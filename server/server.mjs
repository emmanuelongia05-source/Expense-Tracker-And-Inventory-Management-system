import 'dotenv/config'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
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
  const [expenses, inventory, sales, suppliers] = await Promise.all([
    database.collection('expenses').find({ userId }, { projection: { _id: 0, userId: 0 } }).sort({ id: -1 }).toArray(),
    database.collection('inventory').find({ userId }, { projection: { _id: 0, userId: 0 } }).sort({ id: 1 }).toArray(),
    database.collection('sales').find({ userId }, { projection: { _id: 0, userId: 0 } }).sort({ date: -1 }).toArray(),
    database.collection('suppliers').find({ userId }, { projection: { _id: 0, userId: 0 } }).sort({ name: 1 }).toArray(),
  ])
  return { expenses, inventory, sales, suppliers }
}

function inventorySkuPrefix(name) {
  const words = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/gi) || []
  const initials = words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join('') : words[0]?.slice(0, 2)
  return (initials || 'PR').toUpperCase().padEnd(2, 'X')
}

async function generateInventorySku(userId, name) {
  const prefix = inventorySkuPrefix(name)
  const existingSkus = await database.collection('inventory').distinct('sku', {
    userId,
    sku: { $regex: `^${prefix}-[0-9]+$`, $options: 'i' },
  })
  const usedNumbers = new Set(existingSkus.map((sku) => Number(sku.slice(prefix.length + 1))))
  let sequence = 1
  while (usedNumbers.has(sequence)) sequence += 1
  return `${prefix}-${String(sequence).padStart(3, '0')}`
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

app.get('/api/health', (_request, response) => response.status(database ? 200 : 503).json({ status: database ? 'ok' : 'starting', service: 'ledgerly-api', database: mongoDbName }))
app.use('/api', (request, response, next) => {
  if (request.path === '/health') return next()
  if (!database) return response.status(503).json({ error: 'Database is still connecting. Please try again shortly.' })
  next()
})
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
  const name = String(request.body.name || '').trim()
  const category = String(request.body.category || '').trim()
  const stock = Number(request.body.stock)
  const reorderAt = Number(request.body.reorderAt)
  const value = Number(request.body.value)
  if (!name || name.length > 120 || !category || category.length > 80 || !Number.isSafeInteger(stock) || stock < 0 || !Number.isSafeInteger(reorderAt) || reorderAt < 0 || !Number.isFinite(value) || value < 0) {
    return response.status(400).json({ error: 'Enter a product name, category, non-negative whole-number stock and reorder point, and a valid inventory value.' })
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sku = await generateInventorySku(request.user.sub, name)
    const item = {
      id: Date.now(),
      userId: request.user.sub,
      name,
      sku,
      category,
      stock,
      reorderAt,
      value,
      status: stock === 0 ? 'Out of stock' : stock <= reorderAt ? 'Low stock' : 'In stock',
    }
    try {
      await database.collection('inventory').insertOne(item)
      return response.status(201).json({
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        stock: item.stock,
        reorderAt: item.reorderAt,
        value: item.value,
        status: item.status,
      })
    } catch (error) {
      if (error.code !== 11000) throw error
    }
  }
  return response.status(409).json({ error: 'Unable to generate a unique SKU. Please try again.' })
})
app.put('/api/inventory/:id', requireAuth, async (request, response) => {
  const name = String(request.body.name || '').trim()
  const category = String(request.body.category || '').trim()
  const stock = Number(request.body.stock)
  const reorderAt = Number(request.body.reorderAt)
  const value = Number(request.body.value)
  if (!name || name.length > 120 || !category || category.length > 80 || !Number.isSafeInteger(stock) || stock < 0 || !Number.isSafeInteger(reorderAt) || reorderAt < 0 || !Number.isFinite(value) || value < 0) {
    return response.status(400).json({ error: 'Enter a product name, category, non-negative whole-number stock and reorder point, and a valid inventory value.' })
  }
  const filter = { id: Number(request.params.id), userId: request.user.sub }
  const result = await database.collection('inventory').findOneAndUpdate(
    filter,
    { $set: { name, category, stock, reorderAt, value, status: stock === 0 ? 'Out of stock' : stock <= reorderAt ? 'Low stock' : 'In stock' } },
    { returnDocument: 'after', projection: { _id: 0, userId: 0 } },
  )
  if (!result) return response.status(404).json({ error: 'Inventory item not found.' })
  await database.collection('sales').updateMany(
    { productId: result.id, userId: request.user.sub },
    { $set: { productName: result.name, sku: result.sku } },
  )
  response.json(result)
})

