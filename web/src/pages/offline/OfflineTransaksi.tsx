// Transaksi — transaction management workspace: ringkasan → cari/filter → review → detail/refund.
// Token font/warna milik sistem (tidak ada token baru di file ini).
import { useMemo, useState } from 'react'
import { Banknote, CalendarDays, ReceiptText, Search, Sigma } from 'lucide-react'
import { apiGetDashboard, apiListTransactions, apiRefundTransaction, fetchAll, type Trx } from '../../lib/local-api'
import { useCache } from '../../lib/cache'
import { exportCSV, fmtDate, fmtRp, fmtTime, useDB } from '../../lib/store'
import { NumInput, Button, DatePicker, Empty, Modal, PageHead, Pager, SkeletonRows, StatusPill, Td, Th, TrxItems } from '../../lib/ui'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const PAGE = 10
const METHODS = ['Semua', 'Cash', 'Bank Transfer', 'QRIS', 'E-Wallet', 'Card']

const fmtInv = (id: string) => (isNaN(Number(id)) ? `#${id}` : `#TRX-${String(Number(id)).padStart(5, '0')}`)

export default function Transaksi() {
  const db = useDB()
  const s = db.session!
  const [q, setQ] = useState('')
  const [method, setMethod] = useState('Semua')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(0)
  const f = {
    q: q.trim() || undefined,
    method: method === 'Semua' ? undefined : method,
    date: date || undefined,
  }
  const list = useCache(
    `trx:${s.id}:${s.role}:${q.trim()}:${method}:${date}:${page}`,
    () => apiListTransactions({ ...f, page: page + 1, limit: PAGE }),
    'Gagal memuat transaksi.',
  )
  const trx = list.data?.items ?? []
  const total = list.data?.total ?? 0
  const loading = list.loading
  // Ringkasan mengikuti filter aktif (fetch-all, pola sama seperti Export).
  const agg = useCache(
    `trxagg:${s.id}:${s.role}:${q.trim()}:${method}:${date}`,
    () => fetchAll<Trx>((pg) => apiListTransactions({ ...f, page: pg, limit: 200 })),
    'Gagal memuat ringkasan.',
  )
  const dash = useCache(`dashtrx:${s.id}:${s.role}`, apiGetDashboard)
  const [err, setErr] = useState('')
  const [detail, setDetail] = useState<Trx | null>(null)
  const [refundFor, setRefundFor] = useState<Trx | null>(null)
  const [refundItems, setRefundItems] = useState<{ productId: string; qty: number }[]>([])
  const [refundReason, setRefundReason] = useState('')
  const [busy, setBusy] = useState(false)

  const sum = useMemo(() => {
    if (!agg.data) return null
    const omzet = agg.data.reduce((n, t) => n + t.total, 0)
    const n = agg.data.length
    return { omzet, n, avg: n > 0 ? Math.round(omzet / n) : 0 }
  }, [agg.data])

  function load() {
    list.reload()
    agg.reload()
  }

  const pages = Math.max(1, Math.ceil(total / PAGE))
  const safePage = Math.min(page, pages - 1)

  async function exportList() {
    const all: Trx[] = []
    for (let p = 1; ; p++) {
      const r = await apiListTransactions({ q: q.trim() || undefined, method: method === 'Semua' ? undefined : method, date: date || undefined, page: p, limit: 200 })
      all.push(...r.items)
      if (all.length >= r.total) break
    }
    exportCSV('transaksi.csv', [
      ['id', 'waktu', 'kasir', 'metode', 'subtotal', 'diskon', 'pajak', 'total', 'dibayar', 'kembalian', 'status'],
      ...all.map((t) => [t.id, t.created_at, t.cashier_name, t.method, String(t.subtotal), String(t.discount), String(t.tax), String(t.total), String(t.paid), String(t.change), t.status]),
    ])
  }

  function openRefund(t: Trx) {
    setRefundFor(t)
    setRefundItems(t.items.map((i) => ({ productId: i.product_id, qty: i.qty })))
    setRefundReason('')
  }

  async function submitRefund() {
    if (!refundFor || !refundReason.trim()) return
    const items = refundItems.filter((i) => i.qty > 0)
    if (items.length === 0) return
    setBusy(true); setErr('')
    try {
      await apiRefundTransaction(refundFor.id, items, refundReason.trim())
      setRefundFor(null)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memproses refund.')
    } finally {
      setBusy(false)
    }
  }

  const isAdmin = s.role === 'admin'
  const cards = [
    { label: 'Total Transaksi', value: sum ? String(sum.n) : null, icon: ReceiptText, tint: 'text-[var(--chart-1)] bg-[color-mix(in_oklch,var(--chart-1)_12%,transparent)]' },
    { label: 'Total Penjualan', value: sum ? fmtRp(sum.omzet) : null, icon: Banknote, tint: 'text-[var(--t-sprout)] bg-[color-mix(in_oklch,var(--t-sprout)_12%,transparent)]' },
    { label: 'Transaksi Hari Ini', value: dash.data ? String(dash.data.today.trx_count) : null, icon: CalendarDays, tint: 'text-[var(--chart-2)] bg-[color-mix(in_oklch,var(--chart-2)_12%,transparent)]' },
    { label: 'Rata-rata Transaksi', value: sum ? fmtRp(sum.avg) : null, icon: Sigma, tint: 'text-[var(--chart-3)] bg-[color-mix(in_oklch,var(--chart-3)_14%,transparent)]' },
  ]

  return (
    <>
      <PageHead
        title="Transaksi"
        sub={s.role === 'cashier' ? 'Transaksi yang Anda buat sendiri.' : 'Kelola dan pantau seluruh transaksi penjualan.'}
        right={<Button variant="ghost" onClick={exportList}>Export CSV</Button>}
      />

      {(err || list.err) && <p className="mb-4 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err || list.err}</p>}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium text-muted-foreground">{c.label}</span>
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${c.tint}`}>
                  <c.icon className="size-4.5" />
                </span>
              </div>
              {c.value === null ? (
                <Skeleton className="mt-3 h-7 w-24" />
              ) : (
                <p className="mt-3 truncate text-lg font-semibold leading-none tabular-nums tracking-tight sm:text-[28px]" title={c.value}>{c.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fog" />
          <input
            value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Cari invoice, pelanggan, atau kasir…"
            aria-label="Cari transaksi"
            className="w-full rounded-md border border-border bg-paper py-2.5 pl-10 pr-3.5 text-sm focus:border-jet focus:outline-none"
          />
        </div>
        <div className="sm:w-60">
          <DatePicker value={date} onChange={(v) => { setDate(v); setPage(0) }} label="Filter tanggal" placeholder="Semua tanggal" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {METHODS.map((m) => (
          <button
            key={m}
            onClick={() => { setMethod(m); setPage(0) }}
            aria-pressed={method === m}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${method === m ? 'border-jet bg-jet font-medium text-paper' : 'border-dove text-muted hover:border-jet hover:text-fg'}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="mt-4 hidden overflow-x-auto rounded-2xl bg-cream p-2 sm:block">
        {loading || trx.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>Invoice</Th><Th>Tanggal</Th><Th>Pelanggan</Th>{isAdmin && <Th>Kasir</Th>}<Th>Produk</Th><Th right>Total</Th><Th>Pembayaran</Th><Th>Status</Th><Th />
              </tr>
            </thead>
            {loading ? (
              <SkeletonRows cols={isAdmin ? 9 : 8} rows={10} />
            ) : (
            <tbody>
              {trx.map((t) => (
                <tr key={t.id}>
                  <Td mono><span className="font-medium text-fg">{fmtInv(t.id)}</span></Td>
                  <Td>
                    <span className="block text-[13px] text-fg">{fmtDate(t.created_at)}</span>
                    <span className="block font-mono text-xs text-fog">{fmtTime(t.created_at)}</span>
                  </Td>
                  <Td>{t.customer || '—'}</Td>
                  {isAdmin && <Td>{t.cashier_name}</Td>}
                  <Td>
                    <TrxItems items={t.items} className="max-w-64" />
                  </Td>
                  <Td right><span className="text-[15px] font-semibold text-fg">{fmtRp(t.total)}</span></Td>
                  <Td>{t.method}</Td>
                  <Td><StatusPill status={t.status} /></Td>
                  <Td>
                    <div className="flex justify-end gap-2.5 text-[13px]">
                      <button className="font-medium text-jet hover:underline" onClick={() => setDetail(t)}>Detail</button>
                      {s.role === 'admin' && t.status === 'completed' && (
                        <button className="text-muted hover:underline" onClick={() => openRefund(t)}>Refund</button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
            )}
          </table>
        ) : (
          <Empty
            title="Tidak ada transaksi ditemukan"
            sub="Coba kata kunci, tanggal, atau metode lain."
            action={<Button onClick={() => { setQ(''); setDate(''); setMethod('Semua'); setPage(0) }}>Tampilkan semua</Button>}
          />
        )}
      </div>

      <div className="mt-4 space-y-2.5 sm:hidden">
        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
        ) : trx.length > 0 ? (
          trx.map((t) => (
            <div key={t.id} className="rounded-xl border border-dove bg-paper p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[13px] font-medium text-fg">{fmtInv(t.id)}</p>
                <StatusPill status={t.status} />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-xs text-fog">
                  {fmtDate(t.created_at)} {fmtTime(t.created_at)}{t.customer ? ` · ${t.customer}` : ''}{isAdmin ? ` · ${t.cashier_name}` : ''} · {t.method}
                </p>
                <p className="shrink-0 text-[17px] font-semibold tabular-nums text-fg">{fmtRp(t.total)}</p>
              </div>
              <div className="mt-2">
                <TrxItems items={t.items} />
              </div>
              <div className="mt-2.5 flex justify-end gap-3 text-[13px]">
                <button className="font-medium text-jet hover:underline" onClick={() => setDetail(t)}>Detail</button>
                {s.role === 'admin' && t.status === 'completed' && (
                  <button className="text-muted hover:underline" onClick={() => openRefund(t)}>Refund</button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="py-10 text-center text-sm text-fog">Tidak ada transaksi ditemukan.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
        <span>{total} transaksi</span>
        <Pager page={safePage} total={pages} onChange={setPage} className="" />
      </div>

      <Modal open={!!detail} title={`Detail ${detail ? fmtInv(detail.id) : ''}`} onClose={() => setDetail(null)} wide>
        {detail && <TrxDetail t={detail} showCashier={isAdmin} />}
      </Modal>

      <Modal open={!!refundFor} title={`Refund ${refundFor ? fmtInv(refundFor.id) : ''}`} onClose={() => setRefundFor(null)} wide>
        {refundFor && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Pilih jumlah item yang direfund. Stok akan dikembalikan otomatis.</p>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-dove">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-surface">
                    <Th>Item</Th><Th right>Terjual</Th><Th right>Qty refund</Th>
                  </tr>
                </thead>
                <tbody>
                  {refundFor.items.map((i) => (
                    <tr key={i.product_id}>
                      <Td>{i.name}</Td>
                      <Td right>{i.qty}</Td>
                      <Td right>
                        <NumInput
                          value={refundItems.find((r) => r.productId === i.product_id)?.qty ?? 0}
                          onValue={(r) => setRefundItems((rs) => rs.map((x) => x.productId === i.product_id ? { ...x, qty: Math.min(i.qty, Math.max(0, Number(r || 0))) } : x))}
                          className="w-16 rounded border border-dove bg-paper px-2 py-1 text-right font-mono tabular-nums focus:border-jet focus:outline-none"
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <input
              value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Alasan refund (wajib)"
              className="w-full rounded-md border border-border bg-paper px-3.5 py-2.5 text-sm focus:border-jet focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRefundFor(null)}>Batal</Button>
              <Button onClick={submitRefund} disabled={!refundReason.trim() || refundItems.every((i) => i.qty === 0) || busy}>{busy ? 'Memproses…' : 'Proses Refund'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function TrxDetail({ t, showCashier }: { t: Trx; showCashier: boolean }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-surface p-4 font-mono text-[13px]">
        <span className="text-fog">Invoice</span><span>{fmtInv(t.id)}</span>
        <span className="text-fog">Waktu</span><span>{fmtDate(t.created_at)} {fmtTime(t.created_at)}</span>
        {showCashier && (
          <>
            <span className="text-fog">Kasir</span><span>{t.cashier_name}</span>
          </>
        )}
        {t.customer && (
          <>
            <span className="text-fog">Pelanggan</span><span>{t.customer}</span>
          </>
        )}
        <span className="text-fog">Metode</span><span>{t.method}</span>
        <span className="text-fog">Status</span><span><StatusPill status={t.status} /></span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-dove">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface">
              <Th>Item</Th><Th right>Harga</Th><Th right>Qty</Th><Th right>Subtotal</Th>
            </tr>
          </thead>
          <tbody>
            {t.items.map((i) => (
              <tr key={i.product_id}>
                <Td>{i.name}</Td>
                <Td right>{fmtRp(i.price)}</Td>
                <Td right>{i.qty}</Td>
                <Td right>{fmtRp(i.price * i.qty)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-1 font-mono text-[13px]">
        <div className="flex justify-between"><span className="text-fog">Subtotal</span><span>{fmtRp(t.subtotal)}</span></div>
        {t.discount > 0 && <div className="flex justify-between"><span className="text-fog">Diskon</span><span>-{fmtRp(t.discount)}</span></div>}
        {t.tax > 0 && <div className="flex justify-between"><span className="text-fog">Pajak</span><span>{fmtRp(t.tax)}</span></div>}
        <div className="flex justify-between border-t border-dove pt-1.5 font-medium"><span>Total</span><span>{fmtRp(t.total)}</span></div>
        <div className="flex justify-between"><span className="text-fog">Dibayar</span><span>{fmtRp(t.paid)}</span></div>
        <div className="flex justify-between"><span className="text-fog">Kembalian</span><span>{fmtRp(t.change)}</span></div>
      </div>
    </div>
  )
}
