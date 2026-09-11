// Adapter lokal ber-bentuk API cloud (signature & tipe sama persis dengan
// lib/api.ts) sehingga halaman webapp bisa dipakai 1:1 tanpa backend.
import {
  addTransaction, adjustStock, deleteCategory as dbDeleteCategory, deleteProduct as dbDeleteProduct,
  exportDB, hasAccount, isSkuTaken, refundTransaction, saveCategory, saveProduct, saveSettings,
  setProductActive as dbSetActive, getLocalDB,
} from './localdb'
import type {
  Category, DashboardAdmin, Movement, Page, PayMethod, Product, ReportBundle, StoreSettings, Trx, TrxItem,
} from './api'

export type {
  Category, DashboardAdmin, Movement, Page, PayMethod, Product, ReportBundle, StoreSettings, Trx, TrxItem,
} from './api'

function page<T>(items: T[], f: { page?: number; limit?: number }): Page<T> {
  const page = Math.max(1, f.page ?? 1)
  const limit = Math.min(200, Math.max(1, f.limit ?? 20))
  const start = (page - 1) * limit
  return { items: items.slice(start, start + limit), total: items.length, page, limit }
}

// ── kategori ────────────────────────────────────────────────────────

export function apiListCategories(): Promise<Category[]> {
  return Promise.resolve(getLocalDB().categories.map((c) => ({ ...c })))
}

export function apiCreateCategory(name: string) {
  const db = getLocalDB()
  if (db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return Promise.reject(new Error('Kategori dengan nama itu sudah ada.'))
  }
  const c = saveCategory(name)
  return Promise.resolve({ category: { id: c.id, name: c.name, active: true, created_at: c.created_at } })
}

export function apiDeleteCategory(id: string) {
  dbDeleteCategory(id)
  return Promise.resolve({ soft_deleted: false })
}

// ── produk ──────────────────────────────────────────────────────────

export interface ProductFilter {
  q?: string
  categoryId?: string
  active?: boolean
  page?: number
  limit?: number
}

function toProduct(p: { id: string; name: string; sku: string; categoryId: string | null; categoryName: string | null; buyPrice: number; sellPrice: number; stock: number; unit: string; active: boolean; created_at: string }): Product {
  return {
    id: p.id, category_id: p.categoryId, category_name: p.categoryName, name: p.name, sku: p.sku,
    barcode: '', buy_price: p.buyPrice, sell_price: p.sellPrice, stock: p.stock, unit: p.unit,
    active: p.active, created_at: p.created_at,
  }
}

export function apiListProducts(f: ProductFilter = {}) {
  const db = getLocalDB()
  let items = db.products.map(toProduct)
  const q = (f.q ?? '').trim().toLowerCase()
  if (q) items = items.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q))
  if (f.categoryId) items = items.filter((p) => p.category_id === f.categoryId)
  if (f.active !== undefined) items = items.filter((p) => p.active === f.active)
  return Promise.resolve(page(items, f))
}

export function apiCreateProduct(body: {
  name: string; sku: string; barcode?: string; categoryId?: string | null
  buyPrice?: number; sellPrice: number; stock?: number; unit?: string
}) {
  if (!body.name.trim() || !body.sku.trim()) return Promise.reject(new Error('Nama dan SKU wajib diisi.'))
  if (isSkuTaken(body.sku)) return Promise.reject(new Error('SKU sudah digunakan di toko ini.'))
  saveProduct({
    name: body.name.trim(), sku: body.sku.trim(), categoryId: body.categoryId ?? null,
    buyPrice: body.buyPrice ?? 0, sellPrice: body.sellPrice, stock: body.stock ?? 0,
    unit: body.unit || 'pcs', active: true,
  })
  return Promise.resolve(apiListProducts({ limit: 1 }).then((pg) => pg.items.find((p) => p.sku === body.sku.trim())!))
}

