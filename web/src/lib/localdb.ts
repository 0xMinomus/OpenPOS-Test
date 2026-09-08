import { useSyncExternalStore } from 'react'

// Data layer OFFLINE (localStorage penuh, tanpa backend).
// Satu blok JSON; setiap mutasi mem-bump versi agar UI re-render.
// ponytail: satu kunci localStorage — cukup untuk skala warung;
// upgrade bila data > ~5MB: pindah ke IndexedDB.

export interface OfflineProduct {
  id: string
  name: string
  sku: string
  categoryId: string | null
  categoryName: string | null
  buyPrice: number
  sellPrice: number
  stock: number
  unit: string
  active: boolean
  created_at: string
}

export interface OfflineCategory {
  id: string
  name: string
  active: boolean
  created_at: string
}

export interface OfflineItem {
  productId: string
  name: string
  buyPrice: number
  price: number
  qty: number
}

export interface OfflineTrx {
  id: string
  items: OfflineItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  method: string
  paid: number
  change: number
  status: 'completed' | 'refunded'
  cashier_name: string
  created_at: string
}

export interface OfflineMovement {
  id: string
  productId: string
  productName: string | null
  type: 'sale' | 'refund' | 'adjust' | 'initial'
  qty: number
  reason: string
  actor: string
  created_at: string
}

export interface OfflineSettings {
  ownerName: string
  storeName: string
  address: string
  phone: string
  receiptHeader: string
  receiptFooter: string
  paper: string
  timezone: string
  taxEnabled: boolean
  taxPct: number
}

export interface OfflineDB {
  settings: OfflineSettings
  categories: OfflineCategory[]
  products: OfflineProduct[]
  transactions: OfflineTrx[]
  movements: OfflineMovement[]
  seq: number
}

const KEY = 'op_offline_db'
const VERSION = 1

const emptySettings: OfflineSettings = {
  ownerName: '',
  storeName: '',
  address: '',
  phone: '',
  receiptHeader: 'Terima kasih sudah berbelanja',
  receiptFooter: 'Barang yang sudah dibeli tidak dapat ditukar',
  paper: '58mm',
  timezone: 'Asia/Jakarta',
  taxEnabled: false,
  taxPct: 0,
}

function defaultDB(): OfflineDB {
  return {
    settings: { ...emptySettings },
    categories: [],
    products: [],
    transactions: [],
    movements: [],
    seq: 0,
  }
}

let db: OfflineDB = load()
let version = 0
const subs = new Set<() => void>()

function load(): OfflineDB {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultDB()
    const parsed = JSON.parse(raw) as OfflineDB
    return { ...defaultDB(), ...parsed, settings: { ...emptySettings, ...(parsed.settings ?? {}) } }
  } catch {
    return defaultDB()
  }
}

function commit() {
  version++
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // penuh/tak tersedia — data tetap di memori sesi ini
  }
  subs.forEach((cb) => cb())
}

export function useLocalDB(): OfflineDB {
  useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => version,
  )
  return db
}

