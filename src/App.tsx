import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, BarChart3, Bell, Boxes, CalendarDays, Car, ChevronDown, CircleDollarSign, Dumbbell, Eye, EyeOff, GraduationCap, HeartPulse, Home, LayoutDashboard, LogIn, Moon, MoreHorizontal, PackagePlus, Plus, Receipt, Search, Settings, ShoppingCart, Sparkles, Store, Sun, Ticket, Utensils, Wallet, X } from 'lucide-react'
import './App.css'
import './Workspace.css'
import './AuthLayout.css'
import './AuthLayout.css'

type Expense = { id: number; description: string; category: string; date: string; amount: number; color: string }
type InventoryItem = { id: number; name: string; sku: string; category: string; stock: number; reorderAt: number; value: number; status: 'In stock' | 'Low stock' | 'Out of stock' }
type Sale = { id: string; productId: number; productName: string; sku: string; quantity: number; unitPrice: number; total: number; customerName: string; date: string }
type Supplier = { id: string; name: string; contactPerson: string; email: string; phone: string; address: string }
const initialExpenses: Expense[] = [
  { id: 1, description: 'Wholesale coffee beans', category: 'Inventory', date: 'Today, 09:42', amount: 1840, color: 'mint' },
  { id: 2, description: 'Shop rent - September', category: 'Operations', date: 'Sep 16, 2024', amount: 2200, color: 'lavender' },
  { id: 3, description: 'Social media campaign', category: 'Marketing', date: 'Sep 14, 2024', amount: 480, color: 'peach' },
  { id: 4, description: 'Packaging supplies', category: 'Inventory', date: 'Sep 12, 2024', amount: 365, color: 'sky' },
]
const initialInventory: InventoryItem[] = [
  { id: 1, name: 'House Blend Coffee', sku: 'COF-001', category: 'Coffee', stock: 42, reorderAt: 20, value: 1260, status: 'In stock' },
  { id: 2, name: 'Ceramic Mug - White', sku: 'MER-014', category: 'Merchandise', stock: 8, reorderAt: 12, value: 184, status: 'Low stock' },
  { id: 3, name: 'Cold Brew Bottle', sku: 'DRK-022', category: 'Drinks', stock: 0, reorderAt: 10, value: 0, status: 'Out of stock' },
  { id: 4, name: 'Oat Milk 1L', sku: 'SUP-008', category: 'Supplies', stock: 26, reorderAt: 8, value: 130, status: 'In stock' },
]
const navItems = [{ label: 'Overview', icon: LayoutDashboard }, { label: 'Expenses', icon: Receipt }, { label: 'Inventory', icon: Boxes }, { label: 'Sales', icon: ShoppingCart }, { label: 'Reports', icon: BarChart3 }]
const expenseCategories = [{ name: 'Fixed expenses', icon: Home, color: 'sage' }, { name: 'Shopping', icon: Store, color: 'apricot' }, { name: 'Food', icon: Utensils, color: 'rose' }, { name: 'Medical', icon: HeartPulse, color: 'pink' }, { name: 'Transportation', icon: Car, color: 'lilac' }, { name: 'Fitness', icon: Dumbbell, color: 'blue' }, { name: 'Entertainment', icon: Ticket, color: 'teal' }, { name: 'Family & education', icon: GraduationCap, color: 'olive' }]
const money = (value: number) => `UGX ${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const timeGreeting = (date: Date) => { const hour = date.getHours(); return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening' }
const skuPrefix = (name: string) => {
  const words = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/gi) || []
  const initials = words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join('') : words[0]?.slice(0, 2)
  return (initials || 'PR').toUpperCase().padEnd(2, 'X')
}
type Insight = { type: string; title: string; detail: string }
type AuthUser = { username: string; email: string }

function AuthScreen({ onAuthenticated }: { onAuthenticated: (token: string, user: AuthUser, remember: boolean) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'login' ? { identifier, password } : { username, email, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Authentication failed')
      onAuthenticated(result.token, result.user, remember)
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return <main className={`auth-reference ${theme}`}>
    <aside className="auth-reference-side">
      <div className="ref-brand"><span className="ref-brand-icon"><Boxes size={23} /></span><strong>Ledgerly</strong></div>
      <div className="ref-intro"><h1>Expense Tracker &amp;<br />Inventory Management</h1><p>Smarter control over your expenses, inventory and suppliers, all in one place.</p></div>
      <div className="ref-benefits"><span>Track expenses</span><span>Manage inventory</span><span>Stock alerts</span><span>Reports</span></div>
    </aside>
    <section className="auth-reference-main">
      <button className="ref-theme-toggle" type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}><span>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
      <div className="ref-form-wrap"><h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2><p className="ref-subtitle">{mode === 'login' ? 'Sign in to your expense and inventory dashboard.' : 'Create an account to manage your business.'}</p>
        <form onSubmit={submit} className="ref-form">
          {mode === 'login' ? <div className="ref-field"><label htmlFor="auth-identifier">Username or email</label><input id="auth-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="you@business.com" required /></div> : <><div className="ref-field"><label htmlFor="auth-username">Username</label><input id="auth-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="Choose a username" required /></div><div className="ref-field"><label htmlFor="auth-email">Email</label><input id="auth-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@business.com" required /></div></>}
          <div className="ref-field"><label htmlFor="auth-password">Password</label><div className="ref-password"><input id="auth-password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))} onKeyDown={(event) => setCapsLock(event.getModifierState('CapsLock'))} onBlur={() => setCapsLock(false)} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Enter your password" minLength={8} required /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{capsLock && <p className="ref-caps" role="status">Caps Lock is on.</p>}</div>
          {mode === 'login' && <div className="ref-options"><label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Keep me signed in</label><button type="button" onClick={() => setError('Password reset is not configured yet. Contact your business administrator.')}>Forgot password?</button></div>}
          {error && <p className="ref-error" role="alert">{error}</p>}
          <button className="ref-submit" type="submit" disabled={loading}><span>{loading && <i className="ref-spinner" />}</span>{loading ? 'Signing in...' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        {mode === 'login' && <><div className="ref-or">or</div><button className="ref-google" type="button" disabled title="Google sign-in is not configured"><b>G</b> Continue with Google</button></>}
        <p className="ref-account-switch">{mode === 'login' ? 'New to Ledgerly?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
        <section className="ref-help"><h3>Need help?</h3><p>Can’t sign in or have a question? Contact your workspace administrator.</p></section>
        <nav className="ref-legal" aria-label="Legal links"><a href="#terms">Terms</a><a href="#privacy">Privacy</a><a href="#help">Help centre</a></nav>
      </div>
    </section>
  </main>
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ledgerly_token') || sessionStorage.getItem('ledgerly_token') || '')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => { const stored = localStorage.getItem('ledgerly_user') || sessionStorage.getItem('ledgerly_user'); return stored ? JSON.parse(stored) : null })
  const [now, setNow] = useState(() => new Date())
  const [activeNav, setActiveNav] = useState('Overview')
  const [expenses, setExpenses] = useState(initialExpenses)
  const [inventory, setInventory] = useState(initialInventory)
  const [sales, setSales] = useState<Sale[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [itemName, setItemName] = useState('')
  const [showSaleForm, setShowSaleForm] = useState(false)
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [saleProductId, setSaleProductId] = useState('')
  const [toast, setToast] = useState('')
  const [insights, setInsights] = useState<{ summary: string; insights: Insight[]; provider?: string } | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const filteredInventory = useMemo(() => inventory.filter((item) => `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [inventory, search])
  const filteredExpenses = useMemo(() => expenses.filter((expense) => `${expense.description} ${expense.category} ${expense.date}`.toLowerCase().includes(search.toLowerCase())), [expenses, search])
  const filteredSales = useMemo(() => sales.filter((sale) => `${sale.productName} ${sale.sku} ${sale.customerName} ${sale.date}`.toLowerCase().includes(search.toLowerCase())), [sales, search])
  const filteredSuppliers = useMemo(() => suppliers.filter((supplier) => `${supplier.name} ${supplier.contactPerson} ${supplier.email} ${supplier.phone} ${supplier.address}`.toLowerCase().includes(search.toLowerCase())), [suppliers, search])
  const totalExpenses = useMemo(() => expenses.reduce((total, expense) => total + expense.amount, 0), [expenses])
  const totalSales = useMemo(() => sales.reduce((total, sale) => total + sale.total, 0), [sales])
  const unitsSold = useMemo(() => sales.reduce((total, sale) => total + sale.quantity, 0), [sales])
  const inventoryValue = useMemo(() => inventory.reduce((total, item) => total + item.value, 0), [inventory])
  const stockAlerts = useMemo(() => inventory.filter((item) => item.status !== 'In stock').length, [inventory])
  const categoryTotals = useMemo(() => expenses.reduce<Record<string, number>>((totals, expense) => { totals[expense.category] = (totals[expense.category] || 0) + expense.amount; return totals }, {}), [expenses])
  const outOfStockCount = useMemo(() => inventory.filter((item) => item.stock === 0).length, [inventory])
  const lowStockCount = useMemo(() => inventory.filter((item) => item.stock > 0 && item.stock <= item.reorderAt).length, [inventory])
  const inventoryHealth = inventory.length ? Math.round((inventory.filter((item) => item.status === 'In stock').length / inventory.length) * 100) : 0
  const categoryBreakdown = useMemo(() => Object.entries(categoryTotals).sort(([, a], [, b]) => b - a).map(([name, amount]) => ({ name, amount, percent: totalExpenses ? Math.round((amount / totalExpenses) * 100) : 0 })), [categoryTotals, totalExpenses])
  const availableProducts = useMemo(() => inventory.filter((item) => item.stock > 0), [inventory])
  const selectedSaleProduct = availableProducts.find((item) => String(item.id) === saleProductId)
  const generatedSku = useMemo(() => {
    const prefix = skuPrefix(itemName)
    const usedNumbers = new Set(inventory.flatMap((item) => {
      const suffix = item.sku.startsWith(`${prefix}-`) ? item.sku.slice(prefix.length + 1) : ''
      return /^\d+$/.test(suffix) ? [Number(suffix)] : []
    }))
    let sequence = 1
    while (usedNumbers.has(sequence)) sequence += 1
    return `${prefix}-${String(sequence).padStart(3, '0')}`
  }, [inventory, itemName])
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3000) }
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  useEffect(() => { const clock = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(clock) }, [])
  useEffect(() => { if (!token) return; fetch('/api/data', { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.ok ? response.json() : Promise.reject(new Error('Your session has expired'))).then((data) => { setExpenses(data.expenses.map((expense: Expense) => ({ ...expense, color: expense.color || 'peach' }))); setInventory(data.inventory); setSales(data.sales || []); setSuppliers(data.suppliers || []) }).catch(() => { localStorage.removeItem('ledgerly_token'); localStorage.removeItem('ledgerly_user'); setToken(''); setCurrentUser(null) }) }, [token])
  const handleAuthenticated = (newToken: string, user: AuthUser, remember: boolean) => { localStorage.removeItem('ledgerly_token'); localStorage.removeItem('ledgerly_user'); sessionStorage.removeItem('ledgerly_token'); sessionStorage.removeItem('ledgerly_user'); const storage = remember ? localStorage : sessionStorage; storage.setItem('ledgerly_token', newToken); storage.setItem('ledgerly_user', JSON.stringify(user)); setToken(newToken); setCurrentUser(user) }
  const logout = () => { localStorage.removeItem('ledgerly_token'); localStorage.removeItem('ledgerly_user'); sessionStorage.removeItem('ledgerly_token'); sessionStorage.removeItem('ledgerly_user'); setToken(''); setCurrentUser(null); setInsights(null) }
  const runAnalysis = () => { setAnalysisLoading(true); fetch('/api/analysis', { method: 'POST', headers: authHeaders, body: JSON.stringify({ expenses, inventory }) }).then((response) => response.json()).then(setInsights).catch(() => notify('Unable to run analysis')).finally(() => setAnalysisLoading(false)) }
  const addExpense = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const expense = { description: String(data.get('description') || 'New expense'), category: String(data.get('category') || 'Operations'), amount: Number(data.get('amount')) || 0 }; setExpenses((current) => [{ id: Date.now(), ...expense, date: 'Just now', color: 'peach' }, ...current]); fetch('/api/expenses', { method: 'POST', headers: authHeaders, body: JSON.stringify(expense) }).catch(() => undefined); setShowExpenseForm(false); notify('Expense added to your ledger') }
  const addItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const item = {
      name: itemName.trim(),
      sku: generatedSku,
      category: String(data.get('category') || 'Other'),
      stock: Number(data.get('stock')),
      reorderAt: Number(data.get('reorderAt')),
      value: Number(data.get('value')),
    }

    try {
      if (editingItem) {
        const response = await fetch(`/api/inventory/${editingItem.id}`, { method: 'PUT', headers: authHeaders, body: JSON.stringify(item) })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to update inventory item')
        setInventory((current) => current.map((entry) => entry.id === editingItem.id ? result : entry))
        setShowItemForm(false)
        setEditingItem(null)
        setItemName('')
        notify('Inventory item updated')
        return
      }

      const response = await fetch('/api/inventory', { method: 'POST', headers: authHeaders, body: JSON.stringify(item) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to add inventory item')
      setInventory((current) => [...current, result])
      setShowItemForm(false)
      setItemName('')
      notify(`Inventory item added · SKU ${result.sku}`)
    } catch (itemError) {
      notify(itemError instanceof Error ? itemError.message : 'Unable to add inventory item')
    }
  }
  const openItemForm = () => {
    setEditingItem(null)
    setItemName('')
    setShowItemForm(true)
  }
  const closeItemForm = () => {
    setShowItemForm(false)
    setEditingItem(null)
    setItemName('')
  }
  const addSale = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const sale = {
      productId: Number(data.get('productId')),
      quantity: Number(data.get('quantity')),
      unitPrice: Number(data.get('unitPrice')),
      customerName: String(data.get('customerName') || '').trim(),
    }

    try {
      const response = await fetch('/api/sales', { method: 'POST', headers: authHeaders, body: JSON.stringify(sale) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to record sale')
      setSales((current) => [result.sale, ...current])
      setInventory((current) => current.map((item) => item.id === result.inventory.id ? result.inventory : item))
      setShowSaleForm(false)
      setSaleProductId('')
      notify('Sale recorded and inventory updated')
    } catch (saleError) {
      notify(saleError instanceof Error ? saleError.message : 'Unable to record sale')
    }
  }

  const addSupplier = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const supplier = {
      name: String(data.get('name') || '').trim(),
      contactPerson: String(data.get('contactPerson') || '').trim(),
      email: String(data.get('email') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      address: String(data.get('address') || '').trim(),
    }

    try {
      const response = await fetch('/api/suppliers', { method: 'POST', headers: authHeaders, body: JSON.stringify(supplier) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to add supplier')
      setSuppliers((current) => [result, ...current])
      setShowSupplierForm(false)
      notify('Supplier added')
    } catch (supplierError) {
      notify(supplierError instanceof Error ? supplierError.message : 'Unable to add supplier')
    }
  }

  const deleteSupplier = async (supplier: Supplier) => {
    try {
      const response = await fetch(`/api/suppliers/${encodeURIComponent(supplier.id)}`, { method: 'DELETE', headers: authHeaders })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Unable to remove supplier')
      }
      setSuppliers((current) => current.filter((item) => item.id !== supplier.id))
      notify('Supplier removed')
    } catch (supplierError) {
      notify(supplierError instanceof Error ? supplierError.message : 'Unable to remove supplier')
    }
  }

  const renderWorkspacePage = () => {
    const descriptions: Record<string, string> = {
      Expenses: 'Review and record your business spending.',
      Inventory: 'Track stock levels, product value, and items to reorder.',
      Sales: 'Record sales, track revenue, and keep stock levels up to date.',
      Reports: 'Review spending patterns and business health.',
      Categories: 'See how your expenses are distributed by category.',
      Suppliers: 'Keep your supplier contacts organized in one place.',
      Settings: 'Manage your signed-in workspace account.',
    }

    return <section className="page-view">
      <header className="page-view-heading">
        <div>
          <p className="eyebrow">{activeNav} · Workspace</p>
          <h1>{activeNav}</h1>
          <p className="subheading">{descriptions[activeNav] || 'Workspace details'}</p>
        </div>
        <div className="heading-actions">
          {activeNav === 'Expenses' && <button className="button primary" onClick={() => setShowExpenseForm(true)}><Plus size={17} /> Add expense</button>}
          {activeNav === 'Inventory' && <button className="button primary" onClick={openItemForm}><PackagePlus size={17} /> Add inventory</button>}
          {activeNav === 'Categories' && <button className="button primary" onClick={() => setShowExpenseForm(true)}><Plus size={17} /> Add expense</button>}
          {activeNav === 'Sales' && <button className="button primary" onClick={() => { setSaleProductId(String(availableProducts[0]?.id || '')); setShowSaleForm(true) }} disabled={!availableProducts.length}><Plus size={17} /> Record sale</button>}
          {activeNav === 'Suppliers' && <button className="button primary" onClick={() => setShowSupplierForm(true)}><Plus size={17} /> Add supplier</button>}
        </div>
      </header>

      {activeNav === 'Expenses' && <section className="panel workspace-panel">
        <div className="panel-heading"><div><h2>All expenses</h2><p>{filteredExpenses.length} matching records · Total {money(totalExpenses)}</p></div></div>
        <div className="expense-list">
          {filteredExpenses.length ? filteredExpenses.map((expense) => <div className="expense-row" key={expense.id}>
            <div className={`expense-icon ${expense.color}`}><Receipt size={17} /></div>
            <div className="expense-name"><strong>{expense.description}</strong><span>{expense.category} <b>·</b> {expense.date}</span></div>
            <strong className="expense-amount">-{money(expense.amount)}</strong>
          </div>) : <div className="workspace-empty"><Receipt size={25} /><strong>No matching expenses</strong><span>Try another search or add a new expense.</span></div>}
        </div>
      </section>}

      {activeNav === 'Inventory' && <section className="panel workspace-panel">
        <div className="panel-heading"><div><h2>All inventory</h2><p>{filteredInventory.length} matching products · Total value {money(inventoryValue)}</p></div></div>
        <div className="inventory-table workspace-inventory">
          <div className="table-header"><span>Product</span><span>Stock</span><span>Value</span></div>
          {filteredInventory.length ? filteredInventory.map((item) => <div className="table-row" key={item.id}>
            <div className="table-product"><span className="product-thumb"><Boxes size={16} /></span><span><strong>{item.name}</strong><small>{item.sku} · {item.category}</small></span><button type="button" className="inventory-edit-button" aria-label={`Edit ${item.name} stock and details`} onClick={() => { setEditingItem(item); setItemName(item.name); setShowItemForm(true) }}>Edit stock</button></div>
            <span className={`stock-count ${item.status === 'Low stock' ? 'warning' : item.status === 'Out of stock' ? 'danger' : ''}`}>{item.stock} · {item.status}</span>
            <strong>{money(item.value)}</strong>
          </div>) : <div className="workspace-empty"><Boxes size={25} /><strong>No matching products</strong><span>Try another search or add an inventory item.</span></div>}
        </div>
      </section>}

      {activeNav === 'Reports' && <div className="workspace-report-grid">
        <section className="panel">
          <div className="panel-heading"><div><h2>Expense breakdown</h2><p>Recorded spending by category</p></div></div>
          {categoryBreakdown.length ? <div className="workspace-category-list">{categoryBreakdown.map((category) => <div className="workspace-category-row" key={category.name}>
            <span>{category.name}</span><strong>{money(category.amount)}</strong><small>{category.percent}%</small><i><b style={{ width: `${category.percent}%` }} /></i>
          </div>)}</div> : <div className="workspace-empty"><BarChart3 size={25} /><strong>No report data yet</strong><span>Add expenses to see a spending breakdown.</span></div>}
        </section>
        <section className="panel">
          <div className="panel-heading"><div><h2>Business analysis</h2><p>Recommendations from current expenses and stock.</p></div></div>
          <button className="button primary workspace-analysis-button" onClick={runAnalysis} disabled={analysisLoading}><Sparkles size={15} />{analysisLoading ? 'Analyzing...' : 'Run analysis'}</button>
          {insights && <div className="workspace-insights"><strong>{insights.summary}</strong>{insights.insights.map((insight, index) => <p key={`${insight.title}-${index}`}><b>{insight.title}</b><br />{insight.detail}</p>)}</div>}
        </section>
      </div>}

      {activeNav === 'Categories' && <section className="panel workspace-panel">
        <div className="panel-heading"><div><h2>Expense categories</h2><p>Spending totals based on your recorded expenses.</p></div></div>
        <div className="workspace-category-list">
          {expenseCategories.map(({ name, icon: Icon, color }) => {
            const amount = categoryTotals[name] || 0
            const percent = totalExpenses ? Math.round((amount / totalExpenses) * 100) : 0
            return <div className="workspace-category-row" key={name}>
              <span className={`category-icon ${color}`}><Icon size={16} />{name}</span><strong>{money(amount)}</strong><small>{percent}%</small><i><b style={{ width: `${percent}%` }} /></i>
            </div>
          })}
          {Object.entries(categoryTotals).filter(([name]) => !expenseCategories.some((category) => category.name === name)).map(([name, amount]) => {
            const percent = totalExpenses ? Math.round((amount / totalExpenses) * 100) : 0
            return <div className="workspace-category-row" key={name}><span>{name}</span><strong>{money(amount)}</strong><small>{percent}%</small><i><b style={{ width: `${percent}%` }} /></i></div>
          })}
        </div>
      </section>}

      {activeNav === 'Sales' && <>
        <section className="metric-grid sales-metrics" aria-label="Sales summary">
          <article className="metric-card"><div className="metric-top"><span>Total revenue</span><span className="metric-icon green"><CircleDollarSign size={17} /></span></div><strong>{money(totalSales)}</strong><div className="metric-trend neutral">{sales.length} recorded sales</div></article>
          <article className="metric-card"><div className="metric-top"><span>Units sold</span><span className="metric-icon blue"><Boxes size={17} /></span></div><strong>{unitsSold.toLocaleString()}</strong><div className="metric-trend neutral">Across all products</div></article>
          <article className="metric-card"><div className="metric-top"><span>Products available</span><span className="metric-icon yellow"><ShoppingCart size={17} /></span></div><strong>{availableProducts.length}</strong><div className="metric-trend neutral">Ready to sell</div></article>
        </section>
        <section className="panel workspace-panel">
          <div className="panel-heading"><div><h2>Sales history</h2><p>{filteredSales.length} matching sales · Revenue {money(totalSales)}</p></div></div>
          {filteredSales.length ? <div className="workspace-data-list sales-list">
            <div className="workspace-data-header sales-data-row"><span>Product</span><span>Customer</span><span>Qty</span><span>Total</span><span>Date</span></div>
            {filteredSales.map((sale) => <div className="workspace-data-row sales-data-row" key={sale.id}>
              <span className="workspace-primary-cell"><strong>{sale.productName}</strong><small>{sale.sku} · {money(sale.unitPrice)} each</small></span>
              <span>{sale.customerName || 'Walk-in customer'}</span>
              <span>{sale.quantity}</span>
              <strong>{money(sale.total)}</strong>
              <span>{new Date(sale.date).toLocaleDateString()}</span>
            </div>)}
          </div> : <div className="workspace-empty sales-empty"><ShoppingCart size={25} /><strong>{search ? 'No matching sales' : 'No sales recorded yet'}</strong><span>{search ? 'Try another search.' : availableProducts.length ? 'Record your first sale to track revenue and update stock.' : 'Add inventory with available stock before recording a sale.'}</span>{availableProducts.length > 0 && <button className="button primary" onClick={() => { setSaleProductId(String(availableProducts[0].id)); setShowSaleForm(true) }}><Plus size={16} /> Record sale</button>}</div>}
        </section>
      </>}

      {activeNav === 'Suppliers' && <section className="panel workspace-panel">
        <div className="panel-heading"><div><h2>Supplier directory</h2><p>{filteredSuppliers.length} matching suppliers</p></div></div>
        {filteredSuppliers.length ? <div className="workspace-data-list supplier-list">
          <div className="workspace-data-header supplier-data-row"><span>Supplier</span><span>Contact person</span><span>Email</span><span>Phone</span><span>Address</span><span /></div>
          {filteredSuppliers.map((supplier) => <div className="workspace-data-row supplier-data-row" key={supplier.id}>
            <span className="workspace-primary-cell"><strong>{supplier.name}</strong></span>
            <span>{supplier.contactPerson || '—'}</span>
            <span>{supplier.email || '—'}</span>
            <span>{supplier.phone || '—'}</span>
            <span>{supplier.address || '—'}</span>
            <button type="button" className="supplier-remove" aria-label={`Remove ${supplier.name}`} onClick={() => deleteSupplier(supplier)}><X size={16} /></button>
          </div>)}
        </div> : <div className="workspace-empty supplier-empty"><Store size={25} /><strong>{search ? 'No matching suppliers' : 'No suppliers added yet'}</strong><span>{search ? 'Try another search.' : 'Add supplier contact details to keep your business directory up to date.'}</span><button className="button primary" onClick={() => setShowSupplierForm(true)}><Plus size={16} /> Add supplier</button></div>}
      </section>}

      {activeNav === 'Settings' && <section className="panel workspace-panel settings-panel">
        <div className="panel-heading"><div><h2>Workspace account</h2><p>Signed-in account details and access.</p></div></div>
        <dl><div><dt>Username</dt><dd>{currentUser?.username || 'Business owner'}</dd></div><div><dt>Email</dt><dd>{currentUser?.email || 'Not provided'}</dd></div><div><dt>Workspace</dt><dd>Business workspace</dd></div></dl>
        <button className="button secondary" onClick={logout}><LogIn size={16} /> Log out</button>
      </section>}
    </section>
  }

  if (!token) return <AuthScreen onAuthenticated={handleAuthenticated} />
  return <div className={`app-shell page-${activeNav.toLowerCase()}`}>
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><CircleDollarSign size={20} /></span><span className="brand-copy"><strong>Ledgerly</strong><small>Expense Tracker & Inventory</small></span></div><div className="workspace-switcher"><span className="avatar">{currentUser?.username.slice(0, 2).toUpperCase() || 'BU'}</span><span><strong>{currentUser?.username || 'My business'}</strong><small>Business workspace</small></span><ChevronDown size={15} /></div><nav className="main-nav" aria-label="Main navigation"><p className="nav-label">Workspace</p>{navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => setActiveNav(label)}><Icon size={18} /><span>{label}</span>{label === 'Inventory' && stockAlerts > 0 && <span className="nav-badge">{stockAlerts}</span>}</button>)}<button className={`nav-item ${activeNav === 'Categories' ? 'active' : ''}`} onClick={() => setActiveNav('Categories')}><Ticket size={18} /><span>Categories</span></button><button className={`nav-item ${activeNav === 'Suppliers' ? 'active' : ''}`} onClick={() => setActiveNav('Suppliers')}><ShoppingCart size={18} /><span>Suppliers</span></button><p className="nav-label nav-label-lower">Manage</p><button className={`nav-item ${activeNav === 'Settings' ? 'active' : ''}`} onClick={() => setActiveNav('Settings')}><Settings size={18} /><span>Settings</span></button></nav><section className="sidebar-health"><div className="health-label"><span><i /> Business health</span><span>{inventoryHealth}%</span></div><div className="health-ring" style={{ background: `conic-gradient(#11d6ae ${inventoryHealth}%, #25436a ${inventoryHealth}% 100%)` }}><span><strong>{inventoryHealth}%</strong><small>In stock</small></span></div><div className="health-caption"><ArrowUpRight size={14} /> {inventory.length - stockAlerts}/{inventory.length} products available</div><small className="health-quote">“Better tracking.<br />Smarter decisions.”</small></section><button className="nav-item logout-nav" onClick={logout}><LogIn size={18} /><span>Log out</span></button></aside>
    <main className="main-content"><header className="topbar"><div className="global-search"><Search size={17} /><input placeholder="Search expenses, products, or suppliers..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="header-note"><span className="note-mark">✦</span><span>Consistent tracking<br />leads to greater growth.</span></div><div className="top-actions"><button className="date-pill" title={now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}><CalendarDays size={15} /> {now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</button><button className="icon-button" aria-label="Notifications" onClick={() => notify('You are all caught up')}><Bell size={18} /><i /></button><button className="account-profile" onClick={logout} title="Log out"><span className="top-avatar account-button">{currentUser?.username.slice(0, 2).toUpperCase() || 'BU'}</span><span className="profile-copy"><strong>{currentUser?.username || 'Business owner'}</strong><small>Business owner</small></span><ChevronDown size={14} /></button></div></header><div className="content-wrap">
      <section className="page-heading"><div><p className="eyebrow">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} <span className="current-time">· {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span></p><h1>{timeGreeting(now)}, {currentUser?.username || 'there'} <span>👋</span></h1><p className="subheading">Here is what is happening with your business today.</p></div><div className="heading-actions"><button className="button secondary" onClick={() => setShowExpenseForm(true)}><Plus size={17} /> Add expense</button><button className="button primary" onClick={() => setShowItemForm(true)}><PackagePlus size={17} /> Add inventory</button></div></section>
      <section className="metric-grid reference-metrics" aria-label="Business summary"><article className="metric-card"><div className="metric-top"><span>Total expenses</span><span className="metric-icon green"><Wallet size={17} /></span></div><strong>{money(totalExpenses)}</strong><div className="metric-trend up"><ArrowDownRight size={14} /> {expenses.length} <span>recorded entries</span></div></article><article className="metric-card"><div className="metric-top"><span>Total inventory value</span><span className="metric-icon blue"><Boxes size={17} /></span></div><strong>{money(inventoryValue)}</strong><div className="metric-trend up"><ArrowUpRight size={14} /> {inventory.length} <span>tracked products</span></div></article><article className="metric-card"><div className="metric-top"><span>Expense categories</span><span className="metric-icon violet"><Receipt size={17} /></span></div><strong>{Object.keys(categoryTotals).length}</strong><div className="metric-trend neutral"><span>Categories with recorded spending</span></div></article><article className="metric-card"><div className="metric-top"><span>Stock alerts</span><span className="metric-icon orange"><Boxes size={17} /></span></div><strong>{stockAlerts}</strong><div className="metric-trend down"><ArrowDownRight size={14} /> {outOfStockCount} out of stock <span>· {lowStockCount} low</span></div></article></section>
      <section className="reference-grid"><article className="panel expense-overview"><div className="panel-heading"><div><h2>Expense overview</h2><p>Recorded spending by category</p></div><span className="period-label"><CalendarDays size={14} /> This account</span></div>{categoryBreakdown.length ? <div className="expense-breakdown"><div className="donut-wrap"><div className="expense-donut" style={{ background: `conic-gradient(${categoryBreakdown.map((_, index) => `${['#1677ed', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#64748b'][index % 6]} ${categoryBreakdown.slice(0, index).reduce((sum, previous) => sum + previous.percent, 0)}% ${categoryBreakdown.slice(0, index + 1).reduce((sum, current) => sum + current.percent, 0)}%`).join(', ')})` }}><span><small>Total expenses</small><strong>{money(totalExpenses)}</strong></span></div></div><div className="category-legend">{categoryBreakdown.slice(0, 6).map((item, index) => <div className="legend-row" key={item.name}><i style={{ background: ['#1677ed', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#64748b'][index % 6] }} /><span>{item.name}</span><strong>{money(item.amount)}</strong><small>{item.percent}%</small></div>)}</div></div> : <div className="empty-chart"><Receipt size={25} /><strong>No expenses recorded yet</strong><span>Add an expense to see your category breakdown.</span></div>}</article><article className="panel stock-panel reference-stock"><div className="panel-heading"><div><h2>Inventory stock levels</h2><p>Stock that may need attention</p></div><button className="text-button" onClick={() => setActiveNav('Inventory')}>View all <ArrowUpRight size={14} /></button></div><div className="reference-stock-list">{inventory.slice(0, 6).map((item) => <div className="reference-stock-row" key={item.id}><span className="reference-product-icon"><Boxes size={17} /></span><span className="reference-product"><strong>{item.name}</strong><small>{item.stock} units · {item.sku}</small></span><span className={`table-status ${item.status === 'In stock' ? 'good' : item.status === 'Low stock' ? 'warning' : 'danger'}`}>{item.status}</span></div>)}</div></article><article className="panel quick-actions"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common tasks</p></div></div><button className="quick-action expense-action" onClick={() => setShowExpenseForm(true)}><Plus size={18} /><span><strong>Add expense</strong><small>Record a new expense</small></span></button><button className="quick-action inventory-action" onClick={() => setShowItemForm(true)}><PackagePlus size={18} /><span><strong>Add product</strong><small>Update inventory stock</small></span></button><button className="quick-action reports-action" onClick={runAnalysis}><BarChart3 size={18} /><span><strong>View reports</strong><small>Analyze your business data</small></span></button></article></section>
      <section className="ai-panel panel"><div className="ai-heading"><div className="ai-title"><span className="ai-icon"><Sparkles size={17} /></span><div><h2>AI business analysis</h2><p>Get practical recommendations from your latest expenses and stock levels.</p></div></div><button className="button primary" onClick={runAnalysis} disabled={analysisLoading}><Sparkles size={15} /> {analysisLoading ? 'Analyzing...' : 'Analyze now'}</button></div>{insights ? <div className="insight-grid">{insights.insights.map((insight) => <div className={`insight-card ${insight.type}`} key={insight.title}><strong>{insight.title}</strong><p>{insight.detail}</p></div>)}</div> : <div className="ai-empty">Run an analysis to surface cash-flow patterns, spending concentration, and stock risks. <span>Powered by Ledgerly AI</span></div>}</section>
        <section className="panel category-panel"><div className="panel-heading"><div><h2>Expense planner</h2><p>See how your spending is distributed across business categories.</p></div><button className="text-button" onClick={() => setShowExpenseForm(true)}>Add expense <Plus size={14} /></button></div><div className="category-grid">{expenseCategories.map(({ name, icon: Icon, color }) => <button className={`category-card ${color}`} key={name} onClick={() => setShowExpenseForm(true)}><span className="category-art"><Icon size={19} /></span><span className="category-info"><strong>{name}</strong><small>{money(categoryTotals[name] || 0)}</small></span><ArrowUpRight size={14} /></button>)}</div></section>
      <section className="dashboard-grid"><article className="panel chart-panel"><div className="panel-heading"><div><h2>Cash flow</h2><p>Income and expenses over time</p></div><select aria-label="Cash flow period"><option>Last 6 months</option><option>This year</option></select></div><div className="chart-legend"><span><i className="legend-income" /> Income</span><span><i className="legend-expense" /> Expenses</span></div><div className="chart"><div className="y-axis"><span>UGX 8k</span><span>UGX 6k</span><span>UGX 4k</span><span>UGX 2k</span><span>UGX 0</span></div><div className="chart-area"><div className="grid-lines"><i /><i /><i /><i /><i /></div><svg viewBox="0 0 620 190" preserveAspectRatio="none" role="img" aria-label="Cash flow trend chart"><path className="income-line" d="M0 138 C40 130 55 144 92 111 S143 125 180 89 S235 117 270 68 S320 97 362 80 S410 93 450 49 S505 77 545 32 S584 52 620 19" /><path className="expense-line" d="M0 160 C43 151 55 155 92 132 S142 147 180 116 S235 140 270 119 S320 124 362 101 S410 119 450 91 S500 116 545 85 S585 96 620 75" /><path className="income-fill" d="M0 138 C40 130 55 144 92 111 S143 125 180 89 S235 117 270 68 S320 97 362 80 S410 93 450 49 S505 77 545 32 S584 52 620 19 V190 H0 Z" /></svg><div className="x-axis"><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div></div></div></article>
      <article className="panel stock-panel"><div className="panel-heading"><div><h2>Stock alerts</h2><p>Items that need your attention</p></div><button className="text-button" onClick={() => setActiveNav('Inventory')}>View all <ArrowUpRight size={15} /></button></div><div className="alert-list">{inventory.filter((item) => item.status !== 'In stock').map((item) => <div className="alert-row" key={item.id}><div className={`product-dot ${item.status === 'Out of stock' ? 'red' : 'orange'}`}><Boxes size={16} /></div><div className="alert-name"><strong>{item.name}</strong><span>{item.sku}</span></div><div className={`status ${item.status === 'Out of stock' ? 'out' : 'low'}`}>{item.status}</div><button className="more-button" aria-label={`More options for ${item.name}`}><MoreHorizontal size={17} /></button></div>)}</div><div className="stock-summary"><span><i className="dot red-dot" /> 1 out of stock</span><span><i className="dot orange-dot" /> 2 low stock</span></div></article></section>
      <section className="lower-grid"><article className="panel expense-panel"><div className="panel-heading"><div><h2>Recent expenses</h2><p>Keep an eye on where your money goes</p></div><button className="text-button" onClick={() => setActiveNav('Expenses')}>View all <ArrowUpRight size={15} /></button></div><div className="expense-list">{filteredExpenses.slice(0, 4).map((expense) => <div className="expense-row" key={expense.id}><div className={`expense-icon ${expense.color}`}><Receipt size={17} /></div><div className="expense-name"><strong>{expense.description}</strong><span>{expense.category} <b>•</b> {expense.date}</span></div><strong className="expense-amount">-{money(expense.amount)}</strong></div>)}</div></article><article className="panel inventory-panel"><div className="panel-heading"><div><h2>Inventory snapshot</h2><p>Your most valuable items</p></div><button className="text-button" onClick={() => setActiveNav('Inventory')}>Manage <ArrowUpRight size={15} /></button></div><div className="inventory-table"><div className="table-header"><span>Product</span><span>Stock</span><span>Value</span></div>{filteredInventory.slice(0, 3).map((item) => <div className="table-row" key={item.id}><div className="table-product"><span className="product-thumb"><Boxes size={16} /></span><span><strong>{item.name}</strong><small>{item.category}</small></span></div><span className={`stock-count ${item.status === 'Low stock' ? 'warning' : item.status === 'Out of stock' ? 'danger' : ''}`}>{item.stock} units</span><strong>{money(item.value)}</strong></div>)}</div><div className="table-search"><Search size={16} /><input placeholder="Search expenses and inventory..." value={search} onChange={(event) => setSearch(event.target.value)} /></div></article></section>
      {activeNav !== 'Overview' && renderWorkspacePage()}
    </div></main>
    {showExpenseForm && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowExpenseForm(false)}><form className="modal" onSubmit={addExpense}><div className="modal-header"><div><h2>Add expense</h2><p>Record a new business expense.</p></div><button type="button" className="close-button" onClick={() => setShowExpenseForm(false)} aria-label="Close"><X size={18} /></button></div><label>Description<input name="description" placeholder="e.g. Delivery supplies" required /></label><div className="form-row"><label>Category<select name="category"><option>Fixed expenses</option><option>Shopping</option><option>Food</option><option>Medical</option><option>Transportation</option><option>Fitness</option><option>Entertainment</option><option>Family & education</option><option>Operations</option><option>Inventory</option><option>Marketing</option><option>Payroll</option></select></label><label>Amount<input name="amount" type="number" min="0" step="0.01" placeholder="0.00" required /></label></div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowExpenseForm(false)}>Cancel</button><button className="button primary">Save expense</button></div></form></div>}
    {showItemForm && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeItemForm()}><form className="modal" onSubmit={addItem}><div className="modal-header"><div><h2>{editingItem ? 'Edit inventory item' : 'Add inventory item'}</h2><p>{editingItem ? 'Correct product details or stock levels.' : 'Keep your catalog up to date.'}</p></div><button type="button" className="close-button" onClick={closeItemForm} aria-label="Close"><X size={18} /></button></div><label>Product name<input name="name" value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="e.g. Espresso beans" required /></label><div className="form-row"><label>SKU <span className="optional-label">{editingItem ? 'Stable product code' : 'Auto-generated'}</span><input name="sku" value={editingItem?.sku || generatedSku} readOnly aria-readonly="true" /></label><label>Category<input name="category" defaultValue={editingItem?.category || ''} placeholder="Coffee" required /></label></div><div className="form-row"><label>Units in stock<input name="stock" type="number" min="0" defaultValue={editingItem?.stock} placeholder="0" required /></label><label>Reorder point<input name="reorderAt" type="number" min="0" defaultValue={editingItem?.reorderAt} placeholder="10" required /></label></div><label>Inventory value<input name="value" type="number" min="0" step="0.01" defaultValue={editingItem?.value} placeholder="0.00" required /></label><div className="modal-actions"><button type="button" className="button secondary" onClick={closeItemForm}>Cancel</button><button className="button primary">{editingItem ? 'Save changes' : 'Save item'}</button></div></form></div>}
    {showSaleForm && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowSaleForm(false)}><form className="modal" onSubmit={addSale}><div className="modal-header"><div><h2>Record sale</h2><p>Record revenue and deduct sold units from inventory.</p></div><button type="button" className="close-button" onClick={() => setShowSaleForm(false)} aria-label="Close"><X size={18} /></button></div><label>Product<select name="productId" value={saleProductId} onChange={(event) => setSaleProductId(event.target.value)} required>{availableProducts.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.stock} in stock</option>)}</select></label><div className="form-row"><label>Quantity<input name="quantity" type="number" min="1" max={selectedSaleProduct?.stock || 1} step="1" placeholder="1" required /></label><label>Unit price<input name="unitPrice" type="number" min="0.01" step="0.01" placeholder="0.00" required /></label></div><label>Customer name <span className="optional-label">Optional</span><input name="customerName" maxLength={120} placeholder="Walk-in customer" /></label>{selectedSaleProduct && <p className="form-hint">{selectedSaleProduct.stock} units available. Stock will update when the sale is saved.</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowSaleForm(false)}>Cancel</button><button className="button primary" disabled={!availableProducts.length}>Save sale</button></div></form></div>}
    {showSupplierForm && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowSupplierForm(false)}><form className="modal" onSubmit={addSupplier}><div className="modal-header"><div><h2>Add supplier</h2><p>Save your supplier's contact details.</p></div><button type="button" className="close-button" onClick={() => setShowSupplierForm(false)} aria-label="Close"><X size={18} /></button></div><label>Supplier name<input name="name" maxLength={120} placeholder="e.g. Kampala Coffee Traders" required /></label><label>Contact person<input name="contactPerson" maxLength={120} placeholder="Contact name" /></label><div className="form-row"><label>Email<input name="email" type="email" maxLength={254} placeholder="supplier@business.com" /></label><label>Phone<input name="phone" type="tel" maxLength={40} placeholder="+256 ..." /></label></div><label>Address<input name="address" maxLength={240} placeholder="Supplier location" /></label><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowSupplierForm(false)}>Cancel</button><button className="button primary">Save supplier</button></div></form></div>}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>
}
export default App
