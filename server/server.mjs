import 'dotenv/config'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataPath = path.join(__dirname, 'data.json')
const app = express()
const port = Number(process.env.PORT || 8787)
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true'
const mongoUri = process.env.MONGODB_URI || (isProduction ? '' : 'mongodb://127.0.0.1:27017')
const mongoDbName = process.env.MONGODB_DB || 'ledgerly'
const jwtSecret = process.env.JWT_SECRET || (isProduction ? '' : 'local-development-secret-change-me')
let mongoClient
let database

app.use(cors())
app.use(express.json())
const frontendPath = path.join(__dirname, '../dist')

async function seedUserData(userId, claimLegacy = false) {
  const [expenseCount, inventoryCount, userExpenseCount, userInventoryCount] = await Promise.all([
    database.collection('expenses').countDocuments(),
    database.collection('inventory').countDocuments(),
    database.collection('expenses').countDocuments({ userId }),
    database.collection('inventory').countDocuments({ userId }),
  ])
  if (claimLegacy && (expenseCount || inventoryCount)) {
    await Promise.all([
      database.collection('expenses').updateMany({ userId: { $exists: false } }, { $set: { userId } }),
      database.collection('inventory').updateMany({ userId: { $exists: false } }, { $set: { userId } }),
    ])
    return
  }
  if (userExpenseCount || userInventoryCount) return
  const seed = JSON.parse(await fs.readFile(dataPath, 'utf8'))
  await Promise.all([
    database.collection('expenses').insertMany(seed.expenses.map((expense) => ({ ...expense, userId }))),
    database.collection('inventory').insertMany(seed.inventory.map((item) => ({ ...item, userId }))),
  ])
}

function issueToken(user) {
  return jwt.sign({ sub: user._id.toString(), username: user.username, email: user.email }, jwtSecret, { expiresIn: '7d' })
}

function requireAuth(request, response, next) {
  const authorization = request.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return response.status(401).json({ error: 'Authentication required' })
  try {
    request.user = jwt.verify(token, jwtSecret)
    next()
  } catch {
    return response.status(401).json({ error: 'Session expired or invalid' })
  }
}

async function readData(userId) {
  const [expenses, inventory] = await Promise.all([
    database.collection('expenses').find({ userId }, { projection: { _id: 0, userId: 0 } }).sort({ id: -1 }).toArray(),
    database.collection('inventory').find({ userId }, { projection: { _id: 0, userId: 0 } }).sort({ id: 1 }).toArray(),
  ])
  return { expenses, inventory }
}

function buildInsights(data) {
  const expenses = data.expenses || []
  const inventory = data.inventory || []
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const inventoryValue = inventory.reduce((sum, item) => sum + Number(item.value || 0), 0)
  const lowStock = inventory.filter((item) => item.stock > 0 && item.stock <= item.reorderAt)
  const outOfStock = inventory.filter((item) => item.stock === 0)
  const byCategory = expenses.reduce((categories, expense) => {
    categories[expense.category] = (categories[expense.category] || 0) + Number(expense.amount || 0)
    return categories
  }, {})
  const largestCategory = Object.entries(byCategory).sort(([, first], [, second]) => second - first)[0]
  const insights = []

  if (outOfStock.length > 0) {
    insights.push({ type: 'urgent', title: `${outOfStock.length} product${outOfStock.length > 1 ? 's' : ''} out of stock`, detail: `Reorder ${outOfStock.map((item) => item.name).join(', ')} to avoid missed sales.` })
  }
  if (lowStock.length > 0) {
    insights.push({ type: 'watch', title: `${lowStock.length} low-stock item${lowStock.length > 1 ? 's' : ''}`, detail: `${lowStock.map((item) => item.name).join(', ')} ${lowStock.length > 1 ? 'are' : 'is'} below the reorder point.` })
  }
  if (largestCategory) {
    insights.push({ type: 'money', title: `${largestCategory[0]} is your largest expense`, detail: `You have recorded UGX ${Number(largestCategory[1]).toLocaleString('en-US', { maximumFractionDigits: 2 })} in this category across the current ledger.` })
  }
  insights.push({ type: 'signal', title: 'Healthy operating picture', detail: `Your ledger contains UGX ${totalExpenses.toLocaleString('en-US', { maximumFractionDigits: 2 })} in expenses and UGX ${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 2 })} in tracked stock value.` })
  return { summary: `I found ${insights.length - 1} action point${insights.length - 1 === 1 ? '' : 's'} worth reviewing today.`, insights, provider: 'local-business-rules' }
}

async function generateAiInsights(data) {
  if (!process.env.OPENAI_API_KEY) return buildInsights(data)
  const prompt = `You are a practical small-business finance analyst. Review this JSON and return exactly 3 concise recommendations as JSON with keys summary and insights. Each insight must have type (urgent, watch, money, or signal), title, and detail. Do not invent data. JSON: ${JSON.stringify(data)}`
  const response = await fetch(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!response.ok) throw new Error(`AI provider returned ${response.status}`)
  const result = await response.json()
  return { ...JSON.parse(result.choices[0].message.content), provider: 'openai' }
}

