import { useEffect, useState } from 'react'
import { apiAdjustStock, apiListMovements, apiListProducts, fetchAll, type Movement, type Product } from '../lib/api'
import { fmtDate, fmtTime } from '../lib/store'
import { Button, Input, Modal, PageHead, Pill, Td, Th } from '../lib/ui'

const TYPE_LABEL: Record<Movement['type'], string> = {
  sale: 'Penjualan', refund: 'Refund', adjust: 'Penyesuaian', initial: 'Stok awal',
}

export default function Stok() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [movements, setMovements] = useState<Movement[] | null>(null)
  const [err, setErr] = useState('')
  const [adjustFor, setAdjustFor] = useState<Product | null>(null)
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [type, setType] = useState<'plus' | 'minus'>('plus')
  const [busy, setBusy] = useState(false)

  function load() {
    setErr('')
    fetchAll<Product>((page) => apiListProducts({ page, limit: 200 }))
      .then(setProducts).catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat stok.'))
    apiListMovements({ limit: 50 }).then((r) => setMovements(r.items)).catch(() => {})
  }
  useEffect(() => { load() }, [])

  async function submit() {
    const n = Number(qty)
    const r = reason.trim()
    if (!adjustFor || !Number.isFinite(n) || n <= 0 || !r) return
    setBusy(true); setErr('')
    try {
      await apiAdjustStock(adjustFor.id, type, n, r)
      setAdjustFor(null); setQty(''); setReason(''); setType('plus')
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyesuaikan stok.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead title="Stok" sub="Status stok saat ini dan riwayat pergerakan barang." />
      {err && <p className="mb-4 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-fog">Status stok</h2>
          <div className="overflow-x-auto rounded-2xl bg-cream p-2">
            {!products ? (
              <p className="py-14 text-center text-sm text-fog">Memuat…</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Produk</Th><Th right>Stok</Th><Th>Status</Th><Th />
                  </tr>
                </thead>
                <tbody>
                  {products.filter((p) => p.active).map((p) => (
                    <tr key={p.id}>
                      <Td><span className="font-medium text-fg">{p.name}</span></Td>
                      <Td right><span className={p.stock <= 5 ? 'font-medium text-ember' : ''}>{p.stock} {p.unit}</span></Td>
                      <Td>
                        {p.stock === 0 ? <Pill tone="warn">Habis</Pill> : p.stock <= 5 ? <Pill tone="warn">Menipis</Pill> : <Pill>Aman</Pill>}
                      </Td>
                      <Td>
                        <button className="text-[13px] font-medium text-jet hover:underline" onClick={() => setAdjustFor(p)}>Penyesuaian</button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-fog">Riwayat pergerakan</h2>
          <div className="max-h-[70vh] overflow-y-auto rounded-2xl bg-cream p-2">
            {!movements ? (
              <p className="py-10 text-center text-sm text-fog">Memuat…</p>
            ) : movements.length === 0 ? (
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
                      <Td mono>{fmtDate(m.created_at)} {fmtTime(m.created_at)}</Td>
                      <Td>{m.product_name ?? '—'}</Td>
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

      <Modal open={!!adjustFor} title={`Penyesuaian stok · ${adjustFor?.name ?? ''}`} onClose={() => setAdjustFor(null)}>
        {adjustFor && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Stok saat ini: <strong className="text-fg">{adjustFor.stock} {adjustFor.unit}</strong></p>
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
            <Button className="w-full" onClick={submit} disabled={!Number(qty) || !reason.trim() || busy}>{busy ? 'Menyimpan…' : 'Simpan Penyesuaian'}</Button>
          </div>
        )}
      </Modal>
    </>
  )
}