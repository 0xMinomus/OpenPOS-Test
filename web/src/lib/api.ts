import { useEffect, useState } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? '/api/v1'
const ACCESS_KEY = 'op_access'
const REFRESH_KEY = 'op_refresh'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, message: string, code = '') {
    super(message)
    this.status = status
    this.code = code
  }
}

export function getToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function hasToken(): boolean {
  return !!getToken()
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

function saveTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
}

let refreshing: Promise<string> | null = null

async function refreshTokens(): Promise<string> {
  if (!refreshing) {
    refreshing = (async () => {
      const rt = localStorage.getItem(REFRESH_KEY)
      if (!rt) throw new ApiError(401, 'Sesi berakhir. Silakan masuk kembali.')
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        clearTokens()
        throw new ApiError(401, data.error ?? 'Sesi berakhir. Silakan masuk kembali.')
      }
      saveTokens(data.access_token, data.refresh_token)
      return data.access_token as string
    })()
    try {
      await refreshing
    } finally {
      refreshing = null
    }
  }
  return refreshing!
}

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  let token = auth ? getToken() : null
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (res.status === 401 && attempt === 0 && token && !path.startsWith('/auth/')) {
      token = await refreshTokens()
      continue
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(res.status, data.error ?? 'Terjadi kesalahan.', data.error ?? '')
    return data as T
  }
  throw new ApiError(401, 'Sesi berakhir. Silakan masuk kembali.')
}

// ── tipe server (snake_case) ─────────────────────────────────────────

export type Role = 'admin' | 'cashier'
export type PayMethod = 'Cash' | 'Bank Transfer' | 'QRIS' | 'E-Wallet' | 'Card'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  active: boolean
  store_id: string
  store_name: string
  created_at: string
}

export interface AuthResp {
  access_token: string
  refresh_token: string
  user: User
}

export interface Category {
  id: string
  name: string
  active: boolean
  created_at: string
}

export interface Product {
  id: string
  category_id: string | null
  category_name: string | null
  name: string
  sku: string
  barcode: string
  buy_price: number
  sell_price: number
  stock: number
  unit: string
  active: boolean
  created_at: string
}

export interface TrxItem {
  product_id: string
  name: string
  buy_price: number
  price: number
  qty: number
}

export interface Trx {
  id: string
  seq: number
  cashier_name: string
  items: TrxItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  method: string
  paid: number
  change: number
  status: 'completed' | 'pending' | 'cancelled' | 'refunded'
  customer: string
  time: string
}

export interface Movement {
  id: string
  product_id: string
  product_name: string | null
  type: 'sale' | 'refund' | 'adjust' | 'initial'
  qty: number
  reason: string
  actor: string
  created_at: string
}

export interface StoreSettings {
  storeName: string
  address: string
  phone: string
  taxEnabled: boolean
  taxPct: number
  receiptHeader: string
  receiptFooter: string
  paper: string
  timezone: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface DashboardAdmin {
  role: 'admin'
  today: { omzet: number; trx_count: number; items_sold: number; low_stock: number }
  sales7: { date: string; omzet: number }[]
  methods: { method: string; total: number }[]
  top_products: { product_id: string; name: string; qty: number; revenue: number }[]
  recent: { id: string; cashier_name: string; total: number; status: Trx['status']; time: string }[]
}

export interface DashboardCashier {
  role: 'cashier'
  today: { omzet: number; trx_count: number; items_sold: number }
  recent: { id: string; cashier_name: string; total: number; status: Trx['status']; time: string }[]
}

export interface ReportBundle {
  period: string
  summary: { omzet: number; trx_count: number; items_sold: number; gross_profit: number }
  by_method: { method: string; total: number }[]
  by_status: { status: string; count: number }[]
  products: { product_id: string; name: string; sku: string; qty: number; revenue: number; profit: number }[]
  transactions: { date: string; id: string; cashier: string; method: string; total: number; hpp: number; profit: number; status: string }[]
  stock: { name: string; sku: string; stock: number; buy_price: number; sell_price: number; stock_value: number }[]
}

// ── auth ─────────────────────────────────────────────────────────────

export function apiLogin(email: string, password: string, passcode?: string) {
  return request<AuthResp>('POST', '/auth/login', { email, password, ...(passcode ? { passcode } : {}) }, false)
    .then((r) => { saveTokens(r.access_token, r.refresh_token); return r })
}

export function apiRegister(name: string, email: string, password: string, storeName: string) {
  return request<AuthResp>('POST', '/auth/register', { name, email, password, storeName }, false)
    .then((r) => { saveTokens(r.access_token, r.refresh_token); return r })
}

export async function apiLogout() {
  const rt = localStorage.getItem(REFRESH_KEY)
  try {
    await request('POST', '/auth/logout', rt ? { refresh_token: rt } : undefined, false)
  } catch {
    // best-effort
  }
  clearTokens()
}

export function apiMe() {
  return request<{ user: User }>('GET', '/auth/me')
}

// ── users ────────────────────────────────────────────────────────────

export function apiListUsers() {
  return request<{ users: User[] }>('GET', '/users')
}

export function apiCreateUser(body: { name: string; email: string; password: string }) {
  return request<{ user: User }>('POST', '/users', body)
}

export function apiSetUserActive(id: string, active: boolean) {
  return request<{ message: string }>('PATCH', `/users/${id}/active`, { active })
}

export function apiSetPasscode(id: string, passcode: string) {
  return request<{ message: string }>('PUT', `/users/${id}/passcode`, { passcode })
}

// ── katalog ──────────────────────────────────────────────────────────

export function apiListCategories() {
  return request<{ categories: Category[] }>('GET', '/categories')
}

export function apiCreateCategory(name: string) {
  return request<{ category: Category }>('POST', '/categories', { name })
}

export function apiDeleteCategory(id: string) {
  return request<{ soft_deleted: boolean }>('DELETE', `/categories/${id}`)
}

export interface ProductFilter {
  q?: string
  categoryId?: string
  active?: boolean
  page?: number
  limit?: number
}

function qs(p: Record<string, string | number | boolean | undefined>) {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '') s.set(k, String(v))
  const str = s.toString()
  return str ? '?' + str : ''
}