app.get('/api/inventory/:id/restocks', requireAuth, async (request, response) => {
  const productId = Number(request.params.id)
  const userId = request.user.sub
  const product = await database.collection('inventory').findOne({ id: productId, userId }, { projection: { _id: 1 } })
  if (!product) return response.status(404).json({ error: 'Inventory item not found.' })
  const restocks = await database.collection('stockMovements').find(
    { productId, userId, type: 'restock' }, { projection: { _id: 0, userId: 0 } },
  ).sort({ receivedAt: -1, id: -1 }).toArray()
  response.json(restocks)
})
app.post('/api/inventory/:id/restocks', requireAuth, async (request, response) => {
  const productId = Number(request.params.id)
  const quantity = Number(request.body.quantity)
  const unitCost = Number(request.body.unitCost)
  const receivedAt = String(request.body.receivedAt || '')
  const supplierId = String(request.body.supplierId || '')
  const note = String(request.body.note || '').trim()
  const totalCost = Math.round(quantity * unitCost * 100) / 100
  const receivedDate = new Date(`${receivedAt}T00:00:00.000Z`)
  if (!Number.isSafeInteger(productId) || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(totalCost) || totalCost < 0 || totalCost > Number.MAX_SAFE_INTEGER || !/^\d{4}-\d{2}-\d{2}$/.test(receivedAt) || !Number.isFinite(receivedDate.getTime()) || receivedDate.toISOString().slice(0, 10) !== receivedAt || note.length > 300) {
    return response.status(400).json({ error: 'Enter a positive whole-number quantity, valid unit cost and received date, and a note no longer than 300 characters.' })
  }
  const userId = request.user.sub
  const product = await database.collection('inventory').findOne({ id: productId, userId })
  if (!product) return response.status(404).json({ error: 'Inventory item not found.' })
  const currentStock = Number(product.stock)
  const currentValue = Number(product.value || 0)
  if (!Number.isSafeInteger(currentStock) || currentStock < 0 || !Number.isFinite(currentValue) || currentValue < 0 || currentStock + quantity > Number.MAX_SAFE_INTEGER || currentValue + totalCost > Number.MAX_SAFE_INTEGER) {
    return response.status(409).json({ error: 'This restock would exceed the supported inventory quantity or value.' })
  }
  let supplierName = ''
  if (supplierId) {
    const supplier = await database.collection('suppliers').findOne({ id: supplierId, userId }, { projection: { _id: 0, name: 1 } })
    if (!supplier) return response.status(400).json({ error: 'Choose a valid supplier from your supplier list.' })
    supplierName = supplier.name
  }
  const nextStock = { $add: ['$stock', quantity] }
  const inventory = await database.collection('inventory').findOneAndUpdate(
    { id: productId, userId, stock: product.stock, value: product.value },
    [{ $set: {
      stock: nextStock,
      value: { $round: [{ $add: [{ $ifNull: ['$value', 0] }, totalCost] }, 2] },
      status: { $switch: { branches: [
        { case: { $eq: [nextStock, 0] }, then: 'Out of stock' },
        { case: { $lte: [nextStock, '$reorderAt'] }, then: 'Low stock' },
      ], default: 'In stock' } },
    } }],
    { returnDocument: 'after', projection: { _id: 0, userId: 0 } },
  )
  if (!inventory) return response.status(409).json({ error: 'Inventory changed before the restock was saved. Refresh and try again.' })
  const movement = {
    id: randomUUID(), userId, productId, productName: product.name, sku: product.sku,
    type: 'restock', quantity, unitCost, totalCost, supplierId, supplierName,
    receivedAt, note, createdAt: new Date().toISOString(),
  }
  try {
    await database.collection('stockMovements').insertOne(movement)
  } catch (error) {
    try {
      const rolledBackInventory = await changeInventoryForSale(userId, productId, -quantity, -totalCost)
      if (!rolledBackInventory) throw new Error(`Inventory item ${productId} no longer exists`)
    } catch (rollbackError) {
      console.error(`Unable to roll back inventory after failed restock record ${movement.id}:`, rollbackError)
      return response.status(500).json({ error: 'The stock quantity changed, but its restock record and rollback failed. Check inventory before retrying.' })
    }
    console.error(`Unable to save restock record ${movement.id}:`, error)
    return response.status(500).json({ error: 'Unable to save the restock record. Inventory was rolled back; please try again.' })
  }
  response.status(201).json({ inventory, movement: { ...movement, userId: undefined } })
})

