// Stok — inventory monitoring workspace: ringkasan → cari/filter → tab stok/riwayat → tindakan.
// Token font/warna milik sistem (tidak ada token baru di file ini).
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Check, ChevronDown, CircleCheck, OctagonX, Package, Search, TriangleAlert } from 'lucide-react'
import { apiAdjustStock, apiListCategories, apiListMovements, apiListProducts, fetchAll, type Category, type Movement, type Product } from '../lib/api'
import { useCache } from '../lib/cache'
import { fmtDate, fmtTime, useDB } from '../lib/store'
import { NumInput, Button, Empty, Input, Modal, PageHead, Pager, Pill, SkeletonRows, Td, Th } from '../lib/ui'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const TYPE_LABEL: Record<Movement['type'], string> = {
  sale: 'Penjualan', refund: 'Refund', adjust: 'Penyesuaian', initial: 'Stok awal',
}

const NONE = '__none__'
const PAGE_SIZE = 10

const isLow = (stock: number) => stock > 0 && stock <= 5

export default function Stok() {
  const { session } = useDB()
  const who = `${session?.id}:${session?.role}`
  const prod = useCache<Product[]>(`stock-products:${who}`, () => fetchAll<Product>((page) => apiListProducts({ page, limit: 200 })), 'Gagal memuat stok.')
  const products = prod.data
  const mov = useCache<Movement[]>(`movements:${who}`, () => apiListMovements({ limit: 50 }).then((r) => r.items))
  const movements = mov.data
  const catq = useCache<Category[]>(`cats:${who}`, () => apiListCategories())
  const cats = (catq.data ?? []).filter((c) => c.active)

  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'stock' | 'movement'>(params.get('tab') === 'riwayat' ? 'movement' : 'stock')
  const [page, setPage] = useState(0)
  const [mpage, setMpage] = useState(0)
  const [adjustFor, setAdjustFor] = useState<Product | null>(null)
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [type, setType] = useState<'plus' | 'minus'>('plus')
  const [busy, setBusy] = useState(false)

  const actives = useMemo(() => (products ?? []).filter((p) => p.active), [products])

  const counts = useMemo(() => {
    let aman = 0, menipis = 0, habis = 0
    for (const p of actives) {
      if (p.stock === 0) habis++
      else if (isLow(p.stock)) menipis++
      else aman++
    }
    return { total: actives.length, aman, menipis, habis }
  }, [actives])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return actives.filter((p) => {
      if (catFilter === NONE && p.category_id) return false
      if (catFilter && catFilter !== NONE && p.category_id !== catFilter) return false
      if (needle && !`${p.name} ${p.sku}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [actives, q, catFilter])

  useEffect(() => { setPage(0) }, [q, catFilter, tab])
  useEffect(() => { setMpage(0) }, [tab])

  // ponytail: paging client-side di atas fetchAll; server-side bila katalog puluhan ribu.
  const stockPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const stockPage = Math.min(page, stockPages - 1)
  const stockItems = filtered.slice(stockPage * PAGE_SIZE, stockPage * PAGE_SIZE + PAGE_SIZE)

  const movPages = Math.max(1, Math.ceil((movements?.length ?? 0) / PAGE_SIZE))
  const movPage = Math.min(mpage, movPages - 1)
  const movItems = (movements ?? []).slice(movPage * PAGE_SIZE, movPage * PAGE_SIZE + PAGE_SIZE)

  function load() {
    prod.reload()
    mov.reload()
  }

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

  const stats = [
    { label: 'Total Produk', value: counts.total, icon: Package, tint: 'text-[var(--chart-1)] bg-[color-mix(in_oklch,var(--chart-1)_12%,transparent)]' },
    { label: 'Stok Aman', value: counts.aman, icon: CircleCheck, tint: 'text-[var(--t-sprout)] bg-[color-mix(in_oklch,var(--t-sprout)_12%,transparent)]' },
    { label: 'Stok Menipis', value: counts.menipis, icon: TriangleAlert, tint: 'text-[var(--t-sunbeam)] bg-[color-mix(in_oklch,var(--t-sunbeam)_14%,transparent)]' },
    { label: 'Stok Habis', value: counts.habis, icon: OctagonX, tint: 'text-[var(--t-ember)] bg-[color-mix(in_oklch,var(--t-ember)_12%,transparent)]' },
  ]

  const catLabel = !catFilter ? 'Semua kategori' : catFilter === NONE ? 'Tanpa kategori' : cats.find((c) => c.id === catFilter)?.name ?? 'Semua kategori'

  return (
    <>
      <PageHead title="Stok" sub="Pantau ketersediaan dan pergerakan stok barang." />

      {(err || prod.err) && <p className="mb-4 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err || prod.err}</p>}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {!products ? (
          [0, 1, 2, 3].map((i) => (
            <Card key={i} aria-hidden="true">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="size-9 rounded-lg" />
                </div>
                <Skeleton className="h-7 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium text-muted-foreground">{s.label}</span>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${s.tint}`}>
                    <s.icon className="size-4.5" />
                  </span>
                </div>
                <p className="mt-3 text-[28px] font-semibold leading-none tabular-nums tracking-tight">{s.value}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="mt-5 flex gap-2">
        {([
          { id: 'stock', label: 'Stok Saat Ini' },
          { id: 'movement', label: 'Riwayat Pergerakan' },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`rounded-lg border px-3.5 py-2 text-sm transition ${tab === t.id ? 'border-jet bg-paper font-medium' : 'border-dove bg-paper text-muted hover:border-jet hover:text-fg'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fog" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau SKU…"
              aria-label="Cari produk"
              className="w-full rounded-md border border-border bg-paper py-2.5 pl-10 pr-3.5 text-sm focus:border-jet focus:outline-none"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Filter kategori"
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-paper px-3.5 py-2.5 text-sm transition outline-none hover:border-jet focus-visible:ring-2 focus-visible:ring-ring sm:w-56"
            >
              <span className="min-w-0 flex-1 truncate text-left">{catLabel}</span>
              <ChevronDown className="size-4 shrink-0 text-fog" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setCatFilter('')}>
                <Check className={`size-4 ${!catFilter ? 'opacity-100' : 'opacity-0'}`} />
                Semua kategori
              </DropdownMenuItem>
              {cats.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => setCatFilter(c.id)}>
                  <Check className={`size-4 ${catFilter === c.id ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => setCatFilter(NONE)}>
                <Check className={`size-4 ${catFilter === NONE ? 'opacity-100' : 'opacity-0'}`} />
                Tanpa kategori
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {tab === 'stock' ? (
        <div className="mt-4">
          <div className="hidden overflow-x-auto rounded-2xl bg-cream p-2 sm:block">
            {!products ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Produk</Th><Th>SKU</Th><Th>Kategori</Th><Th><div className="text-center">Stok</div></Th><Th>Status</Th><Th />
                  </tr>
                </thead>
                <SkeletonRows cols={6} />
              </table>
            ) : filtered.length > 0 ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Produk</Th><Th>SKU</Th><Th>Kategori</Th><Th><div className="text-center">Stok</div></Th><Th>Status</Th><Th />
                  </tr>
                </thead>
                <tbody>
                  {stockItems.map((p) => (
                    <tr key={p.id}>
                      <Td><span className="text-[15px] font-medium text-fg">{p.name}</span></Td>
                      <Td mono>{p.sku}</Td>
                      <Td>{p.category_name ?? 'Tanpa kategori'}</Td>
                      <Td><div className="flex justify-center"><StockQty stock={p.stock} unit={p.unit} /></div></Td>
                      <Td><StockPill stock={p.stock} /></Td>
                      <Td>
                        <div className="flex justify-end">
                          <button className="text-[13px] font-medium text-jet hover:underline" onClick={() => setAdjustFor(p)}>Penyesuaian</button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty
                title={products.length > 0 ? 'Tidak ada produk yang cocok' : 'Belum ada produk'}
                sub={products.length > 0 ? 'Coba kata kunci lain atau ubah filter kategori.' : 'Tambah produk dari menu Produk untuk mulai memantau stok.'}
                action={products.length > 0 ? <Button onClick={() => { setCatFilter(''); setQ('') }}>Tampilkan semua</Button> : undefined}
              />
            )}
          </div>

          <div className="space-y-2.5 sm:hidden">
            {!products ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : filtered.length > 0 ? (
              stockItems.map((p) => (
                <div key={p.id} className="rounded-xl border border-dove bg-paper p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-fg">{p.name}</p>
                    <StockPill stock={p.stock} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-fog">{p.sku} · {p.category_name ?? 'Tanpa kategori'}</p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <StockQty stock={p.stock} unit={p.unit} />
                    <button className="text-[13px] font-medium text-jet hover:underline" onClick={() => setAdjustFor(p)}>Penyesuaian</button>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-sm text-fog">
                {products.length > 0 ? 'Tidak ada produk yang cocok.' : 'Belum ada produk.'}
              </p>
            )}
          </div>

          <Pager page={stockPage} total={stockPages} onChange={setPage} />
        </div>
      ) : (
        <div className="mt-4">
          <div className="hidden overflow-x-auto rounded-2xl bg-cream p-2 sm:block">
            {!movements ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Waktu</Th><Th>Produk</Th><Th>Jenis</Th><Th right>Qty</Th><Th>Alasan</Th><Th>Aktor</Th>
                  </tr>
                </thead>
                <SkeletonRows cols={6} />
              </table>
            ) : movements.length > 0 ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Waktu</Th><Th>Produk</Th><Th>Jenis</Th><Th right>Qty</Th><Th>Alasan</Th><Th>Aktor</Th>
                  </tr>
                </thead>
                <tbody>
                  {movItems.map((m) => (
                    <tr key={m.id}>
                      <Td mono>{fmtDate(m.created_at)} {fmtTime(m.created_at)}</Td>
                      <Td>{m.product_name ?? '—'}</Td>
                      <Td><Pill tone={m.type === 'sale' ? 'ok' : m.type === 'refund' ? 'warn' : 'muted'}>{TYPE_LABEL[m.type]}</Pill></Td>
                      <Td right><span className={`font-mono tabular-nums ${m.qty > 0 ? 'text-sprout' : 'text-ember'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</span></Td>
                      <Td>{m.reason}</Td>
                      <Td>{m.actor}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-10 text-center text-sm text-fog">Belum ada pergerakan stok.</p>
            )}
          </div>

          <div className="space-y-2.5 sm:hidden">
            {!movements ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
            ) : movements.length > 0 ? (
              movItems.map((m) => (
                <div key={m.id} className="rounded-xl border border-dove bg-paper p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{m.product_name ?? '—'}</p>
                    <span className={`shrink-0 font-mono text-sm tabular-nums ${m.qty > 0 ? 'text-sprout' : 'text-ember'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-fog">{fmtDate(m.created_at)} {fmtTime(m.created_at)} · {TYPE_LABEL[m.type]} · {m.actor}</p>
                  {m.reason && <p className="mt-1 truncate text-[13px] text-muted">{m.reason}</p>}
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-sm text-fog">Belum ada pergerakan stok.</p>
            )}
          </div>

          <Pager page={movPage} total={movPages} onChange={setMpage} />
        </div>
      )}

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
            <NumInput label="Jumlah" value={qty} onValue={setQty} placeholder="0" />
            <Input label="Alasan (wajib)" value={reason} onChange={setReason} placeholder="cth: barang rusak, stok fisik berbeda" />
            <Button className="w-full" onClick={submit} disabled={!Number(qty) || !reason.trim() || busy}>{busy ? 'Menyimpan…' : 'Simpan Penyesuaian'}</Button>
          </div>
        )}
      </Modal>
    </>
  )
}

function StockPill({ stock }: { stock: number }) {
  if (stock === 0) return <Pill tone="warn">Habis</Pill>
  if (isLow(stock)) return <Pill tone="warn">Menipis</Pill>
  return <Pill>Aman</Pill>
}

function StockQty({ stock, unit }: { stock: number; unit: string }) {
  const dot = stock === 0 ? 'var(--t-ember)' : isLow(stock) ? 'var(--t-sunbeam)' : 'var(--t-sprout)'
  return (
    <span className={`inline-flex items-center gap-1.5 text-[15px] tabular-nums ${stock === 0 || isLow(stock) ? 'font-semibold text-fg' : 'text-muted'}`}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} aria-hidden="true" />
      {stock} {unit}
    </span>
  )
}
