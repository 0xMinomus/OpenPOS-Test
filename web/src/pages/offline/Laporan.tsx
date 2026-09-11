import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Banknote, BarChart3, Boxes, ChevronDown, ChevronUp, CircleCheck, Loader2, OctagonX, Package, ReceiptText, Sigma, TriangleAlert, TrendingUp, Wallet } from 'lucide-react'
import { apiGetReport, apiListMovements, apiListProducts, apiListTransactions, fetchAll, type Movement, type Product, type ReportBundle, type Trx } from '../../lib/local-api'
import { useCache } from '../../lib/cache'
import { exportCSV, fmtDate, fmtInv, fmtRp, fmtShort, fmtTime } from '../../lib/store'
import { Button, PageHead, Pill, SkeletonRows, StatusPill, Td, Th } from '../../lib/ui'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts'

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hari ini' },
  { id: 'yesterday', label: 'Kemarin' },
  { id: 'week', label: 'Minggu ini' },
  { id: 'month', label: 'Bulan ini' },
  { id: 'all', label: 'Semua' },
]

const payConfig: Record<string, string> = {
  Cash: 'var(--chart-1)',
  'Bank Transfer': 'var(--chart-2)',
  QRIS: 'var(--chart-3)',
  'E-Wallet': 'var(--chart-4)',
  Card: 'var(--chart-5)',
}

const salesChartConfig = {
  omzet: { label: 'Penjualan', color: 'var(--chart-omzet)' },
  trx: { label: 'Transaksi', color: 'var(--chart-1)' },
} as const
const profitTrendConfig = {
  revenue: { label: 'Pendapatan', color: 'var(--chart-1)' },
  hpp: { label: 'HPP', color: 'var(--muted)' },
  profit: { label: 'Profit', color: 'var(--chart-omzet)' },
} as const
const profitMarginConfig = {
  margin: { label: 'Margin', color: 'var(--chart-2)' },
} as const
const stockConfig = { nilai: { label: 'Nilai stok', color: 'var(--chart-3)' } } as const
const CAT_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const MOV_LABEL: Record<Movement['type'], string> = {
  sale: 'Penjualan', refund: 'Refund', adjust: 'Penyesuaian', initial: 'Stok awal',
}

const iconTint = {
  blue: { color: 'text-[var(--chart-1)]', bg: 'bg-[color-mix(in_oklch,var(--chart-1)_12%,transparent)]' },
  teal: { color: 'text-[var(--chart-2)]', bg: 'bg-[color-mix(in_oklch,var(--chart-2)_12%,transparent)]' },
  amber: { color: 'text-[var(--chart-3)]', bg: 'bg-[color-mix(in_oklch,var(--chart-3)_14%,transparent)]' },
  rose: { color: 'text-[var(--chart-5)]', bg: 'bg-[color-mix(in_oklch,var(--chart-5)_12%,transparent)]' },
} as const

