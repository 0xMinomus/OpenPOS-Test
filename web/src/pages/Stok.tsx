import { useState } from 'react'
import { fmtDate, fmtTime, mutate, uid, useDB, type MovementType } from '../lib/store'
import { Button, Input, Modal, PageHead, Pill, Td, Th } from '../lib/ui'

const TYPE_LABEL: Record<MovementType, string> = {
  sale: 'Penjualan', refund: 'Refund', adjust: 'Penyesuaian', initial: 'Stok awal',
}

export default function Stok() {
  const db = useDB()
  const [adjustFor, setAdjustFor] = useState<string | null>(null)
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [type, setType] = useState<'plus' | 'minus'>('plus')

  const product = db.products.find((p) => p.id === adjustFor)
  const movements = [...db.movements].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 50)

  function submit() {
    const n = Number(qty)
    const r = reason.trim()
    if (!product || !Number.isFinite(n) || n <= 0 || !r) return
    const delta = type === 'plus' ? n : -n
    if (product.stock + delta < 0) return alert('Stok tidak boleh negatif.')
    mutate((db2) => {
      const p = db2.products.find((x) => x.id === product.id)!
      p.stock += delta
      db2.movements.push({ id: uid(), productId: p.id, type: 'adjust', qty: delta, reason: r, time: new Date().toISOString(), actor: db2.session?.name ?? 'Admin' })
    })
    setAdjustFor(null); setQty(''); setReason(''); setType('plus')
  }

  return (
    <>
      <PageHead title="Stok" sub="Status stok saat ini dan riwayat pergerakan barang." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-fog">Status stok</h2>
          <div className="overflow-x-auto rounded-2xl bg-cream p-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Produk</Th><Th right>Stok</Th><Th>Status</Th><Th />
                </tr>
              </thead>
              <tbody>
                {db.products.filter((p) => p.active).map((p) => (
                  <tr key={p.id}>
                    <Td><span className="font-medium text-fg">{p.name}</span></Td>
                    <Td right><span className={p.stock <= 5 ? 'font-medium text-ember' : ''}>{p.stock} {p.unit}</span></Td>
                    <Td>
                      {p.stock === 0 ? <Pill tone="warn">Habis</Pill> : p.stock <= 5 ? <Pill tone="warn">Menipis</Pill> : <Pill>Aman</Pill>}
                    </Td>
                    <Td>
                      <button className="text-[13px] font-medium text-jet hover:underline" onClick={() => setAdjustFor(p.id)}>Penyesuaian</button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-fog">Riwayat pergerakan</h2>
          <div className="max-h-[70vh] overflow-y-auto rounded-2xl bg-cream p-2">
            {movements.length === 0 ? (
              <p className="py-10 text-center text-sm text-fog">Belum ada pergerakan stok.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Waktu</Th><Th>Produk</Th><Th>Jenis</Th><Th right>Qty</Th><Th>Alasan</Th><Th>Aktor</Th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <Td mono>{fmtDate(m.time)} {fmtTime(m.time)}</Td>
                      <Td>{db.products.find((p) => p.id === m.productId)?.name ?? '—'}</Td>
                      <Td><Pill tone={m.type === 'sale' ? 'ok' : m.type === 'refund' ? 'warn' : 'muted'}>{TYPE_LABEL[m.type]}</Pill></Td>
                      <Td right><span className={m.qty > 0 ? 'text-sprout' : 'text-ember'}>{m.qty > 0 ? '+' : ''}{m.qty}</span></Td>
                      <Td>{m.reason}</Td>
                      <Td>{m.actor}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <Modal open={!!product} title={`Penyesuaian stok — ${product?.name ?? ''}`} onClose={() => setAdjustFor(null)}>
        {product && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Stok saat ini: <strong className="text-fg">{product.stock} {product.unit}</strong></p>
            <div className="flex gap-2">
              <button
                onClick={() => setType('plus')}
                className={`flex-1 rounded-full border py-2 text-sm ${type === 'plus' ? 'border-jet bg-jet text-paper' : 'border-dove text-muted'}`}
              >
                + Tambah
              </button>
              <button
                onClick={() => setType('minus')}
                className={`flex-1 rounded-full border py-2 text-sm ${type === 'minus' ? 'border-jet bg-jet text-paper' : 'border-dove text-muted'}`}
              >
                − Kurangi
              </button>
            </div>
            <Input label="Jumlah" type="number" value={qty} onChange={setQty} placeholder="0" />
            <Input label="Alasan (wajib)" value={reason} onChange={setReason} placeholder="cth: barang rusak, stok fisik berbeda" />
            <Button className="w-full" onClick={submit} disabled={!Number(qty) || !reason.trim()}>Simpan Penyesuaian</Button>
          </div>
        )}
      </Modal>
    </>
  )
}