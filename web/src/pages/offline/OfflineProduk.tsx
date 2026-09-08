import { useMemo, useState } from 'react'
import { deleteCategory, deleteProduct, saveCategory, saveProduct, useLocalDB } from '../../lib/localdb'
import { fmtRp } from '../../lib/store'
import { Button, Empty, Input, Modal, PageHead, Pill, Td, Th } from '../../lib/ui'

interface Draft {
  id?: string
  name: string
  sku: string
  categoryId: string
  buyPrice: string
  sellPrice: string
  stock: string
  unit: string
}

const emptyDraft: Draft = { name: '', sku: '', categoryId: '', buyPrice: '', sellPrice: '', stock: '', unit: 'pcs' }

export default function OfflineProduk() {
  const db = useLocalDB()
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [catName, setCatName] = useState('')
  const [catOpen, setCatOpen] = useState(false)

  const filtered = useMemo(() => {
    const base = db.products.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()))
    if (!catFilter) return base
    return base.filter((p) => p.categoryId === catFilter)
  }, [db.products, q, catFilter])

  const catCount = (id: string) => db.products.filter((p) => p.categoryId === id).length

  function save(d: Draft) {
    const sell = Number(d.sellPrice)
    if (!d.name.trim() || !d.sku.trim() || !Number.isFinite(sell)) return
    saveProduct({
      id: d.id, name: d.name.trim(), sku: d.sku.trim(),
      categoryId: d.categoryId || null, categoryName: d.categoryId ? db.categories.find((c) => c.id === d.categoryId)?.name ?? null : null,
      buyPrice: Number(d.buyPrice) || 0, sellPrice: sell, stock: Number(d.stock) || 0, unit: d.unit || 'pcs',
    })
    setEditing(null)
  }

  function addCat() {
    const n = catName.trim()
    if (!n) return
    saveCategory(n)
    setCatName('')
  }

  function removeCat(id: string) {
    if (!confirm('Hapus kategori? Produk di dalamnya jadi Tanpa Kategori.')) return
    deleteCategory(id)
    if (catFilter === id) setCatFilter('')
  }

  return (
    <>
      <PageHead
        title="Produk"
        sub={`${db.products.length} produk · ${db.categories.length} kategori`}
        right={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setCatOpen(true)}>Kategori</Button>
            <Button onClick={() => setEditing({ ...emptyDraft })}>+ Tambah Produk</Button>
          </div>
        }
      />

      <div className="mb-5 grid items-start gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl bg-cream p-5">
          <h2 className="font-mono text-xs uppercase tracking-wider text-fog">Kategori</h2>
          <div className="mt-3 space-y-1.5">
            <button
              onClick={() => setCatFilter('')}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${catFilter === '' ? 'border-jet bg-paper font-medium' : 'border-dove bg-paper hover:border-jet'}`}
            >
              <span>Semua Kategori</span>
              <CountBadge n={db.products.length} active={catFilter === ''} />
            </button>
            {db.categories.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setCatFilter(catFilter === c.id ? '' : c.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') setCatFilter(catFilter === c.id ? '' : c.id) }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${catFilter === c.id ? 'border-jet bg-paper font-medium' : 'border-dove bg-paper hover:border-jet'}`}
              >
                <span className="min-w-0 flex-1 truncate text-left">{c.name}</span>
                <CountBadge n={catCount(c.id)} active={catFilter === c.id} />
              </div>
            ))}
            {db.categories.length === 0 && <p className="text-sm text-fog">Belum ada kategori.</p>}
          </div>
        </aside>

        <div className="overflow-x-auto rounded-2xl bg-cream p-2">
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau SKU…"
            aria-label="Cari produk"
            className="mb-3 w-full rounded-md border border-border bg-paper px-3.5 py-2.5 text-sm focus:border-jet focus:outline-none"
          />
          {filtered.length > 0 ? (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Nama</Th><Th>SKU</Th><Th>Kategori</Th><Th right>Beli</Th><Th right>Jual</Th><Th right>Stok</Th><Th>Status</Th><Th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-muted/50">
                    <Td><span className="font-medium text-fg">{p.name}</span></Td>
                    <Td mono>{p.sku}</Td>
                    <Td>{p.categoryName ?? 'Tanpa kategori'}</Td>
                    <Td right>{fmtRp(p.buyPrice)}</Td>
                    <Td right><span className="font-medium text-fg">{fmtRp(p.sellPrice)}</span></Td>
                    <Td right><StockCell stock={p.stock} unit={p.unit} /></Td>
                    <Td><Pill tone={p.stock === 0 ? 'warn' : 'ok'}>{p.stock === 0 ? 'Habis' : 'Aktif'}</Pill></Td>
                    <Td>
                      <div className="flex justify-end gap-2.5 text-[13px]">
                        <button className="font-medium text-jet hover:underline" onClick={() => setEditing({ id: p.id, name: p.name, sku: p.sku, categoryId: p.categoryId ?? '', buyPrice: String(p.buyPrice), sellPrice: String(p.sellPrice), stock: String(p.stock), unit: p.unit })}>Ubah</button>
                        <button className="text-ember hover:underline" onClick={() => { if (confirm(`Hapus produk "${p.name}"?`)) deleteProduct(p.id) }}>Hapus</button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title={db.products.length === 0 ? 'Belum ada produk' : 'Tidak ada produk yang cocok'} sub="Tambah produk dari tombol di atas." action={<Button onClick={() => setEditing({ ...emptyDraft })}>+ Tambah Produk</Button>} />
          )}
        </div>
      </div>

      <Modal open={!!editing} title={editing?.id ? 'Ubah Produk' : 'Tambah Produk'} onClose={() => setEditing(null)} wide>
        {editing && <FormProduk draft={editing} cats={db.categories} onSave={save} onCancel={() => setEditing(null)} />}
      </Modal>

      <Modal open={catOpen} title="Kelola Kategori" onClose={() => setCatOpen(false)}>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addCat() }}>
          <Input label="Nama kategori baru" value={catName} onChange={setCatName} placeholder="cth: Minuman" />
          <div className="flex items-end"><Button type="submit">Simpan</Button></div>
        </form>
        <div className="mt-5 border-t border-dove pt-4">
          <h3 className="font-mono text-xs uppercase tracking-wider text-fog">Daftar kategori</h3>
          <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
            {db.categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-dove bg-paper px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <CountBadge n={catCount(c.id)} active={false} />
                <button onClick={() => removeCat(c.id)} className="shrink-0 text-[13px] text-ember hover:underline">Hapus</button>
              </div>
            ))}
            {db.categories.length === 0 && <p className="text-sm text-fog">Belum ada kategori.</p>}
          </div>
        </div>
      </Modal>
    </>
  )
}

