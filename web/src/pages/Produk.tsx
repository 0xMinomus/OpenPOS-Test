import { useRef, useState } from 'react'
import { exportCSV, fmtRp, mutate, uid, useDB } from '../lib/store'
import { Button, Empty, Input, Modal, PageHead, Pill, Td, Th } from '../lib/ui'

interface Draft {
  id?: string
  name: string
  sku: string
  barcode: string
  categoryId: string
  buyPrice: string
  sellPrice: string
  stock: string
  unit: string
}

const emptyDraft: Draft = { name: '', sku: '', barcode: '', categoryId: '', buyPrice: '', sellPrice: '', stock: '', unit: 'pcs' }

export default function Produk() {
  const db = useDB()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [catName, setCatName] = useState('')
  const [importRows, setImportRows] = useState<{ ok: boolean; row: string[]; msg: string }[] | null>(null)

  const filtered = db.products.filter((p) => {
    const s = q.toLowerCase()
    return !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s)
  })

  function save(d: Draft) {
    const sell = Number(d.sellPrice)
    if (!d.name.trim() || !d.sku.trim() || !Number.isFinite(sell)) return
    const skuDup = db.products.some((p) => p.sku.toLowerCase() === d.sku.trim().toLowerCase() && p.id !== d.id)
    if (skuDup) return alert('SKU sudah digunakan di toko ini.')
    mutate((db2) => {
      if (d.id) {
        const p = db2.products.find((x) => x.id === d.id)!
        Object.assign(p, {
          name: d.name.trim(), sku: d.sku.trim(), barcode: d.barcode.trim(), categoryId: d.categoryId || null,
          buyPrice: Number(d.buyPrice) || 0, sellPrice: sell, unit: d.unit || 'pcs',
        })
      } else {
        db2.products.push({
          id: uid(), name: d.name.trim(), sku: d.sku.trim(), barcode: d.barcode.trim(), categoryId: d.categoryId || null,
          buyPrice: Number(d.buyPrice) || 0, sellPrice: sell, stock: Number(d.stock) || 0, unit: d.unit || 'pcs', active: true,
        })
      }
    })
    setEditing(null)
  }

  function toggleActive(id: string) {
    mutate((db2) => { const p = db2.products.find((x) => x.id === id)!; p.active = !p.active })
  }

  function addCat() {
    const n = catName.trim()
    if (!n) return
    mutate((db2) => { db2.categories.push({ id: uid(), name: n, active: true }) })
    setCatName('')
  }

  function deleteCat(id: string) {
    const used = db.products.some((p) => p.categoryId === id)
    if (used) {
      // soft-delete: kategori tetap ada historis, produk kehilangan kategori
      mutate((db2) => { const c = db2.categories.find((x) => x.id === id)!; c.active = false })
    } else {
      mutate((db2) => { db2.categories = db2.categories.filter((x) => x.id !== id) })
    }
  }

  function exportList() {
    exportCSV('produk.csv', [
      ['nama', 'sku', 'barcode', 'kategori', 'harga_beli', 'harga_jual', 'stok', 'unit', 'aktif'],
      ...db.products.map((p) => [
        p.name, p.sku, p.barcode, db.categories.find((c) => c.id === p.categoryId)?.name ?? '', String(p.buyPrice),
        String(p.sellPrice), String(p.stock), p.unit, p.active ? '1' : '0',
      ]),
    ])
  }

  const fileRef = useRef<HTMLInputElement>(null)
  function onImportFile(f: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const lines = String(reader.result).split(/\r?\n/).filter((l) => l.trim())
      const rows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, '')))
      const parsed = rows.map((row, i) => {
        const [name, sku, , sell] = row
        if (!name || !sku || !sell) return { ok: false, row, msg: `Baris ${i + 2}: nama/SKU/harga jual wajib diisi` }
        if (db.products.some((p) => p.sku.toLowerCase() === sku.toLowerCase())) return { ok: false, row, msg: `Baris ${i + 2}: SKU "${sku}" sudah ada` }
        return { ok: true, row, msg: 'siap diimpor' }
      })
      setImportRows(parsed)
    }
    reader.readAsText(f)
  }

  function commitImport() {
    if (!importRows) return
    mutate((db2) => {
      importRows.filter((r) => r.ok).forEach(({ row }) => {
        const [name, sku, buy, sell, stock, cat, barcode] = row
        const categoryId = db2.categories.find((c) => c.name.toLowerCase() === (cat ?? '').toLowerCase() && c.active)?.id ?? null
        db2.products.push({
          id: uid(), name, sku, barcode: barcode ?? '', categoryId,
          buyPrice: Number(buy) || 0, sellPrice: Number(sell), stock: Number(stock) || 0, unit: 'pcs', active: true,
        })
      })
    })
    setImportRows(null)
  }

  return (
    <>
      <PageHead
        title="Produk"
        sub={`${db.products.length} produk · ${db.categories.filter((c) => c.active).length} kategori aktif`}
        right={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={exportList}>Export CSV</Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>Import CSV</Button>
            <Button onClick={() => setEditing({ ...emptyDraft })}>+ Tambah Produk</Button>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = '' }} />
          </div>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_260px]">
        <div>
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau SKU…"
            className="mb-4 w-full rounded-md border border-border bg-paper px-3.5 py-2.5 text-sm focus:border-jet focus:outline-none"
          />
          <div className="overflow-x-auto rounded-2xl bg-cream p-2">
            {filtered.length === 0 ? (
              <Empty title="Belum ada produk" sub="Tambah produk pertama untuk mulai berjualan." action={<Button onClick={() => setEditing({ ...emptyDraft })}>+ Tambah Produk</Button>} />
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Nama</Th><Th>SKU</Th><Th>Kategori</Th><Th right>Beli</Th><Th right>Jual</Th><Th right>Stok</Th><Th>Status</Th><Th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <Td mono={false}><span className="font-medium text-fg">{p.name}</span></Td>
                      <Td mono>{p.sku}</Td>
                      <Td>{db.categories.find((c) => c.id === p.categoryId)?.name ?? '—'}</Td>
                      <Td right>{fmtRp(p.buyPrice)}</Td>
                      <Td right>{fmtRp(p.sellPrice)}</Td>
                      <Td right><span className={p.stock <= 5 ? 'font-medium text-ember' : ''}>{p.stock}</span></Td>
                      <Td><Pill tone={p.active ? 'ok' : 'muted'}>{p.active ? 'Aktif' : 'Nonaktif'}</Pill></Td>
                      <Td>
                        <div className="flex justify-end gap-2 text-[13px]">
                          <button className="font-medium text-jet hover:underline" onClick={() => setEditing({ id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, categoryId: p.categoryId ?? '', buyPrice: String(p.buyPrice), sellPrice: String(p.sellPrice), stock: String(p.stock), unit: p.unit })}>Ubah</button>
                          <button className="text-muted hover:underline" onClick={() => toggleActive(p.id)}>{p.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="rounded-2xl bg-cream p-5 self-start">
          <h2 className="font-mono text-xs uppercase tracking-wider text-fog">Kategori</h2>
          <div className="mt-3 space-y-1.5">
            {db.categories.filter((c) => c.active).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-dove bg-paper px-3 py-2 text-sm">
                <span>{c.name}</span>
                <button onClick={() => deleteCat(c.id)} className="text-xs text-fog hover:text-ember">hapus</button>
              </div>
            ))}
            {db.categories.filter((c) => !c.active).length > 0 && (
              <p className="pt-1 text-xs text-fog">{db.categories.filter((c) => !c.active).length} kategori dinonaktifkan (historis)</p>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Nama kategori baru"
              className="min-w-0 flex-1 rounded-md border border-border bg-paper px-3 py-2 text-sm focus:border-jet focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') addCat() }}
            />
            <Button onClick={addCat}>Tambah</Button>
          </div>
        </aside>
      </div>

      <Modal open={!!editing} title={editing?.id ? 'Ubah Produk' : 'Tambah Produk'} onClose={() => setEditing(null)} wide>
        {editing && (
          <FormProduk
            draft={editing}
            cats={db.categories.filter((c) => c.active)}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal open={!!importRows} title="Preview Import" onClose={() => setImportRows(null)} wide>
        {importRows && (
          <div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-dove">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-surface">
                    <Th>Baris</Th><Th>Nama</Th><Th>SKU</Th><Th>Hasil</Th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((r, i) => (
                    <tr key={i}>
                      <Td mono>{i + 2}</Td>
                      <Td>{r.row[0]}</Td>
                      <Td mono>{r.row[1]}</Td>
                      <Td><span className={r.ok ? 'text-sprout' : 'text-ember'}>{r.msg}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted">
              {importRows.filter((r) => r.ok).length} baris akan diimpor, {importRows.filter((r) => !r.ok).length} baris dilewati.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setImportRows(null)}>Batal</Button>
              <Button onClick={commitImport} disabled={importRows.every((r) => !r.ok)}>Import {importRows.filter((r) => r.ok).length} Produk</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function FormProduk({ draft, cats, onSave, onCancel }: { draft: Draft; cats: { id: string; name: string }[]; onSave: (d: Draft) => void; onCancel: () => void }) {
  const [d, setD] = useState(draft)
  const set = (k: keyof Draft) => (v: string) => setD({ ...d, [k]: v })
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => { e.preventDefault(); onSave(d) }}
    >
      <div className="sm:col-span-2">
        <Input label="Nama produk" value={d.name} onChange={set('name')} required />
      </div>
      <Input label="SKU (unik)" value={d.sku} onChange={set('sku')} required />
      <Input label="Barcode (opsional)" value={d.barcode} onChange={set('barcode')} />
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
        Kategori
        <select value={d.categoryId} onChange={(e) => set('categoryId')(e.target.value)} className="rounded-md border border-border bg-paper px-3.5 py-2.5 text-[15px] focus:border-jet focus:outline-none">
          <option value="">— tanpa kategori —</option>
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