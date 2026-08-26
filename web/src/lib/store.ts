import { useEffect, useSyncExternalStore, useState } from 'react'
import type { Role, User } from './api'

export type { Role }
export type { Trx, Product, Category, Movement, StoreSettings, PayMethod } from './api'

export interface Session {
  id: string
  email: string
  name: string
  role: Role
  store: string
}

export function toSession(u: User): Session {
  return { id: u.id, email: u.email, name: u.name, role: u.role, store: u.store_name }
}

let session: Session | null = null
let version = 0
const subs = new Set<() => void>()

export function useDB(): { session: Session | null } {
  useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => version,
  )
  return { session }
}

export function setSession(s: Session | null) {
  session = s
  version++
  subs.forEach((cb) => cb())
}

export function getSession(): Session | null {
  return session
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

// ── format & util ────────────────────────────────────────────────────

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

export function exportCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}