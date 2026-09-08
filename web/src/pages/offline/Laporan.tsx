import { useEffect, useMemo, useState } from 'react'
import { Banknote, BarChart3, Package, ReceiptText, TriangleAlert, TrendingUp, Wallet } from 'lucide-react'
import { apiGetReport, type ReportBundle } from '../../lib/local-api'
import { useCache } from '../../lib/cache'
import { exportCSV, fmtRp, fmtShort } from '../../lib/store'
import { Button, PageHead, SkeletonRows, Td, Th } from '../../lib/ui'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from 'recharts'

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

const omzetConfig = { omzet: { label: 'Omzet', color: 'var(--chart-omzet)' } } as const
const profitConfig = { profit: { label: 'Profit', color: 'var(--chart-2)' } } as const
const stockConfig = { nilai: { label: 'Nilai stok', color: 'var(--chart-3)' } } as const

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

function ChartCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{sub}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
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

  const daily = useMemo(() => {
    if (!data) return []
    const map = new Map<string, number>()
    for (const t of data.transactions) {
      const d = t.date.slice(0, 10)
      map.set(d, (map.get(d) ?? 0) + t.total)
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, omzet]) => ({ label: `${date.slice(8, 10)}/${date.slice(5, 7)}`, omzet }))
  }, [data])

  const topProducts = useMemo(() => (data ? [...data.products].sort((a, b) => b.qty - a.qty).slice(0, 5) : []), [data])
  const cashierStats = useMemo(() => {
    if (!data) return []
    const map = new Map<string, { omzet: number; trx: number }>()
    for (const t of data.transactions) {
      const e = map.get(t.cashier) ?? { omzet: 0, trx: 0 }
      e.omzet += t.total
      e.trx += 1
      map.set(t.cashier, e)
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.omzet - a.omzet)
      .slice(0, 5)
  }, [data])
  const topProfitTrx = useMemo(() => (data ? [...data.transactions].sort((a, b) => b.profit - a.profit).slice(0, 5) : []), [data])
  const stockTop = useMemo(() => (data ? [...data.stock].sort((a, b) => b.stock_value - a.stock_value).slice(0, 8) : []), [data])

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

      <div className="mb-5 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`rounded-full border px-3.5 py-1.5 text-xs ${period === p.id ? 'border-jet bg-jet text-paper' : 'border-dove text-muted hover:border-jet'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(['sales', 'products', 'profit', 'stock'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-3.5 py-1.5 text-xs ${tab === t ? 'border-jet bg-jet text-paper' : 'border-dove text-muted hover:border-jet'}`}
          >
            {t === 'sales' ? 'Penjualan' : t === 'products' ? 'Produk' : t === 'profit' ? 'Profit' : 'Stok'}
          </button>
        ))}
      </div>

      {!data ? (
        <LaporanSkeleton />
      ) : (
        <>
          {tab === 'sales' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Total Omzet" value={fmtRp(data.summary.omzet)} sub={`${data.transactions.length} transaksi`} icon={Banknote} tint={iconTint.blue} />
                <Kpi label="Jumlah Transaksi" value={String(data.summary.trx_count)} sub="selesai dalam periode ini" icon={ReceiptText} tint={iconTint.teal} />
                <Kpi label="Item Terjual" value={String(data.summary.items_sold)} sub="satuan produk" icon={Package} tint={iconTint.amber} />
                <Kpi label="Profit Kotor" value={fmtRp(data.summary.gross_profit)} sub="pendapatan dikurangi HPP" icon={TrendingUp} tint={iconTint.rose} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <ChartCard title="Omzet per Hari" sub={daily.length > 0 ? `Total ${fmtRp(data.summary.omzet)} · per tanggal` : 'Tidak ada data pada periode ini'}>
                  {daily.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">Tidak ada transaksi pada periode ini.</p>
                  ) : (
                    <ChartContainer config={omzetConfig} className="h-64 w-full">
                      <BarChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="30%">
                        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="color-mix(in oklch, var(--foreground) 18%, transparent)" />
                        <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={24} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} width={44} domain={[0, 'auto']} tick={{ fontSize: 11 }} />
                        <ChartTooltip cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />} />
                        <Bar dataKey="omzet" fill="var(--color-omzet)" radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out">
                          {daily.length <= 14 && <LabelList dataKey="omzet" position="top" formatter={(v) => fmtShort(Number(v))} fontSize={11} className="fill-muted-foreground" />}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </ChartCard>

                <ChartCard title="Metode Pembayaran" sub={data.by_method.length > 0 ? 'Total per metode' : 'Belum ada data'}>
                  {data.by_method.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <div className="space-y-4">
                      <ChartContainer config={{}} className="mx-auto h-44 w-full">
                        <PieChart>
                          <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />} />
                          <Pie data={data.by_method.map((m) => ({ ...m, fill: payConfig[m.method] ?? 'var(--chart-4)' }))} dataKey="total" nameKey="method" innerRadius={52} outerRadius={74} paddingAngle={3} strokeWidth={0} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out">
                            {data.by_method.map((m, i) => (
                              <Cell key={i} fill={payConfig[m.method] ?? 'var(--chart-4)'} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="space-y-2">
                        {data.by_method.map((m) => (
                          <div key={m.method} className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex items-center gap-2">
                              <span className="size-2.5 rounded-full" style={{ background: payConfig[m.method] ?? 'var(--chart-4)' }} />
                              {m.method}
                            </span>
                            <span className="font-medium tabular-nums">{fmtRp(m.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </ChartCard>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                <ChartCard title="Performa Kasir" sub="Omzet per kasir periode ini">
                  {cashierStats.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <div className="space-y-4">
                      {cashierStats.map((c) => {
                        const max = cashierStats[0].omzet || 1
                        return (
                          <div key={c.name} className="space-y-1.5">
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="truncate font-medium">{c.name}</span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">{c.trx} trx · {fmtRp(c.omzet)}</span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full" style={{ width: `${Math.round((c.omzet / max) * 100)}%`, background: 'var(--chart-1)' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ChartCard>

                <ChartCard title="Transaksi Terbaru" sub="10 transaksi terakhir periode ini">
                  <div className="overflow-x-auto">
                    {data.transactions.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr><Th>Tanggal</Th><Th>ID</Th><Th>Kasir</Th><Th>Metode</Th><Th right>Total</Th></tr>
                        </thead>
                        <tbody>
                          {data.transactions.slice(0, 10).map((t) => (
                            <tr key={t.id}>
                              <Td mono>{t.date.slice(0, 10)}</Td>
                              <Td mono>{t.id}</Td>
                              <Td>{t.cashier}</Td>
                              <Td>{t.method}</Td>
                              <Td right>{fmtRp(t.total)}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </ChartCard>
              </div>
            </div>
          )}

          {tab === 'products' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Kpi label="Produk Terjual" value={String(data.products.reduce((n, p) => n + p.qty, 0))} sub="total satuan" icon={Package} tint={iconTint.blue} />
                <Kpi label="Pendapatan Produk" value={fmtRp(data.products.reduce((n, p) => n + p.revenue, 0))} sub="dari semua produk" icon={Banknote} tint={iconTint.teal} />
                <Kpi label="Profit Produk" value={fmtRp(data.products.reduce((n, p) => n + p.profit, 0))} sub="setelah HPP" icon={TrendingUp} tint={iconTint.amber} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
                <ChartCard title="Produk Terlaris" sub="Top 5 berdasarkan jumlah terjual">
                  {topProducts.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <div className="space-y-4">
                      {topProducts.map((p) => {
                        const max = topProducts[0].qty || 1
                        return (
                          <div key={p.product_id} className="space-y-1.5">
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="truncate font-medium">{p.name}</span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">{p.qty} pcs</span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full" style={{ width: `${Math.round((p.qty / max) * 100)}%`, background: 'var(--chart-2)' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ChartCard>

                <ChartCard title="Rincian Produk" sub="Qty, pendapatan, dan profit per produk">
                  <div className="overflow-x-auto">
                    {data.products.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr><Th>Produk</Th><Th>SKU</Th><Th right>Qty</Th><Th right>Pendapatan</Th><Th right>Profit</Th></tr>
                        </thead>
                        <tbody>
                          {data.products.map((p) => (
                            <tr key={p.product_id}>
                              <Td><span className="font-medium text-fg">{p.name}</span></Td>
                              <Td mono>{p.sku}</Td>
                              <Td right>{p.qty}</Td>
                              <Td right>{fmtRp(p.revenue)}</Td>
                              <Td right>{fmtRp(p.profit)}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </ChartCard>
              </div>
            </div>
          )}

          {tab === 'profit' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Kpi label="Profit Kotor" value={fmtRp(data.summary.gross_profit)} sub={`dari omzet ${fmtRp(data.summary.omzet)}`} icon={TrendingUp} tint={iconTint.blue} />
                <Kpi label="Margin Profit" value={data.summary.omzet > 0 ? `${Math.round((data.summary.gross_profit / data.summary.omzet) * 100)}%` : '0%'} sub="profit per rupiah omzet" icon={BarChart3} tint={iconTint.teal} />
                <Kpi label="Rata-rata per Transaksi" value={data.summary.trx_count > 0 ? fmtRp(Math.round(data.summary.omzet / data.summary.trx_count)) : 'Rp 0'} sub="omzet dibagi transaksi" icon={ReceiptText} tint={iconTint.amber} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <ChartCard title="Profit per Transaksi" sub="Top 5 transaksi paling menguntungkan">
                  {topProfitTrx.length === 0 ? (
                    <p className="py-14 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <ChartContainer config={profitConfig} className="h-56 w-full">
                      <BarChart data={topProfitTrx.map((t) => ({ label: t.id, profit: t.profit }))} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="30%">
                        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="color-mix(in oklch, var(--foreground) 18%, transparent)" />
                        <XAxis dataKey="label" interval={0} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10 }} />
                        <YAxis tickLine={false} axisLine={false} width={44} domain={[0, 'auto']} tick={{ fontSize: 11 }} />
                        <ChartTooltip cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />} />
                        <Bar dataKey="profit" fill="var(--color-profit)" radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out">
                          <LabelList dataKey="profit" position="top" formatter={(v) => fmtShort(Number(v))} fontSize={11} className="fill-muted-foreground" />
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </ChartCard>

                <ChartCard title="Rincian Profit" sub="Total, HPP, dan profit per transaksi">
                  <div className="max-h-72 overflow-y-auto">
                    {data.transactions.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr><Th>ID</Th><Th right>Total</Th><Th right>HPP</Th><Th right>Profit</Th></tr>
                        </thead>
                        <tbody>
                          {data.transactions.map((t) => (
                            <tr key={t.id}>
                              <Td mono>{t.id}</Td>
                              <Td right>{fmtRp(t.total)}</Td>
                              <Td right>{fmtRp(t.hpp)}</Td>
                              <Td right><span className="font-medium text-fg">{fmtRp(t.profit)}</span></Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </ChartCard>
              </div>
            </div>
          )}

          {tab === 'stock' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Kpi label="Nilai Stok" value={fmtRp(data.stock.reduce((n, s) => n + s.stock_value, 0))} sub="total modal di gudang" icon={Wallet} tint={iconTint.blue} />
                <Kpi label="Jenis Produk" value={String(data.stock.length)} sub="produk terdaftar" icon={Package} tint={iconTint.teal} />
                <Kpi label="Stok Menipis" value={String(data.stock.filter((s) => s.stock <= 5).length)} sub="perlu di-restock" icon={TriangleAlert} tint={iconTint.rose} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <ChartCard title="Nilai Stok per Produk" sub="Top 8 produk dengan nilai stok terbesar">
                  {stockTop.length === 0 ? (
                    <p className="py-14 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                  ) : (
                    <ChartContainer config={stockConfig} className="h-56 w-full">
                      <BarChart data={stockTop.map((s) => ({ label: s.name.length > 16 ? s.name.slice(0, 16) + '…' : s.name, nilai: s.stock_value }))} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="30%">
                        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="color-mix(in oklch, var(--foreground) 18%, transparent)" />
                        <XAxis dataKey="label" interval={0} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10 }} />
                        <YAxis tickLine={false} axisLine={false} width={44} domain={[0, 'auto']} tick={{ fontSize: 11 }} />
                        <ChartTooltip cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />} />
                        <Bar dataKey="nilai" fill="var(--color-nilai)" radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={animate} animationDuration={650} animationEasing="ease-out">
                          <LabelList dataKey="nilai" position="top" formatter={(v) => fmtShort(Number(v))} fontSize={11} className="fill-muted-foreground" />
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </ChartCard>

                <ChartCard title="Rincian Stok" sub="Stok, harga, dan nilai per produk">
                  <div className="max-h-72 overflow-y-auto">
                    {data.stock.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr><Th>Produk</Th><Th right>Stok</Th><Th right>Harga beli</Th><Th right>Nilai</Th></tr>
                        </thead>
                        <tbody>
                          {data.stock.map((s, i) => (
                            <tr key={i}>
                              <Td><span className="font-medium text-fg">{s.name}</span></Td>
                              <Td right><span className={s.stock <= 5 ? 'text-ember' : ''}>{s.stock}</span></Td>
                              <Td right>{fmtRp(s.buy_price)}</Td>
                              <Td right>{fmtRp(s.stock_value)}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </ChartCard>
              </div>
            </div>
          )}
        </>
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