app.post('/api/sales', requireAuth, async (request, response) => {
  const productId = Number(request.body.productId)
  const quantity = Number(request.body.quantity)
  const unitPrice = Number(request.body.unitPrice)
  const customerName = String(request.body.customerName || '').trim().slice(0, 120)
  const total = quantity * unitPrice
  if (!Number.isSafeInteger(productId) || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER) {
    return response.status(400).json({ error: 'Choose a product, enter a positive whole-number quantity, and enter a price greater than zero.' })
  }

  const userId = request.user.sub
  const product = await database.collection('inventory').findOne({ id: productId, userId })
  if (!product) return response.status(404).json({ error: 'Inventory item not found.' })
  if (product.stock < quantity) return response.status(409).json({ error: `Only ${product.stock} units of ${product.name} are in stock.` })

  const sale = {
    id: randomUUID(),
    userId,
    productId,
    productName: product.name,
    sku: product.sku,
    quantity,
    unitPrice,
    total: Math.round(total * 100) / 100,
    customerName,
    date: new Date().toISOString(),
  }
  await database.collection('sales').insertOne(sale)

  let updatedInventory
  const remainingStock = { $subtract: ['$stock', quantity] }
  const remainingValue = { $max: [0, { $subtract: ['$value', { $multiply: [{ $divide: ['$value', '$stock'] }, quantity] }] }] }
  try {
    updatedInventory = await database.collection('inventory').findOneAndUpdate(
      { id: productId, userId, stock: { $gte: quantity } },
      [{ $set: {
        stock: remainingStock,
        value: { $round: [remainingValue, 2] },
        status: {
          $switch: {
            branches: [
              { case: { $eq: [remainingStock, 0] }, then: 'Out of stock' },
              { case: { $lte: [remainingStock, '$reorderAt'] }, then: 'Low stock' },
            ],
            default: 'In stock',
          },
        },
      } }],
      { returnDocument: 'after', projection: { _id: 0, userId: 0 } },
    )
  } catch (error) {
    await database.collection('sales').deleteOne({ id: sale.id, userId }).catch((rollbackError) => {
      console.error('Unable to roll back sale after inventory update failed:', rollbackError)
    })
    console.error('Unable to update inventory for sale:', error)
    return response.status(500).json({ error: 'Unable to update inventory for this sale.' })
  }

  if (!updatedInventory) {
    try {
      await database.collection('sales').deleteOne({ id: sale.id, userId })
    } catch (error) {
      console.error('Unable to roll back sale after stock changed:', error)
      return response.status(500).json({ error: 'Unable to confirm this sale. Refresh sales and inventory before retrying.' })
    }
    return response.status(409).json({ error: 'Stock changed before the sale could be recorded. Refresh and try again.' })
  }
  response.status(201).json({ sale: { ...sale, userId: undefined }, inventory: updatedInventory })
})
app.post('/api/suppliers', requireAuth, async (request, response) => {
  const name = String(request.body.name || '').trim()
  const contactPerson = String(request.body.contactPerson || '').trim()
  const email = String(request.body.email || '').trim().toLowerCase()
  const phone = String(request.body.phone || '').trim()
  const address = String(request.body.address || '').trim()
  if (!name || name.length > 120 || contactPerson.length > 120 || email.length > 254 || phone.length > 40 || address.length > 240) {
    return response.status(400).json({ error: 'Enter a supplier name and keep contact details within the allowed lengths.' })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({ error: 'Enter a valid supplier email address.' })
  }

  const supplier = { id: randomUUID(), userId: request.user.sub, name, contactPerson, email, phone, address }
  await database.collection('suppliers').insertOne(supplier)
  response.status(201).json({ id: supplier.id, name, contactPerson, email, phone, address })
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
app.delete('/api/suppliers/:id', requireAuth, async (request, response) => {
  const result = await database.collection('suppliers').deleteOne({ id: request.params.id, userId: request.user.sub })
  if (!result.deletedCount) return response.status(404).json({ error: 'Supplier not found.' })
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

async function connectDatabase() {
  if (!mongoUri) {
    console.error('MONGODB_URI is required. Set it to your MongoDB Atlas connection string in Render environment variables.')
    return
  }
  if (!jwtSecret) {
    console.error('JWT_SECRET is required. Set a strong secret in Render environment variables.')
    return
  }

  const client = new MongoClient(mongoUri, { maxPoolSize: 10, minPoolSize: 0, serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 })
  try {
    await client.connect()
    const connectedDatabase = client.db(mongoDbName)
    await connectedDatabase.collection('inventory').dropIndex('sku_1').catch(() => undefined)
    await Promise.all([
      connectedDatabase.collection('users').createIndex({ username: 1 }, { unique: true }),
      connectedDatabase.collection('users').createIndex({ email: 1 }, { unique: true }),
      connectedDatabase.collection('expenses').createIndex({ userId: 1, category: 1 }),
      connectedDatabase.collection('expenses').createIndex({ id: -1 }, { unique: true }),
      connectedDatabase.collection('inventory').createIndex({ userId: 1, sku: 1 }, { unique: true }),
      connectedDatabase.collection('inventory').createIndex({ stock: 1, reorderAt: 1 }),
      connectedDatabase.collection('stockMovements').createIndex({ userId: 1, productId: 1, receivedAt: -1 }),
      connectedDatabase.collection('stockMovements').createIndex({ userId: 1, id: 1 }, { unique: true }),
      connectedDatabase.collection('sales').createIndex({ userId: 1, date: -1 }),
      connectedDatabase.collection('sales').createIndex({ userId: 1, id: 1 }, { unique: true }),
      connectedDatabase.collection('suppliers').createIndex({ userId: 1, name: 1 }),
      connectedDatabase.collection('suppliers').createIndex({ userId: 1, id: 1 }, { unique: true }),
    ])
    mongoClient = client
    database = connectedDatabase
    console.log(`MongoDB connected: database ${mongoDbName}`)
  } catch (error) {
    await client.close().catch(() => undefined)
    console.error(`MongoDB connection failed: ${error.message}`)
    console.error('Check MONGODB_URI and Atlas Network Access. Retrying in 15 seconds.')
    setTimeout(connectDatabase, 15000).unref()
  }
}

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Ledgerly API listening on 0.0.0.0:${port}`)
  connectDatabase()
})

function shutdown() {
  server.close(() => mongoClient?.close().finally(() => process.exit(0)))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
