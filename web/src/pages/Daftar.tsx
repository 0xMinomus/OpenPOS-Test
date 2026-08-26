import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { apiRegister } from '../lib/api'
import { setSession, toSession } from '../lib/store'
import Navbar from './Navbar'

export default function Daftar() {
  const nav = useNavigate()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [store, setStore] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (step === 1) {
      const em = email.trim().toLowerCase()
      if (!name.trim()) return setErr('Nama wajib diisi.')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setErr('Masukkan alamat email yang valid.')
      if (password.length < 8) return setErr('Kata sandi minimal 8 karakter.')
      setStep(2)
      return
    }
    if (!store.trim()) return setErr('Nama toko wajib diisi.')
    setBusy(true)
    try {
      const r = await apiRegister(name.trim(), email.trim().toLowerCase(), password, store.trim())
      setSession(toSession(r.user))
      nav('/app', { replace: true })
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Gagal mendaftar. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-bg text-fg">
      <Navbar />
      <main className="relative grid min-h-[calc(100vh-116px)] place-items-center overflow-hidden px-8 py-12">
        <div
          className="pointer-events-none absolute -top-35 -left-30 h-140 w-140 rounded-full blur-6xl"
          style={{ background: 'radial-gradient(circle at 32% 32%, #ffa888 0%, #ff8868 55%, transparent 70%)' }}
          aria-hidden="true"
        />
        <section className="auth-card w-full max-w-110 rounded-2xl bg-cream p-10">
          <div className="mb-7 flex items-center gap-2" aria-label="Langkah pendaftaran">
            {[
              { n: 1, label: 'Akun' },
              { n: 2, label: 'Toko' },
              { n: 3, label: 'Selesai' },
            ].map((s, i) => (
              <div key={s.n} className={`flex items-center gap-2 font-mono text-xs ${step >= s.n ? 'text-jet' : 'text-fog'}`}>
                {i > 0 && <span className="h-px w-6 bg-dove" />}
                <span className={`grid h-5.5 w-5.5 place-items-center rounded-full border text-[11px] ${step >= s.n ? 'border-jet bg-jet text-paper' : 'border-dove'}`}>
                  {step > s.n ? '✓' : s.n}
                </span>
                {s.label}
              </div>
            ))}
          </div>

          <p className="font-mono text-xs uppercase tracking-widest text-steel">Daftar · buat akun</p>
          <h1 className="mt-3 text-[clamp(32px,4vw,44px)] font-normal leading-[1.1] tracking-[-0.025em]">Mulai toko Anda hari ini</h1>
          <p className="mt-2 mb-7 text-[15px] text-muted">Satu akun membuat Admin dan toko Anda sekaligus. Gratis selamanya — tanpa kartu kredit.</p>

          {err && (
            <p className="mb-4 flex items-start gap-2 rounded-lg bg-sand px-3.5 py-3 text-[13px]" role="alert">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-none text-ember"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
              {err}
            </p>
          )}

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {step === 1 ? (
              <>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                  Nama Anda
                  <input value={name} onChange={(e) => setName(e.target.value)} type="text" autoComplete="name" placeholder="Nama pemilik toko" className="rounded-md border border-border bg-paper px-3.5 py-3 text-[15px] focus:border-jet focus:outline-none" />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                  Email
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="nama@tokosaya.com" className="rounded-md border border-border bg-paper px-3.5 py-3 text-[15px] focus:border-jet focus:outline-none" />
                  <span className="text-xs font-normal text-fog">Dipakai untuk masuk. Tidak dibagikan.</span>
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                  Kata sandi
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="Minimal 8 karakter" className="rounded-md border border-border bg-paper px-3.5 py-3 text-[15px] focus:border-jet focus:outline-none" />
                </label>
                <button type="submit" className="mt-1 rounded-full bg-jet py-3 text-[15px] font-medium text-paper hover:opacity-85">Lanjutkan</button>
              </>
            ) : (
              <>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                  Nama toko
                  <input value={store} onChange={(e) => setStore(e.target.value)} type="text" placeholder="cth: Toko Sembako Sari" className="rounded-md border border-border bg-paper px-3.5 py-3 text-[15px] focus:border-jet focus:outline-none" />
                  <span className="text-xs font-normal text-fog">Ditampilkan di struk dan dashboard.</span>
                </label>
                <button type="submit" disabled={busy} className="mt-1 rounded-full bg-jet py-3 text-[15px] font-medium text-paper hover:opacity-85 disabled:opacity-40">{busy ? 'Membuat…' : 'Buat Akun'}</button>
              </>
            )}
          </form>

          <p className="mt-6 border-t border-dove pt-5 text-center text-sm text-muted">
            Sudah punya akun? <Link to="/masuk" className="font-medium text-jet hover:underline">Masuk</Link>
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