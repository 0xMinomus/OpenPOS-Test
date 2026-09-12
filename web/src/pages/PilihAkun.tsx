import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { UserRound } from 'lucide-react'
import { ApiError, apiListUsers, apiLogout, apiMe, apiSwitchAccount, hasToken, type User } from '../lib/api'
import { setSession, toSession, useDB } from '../lib/store'
import { Button } from '../lib/ui'
import Navbar from './Navbar'

export default function PilihAkun() {
  const nav = useNavigate()
  const { session } = useDB()
  const [users, setUsers] = useState<User[] | null>(null)
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, setPending] = useState<{ u: User; role: 'admin' | 'cashier' } | null>(null)
  const [pin, setPin] = useState('')

  useEffect(() => {
    let dead = false
    async function boot() {
      try {
        let s = session
        if (!s) {
          if (!hasToken()) { nav('/masuk', { replace: true }); return }
          const me = await apiMe()
          if (dead) return
          s = toSession(me.user)
          setSession(s)
        }
        if (s.role !== 'admin') { nav('/app', { replace: true }); return }
        const list = await apiListUsers()
        if (dead) return
        if (!list.some((u) => u.role === 'cashier' && u.active)) { nav('/app', { replace: true }); return }
        setUsers(list)
      } catch {
        if (!dead) nav('/app', { replace: true })
      }
    }
    boot()
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function pickAccount(u: User, role: 'admin' | 'cashier', code?: string) {
    setErr(''); setBusyId(u.id)
    try {
      const r = await apiSwitchAccount(u.id, code || undefined, role)
      setSession(toSession(r.user))
      nav('/app', { replace: true })
    } catch (x) {
      if (x instanceof ApiError && x.code === 'passcode_required') {
        setPending({ u, role }); setPin('')
      } else {
        setErr(x instanceof Error ? x.message : 'Gagal ganti akun.')
      }
    } finally {
      setBusyId(null)
    }
  }

  // has_passcode dari server: akun ber-PIN langsung ke form, sisanya masuk langsung.
  function tapAccount(u: User, role: 'admin' | 'cashier') {
    setErr('')
    if (u.has_passcode) { setPending({ u, role }); setPin('') }
    else pickAccount(u, role)
  }

  async function keluar() {
    await apiLogout()
    setSession(null)
    nav('/masuk', { replace: true })
  }

  const cashiers = (users ?? []).filter((u) => u.role === 'cashier')
  const adminUser = (users ?? []).find((u) => u.role === 'admin') ?? null

  return (
    <div className="landing-light bg-bg text-fg">
      <Navbar logoTone="light" />
      <main className="grid min-h-[calc(100vh-116px)] place-items-center px-4 py-8 sm:px-8 sm:py-12">
        <section className="auth-card w-full max-w-105 rounded-2xl border border-dove bg-paper p-5 shadow-xl sm:p-10">
          <p className="font-mono text-xs uppercase tracking-widest text-steel">Pilih akun</p>
          <h1 className="mt-3 text-[clamp(28px,4vw,36px)] font-normal leading-[1.1] tracking-[-0.025em]">Masuk sebagai siapa?</h1>
          <p className="mt-2 mb-7 text-[15px] text-muted">Satu akun untuk tiap peran di toko Anda.</p>

          {err && <p className="mb-4 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember" role="alert">{err}</p>}

          {!users ? (
            <div className="space-y-2.5" aria-busy="true" aria-label="Memuat akun" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              <button
                onClick={() => adminUser && tapAccount(adminUser, 'admin')}
                disabled={busyId === adminUser?.id}
                className="flex w-full items-center gap-3 rounded-xl border border-dove p-3 text-left transition hover:border-jet disabled:opacity-50 sm:p-4"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-jet text-paper">
                  <UserRound className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-fg">{session?.name ?? 'Admin'}</span>
                  <span className="block truncate text-[13px] text-muted">{session?.email ?? ''}</span>
                </span>
                {busyId === adminUser?.id
                  ? <span className="text-[13px] font-medium text-jet">…</span>
                  : <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-[11px] font-medium text-sprout">Admin</span>}
              </button>

              {cashiers.map((u) => (
                <button
                  key={u.id}
                  disabled={!u.active || busyId === u.id}
                  onClick={() => tapAccount(u, 'cashier')}
                  className="flex w-full items-center gap-3 rounded-xl border border-dove p-3 text-left transition hover:border-jet disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-dove sm:p-4"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-steel">
                    <UserRound className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-fg">{u.name}</span>
                    <span className="block text-[13px] text-muted">Kasir</span>
                  </span>
                  {u.active
                    ? <span className="text-[13px] font-medium text-jet">{busyId === u.id ? '…' : 'Masuk →'}</span>
                    : <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted">Nonaktif</span>}
                </button>
              ))}
            </div>
          )}

          {pending && (
            <div className="mt-4 rounded-xl border border-dove p-4">
              <p className="text-sm text-muted">Akun <strong className="text-fg">{pending.u.name}</strong> dilindungi passcode.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && pin.length === 5) pickAccount(pending.u, pending.role, pin) }}
                  inputMode="numeric"
                  autoFocus
                  placeholder="•••••"
                  aria-label="Passcode 5 angka"
                  className="min-w-0 flex-1 rounded-md border border-border bg-paper px-3 py-2.5 text-center font-mono text-lg tracking-[0.5em] focus:border-jet focus:outline-none"
                />
                <button
                  onClick={() => pickAccount(pending.u, pending.role, pin)}
                  disabled={pin.length !== 5 || busyId === pending.u.id}
                  className="rounded-full bg-jet px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-40"
                >
                  {busyId === pending.u.id ? '…' : 'Masuk'}
                </button>
                <button onClick={() => { setPending(null); setPin('') }} className="px-2 text-sm text-muted hover:underline">
                  Batal
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-dove pt-5 text-center">
            <Button variant="ghost" onClick={keluar}>Keluar</Button>
          </div>
        </section>
      </main>
    </div>
  )
}
