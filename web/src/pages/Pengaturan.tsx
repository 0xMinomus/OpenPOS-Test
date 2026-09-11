import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Check, Clock, Eye, EyeOff, ImagePlus, Info, KeyRound, Lock, LogOut, Mail, MapPin, Phone, Printer, ShieldCheck, Users,
} from 'lucide-react'
import {
  ApiError, apiGetSettings, apiListTransactions, apiListUsers, apiLogout, apiResetPassword, apiSendPasswordResetOtp, apiSetPasscode, apiUpdateSettings,
  type Page, type StoreSettings, type Trx, type User,
} from '../lib/api'
import { useCache } from '../lib/cache'
import { fmtDate, fmtRp, fmtTime, getSession, setSession, useDB } from '../lib/store'
import { Button, Input, Modal, NumInput, PageHead, Pill } from '../lib/ui'
import { Receipt } from '../lib/receipt'
import { Skeleton } from '@/components/ui/skeleton'

const TABS = [
  { id: 'akun', label: 'Akun' },
  { id: 'toko', label: 'Toko' },
  { id: 'struk', label: 'Struk' },
  { id: 'pajak', label: 'Pajak' },
] as const

type TabId = (typeof TABS)[number]['id']

const TIMEZONES = [
  { value: 'Asia/Jakarta', label: 'WIB — Jakarta (UTC+7)' },
  { value: 'Asia/Makassar', label: 'WITA — Makassar (UTC+8)' },
  { value: 'Asia/Jayapura', label: 'WIT — Jayapura (UTC+9)' },
]

const INPUT_CLS = 'w-full rounded-md border border-border bg-paper px-3.5 py-2.5 text-[15px] text-fg placeholder:text-fog focus:border-jet focus:outline-2 focus:outline-accent-soft disabled:opacity-60'
const LABEL_CLS = 'flex flex-col gap-1.5 text-[13px] font-medium text-steel'

function todayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-cream p-6 ${className}`}>{children}</section>
}

function CardHead({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  return (
    <div className="mb-4">
      {kicker && <p className="font-mono text-[11px] uppercase tracking-wider text-fog">{kicker}</p>}
      <h2 className="mt-0.5 text-[15px] font-medium text-fg">{title}</h2>
      {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-fg">{value}</span>
    </div>
  )
}

// Field yang belum didukung backend: tampil nonaktif + kontrak
// docs/API-CONTRACT-SETTINGS-EXTENDED.md.
function Soon({ children }: { children: ReactNode }) {
  return (
    <div className="opacity-80">
      <div className="mb-1.5 flex items-center gap-2">
        <div className="flex-1">{children}</div>
        <Pill tone="muted">Segera</Pill>
      </div>
      <p className="-mt-0.5 mb-1 text-xs font-normal text-fog">Segera hadir — menunggu backend.</p>
    </div>
  )
}

function FormActions({ dirty, busy, onReset, onSave }: { dirty: boolean; busy: boolean; onReset: () => void; onSave: () => void }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <Button variant="ghost" onClick={onReset} disabled={busy || !dirty}>Reset</Button>
      <Button onClick={onSave} disabled={busy || !dirty}>{busy ? 'Menyimpan…' : 'Simpan Perubahan'}</Button>
    </div>
  )
}

function PwField({ label, value, onChange, show, onToggle, auto }: { label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; auto: string }) {
  return (
    <label className={LABEL_CLS}>
      {label}
      <span className="relative block">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={auto}
          className={`${INPUT_CLS} pr-11`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-fog hover:text-fg"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  )
}

function pwScore(pw: string) {
  let s = 0
  if (pw.length >= 8) s += 1
  if (pw.length >= 12) s += 1
  if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) s += 1
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) s += 1
  return Math.min(s, 4)
}

const SCORE_LABEL = ['Lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat']
const SCORE_BAR = ['bg-ember', 'bg-ember', 'bg-sunbeam', 'bg-sprout', 'bg-sprout']

const SAMPLE_ITEMS = [
  { name: 'Indomie Goreng', qty: 2, price: 12000 },
  { name: 'Aqua 600ml', qty: 1, price: 5000 },
  { name: 'Roti Tawar', qty: 1, price: 15000 },
]

export default function Pengaturan() {
  const nav = useNavigate()
  const { session } = useDB()
  const today = todayStr()
  const [tab, setTab] = useState<TabId>('akun')
  const [form, setForm] = useState<StoreSettings | null>(null)
  const [saved, setSaved] = useState<StoreSettings | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const accountList = useCache<User[]>(`users:${session?.id}`, () => apiListUsers())
  const users = accountList.data ?? []
  const todayTrx = useCache<Page<Trx>>(`pengaturan-trx:${session?.id}:${today}`, () => apiListTransactions({ date: today, limit: 200, page: 1 }))

  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // Passcode (tab Akun → Keamanan): ubah milik sendiri + reset milik kasir.
  const [pcTarget, setPcTarget] = useState<User | null>(null)
  const [pcVal, setPcVal] = useState('')
  const [pcBusy, setPcBusy] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null)

  // Ganti kata sandi (section khusus di tab Akun): kata sandi baru +
  // verifikasi kode OTP yang dikirim ke email.
  const [showNew, setShowNew] = useState(false)
  const [showNew2, setShowNew2] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [otpRequested, setOtpRequested] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)
  const [pwdErr, setPwdErr] = useState('')

  // Cetak uji coba struk.
  const [printTest, setPrintTest] = useState(false)

  function fetchSettings() {
    return apiGetSettings()
      .then((s) => { setForm(s); setSaved(s) })
      .catch((e) => { setLoadErr(e instanceof Error ? e.message : 'Gagal memuat pengaturan.') })
  }

  useEffect(() => { fetchSettings() }, [])

  function retry() {
    setLoadErr(''); setErr('')
    fetchSettings()
  }

  const set = (k: keyof StoreSettings) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const dirty = !!form && !!saved && JSON.stringify(form) !== JSON.stringify(saved)

  async function save() {
    if (!form) return
    setMsg(''); setErr(''); setBusy(true)
    try {
      const s = await apiUpdateSettings(form)
      setForm(s); setSaved(s)
      const cur = getSession()
      if (cur && cur.store !== s.storeName) setSession({ ...cur, store: s.storeName })
      setMsg('Pengaturan berhasil disimpan.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan perubahan. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  function resetForm() {
    if (saved) { setForm(saved); setMsg(''); setErr('') }
  }

  async function savePc(u: User) {
    if (!/^\d{5}$/.test(pcVal)) return setErr('Passcode harus 5 angka.')
    setMsg(''); setErr(''); setPcBusy(true)
    try {
      await apiSetPasscode(u.id, pcVal, u.role)
      accountList.mutate(users.map((x) => (x.id === u.id ? { ...x, has_passcode: true } : x)))
      setPcTarget(null); setPcVal('')
      setMsg(`Passcode ${u.name} diperbarui.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan passcode.')
    } finally {
      setPcBusy(false)
    }
  }

  async function clearPc(u: User) {
    setMsg(''); setErr(''); setPcBusy(true)
    try {
      await apiSetPasscode(u.id, '', u.role)
      accountList.mutate(users.map((x) => (x.id === u.id ? { ...x, has_passcode: false } : x)))
      setConfirmResetId(null)
      setMsg(`Passcode ${u.name} dinonaktifkan.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus passcode.')
    } finally {
      setPcBusy(false)
    }
  }

  const sendPwOtp = useCallback(async () => {
    const email = session?.email.trim().toLowerCase() ?? ''
    if (!email) return setPwdErr('Email akun tidak ditemukan.')
    setPwdErr(''); setOtp(''); setOtpSending(true); setOtpRequested(true)
    try {
      await apiSendPasswordResetOtp(email)
      setOtpSent(true)
      setCooldown(60)
    } catch (x) {
      if (x instanceof ApiError && x.status === 429) setCooldown(60)
      setOtpSent(false)
      setPwdErr(x instanceof Error ? x.message : 'Gagal mengirim kode. Coba lagi.')
    } finally {
      setOtpSending(false)
    }
  }, [session?.email])

  // Verifikasi muncul otomatis: begitu kata sandi baru valid,
  // kode OTP langsung dikirim tanpa perlu tekan tombol.
  const pwValid = newPw.length >= 8 && newPw === newPw2
  useEffect(() => {
    if (!pwValid || otpRequested || cooldown > 0 || pwdBusy) return
    const t = setTimeout(() => { sendPwOtp() }, 400)
    return () => clearTimeout(t)
  }, [pwValid, otpRequested, cooldown, pwdBusy, sendPwOtp])

  async function submitPwReset() {
    const email = session?.email.trim().toLowerCase() ?? ''
    setPwdErr('')
    if (newPw.length < 8) return setPwdErr('Kata sandi baru minimal 8 karakter.')
    if (newPw !== newPw2) return setPwdErr('Konfirmasi kata sandi tidak cocok.')
    if (otp.length !== 6) return setPwdErr('Masukkan kode 6 digit dari email.')
    setPwdBusy(true)
    try {
      await apiResetPassword(email, otp, newPw)
      setNewPw(''); setNewPw2(''); setOtp(''); setOtpSent(false)
      await apiLogout()
      setSession(null)
      nav('/masuk', { replace: true })
    } catch (x) {
      if (x instanceof ApiError && (x.status === 410 || x.status === 429)) setCooldown(0)
      if (x instanceof ApiError && x.status === 400) setOtp('')
      setPwdErr(x instanceof Error ? x.message : 'Gagal mengganti kata sandi.')
    } finally {
      setPwdBusy(false)
    }
  }

  async function keluar() {
    setBusy(true)
    await apiLogout()
    setSession(null)
    nav('/masuk', { replace: true })
  }

  const s = session
  const me = users.find((u) => u.id === s?.id) ?? null
  const cashiers = users.filter((u) => u.role === 'cashier')
  const taxed = todayTrx.data?.items.filter((t) => t.tax > 0).length ?? 0
  const trxTotal = todayTrx.data?.total ?? 0

  const storeComplete = (form?.storeName.trim() ?? '') !== ''

  const sample = useMemo(() => {
    const taxOn = form?.taxEnabled ?? false
    const pct = form?.taxPct ?? 0
    const subtotal = SAMPLE_ITEMS.reduce((n, i) => n + i.qty * i.price, 0)
    const tax = taxOn ? Math.round((subtotal * pct) / 100) : 0
    return { subtotal, tax, total: subtotal + tax }
  }, [form])

  const sampleTrx: Trx = useMemo(() => ({
    id: '1',
    cashier_name: session?.name ?? 'Kasir',
    items: SAMPLE_ITEMS.map((i, ix) => ({ product_id: `s${ix}`, name: i.name, buy_price: i.price, price: i.price, qty: i.qty })),
    subtotal: sample.subtotal,
    discount: 0,
    tax: sample.tax,
    total: sample.total,
    method: 'Cash',
    paid: sample.total,
    change: 0,
    status: 'completed',
    customer: '',
    created_at: new Date().toISOString(),
  }), [sample, session?.name])

  if (!form) {
    return (
      <>
        <PageHead title="Pengaturan" sub="Kelola akun, toko, struk, pajak, dan keamanan." />
        {loadErr ? (
          <div className="max-w-2xl rounded-2xl bg-cream p-6 text-center">
            <p className="text-sm text-ember">Gagal memuat pengaturan.</p>
            <p className="mt-1 text-[13px] text-muted">Coba muat ulang halaman.</p>
            <Button className="mt-4" onClick={retry}>Coba Lagi</Button>
          </div>
        ) : (
          <>
            <div className="mb-5 flex gap-2" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9 w-20 rounded-full" />
              ))}
            </div>
            <div className="max-w-2xl rounded-2xl bg-cream p-6" aria-busy="true" aria-label="Memuat pengaturan">
              <div className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <div className="mt-5 flex gap-2">
                <Skeleton className="h-12 w-32 rounded-full" />
                <Skeleton className="h-12 w-24 rounded-full" />
              </div>
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <>
      <PageHead title="Pengaturan" sub="Kelola akun, toko, struk, pajak, dan keamanan." />

      {err && <p className="mb-4 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember" role="alert">{err}</p>}
      {msg && <p className="mb-4 rounded-lg bg-surface px-3.5 py-2.5 text-[13px] text-sprout">{msg}</p>}

      <div className="mb-5 flex gap-2 overflow-x-auto" role="tablist" aria-label="Subhalaman pengaturan">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${tab === t.id ? 'border-jet bg-jet text-paper' : 'border-dove bg-cream text-muted hover:border-jet'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'akun' && (
        <div className="space-y-4">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card>
              <CardHead kicker="Akun saya" title="Informasi Akun" />
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-jet font-mono text-lg text-paper" aria-hidden="true">
                  {(session?.name ?? '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-fg">{session?.name ?? '—'}</p>
                  <p className="truncate text-[13px] text-muted">{session?.email || 'Tanpa email'} · {session?.store ?? '—'}</p>
                </div>
                <span className="flex gap-1.5">
                  <Pill tone={session?.role === 'admin' ? 'ok' : 'muted'}>{session?.role === 'admin' ? 'Admin' : 'Kasir'}</Pill>
                  <Pill tone={me?.active === false ? 'muted' : 'ok'}>{me?.active === false ? 'Nonaktif' : 'Akun Aktif'}</Pill>
                </span>
              </div>
              <div className="mt-4 divide-y divide-dove border-t border-dove">
                <MetaRow label="Toko" value={session?.store ?? '—'} />
                <MetaRow label="Bergabung" value={me?.created_at ? fmtDate(me.created_at) : '—'} />
                <MetaRow
                  label="Terakhir login"
                  value={!me?.last_seen_at ? '—' : me.last_seen_at.slice(0, 10) >= today ? `Hari ini, ${fmtTime(me.last_seen_at)}` : fmtDate(me.last_seen_at)}
                />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {session?.role === 'admin' && (
                  <Link to="/app/users" className="inline-flex items-center justify-center gap-2 rounded-full border border-dove bg-transparent px-6 py-3 text-[15px] font-medium transition hover:border-jet">
                    <Users className="size-4" /> Kelola Kasir
                  </Link>
                )}
                <Button variant="danger" onClick={keluar} disabled={busy}><LogOut className="size-4" /> Keluar</Button>
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2">
                <Lock className="size-4 text-steel" aria-hidden="true" />
                <div>
                  <h2 className="text-[15px] font-medium text-fg">Keamanan &amp; Passcode</h2>
                  <p className="mt-0.5 text-[13px] text-muted">Atur passcode untuk akses kasir dan keamanan sistem.</p>
                </div>
              </div>
              <div className="divide-y divide-dove rounded-xl border border-dove px-4">
                <div className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="text-muted">Status Passcode</span>
                  {me == null ? (
                    <span className="text-fog">—</span>
                  ) : (
                    <Pill tone={me.has_passcode ? 'ok' : 'muted'}>{me.has_passcode ? 'Aktif' : 'Tidak aktif'}</Pill>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="text-muted">Akun dilindungi</span>
                  <span className="text-right font-medium text-fg">{session?.name ?? '—'}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => { if (me) { setPcTarget(me); setPcVal(''); setErr('') } }} disabled={!me}>
                  <KeyRound className="size-4" /> Ubah Passcode
                </Button>
                <Button variant="ghost" onClick={() => { setResetOpen(true); setConfirmResetId(null); setErr('') }}>
                  Reset Passcode Kasir
                </Button>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface px-3.5 py-3 text-[13px] text-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-steel" aria-hidden="true" />
                <p>Gunakan passcode yang kuat untuk melindungi data transaksi dan batasi akses hanya untuk kasir yang berwenang.</p>
              </div>
            </Card>
          </div>

          <Card>
            <CardHead title="Kata Sandi Akun" sub="Perbarui kata sandi untuk melindungi akun Anda." />
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-4">
                {pwdErr && <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember" role="alert">{pwdErr}</p>}
                <PwField label="Kata sandi baru" value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew((v) => !v)} auto="new-password" />
                {newPw !== '' && (
                  <div aria-live="polite">
                    <div className="flex gap-1" aria-hidden="true">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className={`h-1.5 flex-1 rounded-full ${i < pwScore(newPw) ? SCORE_BAR[pwScore(newPw)] : 'bg-dove'}`} />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted">Kekuatan: <span className="font-medium text-fg">{SCORE_LABEL[pwScore(newPw)]}</span></p>
                    <ul className="mt-2 space-y-1">
                      {[
                        { ok: newPw.length >= 8, label: 'Minimal 8 karakter' },
                        { ok: /\d/.test(newPw), label: 'Mengandung angka' },
                        { ok: /[a-z]/.test(newPw) && /[A-Z]/.test(newPw), label: 'Huruf besar dan kecil' },
                      ].map((r) => (
                        <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? 'text-sprout' : 'text-fog'}`}>
                          {r.ok ? <Check className="size-3.5" /> : <span className="grid size-3.5 place-items-center" aria-hidden="true">·</span>}
                          {r.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <PwField label="Ulangi kata sandi baru" value={newPw2} onChange={setNewPw2} show={showNew2} onToggle={() => setShowNew2((v) => !v)} auto="new-password" />
                {(otpSending || otpSent) && (
                  <div className="space-y-2" aria-live="polite">
                    <p className="text-[13px] text-muted">
                      {otpSent ? (
                        <>Kode 6 digit terkirim ke <strong className="text-fg">{session?.email.trim().toLowerCase()}</strong>. Cek email lalu masukkan di bawah. Kode berlaku 10 menit.</>
                      ) : (
                        'Mengirim kode verifikasi ke email…'
                      )}
                    </p>
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      type="text" inputMode="numeric" autoComplete="one-time-code"
                      placeholder="••••••"
                      aria-label="Kode verifikasi 6 digit"
                      className="w-full rounded-md border border-border bg-paper px-3.5 py-3 text-center font-mono text-xl tracking-[0.5em] focus:border-jet focus:outline-none"
                    />
                    {otpRequested && (
                      <button
                        type="button"
                        onClick={() => sendPwOtp()}
                        disabled={cooldown > 0 || pwdBusy || otpSending}
                        className="text-[13px] font-medium text-jet hover:underline disabled:opacity-50"
                      >
                        {cooldown > 0 ? `Kirim ulang dalam ${cooldown} detik` : 'Kirim ulang kode'}
                      </button>
                    )}
                  </div>
                )}
                <Button onClick={submitPwReset} disabled={pwdBusy || newPw.length < 8 || newPw !== newPw2 || !otpSent || otp.length !== 6} className="w-full sm:w-auto">
                  {pwdBusy ? 'Menyimpan…' : 'Simpan kata sandi baru'}
                </Button>
              </div>
              <div className="h-fit rounded-xl bg-surface p-4 text-[13px]">
                <p className="flex items-center gap-2 font-medium text-fg"><ShieldCheck className="size-4 text-steel" /> Cara mengganti kata sandi</p>
                <ol className="mt-2.5 list-decimal space-y-1.5 pl-5 text-muted">
                  <li>Tulis kata sandi baru di form sebelah kiri, lalu ulangi sekali lagi.</li>
                  <li>Kode verifikasi terkirim otomatis ke email Anda begitu kata sandi barunya valid. Buka email Anda.</li>
                  <li>Masukkan kode 6 digit yang Anda terima, lalu tekan Simpan kata sandi baru.</li>
                  <li>Selesai. Anda akan keluar otomatis dan bisa masuk lagi dengan kata sandi yang baru.</li>
                </ol>
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-paper px-3 py-2.5 text-muted">
                  <Info className="mt-0.5 size-4 shrink-0 text-steel" aria-hidden="true" />
                  <p>Tips: pakai kata sandi yang belum pernah dipakai di aplikasi lain. Kode hanya berlaku 10 menit, jadi langsung dipakai begitu diterima.</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'toko' && (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHead title="Informasi Toko" sub="Lengkapi informasi toko Anda." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Nama Toko *" value={form.storeName} onChange={set('storeName')} placeholder="Toko Andika" />
              <Soon>
                <label className={LABEL_CLS}>
                  Jenis Usaha *
                  <select disabled className={INPUT_CLS} value="" onChange={() => {}}>
                    <option value="">Menunggu backend</option>
                  </select>
                </label>
              </Soon>
              <Input label="No. Telepon" value={form.phone} onChange={set('phone')} placeholder="0812…" />
              <Soon>
                <label className={LABEL_CLS}>
                  Email
                  <input disabled className={INPUT_CLS} value="" placeholder="Menunggu backend" onChange={() => {}} />
                </label>
              </Soon>
              <label className={`${LABEL_CLS} sm:col-span-2`}>
                Alamat
                <textarea value={form.address} onChange={(e) => set('address')(e.target.value)} rows={3} placeholder="Jl. …" className={INPUT_CLS} />
              </label>
              <Soon>
                <label className={LABEL_CLS}>
                  Kota
                  <input disabled className={INPUT_CLS} value="" placeholder="Menunggu backend" onChange={() => {}} />
                </label>
              </Soon>
              <Soon>
                <label className={LABEL_CLS}>
                  Provinsi
                  <select disabled className={INPUT_CLS} value="" onChange={() => {}}>
                    <option value="">Menunggu backend</option>
                  </select>
                </label>
              </Soon>
              <Soon>
                <label className={LABEL_CLS}>
                  Mata Uang
                  <select disabled className={INPUT_CLS} value="IDR" onChange={() => {}}>
                    <option value="IDR">Rupiah (IDR)</option>
                  </select>
                </label>
              </Soon>
              <label className={LABEL_CLS}>
                Timezone
                <select value={form.timezone} onChange={(e) => set('timezone')(e.target.value)} className={INPUT_CLS}>
                  {!TIMEZONES.some((t) => t.value === form.timezone) && <option value={form.timezone}>{form.timezone}</option>}
                  {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-5">
              <p className="text-[13px] font-medium text-steel">Logo Toko</p>
              <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-dashed border-dove p-4 opacity-80">
                <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-surface text-fog"><ImagePlus className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted">Belum ada logo toko</p>
                  <p className="text-xs text-fog">PNG, JPG maks. 2MB · Segera hadir — menunggu backend.</p>
                </div>
                <Button variant="ghost" disabled>Pilih Gambar</Button>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-1 flex items-center gap-2">
                <p className="text-[13px] font-medium text-steel">Jam Operasional</p>
                <Pill tone="muted">Segera</Pill>
              </div>
              <p className="mb-2 text-xs text-fog">Atur jam operasional toko Anda. Segera hadir — menunggu backend.</p>
              <div className="space-y-2 opacity-80">
                {[['Senin – Jumat', true], ['Sabtu', true], ['Minggu', false]].map(([day, on]) => (
                  <div key={day as string} className="flex flex-wrap items-center gap-2 text-sm">
                    <label className="flex min-w-32 cursor-not-allowed items-center gap-2 text-fg">
                      <input type="checkbox" checked={!!on} disabled className="h-4 w-4 accent-jet" /> {day}
                    </label>
                    {on ? (
                      <>
                        <input disabled value="08:00" onChange={() => {}} aria-label="Jam buka" className="w-24 rounded-md border border-border bg-paper px-2 py-1.5 font-mono text-[13px] tabular-nums" />
                        <span className="text-fog">—</span>
                        <input disabled value="21:00" onChange={() => {}} aria-label="Jam tutup" className="w-24 rounded-md border border-border bg-paper px-2 py-1.5 font-mono text-[13px] tabular-nums" />
                      </>
                    ) : (
                      <span className="text-[13px] text-fog">Tutup</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <FormActions dirty={dirty} busy={busy} onReset={resetForm} onSave={save} />
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHead title="Preview Profil Toko" sub="Ini adalah tampilan informasi toko Anda." />
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface text-fog"><ImagePlus className="size-5" /></span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-fg">{form.storeName || '—'}</p>
                  <p className="text-[13px] text-muted">Retail</p>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-[13px]">
                <p className="flex items-center gap-2 text-muted"><Phone className="size-3.5 shrink-0" />{form.phone || '—'}</p>
                <p className="flex items-center gap-2 text-muted"><Mail className="size-3.5 shrink-0" />—</p>
                <p className="flex items-start gap-2 text-muted"><MapPin className="mt-0.5 size-3.5 shrink-0" /><span>{form.address || '—'}</span></p>
                <p className="flex items-center gap-2 text-muted"><Clock className="size-3.5 shrink-0" />Buka Senin – Sabtu · 08:00 – 21:00</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Pill tone="muted">Rupiah (IDR)</Pill>
                <Pill tone="muted">{form.timezone}</Pill>
              </div>
            </Card>
            <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-[13px] ${storeComplete ? 'border-sprout/40 bg-success-bg text-sprout' : 'border-dove bg-surface text-muted'}`}>
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-fg">{storeComplete ? 'Informasi toko lengkap' : 'Informasi toko belum lengkap'}</p>
                <p className="mt-0.5">{storeComplete ? 'Semua informasi penting sudah diisi dengan benar.' : 'Lengkapi nama toko yang masih diperlukan.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'struk' && (
        <div className="grid items-start gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHead title="Pengaturan Struk" sub="Atur tampilan dan konten struk sesuai kebutuhan toko Anda." />
            <div className="space-y-4">
              <Input label="Header Toko" value={form.storeName} onChange={set('storeName')} hint="Nama toko yang akan ditampilkan di struk" />
              <label className={LABEL_CLS}>
                Footer Struk
                <textarea value={form.receiptHeader} onChange={(e) => set('receiptHeader')(e.target.value)} rows={2} placeholder="Terima kasih telah berbelanja di toko kami." className={INPUT_CLS} />
              </label>
              <div>
                <p className="mb-1 text-[13px] font-medium text-steel">Tampilan struk</p>
                <div className="divide-y divide-dove rounded-xl border border-dove px-4 opacity-80">
                  {['Tampilkan Logo Toko', 'Tampilkan Nama Kasir', 'Tampilkan Metode Pembayaran', 'Tampilkan Pajak', 'Tampilkan Diskon', 'Tampilkan QRIS / Catatan'].map((l) => (
                    <label key={l} className="flex cursor-not-allowed items-center justify-between gap-3 py-2.5 text-sm text-fg">
                      {l}
                      <span className="flex items-center gap-2">
                        <Pill tone="muted">Segera</Pill>
                        <input type="checkbox" checked disabled className="h-4 w-4 accent-jet" />
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <label className={LABEL_CLS}>
                Lebar Kertas
                <select value={form.paper} onChange={(e) => set('paper')(e.target.value)} className={INPUT_CLS}>
                  <option value="58mm">58 mm (Thermal)</option>
                  <option value="80mm">80 mm (Thermal)</option>
                </select>
              </label>
              <label className={LABEL_CLS}>
                Pesan Footer
                <textarea
                  value={form.receiptFooter}
                  onChange={(e) => set('receiptFooter')(e.target.value.slice(0, 200))}
                  rows={2}
                  placeholder="Barang yang sudah dibeli tidak dapat ditukar atau dikembalikan."
                  className={INPUT_CLS}
                />
                <span className="text-xs font-normal text-fog">{form.receiptFooter.length}/200</span>
              </label>
            </div>
            <FormActions dirty={dirty} busy={busy} onReset={resetForm} onSave={save} />
          </Card>

          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHead title="Preview Struk" sub="Ini adalah tampilan struk yang akan dicetak." />
              <div className="flex justify-center overflow-x-auto rounded-xl bg-surface p-4">
                <div className="bg-white px-3 py-4 font-mono text-[11px] leading-relaxed text-black" style={{ width: form.paper }}>
                  <p className="text-center text-[13px] font-bold uppercase">{form.storeName || '—'}</p>
                  {form.address && <p className="mt-0.5 text-center text-[10px]">{form.address}</p>}
                  {form.phone && <p className="text-center text-[10px]">{form.phone}</p>}
                  <div className="receipt-hr my-2" aria-hidden="true" />
                  <p>No. #TRX-00001</p>
                  <p>Kasir: {session?.name ?? '—'}</p>
                  <p>Tanggal: {today}</p>
                  <div className="receipt-hr my-2" aria-hidden="true" />
                  {SAMPLE_ITEMS.map((i) => (
                    <div key={i.name} className="mt-1">
                      <p className="break-words">{i.name}</p>
                      <div className="flex justify-between gap-2 tabular-nums">
                        <span>{i.qty} × {fmtRp(i.price)}</span>
                        <span>{fmtRp(i.qty * i.price)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="receipt-hr my-2" aria-hidden="true" />
                  <div className="flex justify-between tabular-nums"><span>Subtotal</span><span>{fmtRp(sample.subtotal)}</span></div>
                  {form.taxEnabled && <div className="flex justify-between tabular-nums"><span>Pajak</span><span>{fmtRp(sample.tax)}</span></div>}
                  <div className="flex justify-between font-bold tabular-nums"><span>TOTAL</span><span>{fmtRp(sample.total)}</span></div>
                  <div className="receipt-hr my-2" aria-hidden="true" />
                  {form.receiptHeader && <p className="text-center text-[10px]">{form.receiptHeader}</p>}
                  {form.receiptFooter && <p className="mt-1 text-center text-[10px]">{form.receiptFooter}</p>}
                </div>
              </div>
              <Button variant="ghost" className="mt-3 w-full" onClick={() => setPrintTest(true)}>
                <Printer className="size-4" /> Cetak Uji Coba
              </Button>
            </Card>
          </div>
        </div>
      )}

      {tab === 'pajak' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: 'Pajak Aktif', value: form.taxEnabled ? 'Ya' : 'Tidak', sub: 'Pajak sedang digunakan' },
              { label: 'Tarif Pajak', value: `${form.taxPct}%`, sub: 'Tarif pajak saat ini' },
              { label: 'Harga Sudah Termasuk Pajak', value: '—', sub: 'Segera hadir' },
              { label: 'Transaksi Kena Pajak Hari Ini', value: String(taxed), sub: `Dari ${trxTotal} transaksi` },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl bg-cream p-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-fog">{k.label}</p>
                <p className="mt-1 text-2xl font-medium tabular-nums text-fg">{k.value}</p>
                <p className="mt-0.5 text-xs text-muted">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHead title="Pengaturan Pajak" sub="Atur konfigurasi pajak untuk transaksi di toko Anda." />
              <div className="space-y-4">
                <Soon>
                  <label className={LABEL_CLS}>
                    Nama Pajak
                    <input disabled className={INPUT_CLS} value="" placeholder="cth: PPN" onChange={() => {}} />
                  </label>
                </Soon>
                <NumInput allowDecimal label="Tarif Pajak (%)" value={form.taxPct} onValue={(r) => setForm((f) => (f ? { ...f, taxPct: r === '' ? 0 : Number(r.replace(',', '.')) } : f))} />
                <Soon>
                  <label className="flex cursor-not-allowed items-center justify-between gap-3 text-sm text-fg">
                    Harga Sudah Termasuk Pajak
                    <input type="checkbox" disabled className="h-4 w-4 accent-jet" />
                  </label>
                </Soon>
                <Soon>
                  <label className={LABEL_CLS}>
                    Pembulatan Pajak
                    <select disabled className={INPUT_CLS} value="" onChange={() => {}}>
                      <option value="">Menunggu backend</option>
                    </select>
                  </label>
                </Soon>
                <Soon>
                  <label className={LABEL_CLS}>
                    Terapkan Pajak Pada
                    <select disabled className={INPUT_CLS} value="" onChange={() => {}}>
                      <option value="">Menunggu backend</option>
                    </select>
                  </label>
                </Soon>
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-fg">
                  Status Pajak
                  <input type="checkbox" checked={form.taxEnabled} onChange={(e) => setForm((f) => (f ? { ...f, taxEnabled: e.target.checked } : f))} className="h-4 w-4 accent-jet" />
                </label>
                <p className="-mt-2 text-xs text-fog">Aktifkan atau nonaktifkan perhitungan pajak.</p>
              </div>
              <FormActions dirty={dirty} busy={busy} onReset={resetForm} onSave={save} />
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHead title="Contoh Perhitungan Pajak" sub="Simulasi perhitungan pada transaksi." />
                <div className="space-y-1 font-mono text-[13px] tabular-nums">
                  <div className="flex justify-between"><span className="font-sans text-muted">Harga Produk</span><span>{fmtRp(100000)}</span></div>
                  <div className="flex justify-between"><span className="font-sans text-muted">Pajak ({form.taxPct}%)</span><span>{fmtRp(Math.round((100000 * form.taxPct) / 100))}</span></div>
                  <div className="my-2 border-t border-dashed border-dove" />
                  <div className="flex justify-between font-bold"><span className="font-sans">Total</span><span>{fmtRp(100000 + Math.round((100000 * form.taxPct) / 100))}</span></div>
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface px-3.5 py-3 text-[13px] text-muted">
                  <Info className="mt-0.5 size-4 shrink-0 text-steel" aria-hidden="true" />
                  <p>Karena harga belum termasuk pajak, maka pajak akan ditambahkan ke total transaksi.</p>
                </div>
              </Card>
              <Card>
                <CardHead title="Aktivitas Pajak Terkini" sub="Log perubahan pengaturan pajak." />
                <p className="py-4 text-center text-sm text-fog">Belum ada aktivitas pengaturan.</p>
              </Card>
            </div>
          </div>
        </div>
      )}

      <Modal open={pcTarget != null} title="Ubah Passcode" onClose={() => { setPcTarget(null); setPcVal('') }}>
        <p className="mb-3 text-sm text-muted">Passcode 5 angka untuk <strong className="text-fg">{pcTarget?.name}</strong>.</p>
        <input
          value={pcVal}
          onChange={(e) => setPcVal(e.target.value.replace(/\D/g, '').slice(0, 5))}
          inputMode="numeric"
          placeholder="•••••"
          aria-label="Passcode baru"
          className="w-full rounded-md border border-border bg-paper px-3.5 py-3 text-center font-mono text-lg tracking-[0.5em] focus:border-jet focus:outline-none"
        />
        <div className="mt-4 flex gap-2">
          <Button onClick={() => pcTarget && savePc(pcTarget)} disabled={pcBusy || pcVal.length !== 5} className="flex-1">{pcBusy ? '…' : 'Simpan passcode'}</Button>
          <Button variant="ghost" onClick={() => { setPcTarget(null); setPcVal('') }}>Batal</Button>
        </div>
      </Modal>

      <Modal open={resetOpen} title="Reset Passcode Kasir" onClose={() => { setResetOpen(false); setConfirmResetId(null) }}>
        <p className="mb-3 text-sm text-muted">Pilih kasir yang passcodenya akan dinonaktifkan.</p>
        <div className="space-y-2">
          {cashiers.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-dove px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{u.name}</span>
              <Pill tone={u.has_passcode ? 'ok' : 'muted'}>{u.has_passcode ? 'Aktif' : 'Mati'}</Pill>
              {confirmResetId === u.id ? (
                <>
                  <button onClick={() => clearPc(u)} disabled={pcBusy} className="text-[13px] font-medium text-ember hover:underline disabled:opacity-40">
                    {pcBusy ? '…' : 'Yakin, nonaktifkan'}
                  </button>
                  <button onClick={() => setConfirmResetId(null)} className="text-[13px] text-muted hover:underline">Batal</button>
                </>
              ) : (
                <button onClick={() => setConfirmResetId(u.id)} disabled={!u.has_passcode || pcBusy} className="text-[13px] font-medium text-jet hover:underline disabled:opacity-40">
                  Reset
                </button>
              )}
            </div>
          ))}
          {cashiers.length === 0 && <p className="text-sm text-fog">Belum ada akun kasir.</p>}
        </div>
      </Modal>

      <Modal open={printTest} title="Cetak Uji Coba" onClose={() => setPrintTest(false)}>
        {form && <Receipt trx={sampleTrx} settings={form} onClose={() => setPrintTest(false)} />}
      </Modal>
    </>
  )
}
