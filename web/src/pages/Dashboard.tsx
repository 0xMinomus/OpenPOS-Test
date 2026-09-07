import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Banknote, Package, ReceiptText, Store, TriangleAlert } from 'lucide-react'
import { apiGetDashboard, apiListTransactions, type DashboardAdmin, type DashboardCashier, type Trx } from '../lib/api'
import { fmtDate, fmtRp, fmtShort, fmtTime, useDB } from '../lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { TrxItems } from '../lib/ui'

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

const iconTint = {
  blue: { color: 'text-[var(--chart-1)]', bg: 'bg-[color-mix(in_oklch,var(--chart-1)_12%,transparent)]' },
  teal: { color: 'text-[var(--chart-2)]', bg: 'bg-[color-mix(in_oklch,var(--chart-2)_12%,transparent)]' },
  amber: { color: 'text-[var(--chart-3)]', bg: 'bg-[color-mix(in_oklch,var(--chart-3)_14%,transparent)]' },
  rose: { color: 'text-[var(--chart-5)]', bg: 'bg-[color-mix(in_oklch,var(--chart-5)_12%,transparent)]' },
} as const

export default function Dashboard() {
  const db = useDB()
  const s = db.session!
  const [data, setData] = useState<DashboardAdmin | DashboardCashier | null>(null)
  const [err, setErr] = useState('')
  const [recentTrx, setRecentTrx] = useState<Trx[] | null>(null)
  // Kunci sesi pemilik data: cegah render data kasir sebagai admin (atau sebaliknya)
  // saat ganti akun — crash terjadi di render, sebelum effect sempat fetch ulang.
  const sessionKey = `${s.id}:${s.role}`
  const [dataFor, setDataFor] = useState(sessionKey)

  useEffect(() => {
    let dead = false
    setData(null)
    setErr('')
    apiGetDashboard()
      .then((d) => { if (!dead) { setData(d); setDataFor(sessionKey) } })
      .catch((e) => { if (!dead) setErr(e instanceof Error ? e.message : 'Gagal memuat dashboard.') })
    return () => { dead = true }
  }, [sessionKey])

  // Transaksi terbaru dengan detail item (dashboard recent tidak membawa items).
  useEffect(() => {
    let dead = false
    apiListTransactions({ limit: 5 })
      .then((r) => { if (!dead) setRecentTrx(r.items) })
      .catch(() => { if (!dead) setRecentTrx([]) })
    return () => { dead = true }
  }, [sessionKey])

  const isAdmin = s.role === 'admin'
  if (err) return <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>
  if (!data || dataFor !== sessionKey) return <DashboardSkeleton admin={isAdmin} />

  const today = data.today
  const admin = data as DashboardAdmin
  const sales7 = isAdmin ? admin.sales7.map((d, i) => ({ day: DAYS[i], omzet: d.omzet })) : []
  const payData = isAdmin
    ? (Object.entries(payConfig) as [keyof typeof payConfig, (typeof payConfig)[keyof typeof payConfig]][])
        .map(([name, cfg]) => ({ name, total: admin.methods.find((m) => m.method === name)?.total ?? 0, fill: cfg.color }))
        .filter((d) => d.total > 0)
    : []
  const topProducts = isAdmin ? admin.top_products : []
  const topMax = Math.max(...topProducts.map((p) => p.qty), 1)

  const kpis = [
    { label: 'Omzet hari ini', value: fmtRp(today.omzet), icon: Banknote, tint: iconTint.blue },
    { label: 'Transaksi hari ini', value: String(today.trx_count), icon: ReceiptText, tint: iconTint.teal },
    { label: 'Produk terjual', value: String(today.items_sold), icon: Package, tint: iconTint.amber },
    ...(isAdmin ? [{ label: 'Stok menipis', value: String(admin.today.low_stock ?? 0), icon: TriangleAlert, tint: iconTint.rose }] : []),
  ]

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Halo, {s.name}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {today.trx_count > 0
                ? `${today.trx_count} transaksi hari ini dengan omzet ${fmtRp(today.omzet)}.`
                : 'Belum ada transaksi hari ini.'}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">{fmtDate(new Date().toISOString())}</p>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--chart-omzet)_12%,transparent)]">
                <Store className="size-5 text-[var(--chart-omzet)]" />
              </div>
              <div>
                <p className="text-sm font-medium">Kasir siap</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Mulai transaksi baru untuk pelanggan.</p>
              </div>
            </div>
            <Button size="lg" render={<Link to="/app/pos" />}>Buka POS</Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          {kpis.map((k) => (
            <Card key={k.label}>
              <CardContent className="relative min-h-32 p-5">
                <span className={`absolute right-5 top-5 grid size-9 place-items-center rounded-lg ${k.tint.bg}`}>
                  <k.icon className={`size-4.5 ${k.tint.color}`} />
                </span>
                <div className="flex h-full flex-col justify-center pr-9">
                  <span className="text-sm font-medium text-muted-foreground">{k.label}</span>
                  <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{k.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Transaksi Saya</CardTitle>
              <CardDescription>Transaksi terbaru hari ini</CardDescription>
            </div>
            <Button variant="outline" size="sm" render={<Link to="/app/transaksi" />}>
              Lihat semua
            </Button>
          </CardHeader>
          <CardContent>
            {recentTrx === null ? (
              <RecentSkeleton rows={3} />
            ) : recentTrx.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">Belum ada transaksi. Mulai dari POS Kasir.</p>
                <Button className="mt-4" render={<Link to="/app/pos" />}>Buka POS</Button>
              </div>
            ) : (
              <RecentList items={recentTrx} />
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ringkasan toko</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {today.trx_count > 0
              ? `${today.trx_count} transaksi hari ini dengan omzet ${fmtRp(today.omzet)}.`
              : 'Belum ada transaksi hari ini. Buka POS Kasir untuk memulai.'}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{fmtDate(new Date().toISOString())}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="relative min-h-36 p-5">
              <span className={`absolute right-5 top-5 grid size-9 place-items-center rounded-lg ${k.tint.bg}`}>
                <k.icon className={`size-4.5 ${k.tint.color}`} />
              </span>
              <div className="flex h-full flex-col justify-center pr-9">
                <span className="text-sm font-medium text-muted-foreground">{k.label}</span>
                <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{k.value}</p>
              </div>
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
                <BarChart data={sales7} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="30%">
                  <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="color-mix(in oklch, var(--foreground) 18%, transparent)" />
                  <XAxis dataKey="day" interval={0} tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} width={44} domain={[0, 'auto']} tickFormatter={(v: number) => fmtShort(v)} tick={{ fontSize: 11 }} className="font-mono text-xs" />
                  <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />} />
                  <Bar dataKey="omzet" fill="var(--color-omzet)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                </BarChart>
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
                <p className="py-12 text-center text-sm text-muted-foreground">Belum ada transaksi hari ini.</p>
              ) : (
                <div className="space-y-2.5">
                  {payData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between rounded-lg border border-border/60 px-3.5 py-3">
                      <span className="flex items-center gap-2.5 text-sm">
                        <span className="size-2.5 rounded-full" style={{ background: d.fill }} />
                        {d.name}
                      </span>
                      <span className="text-sm font-medium tabular-nums">{fmtRp(d.total)}</span>
                    </div>
                  ))}
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
                <p className="py-12 text-center text-sm text-muted-foreground">Belum ada penjualan hari ini.</p>
              ) : (
                <div className="space-y-4">
                  {topProducts.map((p) => (
                    <div key={p.product_id} className="space-y-2">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium">{p.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{p.qty} pcs</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
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
            {recentTrx === null ? (
              <RecentSkeleton rows={3} />
            ) : recentTrx.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Belum ada transaksi.</p>
            ) : (
              <RecentList items={recentTrx} />
            )}
          </CardContent>
        </Card>
      </div>

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

function DashboardSkeleton({ admin }: { admin: boolean }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat dashboard">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-4 w-24" />
      </div>

      {!admin && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-12 w-32 rounded-full" />
          </CardContent>
        </Card>
      )}

      <div className={`grid gap-4 ${admin ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {(admin ? [0, 1, 2, 3] : [0, 1, 2]).map((i) => (
          <Card key={i}>
            <CardContent className={`relative p-5 ${admin ? 'min-h-36' : 'min-h-32'}`}>
              <Skeleton className="absolute right-5 top-5 size-9 rounded-lg" />
              <div className="flex h-full flex-col justify-center space-y-2 pr-9">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {admin && (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <div className="flex h-56 items-end gap-3">
                {[42, 68, 52, 84, 60, 76, 48].map((h, i) => (
                  <Skeleton key={i} className="flex-1 rounded-b-none rounded-t-md" style={{ height: `${h}%` }} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border/60 px-3.5 py-3">
                    <span className="flex items-center gap-2.5">
                      <Skeleton className="size-2.5 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </span>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {admin ? (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-14" />
                    </div>
                    <Skeleton className="h-2.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <RecentCardSkeleton />
        </div>
      ) : (
        <RecentCardSkeleton />
      )}
    </div>
  )
}

function RecentCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </CardHeader>
      <CardContent>
        <RecentSkeleton rows={5} />
      </CardContent>
    </Card>
  )
}

function RecentSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3.5 py-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function RecentList({ items }: { items: Trx[] }) {
  return (
    <div className="space-y-2">
      {items.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3.5 py-3">
          <div className="min-w-0">
            <TrxItems items={t.items} />
            <p className="mt-1 text-xs text-muted-foreground">{fmtTime(t.created_at)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="text-sm font-semibold tabular-nums">{fmtRp(t.total)}</span>
            <TrxBadge status={t.status} />
          </div>
        </div>
      ))}
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