export function apiUpdateProduct(id: string, body: {
  name: string; sku: string; barcode?: string; categoryId?: string | null
  buyPrice?: number; sellPrice: number; unit?: string
}) {
  const db = getLocalDB()
  if (!body.name.trim() || !body.sku.trim()) return Promise.reject(new Error('Nama dan SKU wajib diisi.'))
  if (isSkuTaken(body.sku, id)) return Promise.reject(new Error('SKU sudah digunakan di toko ini.'))
  const cur = db.products.find((p) => p.id === id)
  if (!cur) return Promise.reject(new Error('Produk tidak ditemukan.'))
  saveProduct({
    id, name: body.name.trim(), sku: body.sku.trim(), categoryId: body.categoryId ?? null,
    buyPrice: body.buyPrice ?? cur.buyPrice, sellPrice: body.sellPrice, unit: body.unit || cur.unit,
  })
  return Promise.resolve(toProduct({ ...cur, ...body, name: body.name.trim(), sku: body.sku.trim() }))
}

export function apiSetProductActive(id: string, active: boolean) {
  dbSetActive(id, active)
  return Promise.resolve({ message: 'Status produk diperbarui.' })
}

export function apiDeleteProduct(id: string) {
  dbDeleteProduct(id)
  return Promise.resolve({ message: 'Produk berhasil dihapus.' })
}

// ── stok ────────────────────────────────────────────────────────────

function toMovement(m: { id: string; productId: string; productName: string | null; type: 'sale' | 'refund' | 'adjust' | 'initial'; qty: number; reason: string; actor: string; created_at: string }): Movement {
  return { id: m.id, product_id: m.productId, product_name: m.productName, type: m.type, qty: m.qty, reason: m.reason, actor: m.actor, created_at: m.created_at }
}

export function apiListMovements(f: { type?: string; productId?: string; page?: number; limit?: number } = {}) {
  const db = getLocalDB()
  let items = db.movements.map(toMovement)
  if (f.type) items = items.filter((m) => m.type === f.type)
  if (f.productId) items = items.filter((m) => m.product_id === f.productId)
  return Promise.resolve(page(items, f))
}

export function apiAdjustStock(productId: string, direction: 'plus' | 'minus', qty: number, reason: string) {
  if (!reason.trim()) return Promise.reject(new Error('alasan penyesuaian wajib diisi'))
  const p = adjustStock(productId, direction, qty, reason)
  if (!p) return Promise.reject(new Error('stok tidak boleh negatif'))
  return Promise.resolve({ product: toProduct(p) })
}

// ── transaksi ───────────────────────────────────────────────────────

function toTrx(t: {
  id: string; items: { productId: string; name: string; buyPrice: number; price: number; qty: number }[]
  subtotal: number; discount: number; tax: number; total: number; method: string; paid: number; change: number
  status: 'completed' | 'refunded'; cashier_name: string; created_at: string
}): Trx {
  const items: TrxItem[] = t.items.map((i) => ({ product_id: i.productId, name: i.name, buy_price: i.buyPrice, price: i.price, qty: i.qty }))
  return {
    id: t.id, seq: Number(t.id.replace(/\D/g, '')), cashier_name: t.cashier_name, items,
    subtotal: t.subtotal, discount: t.discount, tax: t.tax, total: t.total, method: t.method,
    paid: t.paid, change: t.change, status: t.status, customer: '', created_at: t.created_at,
  }
}

export function apiCheckout(body: {
  items: { productId: string; qty: number }[]
  discount?: number; method: string; paid?: number; customer?: string
}) {
  const db = getLocalDB()
  if (body.items.length === 0) return Promise.reject(new Error('Keranjang kosong.'))
  const discount = Math.max(0, body.discount ?? 0)
  let subtotal = 0
  const rows: { productId: string; name: string; buyPrice: number; price: number; qty: number }[] = []
  for (const it of body.items) {
    const p = db.products.find((x) => x.id === it.productId)
    if (!p || !p.active) return Promise.reject(new Error('Ada produk yang tidak aktif.'))
    if (p.stock < it.qty) return Promise.reject(new Error('Stok tidak cukup untuk menyelesaikan transaksi.'))
    subtotal += p.sellPrice * it.qty
    rows.push({ productId: p.id, name: p.name, buyPrice: p.buyPrice, price: p.sellPrice, qty: it.qty })
  }
  if (discount > subtotal) return Promise.reject(new Error('Diskon melebihi subtotal.'))
  const taxPct = db.settings.taxEnabled ? db.settings.taxPct : 0
  const tax = Math.round((subtotal - discount) * (taxPct / 100))
  const total = subtotal - discount + tax
  const isCash = body.method === 'Cash'
  const paid = isCash ? (body.paid ?? 0) : 0
  if (isCash && paid < total) return Promise.reject(new Error('Jumlah bayar kurang dari total.'))
  const change = isCash ? paid - total : 0
  const trx = addTransaction({
    items: rows, subtotal, discount, tax, total, method: body.method,
    paid: isCash ? paid : 0, change, status: 'completed', cashier_name: db.settings.ownerName || 'Kasir',
  })
  return Promise.resolve(toTrx(trx))
}

