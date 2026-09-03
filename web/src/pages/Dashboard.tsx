import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Banknote, Package, ReceiptText, TriangleAlert, Store } from 'lucide-react'
import { apiGetDashboard, type DashboardAdmin, type DashboardCashier } from '../lib/api'
import { fmtDate, fmtRp, fmtShort, fmtTime, useDB } from '../lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Area, AreaChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from '@/components/ui/empty'

const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const salesConfig = {
  omzet: { label: 'Omzet', color: 'var(--chart-omzet)' },
} as const

const payConfig = {
  Cash: { label: 'Cash', color: 'var(--chart-1)' },
  'Bank Transfer': { label: 'Bank Transfer', color: 'var(--chart-2)' },
  QRIS: { label: 'QRIS', color: 'var(--chart-3)' },
  'E-Wallet': { label: 'E-Wallet', color: 'var(--chart-4)' },
  Card: { label: 'Card', color: 'var(--chart-5)' },
} as const

export default function Dashboard() {
  const db = useDB()
  const s = db.session!
  const [data, setData] = useState<DashboardAdmin | DashboardCashier | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    apiGetDashboard().then(setData).catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat dashboard.'))
  }, [])

  if (err) return <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>
  if (!data) return <p className="py-14 text-center text-sm text-fog">Memuat…</p>

  const today = data.today
  const isAdmin = s.role === 'admin'
  const admin = data as DashboardAdmin
  const sales7 = isAdmin ? admin.sales7.map((d, i) => ({ day: DAYS[i], omzet: d.omzet })) : []
  const payData = isAdmin
    ? (Object.entries(payConfig) as [keyof typeof payConfig, (typeof payConfig)[keyof typeof payConfig]][])
        .map(([name, cfg]) => ({ name, total: admin.methods.find((m) => m.method === name)?.total ?? 0, fill: cfg.color }))
        .filter((d) => d.total > 0)
    : []
  const topProducts = isAdmin ? admin.top_products : []
  const topMax = Math.max(...topProducts.map((p) => p.qty), 1)
  const recent = data.recent

  const kpis = [
    { label: 'Omzet hari ini', value: fmtRp(today.omzet), sub: 'dari semua metode bayar', icon: Banknote, color: 'text-[var(--chart-1)]' },
    { label: 'Transaksi hari ini', value: String(today.trx_count), sub: 'selesai · tercatat otomatis', icon: ReceiptText, color: 'text-[var(--chart-2)]' },
    { label: 'Produk terjual', value: String(today.items_sold), sub: 'satuan terjual hari ini', icon: Package, color: 'text-[var(--chart-3)]' },
    ...(isAdmin ? [{ label: 'Stok menipis', value: String(admin.today.low_stock ?? 0), sub: 'perlu di-restock', icon: TriangleAlert, color: 'text-[var(--chart-5)]' }] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ringkasan toko</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Halo {s.name}, ini ringkasan performa {s.store} hari ini.
          </p>
        </div>
        <p className="font-mono text-xs text-muted-foreground">{fmtDate(new Date().toISOString())}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              <k.icon className={`size-4 ${k.color}`} />
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-medium tabular-nums">{k.value}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Penjualan 7 hari terakhir</CardTitle>
              <CardDescription>Omzet per hari</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={salesConfig} className="h-56 w-full">
                <AreaChart data={sales7} margin={{ top: 4, right: 8, bottom: 8, left: 8 }}>
                  <defs>
                    <linearGradient id="fillOmzet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-omzet)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-omzet)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-border" />
                  <XAxis dataKey="day" height={30} interval={0} padding={{ left: 12, right: 12 }} tickLine={false} axisLine={false} tickMargin={8} className="font-mono text-xs" />
                  <YAxis tickLine={false} axisLine={false} width={44} domain={[0, 'auto']} tickFormatter={(v: number) => fmtShort(v)} className="font-mono text-xs" />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />} />
                  <Area dataKey="omzet" type="monotone" dot={false} fill="url(#fillOmzet)" stroke="var(--color-omzet)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metode pembayaran</CardTitle>
              <CardDescription>Hari ini</CardDescription>
            </CardHeader>
            <CardContent>
              {payData.length === 0 ? (
                <p className="py-12 text-center font-mono text-xs text-muted-foreground">Belum ada transaksi hari ini.</p>
              ) : (
                <div className="space-y-4">
                  <ChartContainer config={payConfig} className="mx-auto h-40 w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />} />
                      <Pie data={payData} dataKey="total" nameKey="name" innerRadius={52} outerRadius={72} paddingAngle={3} strokeWidth={0} />
                    </PieChart>
                  </ChartContainer>
                  <div className="space-y-2">
                    {payData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: d.fill }} />
                          {d.name}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmtRp(d.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Produk terlaris</CardTitle>
              <CardDescription>Hari ini</CardDescription>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="py-12 text-center font-mono text-xs text-muted-foreground">Belum ada penjualan hari ini.</p>
              ) : (
                <div className="space-y-4">
                  {topProducts.map((p) => (
                    <div key={p.product_id} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium">{p.name}</span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">{p.qty} pcs</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${Math.round((p.qty / topMax) * 100)}%`, background: 'var(--chart-2)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Transaksi terbaru</CardTitle>
              <CardDescription>5 terakhir</CardDescription>
            </div>
            <Button variant="outline" size="sm" render={<Link to="/app/transaksi" />}>
                Lihat semua
              </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="py-12 text-center font-mono text-xs text-muted-foreground">Belum ada transaksi.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Kasir</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.id}</TableCell>
                      <TableCell className="font-mono text-xs">{fmtTime(t.time)}</TableCell>
                      <TableCell>{t.cashier_name}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">{fmtRp(t.total)}</TableCell>
                      <TableCell className="text-right">
                        <TrxBadge status={t.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {s.role === 'cashier' && (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-muted">
                <Store className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Ringkasan shift Anda</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {today.trx_count} transaksi · {fmtRp(today.omzet)}. Hanya transaksi yang Anda buat.
                </p>
              </div>
            </div>
            <Button render={<Link to="/app/pos" />}>Buka POS</Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && admin.today.trx_count === 0 && (
        <Empty>
          <EmptyContent>
            <EmptyTitle>Belum ada transaksi hari ini</EmptyTitle>
            <EmptyDescription>
              Buka menu POS Kasir untuk memulai transaksi pertama, atau cek produk Anda sudah siap dijual.
            </EmptyDescription>
            <Button render={<Link to="/app/pos" />}>Buka POS Kasir</Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  )
}

function TrxBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    completed: { label: 'Selesai', className: 'bg-[var(--t-success-bg)] text-[var(--t-sprout)]' },
    pending: { label: 'Proses', className: 'bg-muted text-muted-foreground' },
    cancelled: { label: 'Dibatalkan', className: 'bg-muted text-muted-foreground' },
    refunded: { label: 'Refund', className: 'bg-[color-mix(in_oklch,var(--chart-5)_14%,transparent)] text-[var(--chart-5)]' },
  }
  const b = map[status] ?? { label: status, className: 'bg-muted text-muted-foreground' }
  return <Badge className={b.className}>{b.label}</Badge>
}