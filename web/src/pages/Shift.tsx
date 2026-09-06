import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Clock, Play, Square } from 'lucide-react'
import {
  apiCloseShift, apiGetCashierShift, apiListShifts, apiStartShift,
  type CashierShift, type ShiftLog,
} from '../lib/api'
import { fmtDate, fmtRp, fmtTime, useDB } from '../lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Button, PageHead, Pill, Td, Th } from '../lib/ui'

const salesConfig = {
  omzet: { label: 'Omzet', color: 'var(--chart-omzet)' },
} as const

function fmtDur(startedAt: string, closedAt: string | null): string {
  const end = closedAt ? new Date(closedAt).getTime() : Date.now()
  const mins = Math.max(0, Math.round((end - new Date(startedAt).getTime()) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} mnt`
  return `${h} jam ${m} mnt`
}

export default function Shift() {
  const db = useDB()
  const s = db.session!
  const nav = useNavigate()
  const [shift, setShift] = useState<CashierShift | null>(null)
  const [logs, setLogs] = useState<ShiftLog[] | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [openingCash, setOpeningCash] = useState('')

  function loadShift() {
    apiGetCashierShift().then(setShift).catch(() => setShift(null))
  }
  function loadLogs() {
    if (s.role !== 'admin') return
    apiListShifts().then(setLogs).catch(() => {})
  }
  useEffect(() => { loadShift(); loadLogs() }, [s.id, s.role])

  async function startShift() {
    setErr(''); setBusy(true)
    try {
      const st = await apiStartShift(openingCash ? Number(openingCash) : undefined)
      setShift({ shift: st, hourly: [], top_products: [] })
      setOpeningCash('')
      loadLogs()
      nav('/app', { replace: true })
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Gagal memulai shift.')
    } finally {
      setBusy(false)
    }
  }

  async function closeShift() {
    if (!confirm('Tutup shift sekarang?')) return
    setErr(''); setBusy(true)
    try {
      await apiCloseShift()
      setShift(null)
      loadLogs()
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Gagal menutup shift.')
    } finally {
      setBusy(false)
    }
  }

  const active = shift?.shift.started_at ? shift.shift : null
  const hourlyData = (shift?.hourly ?? []).map((h) => ({ hour: String(h.hour).padStart(2, '0'), omzet: h.omzet }))
  const topProducts = shift?.top_products ?? []
  const topMaxP = Math.max(...topProducts.map((p) => p.qty), 1)

  return (
    <>
      <PageHead
        title="Shift"
        sub={s.role === 'admin' ? 'Ringkasan kinerja shift setiap kasir.' : 'Mulai dan tutup shift kerja Anda.'}
      />

      {err && <p className="mb-4 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>}

      {s.role === 'cashier' && (
        <div className="space-y-5">
          {active ? (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 p-5">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--chart-omzet)_12%,transparent)]">
                    <Clock className="size-5 text-[var(--chart-omzet)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Shift sedang berjalan</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Mulai {active.started_at ? fmtTime(active.started_at) : '—'} · Kas awal {active.opening_cash != null ? fmtRp(active.opening_cash) : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Penjualan Shift</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">{fmtRp(active.sales)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Transaksi</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">{active.trx_count}</p>
                  </div>
                </div>
                <Button variant="ghost" onClick={closeShift} disabled={busy}>
                  <Square className="size-4" />
                  {busy ? 'Menutup…' : 'Tutup Shift'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
                      <Clock className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Belum ada shift berjalan</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Mulai shift untuk mencatat penjualan Anda.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      value={openingCash}
                      onChange={(e) => setOpeningCash(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      type="text" inputMode="numeric"
                      placeholder="Kas awal (opsional)"
                      aria-label="Kas awal"
                      className="w-36 rounded-md border border-border bg-paper px-3 py-2 text-sm focus:border-jet focus:outline-none"
                    />
                    <Button onClick={startShift} disabled={busy}>
                      <Play className="size-4" />
                      {busy ? 'Memulai…' : 'Mulai Shift'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Penjualan Shift</CardTitle>
                <CardDescription>
                  {hourlyData.length > 0 ? `Total ${fmtRp(active?.sales ?? 0)} · omzet per jam` : 'Omzet per jam akan muncul setelah shift berjalan'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hourlyData.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">Belum ada data penjualan per jam.</p>
                ) : (
                  <ChartContainer config={salesConfig} className="h-56 w-full">
                    <AreaChart data={hourlyData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                      <defs>
                        <linearGradient id="fillShiftHour" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-omzet)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="var(--color-omzet)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-border" />
                      <XAxis dataKey="hour" interval={0} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
                      <YAxis hide domain={[0, 'auto']} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />} />
                      <Area dataKey="omzet" type="monotone" dot={false} fill="url(#fillShiftHour)" stroke="var(--color-omzet)" strokeWidth={2} />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Produk Terlaris</CardTitle>
                <CardDescription>Selama shift</CardDescription>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <p className="py-14 text-center text-sm text-muted-foreground">Belum ada data.</p>
                ) : (
                  <div className="space-y-4">
                    {topProducts.slice(0, 5).map((p) => (
                      <div key={p.product_id} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-medium">{p.name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{p.qty} pcs</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${Math.round((p.qty / topMaxP) * 100)}%`, background: 'var(--chart-omzet)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {s.role === 'admin' && (
        <div className="overflow-x-auto rounded-2xl bg-cream p-2">
          {!logs ? (
            <p className="py-14 text-center text-sm text-fog">Memuat…</p>
          ) : logs.length === 0 ? (
            <p className="py-14 text-center text-sm text-fog">Belum ada riwayat shift.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Kasir</Th><Th>Mulai</Th><Th>Tutup</Th><Th>Durasi</Th><Th>Kas Awal</Th><Th right>Penjualan</Th><Th right>Transaksi</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <Td><span className="font-medium text-fg">{l.cashier_name}</span></Td>
                    <Td mono>{fmtDate(l.started_at)} {fmtTime(l.started_at)}</Td>
                    <Td mono>{l.closed_at ? `${fmtDate(l.closed_at)} ${fmtTime(l.closed_at)}` : '—'}</Td>
                    <Td mono>{fmtDur(l.started_at, l.closed_at)}</Td>
                    <Td mono>{l.opening_cash != null ? fmtRp(l.opening_cash) : '—'}</Td>
                    <Td right>{fmtRp(l.sales)}</Td>
                    <Td right>{l.trx_count}</Td>
                    <Td>
                      {l.closed_at ? <Pill tone="muted">Selesai</Pill> : <Pill tone="ok">Berjalan</Pill>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  )
}