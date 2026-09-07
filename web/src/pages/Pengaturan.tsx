import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { apiGetSettings, apiListUsers, apiLogout, apiSetPasscode, apiUpdateSettings, type StoreSettings, type User } from '../lib/api'
import { setSession, useDB, useTheme } from '../lib/store'
import { Button, Input, PageHead, Pill } from '../lib/ui'

const TABS = [
  { id: 'akun', label: 'Akun' },
  { id: 'toko', label: 'Toko' },
  { id: 'struk', label: 'Struk' },
  { id: 'pajak', label: 'Pajak' },
  { id: 'passcode', label: 'Passcode' },
] as const

type TabId = (typeof TABS)[number]['id']

const TIMEZONES = [
  { value: 'Asia/Jakarta', label: 'WIB — Jakarta (UTC+7)' },
  { value: 'Asia/Makassar', label: 'WITA — Makassar (UTC+8)' },
  { value: 'Asia/Jayapura', label: 'WIT — Jayapura (UTC+9)' },
]

const PC_SET_KEY = 'op_pc_set'

// ponytail: status passcode hanya cache per-perangkat (backend tidak expos flag),
// upgrade path: tambah field has_passcode di GET /users lalu ganti badge pakai itu.
function loadPcSet(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(PC_SET_KEY) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

export default function Pengaturan() {
  const nav = useNavigate()
  const { session } = useDB()
  const [theme, setTheme] = useTheme()
  const [tab, setTab] = useState<TabId>('akun')
  const [form, setForm] = useState<StoreSettings | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [pcSet, setPcSet] = useState<Record<string, boolean>>(loadPcSet)
  const [editingPc, setEditingPc] = useState<string | null>(null)
  const [pcVal, setPcVal] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [pcBusy, setPcBusy] = useState(false)

  useEffect(() => {
    apiGetSettings().then(setForm).catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat pengaturan.'))
    apiListUsers().then(setUsers).catch(() => {})
  }, [])

  const set = (k: keyof StoreSettings) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f))

  function markPc(id: string, on: boolean) {
    setPcSet((prev) => {
      const next = { ...prev }
      if (on) next[id] = true
      else delete next[id]
      try {
        localStorage.setItem(PC_SET_KEY, JSON.stringify(next))
      } catch {
        // abaikan — cache hanya penanda badge
      }
      return next
    })
  }

  async function save() {
    if (!form) return
    setMsg(''); setErr(''); setBusy(true)
    try {
      setForm(await apiUpdateSettings(form))
      setMsg('Pengaturan disimpan.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan.')
    } finally {
      setBusy(false)
    }
  }

  async function savePc(u: User) {
    if (!/^\d{5}$/.test(pcVal)) return setErr('Passcode harus 5 angka.')
    setMsg(''); setErr(''); setPcBusy(true)
    try {
      await apiSetPasscode(u.id, pcVal, u.role)
      markPc(u.id, true)
      setEditingPc(null); setPcVal('')
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
      markPc(u.id, false)
      setEditingPc(null); setPcVal('')
      setMsg(`Passcode ${u.name} dinonaktifkan.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus passcode.')
    } finally {
      setPcBusy(false)
    }
  }

  async function keluar() {
    setBusy(true)
    await apiLogout()
    setSession(null)
    nav('/masuk', { replace: true })
  }

  if (!form) return <p className="py-14 text-center text-sm text-fog">Memuat…</p>

  return (
    <>
      <PageHead title="Pengaturan" sub="Kelola akun, toko, struk, pajak, dan passcode." />

      {err && <p className="mb-4 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>}
      {msg && <p className="mb-4 rounded-lg bg-surface px-3.5 py-2.5 text-[13px] text-sprout">{msg}</p>}

      <div className="mb-5 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${tab === t.id ? 'border-jet bg-jet text-paper' : 'border-dove bg-cream text-muted hover:border-jet'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-xl space-y-6">
        {tab === 'akun' && (
          <>
            <section className="rounded-2xl bg-cream p-6">
              <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-fog">Akun saya</h2>
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-jet font-mono text-lg text-paper">
                  {(session?.name ?? '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-fg">{session?.name ?? '—'}</p>
                  <p className="truncate text-[13px] text-muted">{session?.email || 'Tanpa email (kasir)'} · {session?.store ?? '—'}</p>
                </div>
                <Pill tone={session?.role === 'admin' ? 'ok' : 'muted'}>{session?.role === 'admin' ? 'Admin' : 'Kasir'}</Pill>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {session?.role === 'admin' && (
                  <Link to="/app/users" className="inline-flex items-center justify-center gap-2 rounded-full border border-dove bg-transparent px-6 py-3 text-[15px] font-medium transition hover:border-jet">
                    Kelola Kasir
                  </Link>
                )}
                <Button variant="danger" onClick={keluar} disabled={busy}>Keluar</Button>
              </div>
            </section>

            <section className="rounded-2xl bg-cream p-6">
              <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-fog">Tampilan</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${theme === 'light' ? 'border-jet bg-paper text-fg' : 'border-dove text-muted hover:border-jet'}`}
                >
                  Terang
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${theme === 'dark' ? 'border-jet bg-paper text-fg' : 'border-dove text-muted hover:border-jet'}`}
                >
                  Gelap
                </button>
              </div>
            </section>
          </>
        )}

        {tab === 'toko' && (
          <section className="rounded-2xl bg-cream p-6">
            <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-fog">Profil toko</h2>
            <div className="space-y-4">
              <Input label="Nama toko" value={form.storeName} onChange={set('storeName')} />
              <Input label="Alamat" value={form.address} onChange={set('address')} />
              <Input label="Telepon" value={form.phone} onChange={set('phone')} />
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                Zona waktu
                <select value={form.timezone} onChange={(e) => set('timezone')(e.target.value)} className="rounded-md border border-border bg-paper px-3.5 py-2.5 text-[15px] text-fg focus:border-jet focus:outline-none">
                  {!TIMEZONES.some((t) => t.value === form.timezone) && <option value={form.timezone}>{form.timezone}</option>}
                  {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <Button onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
            </div>
          </section>
        )}

        {tab === 'struk' && (
          <section className="rounded-2xl bg-cream p-6">
            <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-fog">Struk</h2>
            <div className="space-y-4">
              <Input label="Header struk" value={form.receiptHeader} onChange={set('receiptHeader')} />
              <Input label="Footer struk" value={form.receiptFooter} onChange={set('receiptFooter')} />
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                Ukuran kertas default
                <select value={form.paper} onChange={(e) => set('paper')(e.target.value)} className="rounded-md border border-border bg-paper px-3.5 py-2.5 text-[15px] text-fg focus:border-jet focus:outline-none">
                  <option value="58mm">58 mm</option>
                  <option value="80mm">80 mm</option>
                </select>
              </label>
              <Button onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
            </div>
          </section>
        )}

        {tab === 'pajak' && (
          <section className="rounded-2xl bg-cream p-6">
            <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-fog">Pajak</h2>
            <div className="space-y-4">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg">
                <input type="checkbox" checked={form.taxEnabled} onChange={(e) => setForm({ ...form, taxEnabled: e.target.checked })} className="h-4 w-4 accent-jet" />
                Aktifkan pajak transaksi
              </label>
              {form.taxEnabled && <Input label="Persentase pajak (%)" type="number" value={form.taxPct} onChange={set('taxPct')} />}
              <Button onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
            </div>
          </section>
        )}

        {tab === 'passcode' && (
          <section className="rounded-2xl bg-cream p-6">
            <h2 className="mb-1 font-mono text-xs uppercase tracking-wider text-fog">Passcode akun</h2>
            <p className="mb-4 text-[13px] text-muted">Passcode 5 angka diminta saat login & ganti akun. Status tercatat di perangkat ini.</p>
            <div className="space-y-3">
              {users.map((u) => {
                const known = !!pcSet[u.id]
                const editing = editingPc === u.id
                return (
                  <div key={`${u.role}-${u.id}`} className="rounded-lg border border-dove bg-paper px-3.5 py-2.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-36 flex-1">
                        <p className="text-sm font-medium text-fg">{u.name}</p>
                        <p className="font-mono text-[11px] text-fog">{u.role === 'admin' ? 'Admin' : 'Kasir'}{u.email ? ` · ${u.email}` : ''}</p>
                      </div>
                      {known
                        ? <span className="font-mono text-sm tracking-[0.3em] text-fg" aria-label="Passcode terpasang">•••••</span>
                        : <span className="text-xs text-fog">Belum dipasang</span>}
                      <Pill tone={known ? 'ok' : 'muted'}>{known ? 'Aktif' : 'Mati'}</Pill>
                      {!editing && (
                        <button className="text-[13px] font-medium text-jet hover:underline" onClick={() => { setEditingPc(u.id); setPcVal(''); setErr('') }}>
                          {known ? 'Ganti' : 'Pasang'}
                        </button>
                      )}
                    </div>
                    {editing && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dove pt-3">
                        <input
                          value={pcVal}
                          onChange={(e) => setPcVal(e.target.value.replace(/\D/g, '').slice(0, 5))}
                          inputMode="numeric"
                          placeholder="5 angka baru"
                          aria-label={`Passcode baru ${u.name}`}
                          className="w-36 rounded-md border border-border bg-paper px-3 py-2 text-center font-mono tracking-[0.3em] focus:border-jet focus:outline-none"
                        />
                        <button
                          onClick={() => savePc(u)}
                          disabled={pcBusy || pcVal.length !== 5}
                          className="rounded-md bg-jet px-3.5 py-2 text-[13px] font-medium text-paper disabled:opacity-40"
                        >
                          {pcBusy ? '…' : 'Simpan passcode'}
                        </button>
                        {known && (
                          <button onClick={() => clearPc(u)} disabled={pcBusy} className="text-[13px] text-ember hover:underline disabled:opacity-40">
                            Hapus
                          </button>
                        )}
                        <button onClick={() => { setEditingPc(null); setPcVal('') }} className="text-[13px] text-muted hover:underline">
                          Batal
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {users.length === 0 && <p className="text-sm text-fog">Daftar akun tidak tersedia.</p>}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
