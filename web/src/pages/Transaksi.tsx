import { useEffect, useState } from 'react'
import { apiListTransactions, apiRefundTransaction, type Trx } from '../lib/api'
import { exportCSV, fmtDate, fmtRp, fmtTime, useDB } from '../lib/store'
import { Button, Modal, PageHead, StatusPill, Td, Th } from '../lib/ui'

const PAGE = 20
const METHODS = ['Semua', 'Cash', 'Bank Transfer', 'QRIS', 'E-Wallet', 'Card']

export default function Transaksi() {
  const db = useDB()
  const s = db.session!
  const [q, setQ] = useState('')
  const [method, setMethod] = useState('Semua')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(0)
  const [trx, setTrx] = useState<Trx[]>([])
  const [total, setTotal] = useState(0)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Trx | null>(null)
  const [refundFor, setRefundFor] = useState<Trx | null>(null)
  const [refundItems, setRefundItems] = useState<{ productId: string; qty: number }[]>([])
  const [refundReason, setRefundReason] = useState('')
  const [busy, setBusy] = useState(false)

  function load() {
    setLoading(true); setErr('')
    apiListTransactions({ q: q.trim() || undefined, method: method === 'Semua' ? undefined : method, date: date || undefined, page: page + 1, limit: PAGE })
      .then((r) => { setTrx(r.items); setTotal(r.total) })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat transaksi.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [q, method, date, page])

  const pages = Math.max(1, Math.ceil(total / PAGE))

  async function exportList() {
    const all: Trx[] = []
    for (let p = 1; ; p++) {
      const r = await apiListTransactions({ q: q.trim() || undefined, method: method === 'Semua' ? undefined : method, date: date || undefined, page: p, limit: 200 })
      all.push(...r.items)
      if (all.length >= r.total) break
    }
    exportCSV('transaksi.csv', [
      ['id', 'waktu', 'kasir', 'metode', 'subtotal', 'diskon', 'pajak', 'total', 'dibayar', 'kembalian', 'status'],
      ...all.map((t) => [t.id, t.time, t.cashier_name, t.method, String(t.subtotal), String(t.discount), String(t.tax), String(t.total), String(t.paid), String(t.change), t.status]),
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

  return (
    <>
      <PageHead
        title="Transaksi"
        sub={s.role === 'cashier' ? 'Transaksi yang Anda buat sendiri.' : 'Seluruh transaksi toko.'}
        right={<Button variant="ghost" onClick={exportList}>Export CSV</Button>}
      />

      {err && <p className="mb-4 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Cari ID atau kasir…"
          className="min-w-52 rounded-md border border-border bg-paper px-3.5 py-2 text-sm focus:border-jet focus:outline-none"
        />
        <input
          type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(0) }}
          className="rounded-md border border-border bg-paper px-3.5 py-2 text-sm focus:border-jet focus:outline-none"
        />
        {METHODS.map((m) => (
          <button
            key={m}
            onClick={() => { setMethod(m); setPage(0) }}
            className={`rounded-full border px-3 py-1.5 text-xs ${method === m ? 'border-jet bg-jet text-paper' : 'border-dove text-muted hover:border-jet'}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-cream p-2">
        {loading ? (
          <p className="py-14 text-center text-sm text-fog">Memuat…</p>
        ) : trx.length === 0 ? (
          <p className="py-14 text-center text-sm text-fog">Tidak ada transaksi ditemukan.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>ID</Th><Th>Waktu</Th><Th>Kasir</Th><Th>Metode</Th><Th right>Total</Th><Th>Status</Th><Th />
              </tr>
            </thead>
            <tbody>
              {trx.map((t) => (
                <tr key={t.id}>
                  <Td mono>{t.id}</Td>
                  <Td mono>{fmtDate(t.time)} {fmtTime(t.time)}</Td>
                  <Td>{t.cashier_name}</Td>
                  <Td>{t.method}</Td>
                  <Td right>{fmtRp(t.total)}</Td>
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
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
        <span>{total} transaksi</span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>← Sebelumnya</Button>
          <span className="self-center font-mono text-xs text-fog">{page + 1} / {pages}</span>
          <Button variant="ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Berikutnya →</Button>
        </div>
      </div>

      <Modal open={!!detail} title={`Detail ${detail?.id ?? ''}`} onClose={() => setDetail(null)} wide>
        {detail && <TrxDetail t={detail} />}
      </Modal>

      <Modal open={!!refundFor} title={`Refund ${refundFor?.id ?? ''}`} onClose={() => setRefundFor(null)} wide>
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
                        <input
                          type="number" min="0" max={i.qty} value={refundItems.find((r) => r.productId === i.product_id)?.qty ?? 0}
                          onChange={(e) => setRefundItems((rs) => rs.map((r) => r.productId === i.product_id ? { ...r, qty: Math.min(i.qty, Math.max(0, Number(e.target.value))) } : r))}
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

function TrxDetail({ t }: { t: Trx }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-surface p-4 font-mono text-[13px]">
        <span className="text-fog">Waktu</span><span>{fmtDate(t.time)} {fmtTime(t.time)}</span>
        <span className="text-fog">Kasir</span><span>{t.cashier_name}</span>
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