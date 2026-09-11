// Produk — Operate surface. Katalog + filter kategori + CRUD + CSV.
// Token font/warna milik sistem (tidak ada token baru di file ini).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FolderPlus, Plus, Search, Upload } from 'lucide-react'
import { apiCreateCategory, apiCreateProduct, apiDeleteCategory, apiDeleteProduct, apiListCategories, apiListProducts, apiSetProductActive, apiUpdateProduct, fetchAll, type Category, type Product } from '../../lib/local-api'
import { useCache } from '../../lib/cache'
import { exportCSV, fmtRp, useDB } from '../../lib/store'
import { NumInput, Button, Empty, Input, Modal, PageHead, Pager, Pill, SkeletonRows, Td, Th } from '../../lib/ui'
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
// ponytail: paging client-side di atas fetchAll; pindah ke paging server-side bila katalog puluhan ribu.
const PAGE_SIZE = 15

export default function Produk() {
  const { session } = useDB()
  const who = `${session?.id}:${session?.role}`
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [page, setPage] = useState(0)
  const prod = useCache<Product[]>(`products:${who}:${q.trim()}`, () => fetchAll<Product>((page) => apiListProducts({ q: q.trim() || undefined, page, limit: 200 })), 'Gagal memuat produk.')
  const products = prod.data
  const catq = useCache<Category[]>(`cats:${who}`, () => apiListCategories())
  const cats = catq.data ?? []
  const catsReady = !catq.loading
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleteFor, setDeleteFor] = useState<Product | null>(null)
  const [catName, setCatName] = useState('')
  const [catOpen, setCatOpen] = useState(false)
  const [catBusy, setCatBusy] = useState(false)
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

  useEffect(() => { setPage(0) }, [q, catFilter])
  const totalPages = Math.max(1, Math.ceil((filtered?.length ?? 0) / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = filtered?.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

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
      setCatOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menambah kategori.')
    }
  }

  async function removeCategory(c: Category) {
    if (catBusy) return
    const n = counts.m.get(c.id) ?? 0
    if (!confirm(`Hapus kategori "${c.name}"?${n > 0 ? ` ${n} produk di dalamnya jadi Tanpa Kategori.` : ''}`)) return
    setErr(''); setCatBusy(true)
    try {
      // Pindah semua produk ke Tanpa Kategori dulu supaya DELETE
      // menghapus permanen (backend soft-delete bila masih dipakai).
      const all = await fetchAll<Product>((page) => apiListProducts({ page, limit: 200 }))
      let fail = 0
      for (const p of all.filter((x) => x.category_id === c.id)) {
        try {
          await apiUpdateProduct(p.id, {
            name: p.name, sku: p.sku, barcode: p.barcode, categoryId: null,
            buyPrice: p.buy_price, sellPrice: p.sell_price, unit: p.unit,
          })
        } catch {
          fail++
        }
      }
      if (fail > 0) {
        setErr(`${fail} produk gagal dipindah. Kategori tidak dihapus.`)
        return
      }
      await apiDeleteCategory(c.id)
      if (c.id === catFilter) setCatFilter('')
      catq.reload()
      loadProducts()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus kategori.')
    } finally {
      setCatBusy(false)
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
            <Button variant="ghost" onClick={() => { setCatName(''); setErr(''); setCatOpen(true) }}><FolderPlus className="size-4" />Kategori</Button>
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
                  {(pageItems ?? []).map((p) => (
                    <tr key={p.id}>
                      <Td><span className="font-medium text-fg">{p.name}</span></Td>
                      <Td mono>{p.sku}</Td>
                      <Td>{p.category_name ?? 'Tanpa kategori'}</Td>
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
          <Pager page={safePage} total={totalPages} onChange={setPage} />
        </div>
      </div>

      <Modal open={catOpen} title="Kelola Kategori" onClose={() => setCatOpen(false)}>
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); addCat() }}
        >
          <Input label="Nama kategori baru" value={catName} onChange={setCatName} placeholder="cth: Minuman" />
          <div className="flex items-end">
            <Button type="submit" disabled={catBusy}>Simpan</Button>
          </div>
        </form>
        <div className="mt-5 border-t border-dove pt-4">
          <h3 className="font-mono text-xs uppercase tracking-wider text-fog">Daftar kategori</h3>
          <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
            {activeCats.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-dove bg-paper px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <CountBadge n={counts.m.get(c.id) ?? 0} active={false} />
                <button
                  disabled={catBusy}
                  onClick={() => removeCategory(c)}
                  aria-label={`Hapus kategori ${c.name}`}
                  className="shrink-0 text-[13px] text-ember hover:underline disabled:opacity-40"
                >
                  {catBusy ? '…' : 'Hapus'}
                </button>
              </div>
            ))}
            {activeCats.length === 0 && <p className="text-sm text-fog">Belum ada kategori.</p>}
          </div>
        </div>
      </Modal>

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
      <NumInput label="Harga beli (Rp)" value={d.buyPrice} onValue={set('buyPrice')} />
      <NumInput label="Harga jual (Rp)" value={d.sellPrice} onValue={set('sellPrice')} required />
      {!d.id && <NumInput label="Stok awal" value={d.stock} onValue={set('stock')} />}
      <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Batal</Button>
        <Button type="submit">Simpan</Button>
      </div>
    </form>
  )
}