function Kpi({ label, value, sub, icon: Icon, tint }: { label: string; value: string; sub: string; icon: React.ComponentType<{ className?: string }>; tint: { color: string; bg: string } }) {
  return (
    <Card>
      <CardContent className="relative min-h-32 p-5">
        <span className={`absolute right-5 top-5 grid size-9 place-items-center rounded-lg ${tint.bg}`}>
          <Icon className={`size-4.5 ${tint.color}`} />
        </span>
        <div className="flex h-full flex-col justify-center pr-9">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ChartCard({ title, sub, action, children }: { title: string; sub: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{sub}</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// Slot jam untuk periode 1 hari (Hari ini/Kemarin). Range saya yang tentukan:
// Pagi 05–11, Siang 11–15, Sore 15–18, Malam = sisanya.
const TIME_SLOTS = [
  { label: 'Pagi', range: '05.00–10.59' },
  { label: 'Siang', range: '11.00–14.59' },
  { label: 'Sore', range: '15.00–18.59' },
  { label: 'Malam', range: '19.00–04.59' },
] as const

function slotOf(hour: number): number {
  if (hour >= 5 && hour < 11) return 0
  if (hour >= 11 && hour < 15) return 1
  if (hour >= 15 && hour < 19) return 2
  return 3
}

function localDayISO(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Label tooltip: range jam bila datum slot waktu, kalau tidak ya label sumbu apa adanya.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tipLabel(label: any, payload?: any): any {
  return payload?.[0]?.payload?.range ?? label
}

// Selisih % vs periode pembanding. Null bila tak terdefinisi (prev<=0) → fallback sub biasa.
function delta(cur: number, prev: number | undefined): string | null {
  if (prev === undefined || prev <= 0 || !Number.isFinite(cur)) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return '±0% dari kemarin'
  return `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}% dari kemarin`
}

// KPI dengan komparasi ↑↓ (dipakai tab sales & profit; tab lain tetap pakai Kpi).
// invert: panah dibalik (untuk metrik biaya — naik = memburuk).
function DeltaKpi({ label, value, sub, compare, invert, icon: Icon, tint }: {
  label: string
  value: string
  sub: string
  compare: string | null
  invert?: boolean
  icon: React.ComponentType<{ className?: string }>
  tint: { color: string; bg: string }
}) {
  const dir = invert && compare ? compare.replace(/↑/g, '⇅').replace(/↓/g, '↑').replace(/⇅/g, '↓') : compare
  const up = dir?.startsWith('↑') ?? false
  const down = dir?.startsWith('↓') ?? false
  const tone = !dir ? 'text-muted-foreground' : up ? 'text-sprout' : down ? 'text-ember' : 'text-muted-foreground'
  return (
    <Card>
      <CardContent className="relative min-h-32 p-5">
        <span className={`absolute right-5 top-5 grid size-9 place-items-center rounded-lg ${tint.bg}`}>
          <Icon className={`size-4.5 ${tint.color}`} />
        </span>
        <div className="flex h-full flex-col justify-center pr-9">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <p className="mt-1 truncate text-3xl font-semibold tabular-nums tracking-tight" title={value}>{value}</p>
          <p className={`mt-0.5 text-xs tabular-nums ${tone}`}>{dir ?? sub}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Laporan() {
  const [period, setPeriod] = useState<Period>('today')
  const [tab, setTab] = useState<'sales' | 'products' | 'profit' | 'stock'>('sales')
  // Animasi chart hidup hanya saat mount; refresh/pindah tab tak me-restartnya.
  const [animate, setAnimate] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setAnimate(false), 900)
    return () => clearTimeout(t)
  }, [])
  const rep = useCache<ReportBundle>(`report:${period}`, () => apiGetReport(period), 'Gagal memuat laporan.')
  const data = rep.data
  const err = rep.err
  // Pembanding "kemarin" hanya terdefinisi untuk periode hari ini (API tak punya
  // periode lalu untuk kemarin/minggu/bulan/semua) — dipakai tab sales & profit.
  const needPrev = (tab === 'sales' || tab === 'profit') && period === 'today'
  const prevRep = useCache<ReportBundle | null>(
    `reportprev:${tab}:${period}`,
    () => ((tab === 'sales' || tab === 'profit') && period === 'today' ? apiGetReport('yesterday') : Promise.resolve(null)),
  )
  const prev = needPrev ? prevRep.data : null
  // Katalog untuk join kategori + hitung produk aktif (tab Produk & Stok).
  const catRep = useCache<Product[] | null>(
    `lapcats:${tab}`,
    () => (tab === 'products' || tab === 'stock' ? fetchAll<Product>((pg) => apiListProducts({ page: pg, limit: 200 })) : Promise.resolve(null)),
  )
  // Riwayat global 5 terbaru (API tak dukung filter periode) — tab Stok saja.
  const movRep = useCache<Movement[]>(
    `lapmov:${tab}`,
    () => (tab === 'stock' ? apiListMovements({ limit: 5 }).then((r) => r.items) : Promise.resolve([])),
  )
  const [prodAll, setProdAll] = useState(false)
  useEffect(() => { setProdAll(false) }, [period])
  const catMap = useMemo(() => {
    const m = new Map<string, { category: string; active: boolean }>()
    for (const p of catRep.data ?? []) m.set(p.id, { category: p.category_name ?? 'Tanpa kategori', active: p.active })
    return m
  }, [catRep.data])
  // Data per jam untuk periode 1 hari: t.date laporan hanya tanggal, jadi ambil
  // jam dari daftar transaksi harian (created_at) — endpoint existing, tanpa API baru.
  // HPP per slot = Σ buy_price × qty per item (TrxItem existing).
  const needHourly = (tab === 'sales' || tab === 'profit') && (period === 'today' || period === 'yesterday')
  const dayStr = period === 'yesterday' ? localDayISO(1) : localDayISO(0)
  const hourRep = useCache<Trx[] | null>(
    `reporthour:${tab}:${period}:${dayStr}`,
    () => ((tab === 'sales' || tab === 'profit') && (period === 'today' || period === 'yesterday')
      ? fetchAll<Trx>((pg) => apiListTransactions({ date: period === 'yesterday' ? localDayISO(1) : localDayISO(0), page: pg, limit: 200 }))
      : Promise.resolve(null)),
  )
  const hourly = needHourly ? hourRep.data : undefined
  // Indikator switching: ganti periode (fetch ulang) MAUPUN pindah tab yang butuh
  // data tambahan (katalog) — pola sama seperti kasus periode Hari ini dkk.
  const tabLabel = tab === 'sales' ? 'Penjualan' : tab === 'products' ? 'Produk' : tab === 'profit' ? 'Profit' : 'Stok'
  const auxLoading = (tab === 'products' || tab === 'stock') && catRep.loading && !catRep.data
  const switching = (rep.loading && data !== null) || auxLoading
  const switchingText = auxLoading && !(rep.loading && data !== null)
    ? `Memuat tab ${tabLabel}…`
    : `Memuat periode ${PERIODS.find((p) => p.id === period)?.label}…`

  const daily = useMemo(() => {
    if (!data) return []
    if (needHourly) {
      if (!hourly) return []
      const slots = TIME_SLOTS.map((s) => ({ label: s.label, range: s.range, omzet: 0, trx: 0 }))
      for (const t of hourly) {
        const s = slots[slotOf(new Date(t.created_at).getHours())]
        s.omzet += t.total
        s.trx += 1
      }
      return slots
    }
    const map = new Map<string, { omzet: number; trx: number }>()
    for (const t of data.transactions) {
      const d = t.date.slice(0, 10)
      const e = map.get(d) ?? { omzet: 0, trx: 0 }
      e.omzet += t.total
      e.trx += 1
      map.set(d, e)
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ label: `${date.slice(8, 10)}/${date.slice(5, 7)}`, omzet: v.omzet, trx: v.trx }))
  }, [data, needHourly, hourly])

  const topProducts = useMemo(() => (data ? [...data.products].sort((a, b) => b.qty - a.qty).slice(0, 5) : []), [data])
  const prodSorted = useMemo(() => (data ? [...data.products].sort((a, b) => b.qty - a.qty) : []), [data])
  const lowProducts = useMemo(() => (data ? [...data.products].sort((a, b) => a.qty - b.qty).slice(0, 5) : []), [data])
  const prodProfit = useMemo(() => (data ? [...data.products].sort((a, b) => b.profit - a.profit) : []), [data])
  const profitDaily = useMemo(() => {
    if (!data) return []
    if (needHourly) {
      if (!hourly) return []
      const slots = TIME_SLOTS.map((s) => ({ label: s.label, range: s.range, revenue: 0, hpp: 0, profit: 0, margin: 0 }))
      for (const t of hourly) {
        const s = slots[slotOf(new Date(t.created_at).getHours())]
        const h = t.items.reduce((n, i) => n + i.buy_price * i.qty, 0)
        s.revenue += t.total
        s.hpp += h
        s.profit += t.total - h
      }
      for (const s of slots) s.margin = s.revenue > 0 ? Math.round((s.profit / s.revenue) * 100) : 0
      return slots
    }
    const map = new Map<string, { revenue: number; hpp: number; profit: number }>()
    for (const t of data.transactions) {
      const d = t.date.slice(0, 10)
      const e = map.get(d) ?? { revenue: 0, hpp: 0, profit: 0 }
      e.revenue += t.total
      e.hpp += t.hpp
      e.profit += t.profit
      map.set(d, e)
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        label: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
        ...v,
        margin: v.revenue > 0 ? Math.round((v.profit / v.revenue) * 100) : 0,
      }))
  }, [data, needHourly, hourly])
  // Insight valid dari data existing (maks 5, tanpa klaim buatan).
  const profitInsights = useMemo(() => {
    if (!data || data.transactions.length === 0) return []
    const out: string[] = []
    const omzet = data.summary.omzet
    if (period === 'today' && prev && prev.summary.omzet > 0 && omzet > 0) {
      const cur = Math.round((data.summary.gross_profit / omzet) * 100)
      const pr = Math.round((prev.summary.gross_profit / prev.summary.omzet) * 100)
      const d = cur - pr
      out.push(`Margin profit hari ini ${cur}%, ${d === 0 ? 'sama seperti kemarin' : d > 0 ? `naik ${d}% dibanding kemarin` : `turun ${Math.abs(d)}% dibanding kemarin`}.`)
    }
    if (catMap.size > 0 && data.summary.gross_profit > 0) {
      const byCat = new Map<string, number>()
      for (const p of data.products) {
        const c = catMap.get(p.product_id)?.category ?? 'Tanpa kategori'
        byCat.set(c, (byCat.get(c) ?? 0) + p.profit)
      }
      const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]
      if (top) out.push(`Kategori ${top[0]} menyumbang ${Math.round((top[1] / data.summary.gross_profit) * 100)}% dari total profit.`)
    }
    const star = prodProfit[0]
    if (star && star.profit > 0) out.push(`${star.name} menjadi produk dengan kontribusi profit terbesar (${fmtRp(star.profit)}).`)
    const hppTotal = data.transactions.reduce((n, t) => n + t.hpp, 0)
    if (omzet > 0 && hppTotal > 0) out.push(`HPP periode ini ${fmtRp(hppTotal)} (${Math.round((hppTotal / omzet) * 100)}% dari omzet).`)
    const fat = [...data.products].filter((p) => p.revenue > 0).sort((a, b) => (b.profit / b.revenue) - (a.profit / a.revenue))[0]
    if (fat && fat.profit > 0) out.push(`${fat.name} margin tertinggi ${Math.round((fat.profit / fat.revenue) * 100)}% (${fmtRp(fat.profit)} profit).`)
    return out.slice(0, 5)
  }, [data, period, prev, catMap, prodProfit])
  // Donut kategori: gabung agregat laporan + kategori katalog; 4 teratas + Lainnya.
  const catDonut = useMemo(() => {
    if (!data) return []
    const map = new Map<string, number>()
    for (const p of data.products) {
      const c = catMap.get(p.product_id)?.category ?? 'Tanpa kategori'
      map.set(c, (map.get(c) ?? 0) + p.qty)
    }
    const rows = [...map.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty)
    if (rows.length <= 5) return rows
    const top = rows.slice(0, 4)
    const rest = rows.slice(4).reduce((n, r) => n + r.qty, 0)
    return [...top, { name: 'Lainnya', qty: rest }]
  }, [data, catMap])
  // Baris stok + kategori katalog (cocok SKU lalu nama).
  const stockRows = useMemo(() => {
    if (!data) return []
    const bySku = new Map((catRep.data ?? []).map((p) => [p.sku, p.category_name ?? 'Tanpa kategori']))
    const byName = new Map((catRep.data ?? []).map((p) => [p.name, p.category_name ?? 'Tanpa kategori']))
    return data.stock.map((s) => ({ ...s, category: bySku.get(s.sku) ?? byName.get(s.name) ?? 'Tanpa kategori' }))
  }, [data, catRep.data])
  const stockStatus = useMemo(() => {
    let aman = 0, menipis = 0, habis = 0
    for (const s of stockRows) {
      if (s.stock === 0) habis++
      else if (s.stock <= 5) menipis++
      else aman++
    }
    return { aman, menipis, habis }
  }, [stockRows])
  const lowStock = useMemo(
    () => stockRows.filter((s) => s.stock <= 5).sort((a, b) => a.stock - b.stock),
    [stockRows],
  )
  const catValue = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of stockRows) map.set(s.category, (map.get(s.category) ?? 0) + s.stock_value)
    const rows = [...map.entries()].map(([name, nilai]) => ({ name, nilai })).sort((a, b) => b.nilai - a.nilai)
    if (rows.length <= 5) return rows
    const top = rows.slice(0, 4)
    const rest = rows.slice(4).reduce((n, r) => n + r.nilai, 0)
    return [...top, { name: 'Lainnya', nilai: rest }]
  }, [stockRows])

  function exportTab() {
    if (!data) return
    if (tab === 'sales') {
      exportCSV(`laporan-penjualan-${period}.csv`, [
        ['tanggal', 'id', 'kasir', 'metode', 'total'],
        ...data.transactions.map((t) => [t.date, t.id, t.cashier, t.method, String(t.total)]),
      ])
    } else if (tab === 'products') {
      exportCSV(`laporan-produk-${period}.csv`, [
        ['produk', 'sku', 'qty_terjual', 'pendapatan', 'profit'],
        ...data.products.map((p) => [p.name, p.sku, String(p.qty), String(p.revenue), String(p.profit)]),
      ])
    } else if (tab === 'stock') {
      exportCSV(`laporan-stok.csv`, [
        ['produk', 'sku', 'stok', 'harga_beli', 'harga_jual', 'nilai_stok'],
        ...data.stock.map((s) => [s.name, s.sku, String(s.stock), String(s.buy_price), String(s.sell_price), String(s.stock_value)]),
      ])
    } else {
      exportCSV(`laporan-profit-${period}.csv`, [
        ['tanggal', 'id', 'kasir', 'total', 'hpp', 'profit'],
        ...data.transactions.map((t) => [t.date, t.id, t.cashier, String(t.total), String(t.hpp), String(t.profit)]),
      ])
    }
  }

  if (err && !data) return (
    <>
      <PageHead title="Laporan" sub="Ringkasan performa toko Anda." right={<Button variant="ghost" onClick={exportTab}>Export CSV</Button>} />
      <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>
    </>
  )

  return (
    <>
      <PageHead
        title="Laporan"
        sub="Ringkasan performa toko Anda."
        right={<Button variant="ghost" onClick={exportTab}>Export CSV</Button>}
      />

      <div>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Periode laporan">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition ${period === p.id ? 'border-jet bg-jet font-medium text-paper' : 'border-dove bg-paper text-muted hover:border-jet hover:text-fg'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-2.5 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Jenis laporan">
          {(['sales', 'products', 'profit', 'stock'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-lg px-3.5 py-1.5 text-xs transition outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === t ? 'bg-paper font-medium text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
            >
              {t === 'sales' ? 'Penjualan' : t === 'products' ? 'Produk' : t === 'profit' ? 'Profit' : 'Stok'}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <LaporanSkeleton />
      ) : (
        <div aria-busy={switching || undefined} className={switching ? 'pointer-events-none opacity-60 transition-opacity' : undefined}>
          {switching && (
            <p className="mb-3 flex items-center gap-2 text-[13px] text-muted" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {switchingText}
            </p>
          )}
          {tab === 'sales' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <DeltaKpi label="Total Penjualan" value={fmtRp(data.summary.omzet)} sub={`${data.summary.trx_count} transaksi`} compare={delta(data.summary.omzet, prev?.summary.omzet)} icon={Banknote} tint={iconTint.blue} />
                <DeltaKpi label="Jumlah Transaksi" value={String(data.summary.trx_count)} sub="selesai dalam periode ini" compare={delta(data.summary.trx_count, prev?.summary.trx_count)} icon={ReceiptText} tint={iconTint.teal} />
                <DeltaKpi
                  label="Rata-rata Transaksi"
                  value={fmtRp(data.summary.trx_count > 0 ? Math.round(data.summary.omzet / data.summary.trx_count) : 0)}
                  sub="per transaksi"
                  compare={delta(
                    data.summary.trx_count > 0 ? Math.round(data.summary.omzet / data.summary.trx_count) : 0,
                    prev && prev.summary.trx_count > 0 ? Math.round(prev.summary.omzet / prev.summary.trx_count) : undefined,
                  )}
                  icon={Sigma} tint={iconTint.amber}
                />
                <DeltaKpi label="Produk Terjual" value={String(data.summary.items_sold)} sub="satuan produk" compare={delta(data.summary.items_sold, prev?.summary.items_sold)} icon={Package} tint={iconTint.rose} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <ChartCard title="Penjualan & Transaksi" sub={daily.length > 0 ? `Total ${fmtRp(data.summary.omzet)} · per tanggal` : 'Tidak ada data pada periode ini'}>
                  {daily.length === 0 ? (
                    needHourly && !hourly ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">Memuat rincian jam…</p>
                    ) : (
                      <p className="py-16 text-center text-sm text-muted-foreground">Tidak ada transaksi pada periode ini.</p>
                    )
                  ) : (
                    <>
                      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-full" style={{ background: 'var(--chart-omzet)' }} />
                          Penjualan
                        </span>
                        {!needHourly && (
                          <span className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full" style={{ background: 'var(--chart-1)' }} />
                            Transaksi
                          </span>
                        )}
                      </div>
                      <ChartContainer config={salesChartConfig} className="h-64 w-full [&_:focus]:outline-none">
                        <ComposedChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="30%">
                          <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="color-mix(in oklch, var(--foreground) 18%, transparent)" />
                          <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={24} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="left" tickLine={false} axisLine={false} width={44} domain={[0, 'auto']} tickFormatter={(v: number) => fmtShort(v)} tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="right" orientation="right" hide domain={[0, 'auto']} />
                          <ChartTooltip cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} content={<ChartTooltipContent labelFormatter={tipLabel} formatter={(v, name) => (name === 'Transaksi' ? `${v} transaksi` : fmtRp(Number(v)))} />} />
                          <Bar yAxisId="left" dataKey="omzet" name="Penjualan" fill="var(--color-omzet)" radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out">
                            {daily.length <= 14 && <LabelList dataKey="omzet" position="top" formatter={(v) => fmtShort(Number(v))} fontSize={11} className="fill-muted-foreground" />}
                          </Bar>
                          {!needHourly && (
                            <Line yAxisId="right" type="monotone" dataKey="trx" name="Transaksi" stroke="var(--chart-1)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" dot={{ r: 3, fill: 'var(--chart-1)', strokeWidth: 0 }} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out" />
                          )}
                        </ComposedChart>
                      </ChartContainer>
                    </>
                  )}
                </ChartCard>

                <ChartCard title="Metode Pembayaran" sub={data.by_method.length > 0 ? `Total ${fmtRp(data.summary.omzet)}` : 'Belum ada data'}>
                  {data.by_method.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <div className="space-y-4">
                      <ChartContainer config={{}} className="relative mx-auto h-44 w-full">
                        <PieChart>
                          <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} hideLabel />} />
                          <Pie data={data.by_method.map((m) => ({ ...m, fill: payConfig[m.method] ?? 'var(--chart-4)' }))} dataKey="total" nameKey="method" innerRadius={52} outerRadius={74} paddingAngle={3} strokeWidth={0} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out">
                            {data.by_method.map((m, i) => (
                              <Cell key={i} fill={payConfig[m.method] ?? 'var(--chart-4)'} />
                            ))}
                          </Pie>
                        </PieChart>
                        <div className="pointer-events-none absolute inset-0 grid place-items-center">
                          <div className="text-center">
                            <p className="text-sm font-semibold tabular-nums tracking-tight">{fmtShort(data.summary.omzet)}</p>
                            <p className="text-[11px] text-muted-foreground">Total Penjualan</p>
                          </div>
                        </div>
                      </ChartContainer>
                      <div className="space-y-2">
                        {(() => {
                          const payTotal = data.by_method.reduce((n, m) => n + m.total, 0) || 1
                          return data.by_method.map((m) => (
                            <div key={m.method} className="flex items-center justify-between gap-3 text-sm">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="size-2.5 shrink-0 rounded-full" style={{ background: payConfig[m.method] ?? 'var(--chart-4)' }} />
                                <span className="truncate">{m.method}</span>
                              </span>
                              <span className="shrink-0 tabular-nums">
                                <span className="font-medium">{fmtRp(m.total)}</span>
                                <span className="text-muted-foreground"> · {Math.round((m.total / payTotal) * 100)}%</span>
                              </span>
                            </div>
                          ))
                        })()}
                      </div>
                    </div>
                  )}
                </ChartCard>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <ChartCard
                  title="Transaksi Terbaru"
                  sub="10 transaksi terakhir periode ini"
                  action={<Link to="/transaksi" className="shrink-0 text-[13px] font-medium text-jet hover:underline">Lihat semua →</Link>}
                >
                  <div className="overflow-x-auto">
                    {data.transactions.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr><Th>Invoice</Th><Th>Tanggal</Th><Th>Kasir</Th><Th>Metode</Th><Th right>Total</Th><Th>Status</Th></tr>
                        </thead>
                        <tbody>
                          {data.transactions.slice(0, 10).map((t) => (
                            <tr key={t.id}>
                              <Td mono><span className="font-medium text-fg">{fmtInv(t.id)}</span></Td>
                              <Td mono>{fmtDate(t.date)}</Td>
                              <Td>{t.cashier}</Td>
                              <Td>{t.method}</Td>
                              <Td right><span className="font-medium text-fg">{fmtRp(t.total)}</span></Td>
                              <Td><StatusPill status={t.status} /></Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </ChartCard>

                <ChartCard
                  title="Produk Terlaris"
                  sub="Top 5 jumlah terjual"
                  action={<button onClick={() => setTab('products')} className="shrink-0 text-[13px] font-medium text-jet hover:underline">Lihat semua →</button>}
                >
                  {topProducts.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <div className="space-y-4">
                      {topProducts.map((p, i) => (
                        <div key={p.product_id} className="flex items-baseline gap-3">
                          <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.name}</p>
                            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{p.qty} terjual</p>
                          </div>
                          <span className="shrink-0 text-sm font-medium tabular-nums">{fmtRp(p.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ChartCard>
              </div>
            </div>
          )}

          {tab === 'products' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Qty Terjual" value={String(data.products.reduce((n, p) => n + p.qty, 0))} sub="total satuan" icon={Package} tint={iconTint.blue} />
                <Kpi label="Produk Terjual" value={String(data.products.length)} sub="jenis berbeda terjual" icon={Boxes} tint={iconTint.teal} />
                <Kpi label="Pendapatan Produk" value={fmtRp(data.products.reduce((n, p) => n + p.revenue, 0))} sub="dari semua produk" icon={Banknote} tint={iconTint.amber} />
                <Kpi
                  label="Produk Aktif"
                  value={catRep.data ? String([...catMap.values()].filter((c) => c.active).length) : '…'}
                  sub={catRep.data ? `dari ${catMap.size} produk` : 'memuat katalog…'}
                  icon={CircleCheck} tint={iconTint.rose}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <ChartCard title="Penjualan Produk Teratas" sub="Top 5 berdasarkan jumlah terjual">
                  {topProducts.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <ChartContainer config={{}} className="h-64 w-full [&_:focus]:outline-none">
                      <BarChart data={topProducts.map((p) => ({ name: p.name.length > 16 ? `${p.name.slice(0, 16)}…` : p.name, full: p.name, qty: p.qty }))} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 8 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="4 4" stroke="color-mix(in oklch, var(--foreground) 18%, transparent)" />
                        <XAxis type="number" hide domain={[0, 'auto']} />
                        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={128} tick={{ fontSize: 11 }} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(_, payload) => (payload?.[0]?.payload as { full?: string } | undefined)?.full ?? ''} formatter={(v) => `${v} terjual`} />} />
                        <Bar dataKey="qty" fill="var(--chart-2)" radius={[0, 6, 6, 0]} barSize={22} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out">
                          <LabelList dataKey="qty" position="right" fontSize={11} className="fill-muted-foreground" />
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </ChartCard>

                <ChartCard title="Kategori Terlaris" sub={catDonut.length > 0 ? 'Kontribusi unit per kategori' : 'Belum ada data'}>
                  {catDonut.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <div className="space-y-4">
                      <ChartContainer config={{}} className="relative mx-auto h-44 w-full">
                        <PieChart>
                          <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v} terjual`} hideLabel />} />
                          <Pie data={catDonut.map((c, i) => ({ ...c, fill: CAT_COLORS[i % CAT_COLORS.length] }))} dataKey="qty" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={3} strokeWidth={0} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out">
                            {catDonut.map((c, i) => (
                              <Cell key={c.name} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                        <div className="pointer-events-none absolute inset-0 grid place-items-center">
                          <div className="text-center">
                            <p className="text-sm font-semibold tabular-nums tracking-tight">{fmtShort(catDonut.reduce((n, c) => n + c.qty, 0))}</p>
                            <p className="text-[11px] text-muted-foreground">Unit Terjual</p>
                          </div>
                        </div>
                      </ChartContainer>
                      <div className="space-y-2">
                        {(() => {
                          const catTotal = catDonut.reduce((n, c) => n + c.qty, 0) || 1
                          return catDonut.map((c) => (
                            <div key={c.name} className="flex items-center justify-between gap-3 text-sm">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="size-2.5 shrink-0 rounded-full" style={{ background: CAT_COLORS[catDonut.indexOf(c) % CAT_COLORS.length] }} />
                                <span className="truncate">{c.name}</span>
                              </span>
                              <span className="shrink-0 tabular-nums">
                                <span className="font-medium">{c.qty}</span>
                                <span className="text-muted-foreground"> · {Math.round((c.qty / catTotal) * 100)}%</span>
                              </span>
                            </div>
                          ))
                        })()}
                      </div>
                    </div>
                  )}
                </ChartCard>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <ChartCard
                  title="Produk Terlaris"
                  sub={prodAll ? `Semua ${prodSorted.length} produk` : 'Top 5 jumlah terjual'}
                >
                  <div className="overflow-x-auto">
                    {prodSorted.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr><Th>#</Th><Th>Produk</Th><Th>Kategori</Th><Th right>Qty Terjual</Th><Th right>Pendapatan</Th></tr>
                        </thead>
                        <tbody>
                          {(prodAll ? prodSorted : prodSorted.slice(0, 5)).map((p, i) => (
                            <tr key={p.product_id}>
                              <Td mono>{String(i + 1).padStart(2, '0')}</Td>
                              <Td><span className="font-medium text-fg">{p.name}</span></Td>
                              <Td>{catMap.get(p.product_id)?.category ?? 'Tanpa kategori'}</Td>
                              <Td right>{p.qty}</Td>
                              <Td right><span className="font-medium text-fg">{fmtRp(p.revenue)}</span></Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {prodSorted.length > 5 && (
                    <button
                      onClick={() => setProdAll((v) => !v)}
                      aria-expanded={prodAll}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dove bg-paper py-2 text-[13px] font-medium transition hover:border-jet"
                    >
                      {prodAll ? 'Ringkas' : 'Selengkapnya'}
                      {prodAll ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                  )}
                </ChartCard>

                <ChartCard title="Perlu Perhatian" sub="Penjualan terendah periode ini">
                  {lowProducts.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <div className="space-y-4">
                      {lowProducts.map((p) => (
                        <div key={p.product_id} className="flex items-baseline gap-3">
                          <span className="size-2 mt-1.5 shrink-0 rounded-full" style={{ background: 'var(--t-sunbeam)' }} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.name}</p>
                            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{p.qty} terjual · {fmtRp(p.revenue)}</p>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">Cek stok, harga, atau promosikan kembali produk ini.</p>
                    </div>
                  )}
                </ChartCard>
              </div>
            </div>
          )}

          {tab === 'profit' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <DeltaKpi label="Profit Kotor" value={fmtRp(data.summary.gross_profit)} sub={`dari omzet ${fmtRp(data.summary.omzet)}`} compare={delta(data.summary.gross_profit, prev?.summary.gross_profit)} icon={TrendingUp} tint={iconTint.blue} />
                <DeltaKpi
                  label="Margin Profit"
                  value={data.summary.omzet > 0 ? `${Math.round((data.summary.gross_profit / data.summary.omzet) * 100)}%` : '0%'}
                  sub="profit per rupiah omzet"
                  compare={(() => {
                    if (!prev || prev.summary.omzet <= 0 || data.summary.omzet <= 0) return null
                    const d = Math.round((data.summary.gross_profit / data.summary.omzet) * 100) - Math.round((prev.summary.gross_profit / prev.summary.omzet) * 100)
                    return d === 0 ? '±0% dari kemarin' : `${d > 0 ? '↑' : '↓'} ${Math.abs(d)}% dari kemarin`
                  })()}
                  icon={BarChart3} tint={iconTint.teal}
                />
                <DeltaKpi label="Pendapatan" value={fmtRp(data.summary.omzet)} sub="total penjualan" compare={delta(data.summary.omzet, prev?.summary.omzet)} icon={Banknote} tint={iconTint.amber} />
                <DeltaKpi label="HPP" value={fmtRp(data.transactions.reduce((n, t) => n + t.hpp, 0))} sub="modal barang terjual" compare={delta(data.transactions.reduce((n, t) => n + t.hpp, 0), prev ? prev.transactions.reduce((n, t) => n + t.hpp, 0) : undefined)} invert icon={Wallet} tint={iconTint.rose} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <ChartCard title="Tren Profit" sub={profitDaily.length > 0 ? 'Pendapatan, HPP, dan profit per tanggal' : 'Tidak ada data pada periode ini'}>
                  {profitDaily.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">Tidak ada transaksi pada periode ini.</p>
                  ) : (
                    <>
                      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-full" style={{ background: 'var(--chart-1)' }} />
                          Pendapatan
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-full" style={{ background: 'var(--muted)' }} />
                          HPP
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-full" style={{ background: 'var(--chart-omzet)' }} />
                          Profit
                        </span>
                      </div>
                      <ChartContainer config={profitTrendConfig} className="h-64 w-full [&_:focus]:outline-none">
                        <ComposedChart data={profitDaily} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="30%">
                          <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="color-mix(in oklch, var(--foreground) 18%, transparent)" />
                          <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={24} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="left" tickLine={false} axisLine={false} width={44} domain={[0, 'auto']} tickFormatter={(v: number) => fmtShort(v)} tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="right" orientation="right" hide domain={[0, 'auto']} />
<ChartTooltip cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} content={<ChartTooltipContent labelFormatter={tipLabel} formatter={(v) => fmtRp(Number(v))} />} />
                          <Bar yAxisId="left" dataKey="revenue" name="Pendapatan" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out" />
                          <Bar yAxisId="left" dataKey="hpp" name="HPP" fill="var(--color-hpp)" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out" />
                          <Line yAxisId="right" type="monotone" dataKey="profit" name="Profit" stroke="var(--chart-omzet)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" dot={{ r: 3, fill: 'var(--chart-omzet)', strokeWidth: 0 }} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out" />
                        </ComposedChart>
                      </ChartContainer>
                    </>
                  )}
                </ChartCard>

                <ChartCard title="Margin Profit" sub={profitDaily.length > 0 ? 'Margin per tanggal' : 'Belum ada data'}>
                  {profitDaily.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <ChartContainer config={profitMarginConfig} className="h-64 w-full [&_:focus]:outline-none">
                      <LineChart data={profitDaily} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="color-mix(in oklch, var(--foreground) 18%, transparent)" />
                        <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={24} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} width={40} domain={[0, 'auto']} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} />
                        <ChartTooltip cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} content={<ChartTooltipContent labelFormatter={tipLabel} formatter={(v) => `Margin: ${v}%`} />} />
                        <Line type="monotone" dataKey="margin" name="Margin" stroke="var(--color-margin)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" dot={{ r: 3, fill: 'var(--color-margin)', strokeWidth: 0 }} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out" />
                      </LineChart>
                    </ChartContainer>
                  )}
                </ChartCard>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <ChartCard title="Produk Paling Menguntungkan" sub="Urut profit terbesar">
                  <div className="max-h-80 overflow-auto">
                    {prodProfit.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr><Th>#</Th><Th>Produk</Th><Th right>Qty Terjual</Th><Th right>Pendapatan</Th><Th right>HPP</Th><Th right>Profit</Th><Th right>Margin</Th></tr>
                        </thead>
                        <tbody>
                          {prodProfit.map((p, i) => (
                            <tr key={p.product_id}>
                              <Td mono>{String(i + 1).padStart(2, '0')}</Td>
                              <Td><span className="font-medium text-fg">{p.name}</span></Td>
                              <Td right>{p.qty}</Td>
                              <Td right>{fmtRp(p.revenue)}</Td>
                              <Td right>{fmtRp(p.revenue - p.profit)}</Td>
                              <Td right><span className="font-medium text-fg">{fmtRp(p.profit)}</span></Td>
                              <Td right>{p.revenue > 0 ? `${Math.round((p.profit / p.revenue) * 100)}%` : '—'}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </ChartCard>

                <ChartCard title="Profit Insight" sub="Dari data periode ini">
                  {profitInsights.length === 0 && data.summary.trx_count === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-surface p-4">
                        <p className="text-[13px] text-muted-foreground">Profit per Transaksi</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                          {data.summary.trx_count > 0 ? fmtRp(Math.round(data.summary.gross_profit / data.summary.trx_count)) : 'Rp 0'}
                        </p>
                        {(() => {
                          const c = prev && prev.summary.trx_count > 0 && data.summary.trx_count > 0
                            ? delta(Math.round(data.summary.gross_profit / data.summary.trx_count), Math.round(prev.summary.gross_profit / prev.summary.trx_count))
                            : null
                          return c ? <p className={`mt-1 text-xs tabular-nums ${c.startsWith('↑') ? 'text-sprout' : c.startsWith('↓') ? 'text-ember' : 'text-muted-foreground'}`}>{c}</p> : null
                        })()}
                      </div>
                      {profitInsights.map((s) => (
                        <div key={s} className="flex items-start gap-2.5">
                          <span className="size-2 mt-1.5 shrink-0 rounded-full" style={{ background: 'var(--chart-2)' }} aria-hidden="true" />
                          <p className="text-sm leading-relaxed">{s}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ChartCard>
              </div>
            </div>
          )}

          {tab === 'stock' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Nilai Stok" value={fmtRp(data.stock.reduce((n, s) => n + s.stock_value, 0))} sub="total modal di gudang" icon={Wallet} tint={iconTint.blue} />
                <Kpi
                  label="Total Produk"
                  value={catRep.data ? String([...catMap.values()].filter((c) => c.active).length) : '…'}
                  sub={catRep.data ? `dari ${catMap.size} produk` : 'memuat katalog…'}
                  icon={Package} tint={iconTint.teal}
                />
                <Kpi label="Stok Menipis" value={String(stockStatus.menipis)} sub="Perlu perhatian" icon={TriangleAlert} tint={iconTint.amber} />
                <Kpi label="Stok Habis" value={String(stockStatus.habis)} sub="Perlu segera restock" icon={OctagonX} tint={iconTint.rose} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <ChartCard title="Nilai Stok per Kategori" sub={catValue.length > 0 ? 'Kategori penyimpan nilai terbesar' : 'Belum ada data'}>
                  {catValue.length === 0 ? (
                    <p className="py-14 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <ChartContainer config={stockConfig} className="h-64 w-full [&_:focus]:outline-none">
                      <BarChart data={catValue.map((c) => ({ name: c.name.length > 16 ? `${c.name.slice(0, 16)}…` : c.name, full: c.name, nilai: c.nilai }))} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 8 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="4 4" stroke="color-mix(in oklch, var(--foreground) 18%, transparent)" />
                        <XAxis type="number" hide domain={[0, 'auto']} />
                        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={128} tick={{ fontSize: 11 }} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={tipLabel} formatter={(v) => fmtRp(Number(v))} />} />
                        <Bar dataKey="nilai" fill="var(--color-nilai)" radius={[0, 6, 6, 0]} barSize={22} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out">
                          <LabelList dataKey="nilai" position="right" formatter={(v) => fmtShort(Number(v))} fontSize={11} className="fill-muted-foreground" />
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </ChartCard>

                <ChartCard title="Distribusi Status Stok" sub={stockRows.length > 0 ? 'Kondisi inventory' : 'Belum ada data'}>
                  {stockRows.length === 0 ? (
                    <p className="py-14 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <div className="space-y-4">
                      <ChartContainer config={{}} className="relative mx-auto h-44 w-full">
                        <PieChart>
                          <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v} produk`} hideLabel />} />
                          <Pie
                            data={[
                              { name: 'Aman', total: stockStatus.aman, fill: 'var(--chart-2)' },
                              { name: 'Menipis', total: stockStatus.menipis, fill: 'var(--t-sunbeam)' },
                              { name: 'Habis', total: stockStatus.habis, fill: 'var(--chart-5)' },
                            ].filter((d) => d.total > 0)}
                            dataKey="total" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={3} strokeWidth={0}
                            isAnimationActive={animate} animationDuration={650} animationEasing="ease-out"
                          >
                            <Cell fill="var(--chart-2)" />
                            <Cell fill="var(--t-sunbeam)" />
                            <Cell fill="var(--chart-5)" />
                          </Pie>
                        </PieChart>
                        <div className="pointer-events-none absolute inset-0 grid place-items-center">
                          <div className="text-center">
                            <p className="text-sm font-semibold tabular-nums tracking-tight">{stockRows.length}</p>
                            <p className="text-[11px] text-muted-foreground">Total Produk</p>
                          </div>
                        </div>
                      </ChartContainer>
                      <div className="space-y-2">
                        {(() => {
                          const n = stockRows.length || 1
                          return [
                            { name: 'Aman', total: stockStatus.aman, fill: 'var(--chart-2)' },
                            { name: 'Menipis', total: stockStatus.menipis, fill: 'var(--t-sunbeam)' },
                            { name: 'Habis', total: stockStatus.habis, fill: 'var(--chart-5)' },
                          ].map((d) => (
                            <div key={d.name} className="flex items-center justify-between gap-3 text-sm">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.fill }} />
                                <span className="truncate">{d.name}</span>
                              </span>
                              <span className="shrink-0 tabular-nums">
                                <span className="font-medium">{d.total > 0 ? Math.round((d.total / n) * 100) : 0}%</span>
                                <span className="text-muted-foreground"> ({d.total})</span>
                              </span>
                            </div>
                          ))
                        })()}
                      </div>
                    </div>
                  )}
                </ChartCard>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <ChartCard
                  title="Produk Stok Menipis"
                  sub="Habis dulu, lalu stok terkecil"
                  action={<Link to="/stok" className="shrink-0 text-[13px] font-medium text-jet hover:underline">Lihat semua →</Link>}
                >
                  <div className="overflow-x-auto">
                    {lowStock.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Semua stok aman.</p>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr><Th>#</Th><Th>Produk</Th><Th>SKU</Th><Th right>Stok</Th><Th>Kategori</Th><Th>Status</Th></tr>
                        </thead>
                        <tbody>
                          {lowStock.map((s, i) => (
                            <tr key={`${s.sku}-${s.name}`}>
                              <Td mono>{String(i + 1).padStart(2, '0')}</Td>
                              <Td><span className="font-medium text-fg">{s.name}</span></Td>
                              <Td mono>{s.sku}</Td>
                              <Td right><span className="font-medium tabular-nums text-ember">{s.stock}</span></Td>
                              <Td>{s.category}</Td>
                              <Td><Pill tone="warn">{s.stock === 0 ? 'Habis' : 'Menipis'}</Pill></Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </ChartCard>

                <ChartCard
                  title="Pergerakan Stok Terbaru"
                  sub="5 terbaru · semua periode"
                  action={<Link to="/stok?tab=riwayat" className="shrink-0 text-[13px] font-medium text-jet hover:underline">Lihat semua →</Link>}
                >
                  {(movRep.data ?? []).length === 0 ? (
                    <p className="py-10 text-center text-sm text-fog">{!movRep.loading && movRep.data ? 'Belum ada pergerakan stok.' : 'Memuat…'}</p>
                  ) : (
                    <div className="space-y-3">
                      {(movRep.data ?? []).slice(0, 5).map((m) => (
                        <div key={m.id} className="flex items-baseline gap-3">
                          <span className={`w-12 shrink-0 text-center font-mono text-sm font-medium tabular-nums ${m.qty > 0 ? 'text-sprout' : 'text-ember'}`}>
                            {m.qty > 0 ? `+${m.qty}` : m.qty}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{m.product_name ?? '—'}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {fmtDate(m.created_at)} {fmtTime(m.created_at)} · {MOV_LABEL[m.type]} · {m.actor}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ChartCard>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function LaporanSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Memuat laporan">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="relative min-h-32 p-5">
              <Skeleton className="absolute right-5 top-5 size-9 rounded-lg" />
              <div className="flex h-full flex-col justify-center space-y-2 pr-9">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-3 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-end gap-3" aria-hidden="true">
              {[38, 62, 48, 78, 55, 70, 44, 66].map((h, i) => (
                <Skeleton key={i} className="flex-1 rounded-b-none rounded-t-md" style={{ height: `${h}%` }} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mx-auto size-36 rounded-full" />
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Skeleton className="size-2.5 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </span>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-8" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-44" />
          </CardHeader>
          <CardContent>
            <table className="w-full border-collapse">
              <thead>
                <tr><Th>Tanggal</Th><Th>ID</Th><Th>Kasir</Th><Th>Metode</Th><Th right>Total</Th></tr>
              </thead>
              <SkeletonRows cols={5} rows={5} />
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}