export function apiListTransactions(f: { q?: string; method?: string; date?: string; page?: number; limit?: number } = {}) {
  const db = getLocalDB()
  let items = db.transactions.map(toTrx)
  const q = (f.q ?? '').trim().toLowerCase()
  if (q) items = items.filter((t) => t.id.toLowerCase().includes(q) || t.cashier_name.toLowerCase().includes(q))
  if (f.method) items = items.filter((t) => t.method === f.method)
  if (f.date) items = items.filter((t) => dayKey(t.created_at) === f.date)
  return Promise.resolve(page(items, f))
}

export function apiRefundTransaction(id: string, items: { productId: string; qty: number }[], reason: string) {
  if (!reason.trim()) return Promise.reject(new Error('Alasan refund wajib diisi.'))
  const trx = refundTransaction(id, items, reason)
  if (!trx) return Promise.reject(new Error('Transaksi ini tidak dapat direfund.'))
  return Promise.resolve(toTrx(trx))
}

// ── settings ────────────────────────────────────────────────────────

export function apiGetSettings(): Promise<StoreSettings> {
  const s = getLocalDB().settings
  return Promise.resolve({
    storeName: s.storeName, address: s.address, phone: s.phone,
    taxEnabled: s.taxEnabled, taxPct: s.taxPct,
    receiptHeader: s.receiptHeader, receiptFooter: s.receiptFooter, paper: s.paper, timezone: s.timezone,
    businessType: '', email: '', city: '', province: '', currency: 'IDR', hours: [],
    receiptShowLogo: true, receiptShowCashier: true, receiptShowMethod: true,
    receiptShowTax: true, receiptShowDiscount: true, receiptShowNote: true,
    taxName: '', taxInclusive: false, taxRounding: 'none', taxApplyTo: 'all',
  })
}

export function apiUpdateSettings(s: StoreSettings): Promise<StoreSettings> {
  const db = getLocalDB()
  saveSettings({ ...db.settings, ...s })
  return Promise.resolve(s)
}

// ── dashboard / laporan ─────────────────────────────────────────────

