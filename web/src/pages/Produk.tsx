// Produk — Operate surface. Katalog + filter kategori + CRUD + CSV.
// Token font/warna milik sistem (tidak ada token baru di file ini).
import { useMemo, useRef, useState } from 'react'
import { Download, Plus, Search, Upload } from 'lucide-react'
import { apiCreateCategory, apiCreateProduct, apiDeleteCategory, apiDeleteProduct, apiListCategories, apiListProducts, apiSetProductActive, apiUpdateProduct, fetchAll, type Category, type Product } from '../lib/api'
import { useCache } from '../lib/cache'
import { exportCSV, fmtRp, useDB } from '../lib/store'
import { Button, Empty, Input, Modal, PageHead, Pill, SkeletonRows, Td, Th } from '../lib/ui'
import { Skeleton } from '@/components/ui/skeleton'

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

const NONE = '__none__'

export default function Produk() {
  const { session } = useDB()
  const who = `${session?.id}:${session?.role}`
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const prod = useCache<Product[]>(`products:${who}:${q.trim()}`, () => fetchAll<Product>((page) => apiListProducts({ q: q.trim() || undefined, page, limit: 200 })), 'Gagal memuat produk.')
  const products = prod.data
  const catq = useCache<Category[]>(`cats:${who}`, () => apiListCategories())
  const cats = catq.data ?? []
  const catsReady = !catq.loading
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleteFor, setDeleteFor] = useState<Product | null>(null)
  const [catName, setCatName] = useState('')
  const [importRows, setImportRows] = useState<{ ok: boolean; row: string[]; msg: string }[] | null>(null)
  const [importDone, setImportDone] = useState<{ ok: number; fail: number } | null>(null)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    let none = 0
    for (const p of products ?? []) {
      if (p.category_id) m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1)
      else none++
    }
    return { m, none }
  }, [products])

  const filtered = useMemo(() => {
    if (!products) return null
    if (!catFilter) return products
    if (catFilter === NONE) return products.filter((p) => !p.category_id)
    return products.filter((p) => p.category_id === catFilter)
  }, [products, catFilter])

  const activeCats = cats.filter((c) => c.active)

  function loadProducts() {
    prod.reload()
  }

  async function save(d: Draft) {
    setErr('')
    const sell = Number(d.sellPrice)
    if (!d.name.trim() || !d.sku.trim() || !Number.isFinite(sell)) return
    const body = {
      name: d.name.trim(), sku: d.sku.trim(), barcode: d.barcode.trim(),
      categoryId: d.categoryId || null, buyPrice: Number(d.buyPrice) || 0,
      sellPrice: sell, unit: d.unit || 'pcs',
    }
    try {
      if (d.id) await apiUpdateProduct(d.id, body)
      else await apiCreateProduct({ ...body, stock: Number(d.stock) || 0 })
      setEditing(null)
      loadProducts()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan produk.')
    }
  }

  async function toggleActive(p: Product) {
    try {
      await apiSetProductActive(p.id, !p.active)
      loadProducts()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal mengubah status.')
    }
  }

  async function removeProduct() {
    if (!deleteFor) return
    try {
      await apiDeleteProduct(deleteFor.id)
      setDeleteFor(null)
      loadProducts()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus produk.')
    }
  }

  async function addCat() {
    const n = catName.trim()
    if (!n) return
    try {
      await apiCreateCategory(n)
      catq.reload()
      setCatName('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menambah kategori.')
    }
  }

  async function deleteCat(c: Category) {
    try {
      const r = await apiDeleteCategory(c.id)
      catq.reload()
      if (c.id === catFilter) setCatFilter('')
      if (r.soft_deleted) alert(`Kategori "${c.name}" masih dipakai produk, jadi hanya dinonaktifkan. Histori tetap aman.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus kategori.')
    }
  }

  async function exportList() {
    const all = await fetchAll<Product>((page) => apiListProducts({ page, limit: 200 }))
    exportCSV('produk.csv', [
      ['nama', 'sku', 'barcode', 'kategori', 'harga_beli', 'harga_jual', 'stok', 'unit', 'aktif'],
      ...all.map((p) => [
        p.name, p.sku, p.barcode, p.category_name ?? '', String(p.buy_price),
        String(p.sell_price), String(p.stock), p.unit, p.active ? '1' : '0',
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
        return { ok: true, row, msg: 'siap diimpor' }
      })
      setImportRows(parsed)
      setImportDone(null)
    }
    reader.readAsText(f)
  }

  async function commitImport() {
    if (!importRows) return
    let ok = 0, fail = 0
    for (const r of importRows) {
      if (!r.ok) continue
      const [name, sku, buy, sell, stock, cat, barcode] = r.row
      try {
        await apiCreateProduct({
          name, sku, barcode: barcode ?? '',
          categoryId: cats.find((c) => c.name.toLowerCase() === (cat ?? '').toLowerCase() && c.active)?.id ?? null,
          buyPrice: Number(buy) || 0, sellPrice: Number(sell), stock: Number(stock) || 0, unit: 'pcs',
        })
        ok++
      } catch {
        fail++
      }
    }
    setImportDone({ ok, fail })
    setImportRows(null)
    loadProducts()
  }

  return (
    <>
      <PageHead
        title="Produk"
        sub={
          !products
            ? 'Memuat…'
            : catFilter
              ? `${filtered?.length ?? 0} dari ${products.length} produk ditampilkan`
              : `${products.length} produk · ${activeCats.length} kategori aktif`
        }
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={exportList}><Download className="size-4" />Export</Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}><Upload className="size-4" />Import</Button>
            <Button onClick={() => setEditing({ ...emptyDraft })}><Plus className="size-4" />Tambah Produk</Button>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = '' }} />
          </div>
        }
      />

      {(err || prod.err) && <p className="mb-4 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err || prod.err}</p>}

      <div className="mb-5 grid items-start gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="min-w-0 rounded-2xl bg-cream p-5">
          <h2 className="font-mono text-xs uppercase tracking-wider text-fog">Kategori</h2>
          <div className="mt-3 space-y-1.5">
            {!catsReady ? (
              <div className="space-y-1.5" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <>
                <button
                  onClick={() => setCatFilter('')}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${catFilter === '' ? 'border-jet bg-paper font-medium' : 'border-dove bg-paper hover:border-jet'}`}
                >
                  <span>Semua Kategori</span>
                  <CountBadge n={products?.length ?? 0} active={catFilter === ''} />
                </button>
                {activeCats.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setCatFilter(catFilter === c.id ? '' : c.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setCatFilter(catFilter === c.id ? '' : c.id) }}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition ${catFilter === c.id ? 'border-jet bg-paper font-medium' : 'border-dove bg-paper hover:border-jet'}`}
                  >
                    <span className="min-w-0 flex-1 truncate text-left">{c.name}</span>
                    <CountBadge n={counts.m.get(c.id) ?? 0} active={catFilter === c.id} />
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCat(c) }}
                      aria-label={`Hapus kategori ${c.name}`}
                      className="shrink-0 text-xs text-fog hover:text-ember"
                    >
                      hapus
                    </button>
                  </div>
                ))}
                {counts.none > 0 && (
                  <button
                    onClick={() => setCatFilter(catFilter === NONE ? '' : NONE)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${catFilter === NONE ? 'border-jet bg-paper font-medium' : 'border-dove bg-paper hover:border-jet'}`}
                  >
                    <span>Tanpa kategori</span>
                    <CountBadge n={counts.none} active={catFilter === NONE} />
                  </button>
                )}
              </>
            )}
            {cats.filter((c) => !c.active).length > 0 && (
              <p className="pt-1 text-xs text-fog">{cats.filter((c) => !c.active).length} kategori dinonaktifkan (historis)</p>
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

        <div className="min-w-0">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fog" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau SKU…"
              aria-label="Cari produk"
              className="w-full rounded-md border border-border bg-paper py-2.5 pl-10 pr-3.5 text-sm focus:border-jet focus:outline-none"
            />
          </div>
          <div className="overflow-x-auto rounded-2xl bg-cream p-2">
            {!filtered || filtered.length > 0 ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Nama</Th><Th>SKU</Th><Th>Kategori</Th><Th right>Beli</Th><Th right>Jual</Th><Th right>Stok</Th><Th>Status</Th><Th />
                  </tr>
                </thead>
                {!filtered ? (
                  <SkeletonRows cols={8} />
                ) : (
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-muted/50">
                      <Td><span className="font-medium text-fg">{p.name}</span></Td>
                      <Td mono>{p.sku}</Td>
                      <Td>{p.category_name ?? '—'}</Td>
                      <Td right>{fmtRp(p.buy_price)}</Td>
                      <Td right><span className="font-medium text-fg">{fmtRp(p.sell_price)}</span></Td>
                      <Td right><StockCell stock={p.stock} unit={p.unit} /></Td>
                      <Td><Pill tone={p.active ? 'ok' : 'muted'}>{p.active ? 'Aktif' : 'Nonaktif'}</Pill></Td>
                      <Td>
                        <div className="flex justify-end gap-2.5 text-[13px]">
                          <button className="font-medium text-jet hover:underline" onClick={() => setEditing({ id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, categoryId: p.category_id ?? '', buyPrice: String(p.buy_price), sellPrice: String(p.sell_price), stock: String(p.stock), unit: p.unit })}>Ubah</button>
                          <button className="text-muted hover:underline" onClick={() => toggleActive(p)}>{p.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                          <button className="text-ember hover:underline" onClick={() => setDeleteFor(p)}>Hapus</button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
                )}
              </table>
            ) : products && products.length > 0 ? (
              <Empty title="Tidak ada produk yang cocok" sub="Coba kata kunci lain atau ubah filter kategori." action={<Button onClick={() => { setCatFilter(''); setQ('') }}>Tampilkan semua</Button>} />
            ) : (
              <Empty title="Belum ada produk" sub="Tambah produk pertama untuk mulai berjualan." action={<Button onClick={() => setEditing({ ...emptyDraft })}>+ Tambah Produk</Button>} />
            )}
          </div>
        </div>
      </div>

      <Modal open={!!editing} title={editing?.id ? 'Ubah Produk' : 'Tambah Produk'} onClose={() => setEditing(null)} wide>
        {editing && (
          <FormProduk
            draft={editing}
            cats={cats.filter((c) => c.active)}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal open={!!deleteFor} title={`Hapus Produk · ${deleteFor?.name ?? ''}`} onClose={() => setDeleteFor(null)}>
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Tindakan ini <strong className="text-ember">permanen</strong>. Produk tidak bisa dikembalikan setelah dihapus.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteFor(null)}>Batal</Button>
            <Button variant="danger" onClick={removeProduct}>Hapus Produk</Button>
          </div>
        </div>
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

      <Modal open={!!importDone} title="Hasil Import" onClose={() => setImportDone(null)}>
        {importDone && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              <strong className="text-sprout">{importDone.ok} produk</strong> berhasil diimpor,{' '}
              <strong className="text-ember">{importDone.fail} gagal</strong> (SKU duplikat atau data tidak valid).
            </p>
            <Button className="w-full" onClick={() => setImportDone(null)}>Tutup</Button>
          </div>
        )}
      </Modal>
    </>
  )
}

function CountBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums ${active ? 'bg-jet text-paper' : 'bg-surface text-muted'}`}>
      {n}
    </span>
  )
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
