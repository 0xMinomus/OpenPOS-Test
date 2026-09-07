import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { apiGetSettings, apiGoogleLogin, apiRegister, apiSendOtp, apiSetPasscode, apiUpdateSettings, apiVerifyOtp, apiMe, ApiError, type User } from '../lib/api'
import { setSession, toSession } from '../lib/store'
import { GoogleButton } from '../lib/google'
import Navbar from './Navbar'

const STEPS = [
  { n: 1, label: 'Akun' },
  { n: 2, label: 'Verifikasi' },
  { n: 3, label: 'Toko' },
  { n: 4, label: 'Selesai' },
]

export default function Daftar() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'choice' | 'email' | 'google-onboard'>('choice')
  const [googleUser, setGoogleUser] = useState<User | null>(null)
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [store, setStore] = useState('')
  const [passcode, setPasscode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const [code, setCode] = useState('')
  const [otpMsg, setOtpMsg] = useState('')
  const [cooldown, setCooldown] = useState(0)

  // Datang dari halaman Masuk setelah Google login akun baru:
  // sesi + token sudah tersimpan, tinggal lengkapi nama toko + passcode.
  useEffect(() => {
    if (params.get('google') !== 'onboard' || googleUser) return
    apiMe()
      .then((r) => {
        setSession(toSession(r.user))
        setGoogleUser(r.user)
        setStore(r.user.store_name)
        setMode('google-onboard')
        setStep(3)
      })
      .catch(() => nav('/masuk', { replace: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendOtp() {
    const em = email.trim().toLowerCase()
    setOtpMsg(''); setErr(''); setCode('')
    try {
      await apiSendOtp(em)
      setOtpMsg(`Kode OTP 6 digit terkirim ke ${em}.`)
      setCooldown(60)
    } catch (x) {
      if (x instanceof ApiError && x.status === 429) setCooldown(60)
      setOtpMsg('')
      setErr(x instanceof Error ? x.message : 'Gagal mengirim kode. Coba lagi.')
      throw x
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) return setErr('Masukkan kode OTP 6 digit.')
    setErr(''); setBusy(true)
    try {
      await apiVerifyOtp(email.trim().toLowerCase(), code)
      setStep(3)
    } catch (x) {
      if (x instanceof ApiError && (x.status === 410 || x.status === 429)) setCooldown(0)
      setErr(x instanceof Error ? x.message : 'Kode salah. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!store.trim()) return setErr('Nama toko wajib diisi.')
    if (step === 3) {
      setStep(4)
      return
    }
    if (!/^\d{5}$/.test(passcode)) return setErr('Passcode harus 5 angka.')
    if (passcode !== confirm) return setErr('Passcode tidak cocok.')
    setBusy(true)
    try {
      const r = await apiRegister(name.trim(), email.trim().toLowerCase(), password, store.trim())
      setSession(toSession(r.user))
      try {
        await apiSetPasscode(r.user.id, passcode, 'admin')
      } catch {
        // passcode bukan penghalang masuk; gagal disimpan ditangani halaman Pengaturan
      }
      nav('/app', { replace: true })
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Gagal mendaftar. Coba lagi.')
      setStep(3)
    } finally {
      setBusy(false)
    }
  }

  function step1Next(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!name.trim()) return setErr('Nama wajib diisi.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('Masukkan alamat email yang valid.')
    if (password.length < 8) return setErr('Kata sandi minimal 8 karakter.')
    setBusy(true)
    sendOtp()
      .then(() => setStep(2))
      .catch(() => {})
      .finally(() => setBusy(false))
  }

  async function handleGoogle(credential: string) {
    setErr(''); setBusy(true)
    try {
      const r = await apiGoogleLogin(credential)
      setSession(toSession(r.user))
      // Akun yang baru dibuat detik ini → lengkapi nama toko + passcode.
      // Akun lama (Google dipakai untuk masuk) → langsung ke dashboard.
      const age = r.user.created_at ? Date.now() - new Date(r.user.created_at).getTime() : Infinity
      if (age < 2 * 60 * 1000) {
        setGoogleUser(r.user)
        setStore(r.user.store_name)
        setMode('google-onboard')
        setStep(3)
      } else {
        nav('/app', { replace: true })
      }
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Login Google gagal. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  async function submitGoogle(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!store.trim()) return setErr('Nama toko wajib diisi.')
    if (step === 3) {
      setStep(4)
      return
    }
    if (!/^\d{5}$/.test(passcode)) return setErr('Passcode harus 5 angka.')
    if (passcode !== confirm) return setErr('Passcode tidak cocok.')
    if (!googleUser) return setErr('Sesi Google tidak valid. Ulangi dari awal.')
    setBusy(true)
    try {
      if (store.trim() !== googleUser.store_name) {
        const cur = await apiGetSettings()
        await apiUpdateSettings({ ...cur, storeName: store.trim() })
      }
      await apiSetPasscode(googleUser.id, passcode, 'admin')
      nav('/app', { replace: true })
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Gagal menyimpan. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="landing-light bg-bg text-fg">
      <Navbar logoTone="light" />
      <main className="relative grid min-h-[calc(100vh-116px)] place-items-center overflow-hidden px-8 py-12">
        <div
          className="pointer-events-none absolute -top-35 -left-30 h-140 w-140 rounded-full blur-6xl"
          style={{ background: 'radial-gradient(circle at 32% 32%, #ffa888 0%, #ff8868 55%, transparent 70%)' }}
          aria-hidden="true"
        />
        <section className="auth-card w-full max-w-110 rounded-2xl bg-cream p-10">
          {mode !== 'choice' && (
            <div className="mb-7 flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-label="Langkah pendaftaran">
              {STEPS.map((s, i) => (
                <div key={s.n} className={`flex items-center gap-1.5 font-mono text-[10px] ${step >= s.n ? 'text-jet' : 'text-fog'}`}>
                  {i > 0 && <span className="h-px w-3.5 bg-dove" />}
                  <span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${step >= s.n ? 'border-jet bg-jet text-paper' : 'border-dove'}`}>
                    {step > s.n ? '✓' : s.n}
                  </span>
                  {s.label}
                </div>
              ))}
            </div>
          )}

          <p className="font-mono text-xs uppercase tracking-widest text-steel">Daftar · buat akun</p>
          <h1 className="mt-3 text-[clamp(32px,4vw,44px)] font-normal leading-[1.1] tracking-[-0.025em]">Buat toko Anda hari ini</h1>
          <p className="mt-2 mb-7 text-[15px] text-muted">Satu akun langsung membuat akun admin dan toko Anda sekaligus. Gratis selamanya tanpa kartu kredit.</p>

          {err && (
            <p className="mb-4 flex items-start gap-2 rounded-lg bg-sand px-3.5 py-3 text-[13px]" role="alert">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-none text-ember"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
              {err}
            </p>
          )}

          {mode === 'choice' && (
            <div className="flex flex-col gap-4">
              <GoogleButton onToken={handleGoogle} busy={busy} text="signup_with" />
              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-dove" />
                <span className="text-xs text-fog">atau</span>
                <span className="h-px flex-1 bg-dove" />
              </div>
              <button
                onClick={() => { setErr(''); setMode('email') }}
                className="rounded-full border border-dove py-3 text-[15px] font-medium text-jet hover:border-jet"
              >
                Daftar dengan Email
              </button>
            </div>
          )}

          {mode === 'email' && step === 1 && (
            <form onSubmit={step1Next} className="flex flex-col gap-4" noValidate>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                Nama Anda
                <input value={name} onChange={(e) => setName(e.target.value)} type="text" autoComplete="name" placeholder="Nama pemilik toko" className="rounded-md border border-border bg-paper px-3.5 py-3 text-[15px] focus:border-jet focus:outline-none" />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                Email
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="nama@tokosaya.com" className="rounded-md border border-border bg-paper px-3.5 py-3 text-[15px] focus:border-jet focus:outline-none" />
                <span className="text-xs font-normal text-fog">Dipakai untuk masuk dan verifikasi kode OTP. Tidak dibagikan.</span>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                Kata sandi
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="Minimal 8 karakter" className="rounded-md border border-border bg-paper px-3.5 py-3 text-[15px] focus:border-jet focus:outline-none" />
              </label>
              <button type="submit" disabled={busy} className="mt-1 rounded-full bg-jet py-3 text-[15px] font-medium text-paper hover:opacity-85 disabled:opacity-40">{busy ? 'Mengirim kode…' : 'Lanjutkan'}</button>
              <button type="button" onClick={() => { setErr(''); setMode('choice') }} className="text-center text-[13px] text-muted hover:underline">
                Kembali
              </button>
            </form>
          )}

          {mode === 'email' && step === 2 && (
            <form onSubmit={verifyOtp} className="flex flex-col gap-4" noValidate>
              <div className="rounded-lg bg-surface px-3.5 py-3 text-[13px] text-muted">
                {otpMsg || 'Mengirim kode OTP…'}
                <span className="mt-1 block text-xs text-fog">Kode berlaku 10 menit dan hanya bisa dicoba 3 kali.</span>
              </div>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                Kode OTP
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
                  placeholder="••••••"
                  className="rounded-md border border-border bg-paper px-3.5 py-3 text-center font-mono text-xl tracking-[0.5em] focus:border-jet focus:outline-none"
                />
              </label>
              <button type="submit" disabled={code.length !== 6 || busy} className="mt-1 rounded-full bg-jet py-3 text-[15px] font-medium text-paper hover:opacity-85 disabled:opacity-40">
                {busy ? 'Memverifikasi…' : 'Verifikasi Email'}
              </button>
              <button
                type="button"
                onClick={() => sendOtp().catch(() => {})}
                disabled={cooldown > 0 || busy}
                className="text-center text-[13px] text-muted hover:underline disabled:opacity-50"
              >
                {cooldown > 0 ? `Kirim ulang dalam ${cooldown} detik` : 'Kirim ulang kode'}
              </button>
            </form>
          )}

          {(mode === 'email' || mode === 'google-onboard') && step >= 3 && (
            <form onSubmit={mode === 'google-onboard' ? submitGoogle : submit} className="flex flex-col gap-4" noValidate>
              {step === 3 && (
                <>
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                    Nama toko
                    <input value={store} onChange={(e) => setStore(e.target.value)} type="text" placeholder="cth: Toko Sembako Sari" className="rounded-md border border-border bg-paper px-3.5 py-3 text-[15px] focus:border-jet focus:outline-none" />
                    <span className="text-xs font-normal text-fog">Ditampilkan di struk dan dashboard.</span>
                  </label>
                  <button type="submit" className="mt-1 rounded-full bg-jet py-3 text-[15px] font-medium text-paper hover:opacity-85">Lanjutkan</button>
                </>
              )}
              {step === 4 && (
                <>
                  <div className="rounded-lg bg-surface px-3.5 py-3 text-[13px] text-muted">
                    Terakhir, buat <strong className="text-fg">passcode 5 angka</strong> untuk akun admin Anda. Passcode diminta setiap kali login.
                  </div>
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                    Passcode admin
                    <input
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      type="password" inputMode="numeric" autoComplete="new-password" autoFocus
                      placeholder="•••••"
                      className="rounded-md border border-border bg-paper px-3.5 py-3 text-center font-mono text-lg tracking-[0.5em] focus:border-jet focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                    Ulangi passcode
                    <input
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      type="password" inputMode="numeric" autoComplete="new-password"
                      placeholder="•••••"
                      className="rounded-md border border-border bg-paper px-3.5 py-3 text-center font-mono text-lg tracking-[0.5em] focus:border-jet focus:outline-none"
                    />
                  </label>
                  <button type="submit" disabled={!store.trim() || busy} className="mt-1 rounded-full bg-jet py-3 text-[15px] font-medium text-paper hover:opacity-85 disabled:opacity-40">
                    {busy ? (mode === 'google-onboard' ? 'Menyimpan…' : 'Membuat akun…') : (mode === 'google-onboard' ? 'Selesai' : 'Buat Akun')}
                  </button>
                </>
              )}
            </form>
          )}

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