function dayKey(iso: string): string {
  // Bucket tanggal pakai zona lokal perangkat (zona toko), BUKAN slice UTC —
  // slice UTC menggeser transaksi 00:00–07:59 WITA ke hari sebelumnya.
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayKey(): string {
  return dayKey(new Date().toISOString())
}

export function apiGetDashboard(): Promise<DashboardAdmin> {
  const db = getLocalDB()
  const tk = todayKey()
  const todayTrx = db.transactions.filter((t) => t.status === 'completed' && dayKey(t.created_at) === tk)
  const omzet = todayTrx.reduce((n, t) => n + t.total, 0)
  const items_sold = todayTrx.reduce((n, t) => n + t.items.reduce((m, i) => m + i.qty, 0), 0)
  const low_stock = db.products.filter((p) => p.active && p.stock <= 5).length

  const byDay = new Map<string, number>()
  for (const t of db.transactions.filter((x) => x.status === 'completed')) {
    byDay.set(dayKey(t.created_at), (byDay.get(dayKey(t.created_at)) ?? 0) + t.total)
  }
  const sales7 = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    sales7.push({ date: k, omzet: byDay.get(k) ?? 0 })
  }

  const methods = new Map<string, number>()
  for (const t of todayTrx) methods.set(t.method, (methods.get(t.method) ?? 0) + t.total)

  const prodAgg = new Map<string, { qty: number; revenue: number }>()
  for (const t of todayTrx) {
    for (const i of t.items) {
      const e = prodAgg.get(i.productId) ?? { qty: 0, revenue: 0 }
      e.qty += i.qty
      e.revenue += i.price * i.qty
      prodAgg.set(i.productId, e)
    }
  }
  const top_products = [...prodAgg.entries()]
    .map(([product_id, v]) => ({ product_id, name: db.products.find((p) => p.id === product_id)?.name ?? '', qty: v.qty, revenue: v.revenue }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  const recent = todayTrx.slice(0, 5).map((t) => ({ id: t.id, cashier_name: t.cashier_name, total: t.total, status: t.status as Trx['status'], time: t.created_at }))

  return Promise.resolve({
    role: 'admin',
    today: { omzet, trx_count: todayTrx.length, items_sold, low_stock },
    sales7,
    methods: [...methods.entries()].map(([method, total]) => ({ method, total })),
    top_products,
    recent,
  })
}

function periodRange(period: string): [Date, Date] | null {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'today') return [start, new Date(start.getTime() + 86400000)]
  if (period === 'yesterday') return [new Date(start.getTime() - 86400000), start]
  if (period === 'week') {
    const offset = (now.getDay() + 6) % 7
    const s = new Date(start.getTime() - offset * 86400000)
    return [s, new Date(start.getTime() + 86400000)]
  }
  if (period === 'month') return [new Date(start.getFullYear(), start.getMonth(), 1), new Date(start.getFullYear(), start.getMonth() + 1, 1)]
  return null
}

export function apiGetReport(period: string): Promise<ReportBundle> {
  const db = getLocalDB()
  const range = periodRange(period)
  const trxs = db.transactions.filter((t) => {
    if (t.status !== 'completed') return false
    if (!range) return true
    const tms = new Date(t.created_at).getTime()
    return tms >= range[0].getTime() && tms < range[1].getTime()
  })

  const summary = { omzet: 0, trx_count: 0, items_sold: 0, gross_profit: 0 }
  const by_method = new Map<string, number>()
  const by_status = new Map<string, number>()
  const prodAgg = new Map<string, { name: string; sku: string; qty: number; revenue: number; profit: number }>()
  const transactions = []
  for (const t of trxs) {
    let hpp = 0
    for (const i of t.items) {
      hpp += i.buyPrice * i.qty
      summary.items_sold += i.qty
      const e = prodAgg.get(i.productId) ?? { name: i.name, sku: db.products.find((p) => p.id === i.productId)?.sku ?? '', qty: 0, revenue: 0, profit: 0 }
      e.qty += i.qty
      e.revenue += i.price * i.qty
      e.profit += (i.price - i.buyPrice) * i.qty
      prodAgg.set(i.productId, e)
    }
    summary.omzet += t.total
    summary.trx_count += 1
    summary.gross_profit += t.total - hpp
    by_method.set(t.method, (by_method.get(t.method) ?? 0) + t.total)
    by_status.set(t.status, (by_status.get(t.status) ?? 0) + 1)
    transactions.push({
      date: t.created_at, id: t.id, cashier: t.cashier_name, method: t.method,
      total: t.total, hpp, profit: t.total - hpp, status: t.status,
    })
  }
  const stock = db.products.map((p) => ({ name: p.name, sku: p.sku, stock: p.stock, buy_price: p.buyPrice, sell_price: p.sellPrice, stock_value: p.buyPrice * p.stock }))

  return Promise.resolve({
    period,
    summary,
    by_method: [...by_method.entries()].map(([method, total]) => ({ method, total })).sort((a, b) => b.total - a.total),
    by_status: [...by_status.entries()].map(([status, count]) => ({ status, count })),
    products: [...prodAgg.entries()].map(([product_id, v]) => ({ product_id, ...v })).sort((a, b) => b.qty - a.qty),
    transactions,
    stock,
  })
}

// util yang dipakai halaman (kompatibilitas api.ts)
export function fetchAll<T>(pageFn: (page: number) => Promise<Page<T>>): Promise<T[]> {
  return (async () => {
    const out: T[] = []
    for (let p = 1; ; p++) {
      const d = await pageFn(p)
      out.push(...d.items)
      if (out.length >= d.total) break
    }
    return out
  })()
}

export const METHODS: PayMethod[] = ['Cash', 'Bank Transfer', 'QRIS', 'E-Wallet', 'Card']

export function useLocalHasAccount(): boolean {
  return hasAccount()
}

export { exportDB as localExportDB }