export function apiListProducts(f: ProductFilter = {}) {
  return request<Page<Product>>('GET', '/products' + qs({ ...f }))
}

export function apiCreateProduct(body: {
  name: string; sku: string; barcode?: string; categoryId?: string | null
  buyPrice?: number; sellPrice: number; stock?: number; unit?: string
}) {
  return request<Product>('POST', '/products', body)
}

export function apiUpdateProduct(id: string, body: {
  name: string; sku: string; barcode?: string; categoryId?: string | null
  buyPrice?: number; sellPrice: number; unit?: string
}) {
  return request<Product>('PUT', `/products/${id}`, body)
}

export function apiSetProductActive(id: string, active: boolean) {
  return request<{ message: string }>('PATCH', `/products/${id}/active`, { active })
}

// ── stok ─────────────────────────────────────────────────────────────

export function apiListMovements(f: { type?: string; productId?: string; page?: number; limit?: number } = {}) {
  return request<Page<Movement>>('GET', '/movements' + qs(f))
}

export function apiAdjustStock(productId: string, direction: 'plus' | 'minus', qty: number, reason: string) {
  return request<{ product: Product }>('POST', '/stock/adjustments', { productId, direction, qty, reason })
}

// ── transaksi ────────────────────────────────────────────────────────

export function apiCheckout(body: {
  items: { productId: string; qty: number }[]
  discount?: number
  method: string
  paid?: number
  customer?: string
}) {
  return request<Trx>('POST', '/transactions', body)
}

export function apiListTransactions(f: { q?: string; method?: string; date?: string; page?: number; limit?: number } = {}) {
  return request<Page<Trx>>('GET', '/transactions' + qs(f))
}

export function apiRefundTransaction(id: string, items: { productId: string; qty: number }[], reason: string) {
  return request<Trx>('POST', `/transactions/${id}/refund`, { items, reason })
}

// ── settings / dashboard / laporan ───────────────────────────────────

export function apiGetSettings() {
  return request<StoreSettings>('GET', '/settings')
}

export function apiUpdateSettings(s: StoreSettings) {
  return request<StoreSettings>('PUT', '/settings', s)
}

export function apiGetDashboard() {
  return request<DashboardAdmin | DashboardCashier>('GET', '/dashboard')
}

export function apiGetReport(period: string) {
  return request<ReportBundle>('GET', '/reports' + qs({ period }))
}

// ── util fetch ───────────────────────────────────────────────────────

export async function fetchAll<T>(pageFn: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; ; page++) {
    const d = await pageFn(page)
    out.push(...d.items)
    if (out.length >= d.total) break
  }
  return out
}

export function useFetch<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; err: string; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let dead = false
    setLoading(true)
    setErr('')
    fn().then((d) => { if (!dead) setData(d) })
      .catch((e) => { if (!dead) setErr(e instanceof Error ? e.message : 'Terjadi kesalahan.') })
      .finally(() => { if (!dead) setLoading(false) })
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { data, err, loading, reload: () => setTick((t) => t + 1) }
}