function CountBadge({ n, active }: { n: number; active: boolean }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums ${active ? 'bg-jet text-paper' : 'bg-surface text-muted'}`}>{n}</span>
}

function StockCell({ stock, unit }: { stock: number; unit: string }) {
  const dot = stock === 0 ? 'var(--t-ember)' : stock <= 5 ? 'var(--t-sunbeam)' : 'var(--t-sprout)'
  return (
    <span className={`inline-flex items-center gap-1.5 ${stock <= 5 ? 'font-medium text-fg' : ''}`}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} aria-hidden="true" />
      {stock} {unit}
    </span>
  )
}

function FormProduk({ draft, cats, onSave, onCancel }: { draft: Draft; cats: { id: string; name: string }[]; onSave: (d: Draft) => void; onCancel: () => void }) {
  const [d, setD] = useState(draft)
  const set = (k: keyof Draft) => (v: string) => setD({ ...d, [k]: v })
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSave(d) }}>
      <div className="sm:col-span-2">
        <Input label="Nama produk" value={d.name} onChange={set('name')} required />
      </div>
      <Input label="SKU (unik)" value={d.sku} onChange={set('sku')} required />
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
        Kategori
        <select value={d.categoryId} onChange={(e) => set('categoryId')(e.target.value)} className="rounded-md border border-border bg-paper px-3.5 py-2.5 text-[15px] focus:border-jet focus:outline-none">
          <option value="">Tanpa kategori</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <Input label="Satuan" value={d.unit} onChange={set('unit')} />
      <Input label="Harga beli (Rp)" type="number" value={d.buyPrice} onChange={set('buyPrice')} />
      <Input label="Harga jual (Rp)" type="number" value={d.sellPrice} onChange={set('sellPrice')} required />
      {!d.id && <Input label="Stok awal" type="number" value={d.stock} onChange={set('stock')} />}
      <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Batal</Button>
        <Button type="submit">Simpan</Button>
      </div>
    </form>
  )
}

