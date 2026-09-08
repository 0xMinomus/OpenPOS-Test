import { useSyncExternalStore } from 'react'

// Data layer offline (localStorage penuh, tanpa backend).
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
}

export interface OfflineCategory {
  id: string
  name: string
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
  created_at: string
}

export interface OfflineSettings {
  storeName: string
  address: string
  phone: string
  receiptHeader: string
  receiptFooter: string
  paper: string
  taxEnabled: boolean
  taxPct: number
}

export interface OfflineDB {
  settings: OfflineSettings
  categories: OfflineCategory[]
  products: OfflineProduct[]
  transactions: OfflineTrx[]
  seq: number
}

const KEY = 'op_offline_db'
const VERSION = 1

const emptySettings: OfflineSettings = {
  storeName: 'Toko Saya',
  address: '',
  phone: '',
  receiptHeader: 'Terima kasih sudah berbelanja',
  receiptFooter: 'Barang yang sudah dibeli tidak dapat ditukar',
  paper: '58mm',
  taxEnabled: false,
  taxPct: 0,
}

function defaultDB(): OfflineDB {
  return { settings: { ...emptySettings }, categories: [], products: [], transactions: [], seq: 0 }
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

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ── produk ──────────────────────────────────────────────────────────

export function saveProduct(p: Omit<OfflineProduct, 'id'> & { id?: string }) {
  if (p.id) {
    const i = db.products.findIndex((x) => x.id === p.id)
    if (i >= 0) db.products[i] = { ...db.products[i], ...p, id: p.id }
  } else {
    db.products.push({ ...p, id: uid() } as OfflineProduct)
  }
  commit()
}

export function deleteProduct(id: string) {
  db.products = db.products.filter((p) => p.id !== id)
  commit()
}

export function setProductStock(id: string, stock: number) {
  const p = db.products.find((x) => x.id === id)
  if (p) { p.stock = stock; commit() }
}

// ── kategori ────────────────────────────────────────────────────────

export function saveCategory(name: string): OfflineCategory {
  const c: OfflineCategory = { id: uid(), name }
  db.categories.push(c)
  commit()
  return c
}

export function deleteCategory(id: string) {
  db.categories = db.categories.filter((c) => c.id !== id)
  db.products = db.products.map((p) => (p.categoryId === id ? { ...p, categoryId: null, categoryName: null } : p))
  commit()
}

// ── transaksi ────────────────────────────────────────────────────────

export function addTransaction(t: Omit<OfflineTrx, 'id' | 'created_at'>): OfflineTrx {
  db.seq += 1
  const trx: OfflineTrx = { ...t, id: `TRX-${String(db.seq).padStart(5, '0')}`, created_at: new Date().toISOString() }
  db.transactions.unshift(trx)
  for (const it of t.items) {
    const p = db.products.find((x) => x.id === it.productId)
    if (p) p.stock -= it.qty
  }
  commit()
  return trx
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
