// Karyawan — cashier performance analytics workspace (admin).
// Token font/warna milik sistem (tidak ada token baru di file ini).
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Banknote, ReceiptText, Trophy, UsersRound } from 'lucide-react'
import { apiGetReport, apiListUsers, type ReportBundle, type User } from '../lib/api'
import { useCache } from '../lib/cache'
import { exportCSV, fmtDate, fmtInv, fmtRp, fmtShort, useDB } from '../lib/store'
import { Button, Empty, Td, Th } from '../lib/ui'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts'

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hari ini' },
  { id: 'yesterday', label: 'Kemarin' },
  { id: 'week', label: 'Minggu ini' },
  { id: 'month', label: 'Bulan ini' },
  { id: 'all', label: 'Semua' },
]

const LINE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const barConfig = { value: { label: 'Nilai', color: 'var(--chart-1)' } } as const

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

export default function Karyawan() {
  const db = useDB()
  const s = db.session!
  const [period, setPeriod] = useState<Period>('today')
  const [metric, setMetric] = useState<'omzet' | 'trx' | 'avg'>('omzet')
  const rep = useCache<ReportBundle>(`report:${period}`, () => apiGetReport(period), 'Gagal memuat laporan.')
  const usersRep = useCache<User[]>(`karyawan-users:${s.id}`, () => apiListUsers(), 'Gagal memuat kasir.')
  const prevRep = useCache<ReportBundle | null>(
    `reportprev:karyawan:${period}`,
    () => (period === 'today' ? apiGetReport('yesterday') : Promise.resolve(null)),
  )
  const data = rep.data
  const err = rep.err || usersRep.err
  const switching = (rep.loading && data !== null) || (usersRep.loading && !usersRep.data)

  const stats = useMemo(() => {
    if (!data) return []
    const map = new Map<string, { omzet: number; trx: number }>()
    for (const t of data.transactions) {
      const e = map.get(t.cashier) ?? { omzet: 0, trx: 0 }
      e.omzet += t.total
      e.trx += 1
      map.set(t.cashier, e)
    }
    const rows = [...map.entries()].map(([name, v]) => ({
      name,
      omzet: v.omzet,
      trx: v.trx,
      avg: v.trx > 0 ? Math.round(v.omzet / v.trx) : 0,
    }))
    for (const u of usersRep.data ?? []) {
      if (u.role === 'cashier' && u.active && !map.has(u.name)) rows.push({ name: u.name, omzet: 0, trx: 0, avg: 0 })
    }
    return rows.sort((a, b) => b.omzet - a.omzet)
  }, [data, usersRep.data])

  const totalOmzet = stats.reduce((n, r) => n + r.omzet, 0)
  const totalTrx = stats.reduce((n, r) => n + r.trx, 0)
  const activeCount = stats.filter((r) => r.trx > 0).length
  const best = stats.find((r) => r.trx > 0) ?? null

  const trend = useMemo(() => {
    if (!data) return { dates: [] as string[], rows: [] as Record<string, string | number>[], top: [] as typeof stats }
    const top = stats.filter((r) => r.trx > 0).slice(0, 5)
    const names = new Set(top.map((r) => r.name))
    const perDate = new Map<string, Map<string, number>>()
    for (const t of data.transactions) {
      if (!names.has(t.cashier)) continue
      const d = t.date.slice(0, 10)
      const m = perDate.get(d) ?? new Map<string, number>()
      m.set(t.cashier, (m.get(t.cashier) ?? 0) + t.total)
      perDate.set(d, m)
    }
    const dates = [...perDate.keys()].sort()
    return {
      dates,
      rows: dates.map((d) => {
        const m = perDate.get(d)!
        const row: Record<string, string | number> = { label: `${d.slice(8, 10)}/${d.slice(5, 7)}` }
        for (const r of top) row[r.name] = m.get(r.name) ?? 0
        return row
      }),
      top,
    }
  }, [data, stats])

  const donut = useMemo(() => {
    const top = stats.filter((r) => r.trx > 0).slice(0, 5)
    const rest = stats.filter((r) => r.trx > 0).slice(5).reduce((n, r) => n + r.omzet, 0)
    const rows = top.map((r) => ({ name: r.name, total: r.omzet }))
    if (rest > 0) rows.push({ name: 'Lainnya', total: rest })
    return rows
  }, [stats])

  const recent = useMemo(
    () => (data ? [...data.transactions].sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id)).slice(0, 8) : []),
    [data],
  )

  const changes = useMemo(() => {
    if (period !== 'today' || !prevRep.data) {
      return stats.map((r) => ({ name: r.name, cur: r.omzet, prev: null as number | null }))
    }
    const pm = new Map<string, number>()
    for (const t of prevRep.data.transactions) pm.set(t.cashier, (pm.get(t.cashier) ?? 0) + t.total)
    const names = new Set([...stats.map((r) => r.name), ...pm.keys()])
    return [...names].map((name) => ({
      name,
      cur: stats.find((r) => r.name === name)?.omzet ?? 0,
      prev: pm.get(name) ?? 0,
    })).sort((a, b) => b.cur - a.cur)
  }, [stats, prevRep.data, period])

  function changeStatus(cur: number, prev: number | null): { label: string; cls: string } {
    if (prev === null) return { label: 'Stabil', cls: 'bg-surface text-muted' }
    if (cur === 0 && prev === 0) return { label: 'Belum ada transaksi', cls: 'bg-surface text-muted' }
    if (cur === prev) return { label: 'Stabil', cls: 'bg-surface text-muted' }
    return cur > prev
      ? { label: 'Naik', cls: 'bg-[var(--t-success-bg)] text-[var(--t-sprout)]' }
      : { label: 'Menurun', cls: 'bg-[color-mix(in_oklch,var(--chart-5)_14%,transparent)] text-[var(--chart-5)]' }
  }

  function exportList() {
    exportCSV(`karyawan-${period}.csv`, [
      ['kasir', 'omzet', 'transaksi', 'rata_rata', 'kontribusi_pct'],
      ...stats.map((r) => [r.name, String(r.omzet), String(r.trx), String(r.avg), totalOmzet > 0 ? String(Math.round((r.omzet / totalOmzet) * 100)) : '0']),
    ])
  }

  if (err && !data) return (
    <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>
  )

  const metricFmt = (v: number) => (metric === 'omzet' ? fmtRp(v) : metric === 'trx' ? `${v} trx` : fmtRp(v))
  const metricLabel = metric === 'omzet' ? 'Nilai Penjualan' : metric === 'trx' ? 'Jumlah Transaksi' : 'Rata-rata Transaksi'

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="ghost" onClick={exportList}>Export CSV</Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Periode performa">
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

      {!data ? (
        <div className="mt-5 space-y-5" aria-busy="true" aria-label="Memuat performa kasir">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="size-9 rounded-lg" />
                  </div>
                  <Skeleton className="h-7 w-28" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        </div>
      ) : stats.length === 0 ? (
        <Empty
          title="Belum ada data performa"
          sub="Data performa kasir akan muncul setelah transaksi dilakukan."
          action={<Link to="/app/pos" className="inline-flex items-center justify-center gap-2 rounded-full border border-jet bg-jet px-6 py-3 text-[15px] font-medium text-paper transition hover:opacity-85">Buka POS Kasir</Link>}
        />
      ) : (
        <div className={switching ? 'pointer-events-none opacity-60 transition-opacity' : undefined} aria-busy={switching || undefined}>
          {switching && (
            <p className="mb-3 flex items-center gap-2 text-[13px] text-muted" role="status">
              Memuat periode {PERIODS.find((p) => p.id === period)?.label}…
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Penjualan" value={fmtRp(totalOmzet)} icon={Banknote} tint="text-[var(--chart-1)] bg-[color-mix(in_oklch,var(--chart-1)_12%,transparent)]" />
            <StatCard label="Total Transaksi" value={String(totalTrx)} icon={ReceiptText} tint="text-[var(--chart-2)] bg-[color-mix(in_oklch,var(--chart-2)_12%,transparent)]" />
            <StatCard label="Kasir Aktif" value={String(activeCount)} sub={`dari ${stats.length} kasir`} icon={UsersRound} tint="text-[var(--chart-3)] bg-[color-mix(in_oklch,var(--chart-3)_14%,transparent)]" />
            <StatCard label="Kasir Terbaik" value={best ? best.name : '—'} sub={best ? fmtRp(best.omzet) : 'belum ada transaksi'} icon={Trophy} tint="text-[var(--chart-5)] bg-[color-mix(in_oklch,var(--chart-5)_12%,transparent)]" />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">Penjualan per Kasir</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{metricLabel} · {PERIODS.find((p) => p.id === period)?.label}</p>
                  </div>
                  <div className="inline-flex gap-1 rounded-xl bg-surface p-1" role="group" aria-label="Metrik bar">
                    {(['omzet', 'trx', 'avg'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMetric(m)}
                        aria-pressed={metric === m}
                        className={`rounded-lg px-2.5 py-1 text-xs transition ${metric === m ? 'bg-paper font-medium text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
                      >
                        {m === 'omzet' ? 'Nilai' : m === 'trx' ? 'Transaksi' : 'Rata-rata'}
                      </button>
                    ))}
                  </div>
                </div>
                <ChartContainer config={barConfig} className="mt-3 h-64 w-full [&_:focus]:outline-none">
                  <BarChart data={stats.filter((r) => r.trx > 0).map((r) => ({ name: r.name.length > 14 ? `${r.name.slice(0, 14)}…` : r.name, full: r.name, value: metric === 'omzet' ? r.omzet : metric === 'trx' ? r.trx : r.avg }))} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 8 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="4 4" stroke="color-mix(in oklch, var(--foreground) 18%, transparent)" />
                    <XAxis type="number" hide domain={[0, 'auto']} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={110} tick={{ fontSize: 11 }} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(_, payload) => (payload?.[0]?.payload as { full?: string } | undefined)?.full ?? ''} formatter={(v) => metricFmt(Number(v))} />} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={[0, 6, 6, 0]} barSize={22} isAnimationActive animationDuration={650} animationEasing="ease-out">
                      <LabelList dataKey="value" position="right" formatter={(v) => (metric === 'omzet' || metric === 'avg' ? fmtShort(Number(v)) : String(v))} fontSize={11} className="fill-muted-foreground" />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p className="text-base font-semibold">Proporsi Penjualan</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Kontribusi per kasir</p>
                {totalOmzet === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">Belum ada penjualan.</p>
                ) : (
                <>
                <ChartContainer config={{}} className="relative mx-auto mt-2 h-44 w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} hideLabel />} />
                    <Pie data={donut} dataKey="total" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={3} strokeWidth={0} isAnimationActive animationDuration={650} animationEasing="ease-out">
                      {donut.map((d, i) => (
                        <Cell key={d.name} fill={LINE_COLORS[i % LINE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <p className="text-sm font-semibold tabular-nums tracking-tight">{fmtShort(totalOmzet)}</p>
                      <p className="text-[11px] text-muted-foreground">Total Penjualan</p>
                    </div>
                  </div>
                </ChartContainer>
                <div className="mt-3 space-y-2">
                  {donut.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                        <span className="truncate">{d.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        <span className="font-medium">{fmtRp(d.total)}</span>
                        <span className="text-muted-foreground"> · {totalOmzet > 0 ? Math.round((d.total / totalOmzet) * 100) : 0}%</span>
                      </span>
                    </div>
                  ))}
                </div>
                </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardContent className="p-5">
                <p className="text-base font-semibold">Tren Penjualan per Kasir</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">5 teratas · per tanggal</p>
                {trend.rows.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                ) : (
                  <ChartContainer config={{}} className="mt-3 h-64 w-full [&_:focus]:outline-none">
                    <LineChart data={trend.rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="color-mix(in oklch, var(--foreground) 18%, transparent)" />
                      <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={24} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} width={44} domain={[0, 'auto']} tickFormatter={(v: number) => fmtShort(v)} tick={{ fontSize: 11 }} />
                      <ChartTooltip cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />} />
                      {trend.top.map((r, i) => (
                        <Line key={r.name} type="monotone" dataKey={r.name} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={trend.rows.length > 1 ? false : { r: 3 }} isAnimationActive animationDuration={650} animationEasing="ease-out" />
                      ))}
                    </LineChart>
                  </ChartContainer>
                )}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  {trend.top.map((r, i) => (
                    <span key={r.name} className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                      {r.name}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p className="text-base font-semibold">Ringkasan Performa</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Urut penjualan tertinggi</p>
                <div className="mt-4 hidden space-y-3 sm:block">
                  {stats.map((r) => (
                    <div key={r.name} className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-xs font-semibold text-steel" aria-hidden="true">
                        {initials(r.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium">{r.name}</p>
                          <p className="shrink-0 text-sm font-medium tabular-nums">{fmtRp(r.omzet)}</p>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${totalOmzet > 0 ? Math.round((r.omzet / totalOmzet) * 100) : 0}%`, background: 'var(--chart-1)' }} />
                        </div>
                        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                          {r.trx > 0 ? `${r.trx} trx · avg ${fmtRp(r.avg)} · ${totalOmzet > 0 ? Math.round((r.omzet / totalOmzet) * 100) : 0}%` : 'Belum ada transaksi'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2.5 sm:hidden">
                  {stats.map((r) => (
                    <div key={r.name} className="rounded-xl border border-dove bg-paper p-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-xs font-semibold text-steel" aria-hidden="true">
                          {initials(r.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{r.name}</p>
                          <p className="text-xs tabular-nums text-muted-foreground">{r.trx > 0 ? `${r.trx} trx · ${totalOmzet > 0 ? Math.round((r.omzet / totalOmzet) * 100) : 0}%` : 'Belum ada transaksi'}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">{fmtRp(r.omzet)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">Transaksi Terbaru</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">8 terakhir periode ini</p>
                  </div>
                  <Link to="/app/transaksi" className="shrink-0 text-[13px] font-medium text-jet hover:underline">Lihat semua →</Link>
                </div>
                {recent.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada data.</p>
                ) : (
                  <>
                    <div className="mt-3 hidden overflow-x-auto sm:block">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr><Th>Waktu</Th><Th>Invoice</Th><Th>Kasir</Th><Th right>Total</Th><Th>Metode</Th></tr>
                        </thead>
                        <tbody>
                          {recent.map((t) => (
                            <tr key={t.id}>
                              <Td mono>{fmtDate(t.date)}</Td>
                              <Td mono>{fmtInv(t.id)}</Td>
                              <Td>{t.cashier}</Td>
                              <Td right><span className="font-medium text-fg">{fmtRp(t.total)}</span></Td>
                              <Td>{t.method}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 space-y-2.5 sm:hidden">
                      {recent.map((t) => (
                        <div key={t.id} className="rounded-xl border border-dove bg-paper p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-mono text-[13px] font-medium">{fmtInv(t.id)}</p>
                            <p className="shrink-0 text-[15px] font-semibold tabular-nums">{fmtRp(t.total)}</p>
                          </div>
                          <p className="mt-1 truncate text-xs text-fog">{fmtDate(t.date)} · {t.cashier} · {t.method}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p className="text-base font-semibold">Perubahan Performa</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{period === 'today' ? 'Hari ini vs kemarin' : 'Hanya tersedia untuk Hari ini'}</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr><Th>Kasir</Th><Th right>Ini</Th><Th right>Lalu</Th><Th>Status</Th></tr>
                    </thead>
                    <tbody>
                      {changes.map((c) => {
                        const st = changeStatus(c.cur, c.prev)
                        return (
                          <tr key={c.name}>
                            <Td><span className="font-medium text-fg">{c.name}</span></Td>
                            <Td right>{fmtRp(c.cur)}</Td>
                            <Td right>{c.prev === null ? '—' : fmtRp(c.prev)}</Td>
                            <Td><span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span></Td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}

function StatCard({ label, value, sub, icon: Icon, tint }: {
  label: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  tint: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
          <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tint}`}>
            <Icon className="size-4.5" />
          </span>
        </div>
        <p className="mt-3 truncate text-[26px] font-semibold leading-none tabular-nums tracking-tight" title={value}>{value}</p>
        {sub && <p className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}
