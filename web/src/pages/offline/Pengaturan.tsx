import { useEffect, useState } from 'react'
import { apiGetSettings, apiUpdateSettings, type StoreSettings } from '../../lib/local-api'
import { useLocalDB, saveSettings } from '../../lib/localdb'
import { getSession, setSession } from '../../lib/store'
import { Button, Input, PageHead } from '../../lib/ui'

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

export default function OfflinePengaturan() {
  const db = useLocalDB()
  const [tab, setTab] = useState<TabId>('akun')
  const [form, setForm] = useState<StoreSettings | null>(null)
  const [ownerName, setOwnerName] = useState(db.settings.ownerName)
  const [storeName, setStoreName] = useState(db.settings.storeName)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    apiGetSettings().then(setForm).catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat pengaturan.'))
  }, [])

  const set = (k: keyof StoreSettings) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f))

  async function save() {
    if (!form) return
    setMsg(''); setErr(''); setBusy(true)
    try {
      const saved = await apiUpdateSettings(form)
      setForm(saved)
      const cur = getSession()
      if (cur && cur.store !== saved.storeName) setSession({ ...cur, store: saved.storeName })
      setMsg('Pengaturan disimpan.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan.')
    } finally {
      setBusy(false)
    }
  }

  function saveOwner() {
    setErr(''); setMsg('')
    if (!ownerName.trim() || !storeName.trim()) return setErr('Nama pemilik dan nama toko wajib diisi.')
    saveSettings({ ...db.settings, ownerName: ownerName.trim(), storeName: storeName.trim() })
    const cur = getSession()
    if (cur) setSession({ ...cur, name: ownerName.trim(), store: storeName.trim() })
    setMsg('Profil disimpan.')
  }

  if (!form) return <p className="py-14 text-center text-sm text-fog">Memuat…</p>

  return (
    <>
      <PageHead title="Pengaturan" sub="Kelola akun, toko, struk, dan pajak." />

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

      <div className="max-w-2xl space-y-6">
        {tab === 'akun' && (
          <section className="rounded-2xl bg-cream p-6">
            <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-fog">Profil</h2>
            <div className="space-y-4">
              <Input label="Nama pemilik" value={ownerName} onChange={setOwnerName} />
              <Input label="Nama toko" value={storeName} onChange={setStoreName} />
              <Button onClick={saveOwner} disabled={busy}>Simpan</Button>
            </div>
          </section>
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
      </div>
    </>
  )
}
