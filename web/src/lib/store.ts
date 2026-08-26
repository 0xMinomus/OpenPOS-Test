import { useEffect, useSyncExternalStore, useState } from 'react'

export type Role = 'admin' | 'cashier'

export interface Account {
  email: string
  name: string
  password: string
  store: string
  role: Role
  active: boolean
  createdAt?: string
  passcode?: string
}

export interface Session {
  email: string
  name: string
  store: string
  role: Role
}

export interface Category {
  id: string
  name: string
  active: boolean
}

export interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  categoryId: string | null
  buyPrice: number
  sellPrice: number
  stock: number
  unit: string
  active: boolean
}

export interface TrxItem {
  productId: string
  name: string
  buyPrice: number
  price: number
  qty: number
}

export type TrxStatus = 'pending' | 'completed' | 'cancelled' | 'refunded'
export type PayMethod = 'Cash' | 'Bank Transfer' | 'QRIS' | 'E-Wallet' | 'Card'

export interface Trx {
  id: string
  seq: number
  cashier: string
  cashierName: string
  items: TrxItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  method: PayMethod
  paid: number
  change: number
  status: TrxStatus
  time: string
  customer: string
}

export interface Refund {
  id: string
  trxId: string
  items: { productId: string; qty: number }[]
  reason: string
  time: string
  by: string
}

export type MovementType = 'sale' | 'refund' | 'adjust' | 'initial'

export interface Movement {
  id: string
  productId: string
  type: MovementType
  qty: number
  reason: string
  time: string
  actor: string
}

export interface Settings {
  storeName: string
  address: string
  phone: string
  taxPct: number
  taxEnabled: boolean
  receiptHeader: string
  receiptFooter: string
  paper: string
  timezone: string
}

export interface DB {
  accounts: Record<string, Account>
  session: Session | null
  categories: Category[]
  products: Product[]
  trx: Trx[]
  refunds: Refund[]
  movements: Movement[]
  seq: number
  settings: Settings
}

const KEY = 'op_db_v1'

function seed(): DB {
  const cat = (name: string): Category => ({ id: uid(), name, active: true })
  const cSembako = cat('Sembako')
  const cMinuman = cat('Minuman')
  const cRumah = cat('Rumah Tangga')
  const prod = (
    name: string, sku: string, categoryId: string | null, buy: number, sell: number, stock: number,
  ): Product => ({ id: uid(), name, sku, barcode: '', categoryId, buyPrice: buy, sellPrice: sell, stock, unit: 'pcs', active: true })

  return {
    accounts: {
      admin: { email: 'admin', name: 'Admin Demo', password: '123', store: 'Toko Demo', role: 'admin', active: true, createdAt: new Date().toISOString() },
    },
    session: null,
    categories: [cSembako, cMinuman, cRumah],
    products: [
      prod('Beras Premium 5 kg', 'BR-001', cSembako.id, 62000, 68000, 24),
      prod('Gula Pasir 1 kg', 'GP-001', cSembako.id, 16000, 17500, 40),
      prod('Minyak Goreng 1 L', 'MG-001', cSembako.id, 18000, 20000, 30),
      prod('Mie Goreng Instan', 'MG-002', cSembako.id, 3200, 3500, 60),
      prod('Kopi Sachet 165 g', 'KP-001', cMinuman.id, 13000, 14000, 25),
      prod('Teh Celup 25 sachet', 'TH-001', cMinuman.id, 9000, 10500, 18),
      prod('Air Mineral 600 ml', 'AM-001', cMinuman.id, 2800, 3000, 48),
      prod('Sabun Mandi 90 g', 'SB-001', cRumah.id, 5500, 6500, 22),
      prod('Detergen 800 g', 'DT-001', cRumah.id, 16000, 18500, 15),
      prod('Shampo Sachet', 'SH-001', cRumah.id, 900, 1000, 80),
    ],
    trx: [],
    refunds: [],
    movements: [],
    seq: 0,
    settings: {
      storeName: 'Toko Demo',
      address: '',
      phone: '',
      taxPct: 0,
      taxEnabled: false,
      receiptHeader: 'Terima kasih sudah berbelanja',
      receiptFooter: 'Barang yang sudah dibeli tidak dapat ditukar',
      paper: '58mm',
      timezone: 'Asia/Makassar',
    },
  }
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    const db = JSON.parse(raw) as DB
if (!db.accounts.admin) {
        db.accounts.admin = { email: 'admin', name: 'Admin Demo', password: '123', store: 'Toko Demo', role: 'admin', active: true, createdAt: new Date().toISOString() }
      }
    return db
  } catch {
    return seed()
  }
}

let db = load()
let version = 0
const subs = new Set<() => void>()

function save() {
  localStorage.setItem(KEY, JSON.stringify(db))
  version++
  subs.forEach((s) => s())
}

export function useDB(): DB {
  useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => version,
  )
  return db
}

export function mutate(fn: (d: DB) => void) {
  fn(db)
  save()
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function fmtRp(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

export function fmtShort(n: number): string {
  if (n >= 1000000) return (n / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'jt'
  if (n >= 1000) return Math.round(n / 1000).toLocaleString('id-ID') + 'rb'
  return String(n)
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isToday(iso: string): boolean {
  return iso.slice(0, 10) === todayStr()
}

export function nextTrxId(db: DB): string {
  db.seq++
  return 'TRX-' + String(db.seq).padStart(4, '0')
}

export function login(email: string, password: string, passcode?: string): Session | null {
  const acc = db.accounts[email]
  if (!acc || !acc.active || acc.password !== password) return null
  if (acc.passcode && acc.passcode !== passcode) return null
  const s: Session = { email: acc.email, name: acc.name, store: acc.store, role: acc.role }
  mutate((d) => { d.session = s })
  return s
}

export function logout() {
  mutate((d) => { d.session = null })
}

export function loginAs(email: string, passcode?: string): boolean {
  const acc = db.accounts[email]
  if (!acc || !acc.active) return false
  if (acc.passcode && acc.passcode !== passcode) return false
  mutate((d) => {
    d.session = { email: acc.email, name: acc.name, store: acc.store, role: acc.role }
  })
  return true
}

export function register(name: string, email: string, password: string, store: string) {
  mutate((d) => {
    d.accounts[email] = { email, name, password, store, role: 'admin', active: true, createdAt: new Date().toISOString() }
    d.session = { email, name, store, role: 'admin' }
    d.settings.storeName = store
  })
}

// ── theme ────────────────────────────────────────────────────────────

export type ThemePref = 'light' | 'dark'

export function applyTheme(pref: ThemePref) {
  document.documentElement.classList.toggle('dark', pref === 'dark')
  localStorage.setItem('op_theme', pref)
}

export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(() => {
    const saved = localStorage.getItem('op_theme')
    return saved === 'light' ? 'light' : 'dark'
  })
  useEffect(() => {
    applyTheme(pref)
  }, [pref])
  return [pref, setPref]
}

export function exportCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}