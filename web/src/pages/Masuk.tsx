import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError, apiLogin } from '../lib/api'
import { setSession, toSession } from '../lib/store'
import Navbar from './Navbar'

export default function Masuk() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passcode, setPasscode] = useState('')
  const [needPasscode, setNeedPasscode] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const em = email.trim().toLowerCase()
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setErr('Masukkan alamat email yang valid.')
    if (!password) return setErr('Kata sandi wajib diisi.')
    setErr(''); setBusy(true)
    try {
      const r = await apiLogin(em, password)
      setSession(toSession(r.user))
      nav('/app', { replace: true })
    } catch (x) {
      if (x instanceof ApiError && x.code === 'passcode_required') {
        setNeedPasscode(true)
        setErr('')
      } else {
        setErr(x instanceof Error ? x.message : 'Gagal masuk. Coba lagi.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function submitPasscode(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const r = await apiLogin(email.trim().toLowerCase(), password, passcode)
      setSession(toSession(r.user))
      nav('/app', { replace: true })
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Passcode salah. Coba lagi.')
      setPasscode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-bg text-fg">
      <Navbar />
      <main className="relative grid min-h-[calc(100vh-116px)] place-items-center overflow-hidden px-8 py-12">
        <div
          className="pointer-events-none absolute -top-35 -right-30 h-140 w-140 rounded-full blur-6xl"
          style={{ background: 'radial-gradient(circle at 32% 32%, #ffa888 0%, #ff8868 55%, transparent 70%)' }}
          aria-hidden="true"
        />
        <section className="auth-card w-full max-w-105 rounded-2xl bg-cream p-10">
          <p className="font-mono text-xs uppercase tracking-widest text-steel">Masuk · kasir</p>
          <h1 className="mt-3 text-[clamp(32px,4vw,44px)] font-normal leading-[1.1] tracking-[-0.025em]">Selamat datang kembali</h1>
          <p className="mt-2 mb-7 text-[15px] text-muted">Masuk ke toko Anda untuk mulai berjualan.</p>

          {err && (
            <p className="mb-4 flex items-start gap-2 rounded-lg bg-sand px-3.5 py-3 text-[13px]" role="alert">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-none text-ember"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
              {err}
            </p>
          )}

          {needPasscode ? (
            <form onSubmit={submitPasscode} className="flex flex-col gap-4" noValidate>
              <div className="rounded-lg bg-surface px-3.5 py-3 text-[13px] text-muted">
                Akun <strong className="text-fg">{email.trim().toLowerCase()}</strong> dilindungi passcode. Masukkan 5 angka untuk melanjutkan.
              </div>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                Passcode
                <input
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  type="password" inputMode="numeric" autoFocus
                  placeholder="•••••"
                  className="rounded-md border border-border bg-paper px-3.5 py-3 text-center font-mono text-lg tracking-[0.5em] focus:border-jet focus:outline-none"
                />
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setNeedPasscode(false); setErr('') }} className="flex-1 rounded-full border border-dove py-3 text-[15px] font-medium text-jet hover:border-jet">Kembali</button>
                <button type="submit" disabled={passcode.length !== 5 || busy} className="flex-1 rounded-full bg-jet py-3 text-[15px] font-medium text-paper hover:opacity-85 disabled:opacity-40">Masuk</button>
              </div>
            </form>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="text" autoComplete="username" placeholder="nama@tokosaya.com" className="rounded-md border border-border bg-paper px-3.5 py-3 text-[15px] focus:border-jet focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
              Kata sandi
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="••••••••" className="rounded-md border border-border bg-paper px-3.5 py-3 text-[15px] focus:border-jet focus:outline-none" />
            </label>
            <button type="submit" disabled={busy} className="mt-1 rounded-full bg-jet py-3 text-[15px] font-medium text-paper hover:opacity-85 disabled:opacity-40">{busy ? 'Memproses…' : 'Masuk'}</button>
            </form>
          )}

          <p className="mt-6 border-t border-dove pt-5 text-center text-sm text-muted">
            Belum punya akun? <Link to="/daftar" className="font-medium text-jet hover:underline">Buat akun gratis</Link>
          </p>
        </section>
      </main>
      <footer className="border-t border-border py-14 text-[13px] text-muted">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span>© 2026 OpenPOS</span>
          <span className="font-mono text-xs text-fog">gratis selamanya · untuk UMKM</span>
        </div>
      </footer>
    </div>
  )
}