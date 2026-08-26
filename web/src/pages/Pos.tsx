import { useEffect, useMemo, useState } from 'react'
import { apiCheckout, apiGetSettings, apiListProducts, fetchAll, type PayMethod, type Product, type StoreSettings, type Trx } from '../lib/api'
import { fmtRp } from '../lib/store'
import { Button, Modal } from '../lib/ui'

const METHODS: PayMethod[] = ['Cash', 'Bank Transfer', 'QRIS', 'E-Wallet', 'Card']

interface CartLine { product: Product; qty: number }

export default function Pos() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Semua')
  const [products, setProducts] = useState<Product[] | null>(null)
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState(0)
  const [method, setMethod] = useState<PayMethod>('Cash')
  const [paid, setPaid] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<Trx | null>(null)

  function load() {
    fetchAll<Product>((page) => apiListProducts({ active: true, page, limit: 200 })).then(setProducts).catch(() => {})
  }
  useEffect(() => { load() }, [])
  useEffect(() => { apiGetSettings().then(setSettings).catch(() => {}) }, [])

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
  const change = Number(paid) - total

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
    if (method === 'Cash' && (!paid || change < 0)) return setErr('Jumlah bayar kurang dari total.')
    setBusy(true)
    try {
      const trx = await apiCheckout({
        items: cart.map((l) => ({ productId: l.product.id, qty: l.qty })),
        discount,
        method,
        paid: method === 'Cash' ? Number(paid) : 0,
      })
      setReceipt(trx)
      setCart([]); setDiscount(0); setPaid(''); setPayOpen(false)
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
        <Button onClick={() => { setPayOpen(true); setErr('') }} disabled={cart.length === 0}>Bayar · Selesaikan Transaksi</Button>
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
            <p className="py-10 text-center text-sm text-fog">Memuat katalog…</p>
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
              <input
                type="number" min="0" max={subtotal} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
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
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
              Jumlah dibayar
              <input
                type="number" min="0" value={paid} onChange={(e) => setPaid(e.target.value)}
                placeholder="0" autoFocus
                className="rounded-md border border-border bg-paper px-3.5 py-2.5 text-[15px] focus:border-jet focus:outline-none"
              />
            </label>
          ) : (
            <p className="text-sm text-muted">Total {fmtRp(total)} akan dicatat sebagai pembayaran {method}.</p>
          )}
          {method === 'Cash' && paid && change >= 0 && (
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

function Receipt({ trx, settings, onClose }: { trx: Trx; settings: StoreSettings | null; onClose: () => void }) {
  const st = settings ?? { storeName: '', address: '', phone: '', receiptHeader: '', receiptFooter: '', paper: '58mm' } as StoreSettings
  return (
    <div>
      <div id="receipt" className="mx-auto w-full max-w-80 rounded-lg border border-dove bg-paper p-4 font-mono text-[12px] leading-relaxed" style={{ width: st.paper }}>
        <p className="text-center text-sm font-medium">{st.storeName}</p>
        {st.address && <p className="text-center">{st.address}</p>}
        {st.phone && <p className="text-center">{st.phone}</p>}
        <p className="mt-2">{new Date(trx.time).toLocaleString('id-ID')}</p>
        <p>ID {trx.id} · {trx.cashier_name}</p>
        <div className="my-2 border-t border-dashed border-dove" />
        {trx.items.map((i) => (
          <div key={i.product_id} className="flex justify-between gap-2">
            <span className="flex-1">{i.name}</span>
            <span className="tabular-nums">{i.qty}×{fmtRp(i.price)}</span>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-dove" />
        <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{fmtRp(trx.subtotal)}</span></div>
        {trx.discount > 0 && <div className="flex justify-between"><span>Diskon</span><span className="tabular-nums">-{fmtRp(trx.discount)}</span></div>}
        {trx.tax > 0 && <div className="flex justify-between"><span>Pajak</span><span className="tabular-nums">{fmtRp(trx.tax)}</span></div>}
        <div className="flex justify-between font-medium"><span>Total</span><span className="tabular-nums">{fmtRp(trx.total)}</span></div>
        <div className="flex justify-between"><span>Bayar ({trx.method})</span><span className="tabular-nums">{fmtRp(trx.paid)}</span></div>
        <div className="flex justify-between"><span>Kembalian</span><span className="tabular-nums">{fmtRp(trx.change)}</span></div>
        <div className="my-2 border-t border-dashed border-dove" />
        <p className="text-center">{st.receiptHeader}</p>
        <p className="text-center text-[11px] text-fog">{st.receiptFooter}</p>
      </div>
      <div className="mt-4 flex justify-center gap-3">
        <Button onClick={() => window.print()}>Cetak Struk</Button>
        <Button variant="ghost" onClick={onClose}>Tutup</Button>
      </div>
    </div>
  )
}