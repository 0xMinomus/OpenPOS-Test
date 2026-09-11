import { useMemo, useState } from 'react'
import { apiCheckout, apiGetSettings, apiListProducts, fetchAll, type PayMethod, type Product, type StoreSettings, type Trx } from '../../lib/local-api'
import { useCache } from '../../lib/cache'
import { fmtRp, useDB } from '../../lib/store'
import { Receipt } from '../../lib/receipt'
import { NumInput, Button, Modal } from '../../lib/ui'
import { Skeleton } from '@/components/ui/skeleton'

const METHODS: PayMethod[] = ['Cash', 'Bank Transfer', 'QRIS', 'E-Wallet', 'Card']

interface CartLine { product: Product; qty: number }

export default function Pos() {
  const { session } = useDB()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Semua')
  const prod = useCache<Product[]>(`pos-products:${session?.id}`, () => fetchAll<Product>((page) => apiListProducts({ active: true, page, limit: 200 })))
  const products = prod.data
  const setq = useCache<StoreSettings>(`settings:${session?.id}`, () => apiGetSettings())
  const settings = setq.data
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState(0)
  const [method, setMethod] = useState<PayMethod>('Cash')
  const [paid, setPaid] = useState('')
  const [exactCash, setExactCash] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<Trx | null>(null)

  function load() {
    prod.reload()
  }

  const cats = useMemo(() => [...new Set((products ?? []).map((p) => p.category_id).filter((x): x is string => !!x))], [products])
  const catName = (id: string | null) => (products ?? []).find((p) => p.category_id === id)?.category_name ?? '—'

  const filtered = (products ?? []).filter((p) => {
    if (cat !== 'Semua' && p.category_id !== cat) return false
    const s2 = q.toLowerCase()
    return !s2 || p.name.toLowerCase().includes(s2) || p.sku.toLowerCase().includes(s2) || p.barcode.toLowerCase().includes(s2)
  })

  const effStock = (p: Product) => p.stock - (cart.find((l) => l.product.id === p.id)?.qty ?? 0)

  const taxPct = settings?.taxEnabled ? settings.taxPct : 0
  const subtotal = cart.reduce((n, l) => n + l.product.sell_price * l.qty, 0)
  const tax = Math.round((subtotal - discount) * (taxPct / 100))
  const total = subtotal - discount + tax
  const change = exactCash ? 0 : Number(paid) - total

  function add(p: Product) {
    setCart((c) => {
      const ex = c.find((l) => l.product.id === p.id)
      if (ex) {
        if (ex.qty >= p.stock) { setErr('Stok tidak cukup.'); return c }
        return c.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l))
      }
      if (p.stock < 1) { setErr('Stok tidak cukup.'); return c }
      return [...c, { product: p, qty: 1 }]
    })
    setErr('')
  }

  function setQty(id: string, qty: number) {
    if (qty < 1) return setCart((c) => c.filter((l) => l.product.id !== id))
    setCart((c) => c.map((l) => {
      if (l.product.id !== id) return l
      if (qty > l.product.stock) { setErr('Stok tidak cukup.'); return l }
      return { ...l, qty }
    }))
  }

  async function checkout() {
    setErr('')
    if (cart.length === 0) return setErr('Keranjang kosong.')
    if (method === 'Cash' && !exactCash && (!paid || change < 0)) return setErr('Jumlah bayar kurang dari total.')
    setBusy(true)
    try {
      const trx = await apiCheckout({
        items: cart.map((l) => ({ productId: l.product.id, qty: l.qty })),
        discount,
        method,
        paid: method === 'Cash' ? (exactCash ? total : Number(paid)) : 0,
      })
      setReceipt(trx)
      setCart([]); setDiscount(0); setPaid(''); setExactCash(false); setPayOpen(false)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyelesaikan transaksi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-normal tracking-tight sm:text-3xl">POS Kasir</h1>
          <p className="mt-1 text-sm text-muted">Cari produk, tambah ke keranjang, selesaikan pembayaran.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari produk, SKU, atau barcode…"
            aria-label="Cari produk"
            className="mb-3 w-full rounded-md border border-border bg-paper px-3.5 py-3 text-[15px] focus:border-jet focus:outline-none"
          />
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setCat('Semua')}
              className={`rounded-full border px-3 py-1 text-xs ${cat === 'Semua' ? 'border-jet bg-jet text-paper' : 'border-dove text-muted hover:border-jet'}`}
            >
              Semua
            </button>
            {cats.map((id) => (
              <button
                key={id}
                onClick={() => setCat(id)}
                className={`rounded-full border px-3 py-1 text-xs ${cat === id ? 'border-jet bg-jet text-paper' : 'border-dove text-muted hover:border-jet'}`}
              >
                {catName(id)}
              </button>
            ))}
          </div>
          {err && <p className="mb-3 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>}
          {!products ? (
            <div aria-busy="true" aria-label="Memuat katalog">
              <div className="mb-4 flex flex-wrap gap-2" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-6 w-16 rounded-full" />
                ))}
              </div>
              <div className="grid max-h-[62vh] grid-cols-2 gap-2.5 overflow-y-auto pr-1 md:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-2 rounded-xl border border-dove p-3.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid max-h-[62vh] grid-cols-2 gap-2.5 overflow-y-auto pr-1 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => add(p)}
                  disabled={effStock(p) === 0}
                  className={`rounded-xl border p-3.5 text-left transition ${effStock(p) === 0 ? 'cursor-not-allowed border-dove opacity-40' : 'border-dove hover:border-jet'}`}
                >
                  <p className="text-[13px] font-medium leading-snug">{p.name}</p>
                  <p className="mt-1 font-mono text-[11px] text-fog">{effStock(p)} stok</p>
                  <p className="mt-1 font-mono text-sm font-medium tabular-nums">{fmtRp(p.sell_price)}</p>
                </button>
              ))}
              {filtered.length === 0 && <p className="col-span-full py-10 text-center text-sm text-fog">Tidak ada produk ditemukan.</p>}
            </div>
          )}
        </section>

        <aside className="flex flex-col rounded-2xl bg-cream p-4">
          <h2 className="font-mono text-xs uppercase tracking-wider text-fog">Keranjang</h2>
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
            {cart.length === 0 && <p className="py-6 text-center text-sm text-fog">Belum ada item. Klik produk untuk menambah.</p>}
            {cart.map((l) => (
              <div key={l.product.id} className="rounded-lg border border-dove bg-paper p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium leading-snug">{l.product.name}</p>
                  <button onClick={() => setCart((c) => c.filter((x) => x.product.id !== l.product.id))} aria-label={`Hapus ${l.product.name}`} className="text-fog hover:text-ember">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setQty(l.product.id, l.qty - 1)} className="grid h-6 w-6 place-items-center rounded-full border border-dove text-sm hover:border-jet">−</button>
                    <span className="w-7 text-center font-mono text-[13px] tabular-nums">{l.qty}</span>
                    <button onClick={() => setQty(l.product.id, l.qty + 1)} className="grid h-6 w-6 place-items-center rounded-full border border-dove text-sm hover:border-jet">+</button>
                  </div>
                  <span className="font-mono text-[13px] tabular-nums">{fmtRp(l.product.sell_price * l.qty)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5 border-t border-dove pt-3 text-sm">
            <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="font-mono tabular-nums">{fmtRp(subtotal)}</span></div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Diskon</span>
              <NumInput
                value={discount}
                onValue={(r) => setDiscount(Math.min(subtotal, Math.max(0, Number(r || 0))))}
                className="w-24 rounded border border-dove bg-paper px-2 py-0.5 text-right font-mono text-[13px] tabular-nums focus:border-jet focus:outline-none"
              />
            </div>
            {taxPct > 0 && (
              <div className="flex justify-between"><span className="text-muted">Pajak ({taxPct}%)</span><span className="font-mono tabular-nums">{fmtRp(tax)}</span></div>
            )}
            <div className="flex justify-between text-base font-medium"><span>Total</span><span className="font-mono tabular-nums">{fmtRp(total)}</span></div>
          </div>
          <Button className="mt-4 w-full" disabled={cart.length === 0} onClick={() => { setPayOpen(true); setErr('') }}>Bayar · {fmtRp(total)}</Button>
        </aside>
      </div>

      <Modal open={payOpen} title="Pembayaran" onClose={() => setPayOpen(false)}>
        <div className="space-y-4">
          {err && <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>}
          <div>
            <p className="mb-2 text-[13px] font-medium text-steel">Metode pembayaran</p>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs ${method === m ? 'border-jet bg-jet text-paper' : 'border-dove text-muted hover:border-jet'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {method === 'Cash' ? (
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={exactCash}
                  onChange={(e) => { setExactCash(e.target.checked); if (e.target.checked) setPaid('') }}
                  className="h-4 w-4 accent-jet"
                />
                Uang Pas
              </label>
              {!exactCash && (
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
                  Jumlah dibayar
                  <NumInput
                    value={paid}
                    onValue={setPaid}
                    placeholder="0"
                    autoFocus
                    className="rounded-md border border-border bg-paper px-3.5 py-2.5 text-[15px] focus:border-jet focus:outline-none"
                  />
                </label>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">Total {fmtRp(total)} akan dicatat sebagai pembayaran {method}.</p>
          )}
          {method === 'Cash' && (exactCash ? change === 0 : paid) && change >= 0 && (
            <div className="flex justify-between rounded-lg bg-surface px-3.5 py-3 text-sm">
              <span className="text-muted">Kembalian</span>
              <span className="font-mono font-medium tabular-nums">{fmtRp(change)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-dove pt-3 text-[15px]">
            <span>Total</span>
            <span className="font-mono font-medium tabular-nums">{fmtRp(total)}</span>
          </div>
          <Button className="w-full" onClick={checkout} disabled={busy}>{busy ? 'Memproses…' : 'Selesaikan Transaksi'}</Button>
        </div>
      </Modal>

      <Modal open={!!receipt} title="Transaksi berhasil" onClose={() => setReceipt(null)}>
        {receipt && <Receipt trx={receipt} settings={settings} onClose={() => setReceipt(null)} />}
      </Modal>
    </>
  )
}
