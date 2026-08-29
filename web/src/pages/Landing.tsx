import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtRp } from '../lib/store'
import Navbar from './Navbar'

interface DemoProduct {
  id: string
  name: string
  sku: string
  barcode: string
  categoryId: string
  sellPrice: number
  stock: number
}

const DEMO_CATS = ['Sembako', 'Minuman', 'Rumah Tangga']

const DEMO_PRODUCTS: DemoProduct[] = [
  { id: 'b1', name: 'Beras Premium 5 kg', sku: 'BR-001', barcode: '', categoryId: 'Sembako', sellPrice: 68000, stock: 24 },
  { id: 'g1', name: 'Gula Pasir 1 kg', sku: 'GP-001', barcode: '', categoryId: 'Sembako', sellPrice: 17500, stock: 40 },
  { id: 'm1', name: 'Minyak Goreng 1 L', sku: 'MG-001', barcode: '', categoryId: 'Sembako', sellPrice: 20000, stock: 30 },
  { id: 'm2', name: 'Mie Goreng Instan', sku: 'MG-002', barcode: '', categoryId: 'Sembako', sellPrice: 3500, stock: 60 },
  { id: 'k1', name: 'Kopi Sachet 165 g', sku: 'KP-001', barcode: '', categoryId: 'Minuman', sellPrice: 14000, stock: 25 },
  { id: 't1', name: 'Teh Celup 25 sachet', sku: 'TH-001', barcode: '', categoryId: 'Minuman', sellPrice: 10500, stock: 18 },
  { id: 'a1', name: 'Air Mineral 600 ml', sku: 'AM-001', barcode: '', categoryId: 'Minuman', sellPrice: 3000, stock: 48 },
  { id: 's1', name: 'Sabun Mandi 90 g', sku: 'SB-001', barcode: '', categoryId: 'Rumah Tangga', sellPrice: 6500, stock: 22 },
]

const SALES7_DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

function randomSales7() {
  const base = 1500000 + Math.random() * 2500000
  return SALES7_DAYS.map((day, i) => ({
    day,
    omzet: Math.round((base + i * 150000 + Math.random() * 1800000 - 900000) / 1000) * 1000,
  }))
}

function SalesTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { day: string } }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-dove bg-paper px-2.5 py-1.5 font-mono text-xs text-fg shadow-sm">
      {payload[0].payload.day} · {fmtRp(payload[0].value)}
    </div>
  )
}

const TESTIMONIALS = [
  { initial: 'S', name: 'Bu Sari', role: 'Pemilik toko kelontong · Java', quote: 'Dulu omzet harian saya hitung dari buku kas setiap malam. Sekarang cukup buka dashboard. Stok langsung berkurang tiap transaksi dan struk tercetak otomatis, jadi saya tidak perlu pusing lagi.' },
  { initial: 'J', name: 'Pak Joko', role: 'Pemilik toko sembako · Surabaya', quote: 'Saya sudah tidak mencatat manual lagi. Sekarang tinggal buka ponsel, semua produk dan stok terlihat jelas. Kasir baru juga langsung bisa dipakai tanpa ribet.' },
  { initial: 'R', name: 'Bu Ratna', role: 'Pemilik toko kosmetik · Bandung', quote: 'Refund dulu membuat pusing. Sekarang cukup sekali klik dan stok kembali otomatis. Pelanggan juga senang karena struknya jelas dan rapi.' },
  { initial: 'B', name: 'Pak Bambang', role: 'Pemilik toko elektronik · Semarang', quote: 'Yang paling saya sukai adalah laporannya. Setiap malam saya bisa melihat produk mana yang laku dan mana yang harus diisi ulang, sehingga keputusan belanja lebih pasti.' },
  { initial: 'D', name: 'Bu Dewi', role: 'Pemilik toko pakaian · Yogyakarta', quote: 'Kasirnya cepat, pelanggan tidak menunggu lama saat toko ramai. Pembayaran QRIS, transfer, dan tunai tersedia semua, dan gratis pula.' },
  { initial: 'H', name: 'Pak Hendra', role: 'Pemilik minimarket · Makassar', quote: 'Karyawan saya diberi akses terbatas, hanya bisa bertransaksi. Data tetap aman dan saya masih bisa memantau omzet dari rumah.' },
  { initial: 'S', name: 'Bu Siti', role: 'Pemilik toko kelontong · Malang', quote: 'Dulu saya sering kehabisan stok tanpa sadar. Sekarang stok yang menipis langsung terlihat di dashboard, jadi saya bisa membeli barang sebelum habis.' },
  { initial: 'A', name: 'Pak Agus', role: 'Pemilik toko aksesoris · Denpasar', quote: 'Mudah dipelajari, orang awam seperti saya pun langsung bisa memakainya. Setiap transaksi tercatat otomatis dan tidak ada lagi uang yang terlewat.' },
  { initial: 'M', name: 'Bu Melati', role: 'Pemilik toko kosmetik · Medan', quote: 'Struk bisa dicetak atau dikirim digital. Pelanggan makin percaya dan toko terlihat profesional meskipun hanya toko kecil.' },
  { initial: 'R', name: 'Pak Rudi', role: 'Pemilik toko elektronik · Palembang', quote: 'Seminggu memakai, langsung terbiasa. Import produk dari Excel juga mudah, ratusan barang masuk sekaligus tanpa salah tulis.' },
]

