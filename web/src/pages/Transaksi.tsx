import { useMemo, useState } from 'react'
import { exportCSV, fmtDate, fmtRp, fmtTime, mutate, uid, useDB, type Trx } from '../lib/store'
import { Button, Modal, PageHead, StatusPill, Td, Th } from '../lib/ui'

const PAGE = 20

export default function Transaksi() {
  const db = useDB()
  const s = db.session!
  const [q, setQ] = useState('')
  const [method, setMethod] = useState('Semua')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<Trx | null>(null)
  const [refundFor, setRefundFor] = useState<Trx | null>(null)
  const [refundItems, setRefundItems] = useState<{ productId: string; qty: number }[]>([])
  const [refundReason, setRefundReason] = useState('')

  const methods = ['Semua', 'Cash', 'Bank Transfer', 'QRIS', 'E-Wallet', 'Card']

  const all = useMemo(() => {
    let list = [...db.trx].sort((a, b) => b.time.localeCompare(a.time))
    if (s.role === 'cashier') list = list.filter((t) => t.cashier === s.email)
    if (method !== 'Semua') list = list.filter((t) => t.method === method)
    if (date) list = list.filter((t) => t.time.slice(0, 10) === date)
    const ql = q.toLowerCase()
    if (ql) list = list.filter((t) => t.id.toLowerCase().includes(ql) || t.cashierName.toLowerCase().includes(ql))
    return list
  }, [db.trx, s, method, date, q])

  const pages = Math.max(1, Math.ceil(all.length / PAGE))
  const view = all.slice(page * PAGE, page * PAGE + PAGE)

  function exportList() {
    exportCSV('transaksi.csv', [
      ['id', 'waktu', 'kasir', 'metode', 'subtotal', 'diskon', 'pajak', 'total', 'dibayar', 'kembalian', 'status'],
      ...all.map((t) => [t.id, t.time, t.cashierName, t.method, String(t.subtotal), String(t.discount), String(t.tax), String(t.total), String(t.paid), String(t.change), t.status]),
    ])
  }

  function openRefund(t: Trx) {
    setRefundFor(t)
    setRefundItems(t.items.map((i) => ({ productId: i.productId, qty: i.qty })))
    setRefundReason('')
  }

  function submitRefund() {
    if (!refundFor || !refundReason.trim()) return
    const items = refundItems.filter((i) => i.qty > 0)
    if (items.length === 0) return
    const full = items.length === refundFor.items.length && items.every((i) => refundFor.items.find((x) => x.productId === i.productId)?.qty === i.qty)
    mutate((db2) => {
      const trx = db2.trx.find((t) => t.id === refundFor.id)!
      if (trx.status === 'refunded') return
      items.forEach((i) => {
        const p = db2.products.find((x) => x.id === i.productId)
        if (p) p.stock += i.qty
        db2.movements.push({ id: uid(), productId: i.productId, type: 'refund', qty: i.qty, reason: 'Refund ' + trx.id, time: new Date().toISOString(), actor: db2.session?.name ?? '' })
      })
      db2.refunds.push({ id: uid(), trxId: trx.id, items, reason: refundReason.trim(), time: new Date().toISOString(), by: db2.session?.name ?? '' })
      if (full) trx.status = 'refunded'
    })
    setRefundFor(null)
  }

  return (
    <>
      <PageHead
        title="Transaksi"
        sub={s.role === 'cashier' ? 'Transaksi yang Anda buat sendiri.' : 'Seluruh transaksi toko.'}
        right={<Button variant="ghost" onClick={exportList}>Export CSV</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Cari ID atau kasir…"
          className="min-w-52 rounded-md border border-border bg-paper px-3.5 py-2 text-sm focus:border-jet focus:outline-none"
        />
        <input
          type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(0) }}
          className="rounded-md border border-border bg-paper px-3.5 py-2 text-sm focus:border-jet focus:outline-none"
        />
        {methods.map((m) => (
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
        {view.length === 0 ? (
          <p className="py-14 text-center text-sm text-fog">Tidak ada transaksi ditemukan.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>ID</Th><Th>Waktu</Th><Th>Kasir</Th><Th>Metode</Th><Th right>Total</Th><Th>Status</Th><Th />
              </tr>
            </thead>
            <tbody>
              {view.map((t) => (
                <tr key={t.id}>
                  <Td mono>{t.id}</Td>
                  <Td mono>{fmtDate(t.time)} {fmtTime(t.time)}</Td>
                  <Td>{t.cashierName}</Td>
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
        <span>{all.length} transaksi</span>
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
                    <tr key={i.productId}>
                      <Td>{i.name}</Td>
                      <Td right>{i.qty}</Td>
                      <Td right>
                        <input
                          type="number" min="0" max={i.qty} value={refundItems.find((r) => r.productId === i.productId)?.qty ?? 0}
                          onChange={(e) => setRefundItems((rs) => rs.map((r) => r.productId === i.productId ? { ...r, qty: Math.min(i.qty, Math.max(0, Number(e.target.value))) } : r))}
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
              <Button onClick={submitRefund} disabled={!refundReason.trim() || refundItems.every((i) => i.qty === 0)}>Proses Refund</Button>
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
        <span className="text-fog">Kasir</span><span>{t.cashierName}</span>
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
              <tr key={i.productId}>
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