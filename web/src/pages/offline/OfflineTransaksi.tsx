import { useState } from 'react'
import { useLocalDB } from '../../lib/localdb'
import { fmtDate, fmtRp, fmtTime } from '../../lib/store'
import { Button, Modal, PageHead, StatusPill, Td, Th } from '../../lib/ui'

export default function OfflineTransaksi() {
  const db = useLocalDB()
  const [detail, setDetail] = useState<string | null>(null)
  const trx = detail ? db.transactions.find((t) => t.id === detail) ?? null : null

  return (
    <>
      <PageHead title="Transaksi" sub={`${db.transactions.length} transaksi tersimpan di perangkat ini.`} />

      <div className="overflow-x-auto rounded-2xl bg-cream p-2">
        {db.transactions.length === 0 ? (
          <p className="py-14 text-center text-sm text-fog">Belum ada transaksi. Mulai dari menu Kasir.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>ID</Th><Th>Waktu</Th><Th>Metode</Th><Th right>Total</Th><Th>Status</Th><Th />
              </tr>
            </thead>
            <tbody>
              {db.transactions.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-muted/50">
                  <Td mono>{t.id}</Td>
                  <Td mono>{fmtDate(t.created_at)} {fmtTime(t.created_at)}</Td>
                  <Td>{t.method}</Td>
                  <Td right><span className="font-medium text-fg">{fmtRp(t.total)}</span></Td>
                  <Td><StatusPill status="completed" /></Td>
                  <Td>
                    <button className="text-[13px] font-medium text-jet hover:underline" onClick={() => setDetail(t.id)}>Detail</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!trx} title={`Detail ${trx?.id ?? ''}`} onClose={() => setDetail(null)} wide>
        {trx && (
          <div className="space-y-3 text-sm">
            <div className="overflow-x-auto rounded-lg border border-dove">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-surface">
                    <Th>Item</Th><Th right>Harga</Th><Th right>Qty</Th><Th right>Subtotal</Th>
                  </tr>
                </thead>
                <tbody>
                  {trx.items.map((i) => (
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
              <div className="flex justify-between"><span className="text-fog">Subtotal</span><span>{fmtRp(trx.subtotal)}</span></div>
              {trx.discount > 0 && <div className="flex justify-between"><span className="text-fog">Diskon</span><span>-{fmtRp(trx.discount)}</span></div>}
              {trx.tax > 0 && <div className="flex justify-between"><span className="text-fog">Pajak</span><span>{fmtRp(trx.tax)}</span></div>}
              <div className="flex justify-between border-t border-dove pt-1.5 font-medium"><span>Total</span><span>{fmtRp(trx.total)}</span></div>
              <div className="flex justify-between"><span className="text-fog">Dibayar</span><span>{fmtRp(trx.paid)}</span></div>
              <div className="flex justify-between"><span className="text-fog">Kembalian</span><span>{fmtRp(trx.change)}</span></div>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setDetail(null)}>Tutup</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
