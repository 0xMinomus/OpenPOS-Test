import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  apiGetSettings, apiListTransactions, apiUpdateSettings,
  type Page, type StoreSettings, type Trx,
} from '../../lib/local-api'
import { useCache } from '../../lib/cache'
import { useLocalDB, saveSettings } from '../../lib/localdb'
import { fmtRp, getSession, setSession } from '../../lib/store'
import { Button, Input, Modal, NumInput, PageHead } from '../../lib/ui'
import { Receipt } from '../../lib/receipt'
import { Skeleton } from '@/components/ui/skeleton'

// Versi offline dari Pengaturan cloud: struktur & tampilan sama,
// tanpa fitur yang butuh backend (akun kasir, passcode, kata sandi,
// field kontrak settings-extended, log audit).

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

function FormActions({ dirty, busy, onReset, onSave }: { dirty: boolean; busy: boolean; onReset: () => void; onSave: () => void }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <Button variant="ghost" onClick={onReset} disabled={busy || !dirty}>Reset</Button>
      <Button onClick={onSave} disabled={busy || !dirty}>{busy ? 'Menyimpan…' : 'Simpan Perubahan'}</Button>
    </div>
  )
}

const SAMPLE_ITEMS = [
  { name: 'Indomie Goreng', qty: 2, price: 12000 },
  { name: 'Aqua 600ml', qty: 1, price: 5000 },
  { name: 'Roti Tawar', qty: 1, price: 15000 },
]

export default function OfflinePengaturan() {
  const db = useLocalDB()
  const today = todayStr()
  const [tab, setTab] = useState<TabId>('akun')
  const [form, setForm] = useState<StoreSettings | null>(null)
  const [saved, setSaved] = useState<StoreSettings | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [ownerName, setOwnerName] = useState(db.settings.ownerName)
  const [storeName, setStoreName] = useState(db.settings.storeName)
  const todayTrx = useCache<Page<Trx>>(`offline-pengaturan-trx:${today}`, () => apiListTransactions({ date: today, limit: 200, page: 1 }))

  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [printTest, setPrintTest] = useState(false)

  function fetchSettings() {
    return apiGetSettings()
      .then((s) => { setForm(s); setSaved(s) })
      .catch((e) => { setLoadErr(e instanceof Error ? e.message : 'Gagal memuat pengaturan.') })
  }

  useEffect(() => { fetchSettings() }, [])

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

  function retry() {
    setLoadErr(''); setErr('')
    fetchSettings()
  }

  function saveOwner() {
    setErr(''); setMsg('')
    if (!ownerName.trim() || !storeName.trim()) return setErr('Nama pemilik dan nama toko wajib diisi.')
    saveSettings({ ...db.settings, ownerName: ownerName.trim(), storeName: storeName.trim() })
    const cur = getSession()
    if (cur) setSession({ ...cur, name: ownerName.trim(), store: storeName.trim() })
    setMsg('Profil disimpan.')
  }

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
    cashier_name: db.settings.ownerName || 'Kasir',
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
  }), [sample, db.settings.ownerName])

  if (!form) {
    return (
      <>
        <PageHead title="Pengaturan" sub="Kelola akun, toko, struk, dan pajak." />
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
      <PageHead title="Pengaturan" sub="Kelola akun, toko, struk, dan pajak." />

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
        <div className="max-w-2xl">
          <Card>
            <CardHead kicker="Akun saya" title="Informasi Akun" sub="Profil pemilik perangkat ini." />
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-jet font-mono text-lg text-paper" aria-hidden="true">
                {(db.settings.ownerName || '?').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-fg">{db.settings.ownerName || '—'}</p>
                <p className="truncate text-[13px] text-muted">{db.settings.storeName || '—'}</p>
              </div>
              <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-[11px] font-medium text-sprout">Admin</span>
            </div>
            <div className="mt-4 divide-y divide-dove border-t border-dove">
              <MetaRow label="Toko" value={db.settings.storeName || '—'} />
              <MetaRow label="Mode" value="Offline · data di perangkat" />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Nama pemilik" value={ownerName} onChange={setOwnerName} />
              <Input label="Nama toko" value={storeName} onChange={setStoreName} />
            </div>
            <div className="mt-4">
              <Button onClick={saveOwner} disabled={busy}>Simpan</Button>
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
              <Input label="No. Telepon" value={form.phone} onChange={set('phone')} placeholder="0812…" />
              <label className={`${LABEL_CLS} sm:col-span-2`}>
                Alamat
                <textarea value={form.address} onChange={(e) => set('address')(e.target.value)} rows={3} placeholder="Jl. …" className={INPUT_CLS} />
              </label>
              <label className={LABEL_CLS}>
                Timezone
                <select value={form.timezone} onChange={(e) => set('timezone')(e.target.value)} className={INPUT_CLS}>
                  {!TIMEZONES.some((t) => t.value === form.timezone) && <option value={form.timezone}>{form.timezone}</option>}
                  {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
            </div>
            <FormActions dirty={dirty} busy={busy} onReset={resetForm} onSave={save} />
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHead title="Preview Profil Toko" sub="Ini adalah tampilan informasi toko Anda." />
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface text-[15px] font-medium text-steel" aria-hidden="true">
                  {(form.storeName || '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-fg">{form.storeName || '—'}</p>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-[13px] text-muted">
                <p>{form.phone || '—'}</p>
                <p>{form.address || '—'}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted">Rupiah (IDR)</span>
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted">{form.timezone}</span>
              </div>
            </Card>
            <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-[13px] ${storeComplete ? 'border-sprout/40 bg-success-bg text-sprout' : 'border-dove bg-surface text-muted'}`}>
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
                  <p>Kasir: {db.settings.ownerName || '—'}</p>
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
                Cetak Uji Coba
              </Button>
            </Card>
          </div>
        </div>
      )}

      {tab === 'pajak' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {[
              { label: 'Pajak Aktif', value: form.taxEnabled ? 'Ya' : 'Tidak', sub: 'Pajak sedang digunakan' },
              { label: 'Tarif Pajak', value: `${form.taxPct}%`, sub: 'Tarif pajak saat ini' },
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
                <NumInput allowDecimal label="Tarif Pajak (%)" value={form.taxPct} onValue={(r) => setForm((f) => (f ? { ...f, taxPct: r === '' ? 0 : Number(r.replace(',', '.')) } : f))} />
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
                <div className="mt-4 rounded-lg bg-surface px-3.5 py-3 text-[13px] text-muted">
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

      <Modal open={printTest} title="Cetak Uji Coba" onClose={() => setPrintTest(false)}>
        {form && <Receipt trx={sampleTrx} settings={form} onClose={() => setPrintTest(false)} />}
      </Modal>
    </>
  )
}