// Pembaca non-hook (untuk fungsi biasa / adapter API offline).
export function getLocalDB(): OfflineDB {
  return db
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ── akun / onboarding ───────────────────────────────────────────────

export function hasAccount(): boolean {
  return !!db.settings.storeName && !!db.settings.ownerName
}

export function createAccount(ownerName: string, storeName: string) {
  db.settings = { ...db.settings, ownerName, storeName }
  commit()
}

// ── produk ──────────────────────────────────────────────────────────

export function saveProduct(p: Partial<OfflineProduct> & { id?: string }) {
  if (p.id) {
    const i = db.products.findIndex((x) => x.id === p.id)
    if (i >= 0) {
      const cur = db.products[i]
      const next = {
        ...cur, ...p,
        id: p.id,
        categoryName: p.categoryId ? db.categories.find((c) => c.id === p.categoryId)?.name ?? null : null,
      } as OfflineProduct
      db.products[i] = next
    }
  } else {
    const base: OfflineProduct = {
      id: uid(), name: '', sku: '', categoryId: null, categoryName: null,
      buyPrice: 0, sellPrice: 0, stock: 0, unit: 'pcs', active: true, created_at: new Date().toISOString(),
    }
    db.products.push({
      ...base, ...p,
      id: base.id,
      categoryName: p.categoryId ? db.categories.find((c) => c.id === p.categoryId)?.name ?? null : null,
    } as OfflineProduct)
  }
  commit()
}

export function deleteProduct(id: string) {
  db.products = db.products.filter((p) => p.id !== id)
  commit()
}

export function setProductActive(id: string, active: boolean) {
  const p = db.products.find((x) => x.id === id)
  if (p) { p.active = active; commit() }
}

export function setProductStock(id: string, stock: number) {
  const p = db.products.find((x) => x.id === id)
  if (p) { p.stock = stock; commit() }
}

export function isSkuTaken(sku: string, excludeId?: string): boolean {
  return db.products.some((p) => p.sku.toLowerCase() === sku.toLowerCase() && p.id !== excludeId)
}

// ── kategori ────────────────────────────────────────────────────────

export function saveCategory(name: string): OfflineCategory {
  const c: OfflineCategory = { id: uid(), name, active: true, created_at: new Date().toISOString() }
  db.categories.push(c)
  commit()
  return c
}

export function deleteCategory(id: string) {
  db.categories = db.categories.filter((c) => c.id !== id)
  db.products = db.products.map((p) => (p.categoryId === id ? { ...p, categoryId: null, categoryName: null } : p))
  commit()
}

// ── transaksi ───────────────────────────────────────────────────────

export function addTransaction(t: Omit<OfflineTrx, 'id' | 'created_at'>): OfflineTrx {
  db.seq += 1
  const trx: OfflineTrx = { ...t, id: `TRX-${String(db.seq).padStart(5, '0')}`, created_at: new Date().toISOString() }
  db.transactions.unshift(trx)
  for (const it of t.items) {
    const p = db.products.find((x) => x.id === it.productId)
    if (p) p.stock -= it.qty
    db.movements.unshift({
      id: uid(), productId: it.productId, productName: it.name, type: 'sale',
      qty: -it.qty, reason: trx.id, actor: trx.cashier_name, created_at: trx.created_at,
    })
  }
  commit()
  return trx
}

export function refundTransaction(id: string, items: { productId: string; qty: number }[], reason: string): OfflineTrx | null {
  const trx = db.transactions.find((t) => t.id === id)
  if (!trx || trx.status !== 'completed') return null
  for (const it of items) {
    const sold = trx.items.find((x) => x.productId === it.productId)
    if (!sold || it.qty > sold.qty) return null
    const p = db.products.find((x) => x.id === it.productId)
    if (p) p.stock += it.qty
    db.movements.unshift({
      id: uid(), productId: it.productId, productName: sold.name, type: 'refund',
      qty: it.qty, reason, actor: db.settings.ownerName || 'Kasir', created_at: new Date().toISOString(),
    })
  }
  trx.status = 'refunded'
  commit()
  return trx
}

// ── stok / movement ─────────────────────────────────────────────────

export function adjustStock(productId: string, direction: 'plus' | 'minus', qty: number, reason: string): OfflineProduct | null {
  const p = db.products.find((x) => x.id === productId)
  if (!p) return null
  const delta = direction === 'plus' ? qty : -qty
  if (p.stock + delta < 0) return null
  p.stock += delta
  db.movements.unshift({
    id: uid(), productId, productName: p.name, type: 'adjust',
    qty: delta, reason, actor: db.settings.ownerName || 'Kasir', created_at: new Date().toISOString(),
  })
  commit()
  return p
}

// ── settings ─────────────────────────────────────────────────────────

export function saveSettings(s: OfflineSettings) {
  db.settings = s
  commit()
}

// ── backup / restore ────────────────────────────────────────────────

export function exportDB(): string {
  return JSON.stringify(
    { app: 'openpos-offline', version: VERSION, exportedAt: new Date().toISOString(), data: db },
    null,
    2,
  )
}

export function validateImport(raw: string): OfflineDB | null {
  try {
    const parsed = JSON.parse(raw) as { app?: string; data?: OfflineDB }
    if (parsed.app !== 'openpos-offline' || !parsed.data) return null
    if (!Array.isArray(parsed.data.products) || !Array.isArray(parsed.data.transactions) || !Array.isArray(parsed.data.categories)) return null
    return { ...defaultDB(), ...parsed.data, settings: { ...emptySettings, ...(parsed.data.settings ?? {}) } }
  } catch {
    return null
  }
}

export function replaceDB(next: OfflineDB) {
  db = next
  commit()
}

export function resetDB() {
  db = defaultDB()
  commit()
}