app.get('/api/health', (_request, response) => response.json({ status: database ? 'ok' : 'starting', service: 'ledgerly-api', database: mongoDbName }))
app.post('/api/auth/register', async (request, response) => {
  const username = String(request.body.username || '').trim().toLowerCase()
  const email = String(request.body.email || '').trim().toLowerCase()
  const password = String(request.body.password || '')
  if (username.length < 3 || !email.includes('@') || password.length < 8) return response.status(400).json({ error: 'Use a username with 3+ characters, a valid email, and a password with 8+ characters.' })
  try {
    const passwordHash = await bcrypt.hash(password, 12)
    const result = await database.collection('users').insertOne({ username, email, passwordHash, createdAt: new Date() })
    const user = { _id: result.insertedId, username, email }
    const userCount = await database.collection('users').countDocuments()
    await seedUserData(user._id.toString(), userCount === 1)
    response.status(201).json({ token: issueToken(user), user: { username, email } })
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'Username or email is already registered.' })
    response.status(500).json({ error: 'Unable to create account.' })
  }
})
app.post('/api/auth/login', async (request, response) => {
  const identifier = String(request.body.identifier || '').trim().toLowerCase()
  const password = String(request.body.password || '')
  const user = await database.collection('users').findOne({ $or: [{ username: identifier }, { email: identifier }] })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return response.status(401).json({ error: 'Invalid username/email or password.' })
  response.json({ token: issueToken(user), user: { username: user.username, email: user.email } })
})
app.get('/api/auth/me', requireAuth, async (request, response) => response.json({ username: request.user.username, email: request.user.email }))
app.get('/api/data', requireAuth, async (request, response) => response.json(await readData(request.user.sub)))
app.post('/api/expenses', requireAuth, async (request, response) => {
  const expense = { id: Date.now(), userId: request.user.sub, date: 'Just now', ...request.body, amount: Number(request.body.amount) || 0 }
  await database.collection('expenses').insertOne(expense)
  response.status(201).json(expense)
})
app.post('/api/inventory', requireAuth, async (request, response) => {
  const stock = Number(request.body.stock) || 0
  const reorderAt = Number(request.body.reorderAt) || 0
  const item = { id: Date.now(), userId: request.user.sub, ...request.body, stock, reorderAt, value: Number(request.body.value) || 0, status: stock === 0 ? 'Out of stock' : stock <= reorderAt ? 'Low stock' : 'In stock' }
  await database.collection('inventory').insertOne(item)
  response.status(201).json(item)
})
app.delete('/api/expenses/:id', requireAuth, async (request, response) => {
  const result = await database.collection('expenses').deleteOne({ id: Number(request.params.id), userId: request.user.sub })
  if (!result.deletedCount) return response.status(404).json({ error: 'Expense not found' })
  response.status(204).end()
})
app.delete('/api/inventory/:id', requireAuth, async (request, response) => {
  const result = await database.collection('inventory').deleteOne({ id: Number(request.params.id), userId: request.user.sub })
  if (!result.deletedCount) return response.status(404).json({ error: 'Inventory item not found' })
  response.status(204).end()
})
app.post('/api/analysis', requireAuth, async (request, response) => {
  try { response.json(await generateAiInsights(request.body)) } catch (error) { response.status(502).json({ error: error.message, fallback: buildInsights(request.body) }) }
})

app.use(express.static(frontendPath))
app.use((request, response, next) => {
  if (request.path.startsWith('/api')) return next()
  response.sendFile(path.join(frontendPath, 'index.html'))
})

async function start() {
  if (!mongoUri) throw new Error('MONGODB_URI is required in production. Set it to your MongoDB Atlas connection string in Render environment variables.')
  if (!jwtSecret) throw new Error('JWT_SECRET is required in production. Set a strong secret in Render environment variables.')
  mongoClient = new MongoClient(mongoUri, { maxPoolSize: 10, minPoolSize: 0, serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 })
  await mongoClient.connect()
  database = mongoClient.db(mongoDbName)
  await database.collection('inventory').dropIndex('sku_1').catch(() => undefined)
  await Promise.all([
      database.collection('users').createIndex({ username: 1 }, { unique: true }),
      database.collection('users').createIndex({ email: 1 }, { unique: true }),
      database.collection('expenses').createIndex({ userId: 1, category: 1 }),
      database.collection('expenses').createIndex({ id: -1 }, { unique: true }),
      database.collection('inventory').createIndex({ userId: 1, sku: 1 }, { unique: true }),
    database.collection('inventory').createIndex({ stock: 1, reorderAt: 1 }),
  ])
  app.listen(port, () => console.log(`Ledgerly API running at http://localhost:${port} using MongoDB database ${mongoDbName}`))
}

start().catch((error) => {
  console.error(`Unable to connect to MongoDB at ${mongoUri}`)
  console.error(error.message)
  process.exitCode = 1
})