export default function Landing() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Semua')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [done, setDone] = useState(false)
  const [receiptItems, setReceiptItems] = useState<{ product: DemoProduct; qty: number }[]>([])
  const [sales7] = useState(randomSales7)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          io.unobserve(e.target)
        }
      }),
      { threshold: 0.15 },
    )
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const cats = ['Semua', ...DEMO_CATS]
  const products = DEMO_PRODUCTS.filter((p) => {
    if (cat !== 'Semua' && p.categoryId !== cat) return false
    const s = q.toLowerCase()
    return !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.barcode.toLowerCase().includes(s)
  })

  const cartItems = useMemo(
    () => Object.entries(cart).map(([id, qty]) => ({ product: DEMO_PRODUCTS.find((p) => p.id === id)!, qty })).filter((x) => x.product),
    [cart],
  )
  const total = cartItems.reduce((sum, { product, qty }) => sum + product.sellPrice * qty, 0)

  function add(p: DemoProduct) {
    const cur = cart[p.id] ?? 0
    if (cur >= p.stock) return
    setCart({ ...cart, [p.id]: cur + 1 })
  }

  function remove(id: string) {
    setCart((c) => {
      const n = { ...c }
      delete n[id]
      return n
    })
  }

  function pay() {
    if (cartItems.length === 0) return
    setReceiptItems(cartItems)
    setDone(true)
    setCart({})
  }

  return (
    <div className="bg-bg text-fg">
      <Navbar />
      <main>
        <section id="beranda" className="overflow-hidden pt-[clamp(36px,5vw,92px)] pb-10">
          <div className="container mx-auto max-w-6xl px-5 md:px-8 text-center">
            <span className="hero-reveal beta-pill inline-flex items-center rounded-full bg-sand px-3.5 py-1.5 text-xs font-medium tracking-wide text-jet">
              100% gratis · untuk UMKM
            </span>
            <h1 className="hero-reveal mx-auto mt-4 text-[clamp(30px,8.5vw,40px)] font-normal leading-[1.08] tracking-[-0.025em] sm:text-[clamp(40px,5.2vw,60px)]">
              Aplikasi kasir gratis<br />untuk toko Anda.
            </h1>
            <p className="hero-reveal mx-auto mt-4 max-w-[520px] text-base leading-relaxed text-muted sm:mt-6 sm:text-lg">
              Kelola produk, stok, dan penjualan dari satu dashboard sederhana. Tanpa biaya langganan, cocok untuk toko kecil dan menengah.
            </p>
            <div className="hero-reveal mt-6 flex flex-wrap justify-center gap-3 sm:mt-8">
              <Link to="/daftar" className="rounded-full bg-jet px-6 py-3 text-[15px] font-medium text-paper transition hover:bg-[color-mix(in_oklch,var(--t-jet)_82%,white)] active:translate-y-px sm:px-7.5 sm:py-3.5 sm:text-base">
                Buat toko pertama
              </Link>
              <Link to="/masuk" className="rounded-full border border-dove bg-transparent px-6 py-3 text-[15px] font-medium text-jet transition hover:border-jet hover:bg-fg/6 active:translate-y-px sm:px-7.5 sm:py-3.5 sm:text-base">
                Masuk
              </Link>
            </div>
            <div className="hero-reveal mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-xs tracking-wide text-steel sm:mt-9">
              <span className="inline-flex items-center gap-2">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                Gratis tanpa kartu kredit
              </span>
              <span className="inline-flex items-center gap-2">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                Cocok untuk toko retail kecil dan menengah
              </span>
              <span className="inline-flex items-center gap-2">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                Desktop · tablet · mobile
              </span>
            </div>
          </div>

          <div className="hero-visual container relative mx-auto mt-10 max-w-6xl px-5 md:mt-18 md:px-8">
            <div
              className="pointer-events-none absolute -top-24 -right-16 z-0 h-90 w-90 rounded-full blur-6xl sm:-top-28 sm:-right-18 sm:h-130 sm:w-130"
              style={{ background: 'radial-gradient(circle at 32% 32%, #ffa888 0%, color-mix(in oklch, #ff8868 55%, transparent) 42%, transparent 70%)' }}
              aria-hidden="true"
            />
            <div className="relative z-1 overflow-hidden rounded-xl border border-[#262626] bg-[#151515] shadow-[rgba(0,0,0,0.06)_0_0_0_1px,rgba(15,23,42,0.18)_0_18px_40px_-24px]">
              <div className="flex items-center gap-2 border-b border-[#262626] px-4.5 py-3.5">
                <span className="h-2.5 w-2.5 rounded-full bg-ember" />
                <span className="h-2.5 w-2.5 rounded-full bg-sunbeam" />
                <span className="h-2.5 w-2.5 rounded-full bg-sprout" />
                <span className="ml-2 font-mono text-xs tracking-wide text-[#9d9d9d]">openpos · kasir</span>
              </div>
              <div className="p-3 sm:p-5">
                <input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setDone(false) }}
                  placeholder="Cari produk, SKU, atau barcode…"
                  aria-label="Cari produk"
                  className="w-full rounded-md border border-[#262626] bg-[#1b1b1b] px-3.5 py-2.5 font-mono text-[13px] text-[#ededed] placeholder:text-[#9d9d9d] focus:border-[#6a6a6a] focus:outline-2 focus:outline-[#6a6a6a]"
                />
                <div className="mt-3.5 mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter kategori">
                  {cats.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCat(c); setDone(false) }}
                      className={`rounded-full border px-3.5 py-1.5 text-xs transition ${cat === c ? 'border-[#ffffff] bg-[#ffffff] font-medium text-[#0a0a0a]' : 'border-[#2c2c2c] text-[#9d9d9d] hover:border-[#6a6a6a] hover:text-[#ededed]'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="grid items-start gap-3 lg:grid-cols-[1fr_300px] lg:gap-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 xl:grid-cols-4">
                    {products.map((p) => (
                      <div
                        key={p.id}
                        className="pos-product flex flex-col gap-1.5 rounded-lg border border-[#262626] bg-[#1b1b1b] p-2.5 sm:p-3"
                      >
                        <p className="line-clamp-2 text-[13px] font-medium leading-[1.35] text-[#ededed]">{p.name}</p>
                        <p className="font-mono text-[11px] text-[#9d9d9d]">{p.stock} stok</p>
                        <p className="mt-auto font-mono text-sm text-[#ffffff]">{fmtRp(p.sellPrice)}</p>
                        <button
                          onClick={() => add(p)}
                          disabled={p.stock === 0}
                          className="self-start mt-2 rounded-full bg-[#2a2a2a] px-3.5 py-2 text-xs font-medium text-[#ededed] transition hover:bg-[#383838] active:scale-[0.97] disabled:opacity-45 disabled:hover:bg-[#2a2a2a]"
                        >
                          Tambah
                        </button>
                      </div>
                    ))}
                  </div>
                  <aside className="flex flex-col gap-3 rounded-xl border border-[#262626] bg-[#1a1a1a] p-4">
                    <h4 className="text-[13px] font-medium tracking-tight text-[#ffffff]">Keranjang</h4>
                    {done ? (
                      <div className="flex animate-[fade-in_0.3s_ease_both] flex-col gap-2 font-mono text-xs text-[#ededed]">
                        <div className="rounded-md border border-dashed border-[#2c2c2c] bg-[#1b1b1b] px-3 py-2.5 text-[10px] leading-relaxed">
                          <p className="text-center tracking-widest text-[#ffffff]">OPENPOS</p>
                          <p className="text-center text-[#7a7a7a]">{new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          <p className="border-b border-dashed border-[#2c2c2c] pb-1.5 text-center text-[#9d9d9d]">STRUK DEMO</p>
                          <div className="space-y-1 py-1.5">
                            {receiptItems.map(({ product, qty }) => (
                              <div key={product.id} className="flex justify-between gap-3">
                                <span className="flex-1 truncate">{product.name}</span>
                                <span className="tabular-nums">{qty}×{fmtRp(product.sellPrice)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="border-t border-dashed border-[#2c2c2c] pt-1.5">
                            <div className="flex justify-between"><span className="text-[#9d9d9d]">Total</span><span className="font-medium tabular-nums text-[#ffffff]">{fmtRp(receiptItems.reduce((n, { product, qty }) => n + product.sellPrice * qty, 0))}</span></div>
                            <div className="flex justify-between"><span className="text-[#9d9d9d]">Bayar (Cash)</span><span className="tabular-nums">{fmtRp(receiptItems.reduce((n, { product, qty }) => n + product.sellPrice * qty, 0))}</span></div>
                            <div className="flex justify-between"><span className="text-[#9d9d9d]">Kembalian</span><span className="tabular-nums">Rp 0</span></div>
                          </div>
                          <p className="border-t border-dashed border-[#2c2c2c] pt-1.5 text-center tracking-widest text-sprout">PEMBAYARAN BERHASIL</p>
                        </div>
                        <p className="text-center text-[#9d9d9d]">Transaksi selesai!</p>
                        <button
                          onClick={() => { setDone(false); setReceiptItems([]) }}
                          className="rounded-full bg-[#ffffff] py-2.5 text-[13px] font-semibold text-[#0a0a0a] transition hover:bg-[color-mix(in_oklch,#ffffff_82%,#0a0a0a)] active:scale-[0.97]"
                        >
                          Transaksi Baru
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex min-h-16 flex-col gap-2.5">
                          {cartItems.length === 0 && <p className="font-mono text-xs text-[#9d9d9d]">Keranjang kosong.</p>}
                          {cartItems.map(({ product, qty }) => (
                            <div key={product.id} className="pos-item flex items-start justify-between gap-2.5 text-xs leading-[1.4] text-[#ededed]">
                              <span className="flex-1">{product.name}</span>
                              <span className="font-mono text-[#9d9d9d]">×{qty}</span>
                              <button
                                onClick={() => remove(product.id)}
                                aria-label={`Hapus ${product.name}`}
                                className="grid h-6 w-6 place-items-center text-sm leading-none text-[#7a7a7a] hover:text-[#ffffff]"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between border-t border-[#2c2c2c] pt-3 font-mono text-[13px] text-[#ffffff]">
                          <span>Total</span>
                          <span className="text-[15px]">{fmtRp(total)}</span>
                        </div>
                        <button
                          onClick={pay}
                          disabled={cartItems.length === 0}
                          className="rounded-full bg-[#ffffff] py-2.5 text-[13px] font-semibold text-[#0a0a0a] transition hover:bg-[color-mix(in_oklch,#ffffff_82%,#0a0a0a)] active:scale-[0.97] disabled:opacity-50 disabled:hover:bg-[#ffffff]"
                        >
                          Bayar · Selesaikan Transaksi
                        </button>
                      </>
                    )}
                  </aside>
                </div>
              </div>
            </div>
            <p className="mt-4.5 text-center font-mono text-xs text-steel">
              coba interaktif · transaksi di sini hanya pratinjau
            </p>
          </div>
        </section>

        <section id="fitur" className="section border-t border-border">
          <div className="container mx-auto max-w-6xl px-5 md:px-8">
            <div className="reveal max-w-[680px]">
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-steel">Fitur</p>
              <h2 className="mt-5 text-[clamp(30px,3.8vw,46px)] font-normal leading-[1.14] tracking-[-0.025em]">
                Fitur yang dibutuhkan toko kecil, tanpa yang berlebihan.
              </h2>
            </div>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {[
                { mark: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />, t: 'Kasir yang cepat', d: 'Cari produk lewat nama, SKU, atau barcode, lalu tambahkan ke keranjang, terima pembayaran, dan cetak struk. Satu transaksi selesai dalam hitungan detik.' },
                { mark: <path d="M12 2 4 6v12l8 4 8-4V6l-8-4zM4 6l8 4 8-4M12 10v10" />, t: 'Produk dan stok real-time', d: 'Stok berkurang otomatis setiap transaksi dan kembali saat refund. Anda tidak akan kehabisan stok tanpa sadar atau menumpuk barang yang tidak terjual.' },
                { mark: <path d="M3 21h18M6 17v-6M11.5 17V8M17 17v-9" />, t: 'Laporan yang rapi', d: 'Omzet harian, produk terlaris, dan profit terlihat langsung dari dashboard. Tidak perlu menghitung manual di buku kas.' },
              ].map((f, i) => (
                <div key={f.t} className="feature reveal group" data-delay={i}>
                  <span className="mb-5 grid h-9 w-9 place-items-center text-fog transition-colors duration-150 group-hover:text-jet">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">{f.mark}</svg>
                  </span>
                  <h3 className="mb-1.5 text-2xl font-medium leading-[1.3] tracking-[-0.01em]">{f.t}</h3>
                  <p className="text-[15px] leading-relaxed text-muted">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="cara-kerja" className="section border-t border-border bg-sand">
          <div className="container mx-auto max-w-6xl px-5 md:px-8">
            <div className="reveal max-w-[680px]">
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-steel">Cara Kerja</p>
              <h2 className="mt-5 text-[clamp(30px,3.8vw,46px)] font-normal leading-[1.14] tracking-[-0.025em]">
                Dari mendaftar sampai transaksi pertama, hanya tiga langkah.
              </h2>
            </div>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {[
                { n: '01', t: 'Buat akun dan toko', d: 'Daftar sekali. Akun admin dan data toko langsung dibuat bersamaan. Tanpa kartu kredit, tanpa biaya, dan tanpa masa percobaan.' },
                { n: '02', t: 'Tambah produk dan stok', d: 'Masukkan produk beserta harga dan stok awal, atau impor ratusan baris sekaligus lewat file CSV.' },
                { n: '03', t: 'Mulai berjualan', d: 'Buka menu kasir, cari produk, selesaikan pembayaran, lalu cetak struk. Stok otomatis terbarui di dashboard.' },
              ].map((s, i) => (
                <div key={s.n} className="step reveal" data-delay={i}>
                  <span className="mb-5 block font-mono text-[26px] text-fog">{s.n}</span>
                  <h3 className="mb-1.5 text-2xl font-medium leading-[1.3] tracking-[-0.01em]">{s.t}</h3>
                  <p className="text-[15px] leading-relaxed text-muted">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="cerita" className="section border-t border-border">
          <div className="container mx-auto max-w-6xl px-5 md:px-8">
            <div className="reveal mb-8 max-w-[680px]">
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-steel">Kata mereka</p>
              <h2 className="mt-5 text-[clamp(30px,3.8vw,46px)] font-normal leading-[1.14] tracking-[-0.025em]">
                Dipakai toko-toko kecil di seluruh Indonesia.
              </h2>
            </div>
            <div className="marquee-wrap reveal" data-delay="1">
              <div className="marquee-track">
                {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                  <figure key={i} className="marquee-card w-80 flex-none rounded-2xl bg-cream p-5">
                    <div className="mb-2 text-[40px] leading-none text-fog" aria-hidden="true">&ldquo;</div>
                    <blockquote className="text-sm leading-relaxed">{t.quote}</blockquote>
                    <figcaption className="mt-4 flex items-center gap-2.5 text-sm text-steel">
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-jet font-mono text-xs font-medium text-paper" aria-hidden="true">{t.initial}</span>
                      <span>
                        <span className="font-medium text-jet">{t.name}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-steel">{t.role}</span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="tentang" className="section border-t border-border">
          <div className="container mx-auto grid max-w-6xl items-start gap-14 px-5 md:px-8 md:grid-cols-2">
            <div className="reveal">
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-steel">Tentang</p>
              <h2 className="mt-5 text-[clamp(30px,3.8vw,46px)] font-normal leading-[1.14] tracking-[-0.025em]">
                Sederhana untuk siapa pun, andal untuk bisnis yang bertumbuh.
              </h2>
              <p className="mt-10 text-lg leading-relaxed text-muted">
                OpenPOS lahir dari masalah yang sering terjadi. Mayoritas UMKM di Indonesia masih mencatat penjualan di buku kas atau Excel, sementara aplikasi kasir yang ada umumnya berbayar per bulan dan terlalu rumit untuk dipelajari.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-muted">
                Kami membuatnya berbeda. Antarmuka kasir yang sederhana, cukup untuk operasional harian toko kecil, dan gratis selamanya. Tanpa langganan dan tanpa masa percobaan yang berubah menjadi tagihan.
              </p>
            </div>
            <div className="reveal rounded-2xl bg-cream p-8" data-delay="1">
              <div className="mb-5 flex items-center gap-2">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-ember" />
                  <span className="h-2.5 w-2.5 rounded-full bg-sunbeam" />
                  <span className="h-2.5 w-2.5 rounded-full bg-sprout" />
                </span>
                <span className="font-mono text-xs tracking-wide text-steel">openpos · penjualan 7 hari terakhir</span>
              </div>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
<AreaChart data={sales7} margin={{ top: 4, right: 14, bottom: 4, left: 14 }}>
                      <defs>
                        <linearGradient id="landingSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--t-jet)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--t-jet)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--t-dove)" />
                      <XAxis dataKey="day" interval={0} tickLine={false} axisLine={false} tick={{ fontSize: 11, fontFamily: 'Geist Mono', fill: 'var(--t-fog)' }} />
                    <YAxis hide />
                    <Tooltip cursor={{ stroke: 'var(--t-fog)', strokeDasharray: '4 4' }} content={<SalesTooltip />} />
                    <Area type="monotone" dataKey="omzet" stroke="var(--t-jet)" strokeWidth={2} fill="url(#landingSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-center font-mono text-[11px] text-steel">omzet per hari · data demo</p>
            </div>
          </div>
        </section>

        <section id="daftar" className="section border-t border-border py-16 text-center">
          <div className="container mx-auto max-w-[640px] px-5 md:px-8">
            <h2 className="reveal text-[clamp(30px,3.8vw,46px)] font-normal leading-[1.14] tracking-[-0.025em]">Mulai berjualan hari ini tanpa biaya langganan.</h2>
            <p className="reveal mx-auto mt-4 mb-8 max-w-[520px] text-lg leading-relaxed text-muted" data-delay="1">
              Daftar dalam satu menit. Buat toko, tambah produk, lalu terima pembayaran pertama Anda. Gratis selamanya.
            </p>
            <Link
              to="/daftar"
              className="reveal inline-block rounded-full bg-jet px-7.5 py-3.5 text-base font-medium text-paper transition hover:bg-[color-mix(in_oklch,var(--t-jet)_82%,white)] active:translate-y-px"
              data-delay="2"
            >
              Buat toko Anda sekarang
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border py-14 text-[13px] text-muted">
      <div className="container mx-auto grid max-w-6xl items-start gap-8 px-5 md:px-8 md:grid-cols-[2fr_1fr_1fr] md:gap-14">
        <div>
          <Link to="/" className="mb-3 inline-block">
            <img src="/logo.png" alt="OpenPOS" className="h-7 w-auto" />
          </Link>
          <p className="max-w-xs leading-relaxed">
            Sistem kasir digital untuk UMKM Indonesia. Kelola produk, stok, dan penjualan dari satu dashboard sederhana.
          </p>
        </div>
        <nav className="flex flex-col gap-2.5" aria-label="Navigasi footer">
          <Link to="/masuk" className="text-sm hover:text-jet">Masuk</Link>
          <Link to="/daftar" className="text-sm hover:text-jet">Buat akun gratis</Link>
          <a href="#fitur" className="text-sm hover:text-jet">Fitur</a>
          <a href="#tentang" className="text-sm hover:text-jet">Tentang</a>
        </nav>
        <div className="flex flex-col gap-1.5 text-right md:items-end">
          <span className="font-mono text-xs">© 2026 OpenPOS</span>
          <span className="font-mono text-xs">gratis selamanya · untuk UMKM</span>
          <span className="font-mono text-xs">v1.0 · MVP</span>
        </div>
      </div>
    </footer>
  )
}