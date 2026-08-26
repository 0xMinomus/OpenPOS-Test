import { useMemo, useState } from 'react'
import { exportCSV, fmtRp, fmtDate, useDB } from '../lib/store'
import { Button, PageHead, Pill, Td, Th } from '../lib/ui'

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hari ini' },
  { id: 'yesterday', label: 'Kemarin' },
  { id: 'week', label: 'Minggu ini' },
  { id: 'month', label: 'Bulan ini' },
  { id: 'all', label: 'Semua' },
]

function inPeriod(iso: string, p: Period): boolean {
  const d = new Date(iso)
  const now = new Date()
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const t = start(d)
  if (p === 'today') return t === start(now)
  if (p === 'yesterday') return t === start(now) - 86400000
  if (p === 'week') {
    const day = (now.getDay() + 6) % 7
    return t >= start(now) - day * 86400000 && t <= start(now) + 86400000
  }
  if (p === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  return true
}

export default function Laporan() {
  const db = useDB()
  const [period, setPeriod] = useState<Period>('today')
  const [tab, setTab] = useState<'sales' | 'products' | 'profit' | 'stock'>('sales')

  const completed = useMemo(
    () => db.trx.filter((t) => t.status === 'completed' && inPeriod(t.time, period)),
    [db.trx, period],
  )

  const sales = completed.reduce((n, t) => n + t.total, 0)
  const trxCount = completed.length

  const byMethod = new Map<string, number>()
  completed.forEach((t) => byMethod.set(t.method, (byMethod.get(t.method) ?? 0) + t.total))

  const byProduct = new Map<string, { qty: number; rev: number; profit: number }>()
  completed.forEach((t) => t.items.forEach((i) => {
    const cur = byProduct.get(i.productId) ?? { qty: 0, rev: 0, profit: 0 }
    byProduct.set(i.productId, { qty: cur.qty + i.qty, rev: cur.rev + i.qty * i.price, profit: cur.profit + i.qty * (i.price - i.buyPrice) })
  }))

  const byStatus = new Map<string, number>()
  db.trx.forEach((t) => byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1))

  function exportTab() {
    if (tab === 'sales') {
      exportCSV(`laporan-penjualan-${period}.csv`, [
        ['tanggal', 'id', 'kasir', 'metode', 'total'],
        ...completed.map((t) => [fmtDate(t.time), t.id, t.cashierName, t.method, String(t.total)]),
      ])
    } else if (tab === 'products') {
      exportCSV(`laporan-produk-${period}.csv`, [
        ['produk', 'sku', 'qty_terjual', 'pendapatan', 'profit'],
        ...[...byProduct.entries()].map(([pid, v]) => {
          const p = db.products.find((x) => x.id === pid)
          return [p?.name ?? '—', p?.sku ?? '', String(v.qty), String(v.rev), String(v.profit)]
        }),
      ])
    } else if (tab === 'stock') {
      exportCSV(`laporan-stok.csv`, [
        ['produk', 'sku', 'stok', 'harga_beli', 'harga_jual', 'nilai_stok'],
        ...db.products.map((p) => [p.name, p.sku, String(p.stock), String(p.buyPrice), String(p.sellPrice), String(p.stock * p.buyPrice)]),
      ])
    } else {
      exportCSV(`laporan-profit-${period}.csv`, [
        ['tanggal', 'id', 'kasir', 'total', 'hpp', 'profit'],
        ...completed.map((t) => {
          const hpp = t.items.reduce((n, i) => n + i.buyPrice * i.qty, 0)
          return [fmtDate(t.time), t.id, t.cashierName, String(t.total), String(hpp), String(t.total - hpp)]
        }),
      ])
    }
  }

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

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-cream p-5">
          <p className="text-xs text-steel">Total penjualan</p>
          <p className="mt-2 font-mono text-xl tabular-nums">{fmtRp(sales)}</p>
        </div>
        <div className="rounded-2xl bg-cream p-5">
          <p className="text-xs text-steel">Jumlah transaksi</p>
          <p className="mt-2 font-mono text-xl tabular-nums">{trxCount}</p>
        </div>
        <div className="rounded-2xl bg-cream p-5">
          <p className="text-xs text-steel">Item terjual</p>
          <p className="mt-2 font-mono text-xl tabular-nums">{completed.reduce((n, t) => n + t.items.reduce((m, i) => m + i.qty, 0), 0)}</p>
        </div>
        <div className="rounded-2xl bg-cream p-5">
          <p className="text-xs text-steel">Profit kotor</p>
          <p className="mt-2 font-mono text-xl tabular-nums">
            {fmtRp(completed.reduce((n, t) => n + t.items.reduce((m, i) => m + i.qty * (i.price - i.buyPrice), 0), 0))}
          </p>
        </div>
      </div>

      {tab === 'sales' && (
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <section className="overflow-x-auto rounded-2xl bg-cream p-5">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-fog">Transaksi ({period})</h2>
            {completed.length === 0 ? <p className="py-8 text-center text-sm text-fog">Tidak ada data pada periode ini.</p> : (
              <table className="w-full border-collapse">
                <thead>
                  <tr><Th>Tanggal</Th><Th>ID</Th><Th>Kasir</Th><Th>Metode</Th><Th right>Total</Th></tr>
                </thead>
                <tbody>
                  {completed.slice(0, 50).map((t) => (
                    <tr key={t.id}>
                      <Td mono>{fmtDate(t.time)}</Td>
                      <Td mono>{t.id}</Td>
                      <Td>{t.cashierName}</Td>
                      <Td>{t.method}</Td>
                      <Td right>{fmtRp(t.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="rounded-2xl bg-cream p-5">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-fog">Metode pembayaran</h2>
            {byMethod.size === 0 && <p className="py-8 text-center text-sm text-fog">Tidak ada data.</p>}
            {[...byMethod.entries()].map(([m, v]) => (
              <div key={m} className="flex justify-between border-b border-dove py-2 text-sm last:border-0">
                <span>{m}</span><span className="font-mono tabular-nums">{fmtRp(v)}</span>
              </div>
            ))}
            <h2 className="mb-3 mt-6 font-mono text-xs uppercase tracking-wider text-fog">Transaksi per status</h2>
            {[...byStatus.entries()].map(([st, v]) => (
              <div key={st} className="flex justify-between border-b border-dove py-2 text-sm last:border-0">
                <span><Pill tone={st === 'completed' ? 'ok' : st === 'refunded' ? 'warn' : 'muted'}>{st}</Pill></span>
                <span className="font-mono tabular-nums">{v}</span>
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === 'products' && (
        <section className="overflow-x-auto rounded-2xl bg-cream p-5">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-fog">Produk terjual ({period})</h2>
          {byProduct.size === 0 ? <p className="py-8 text-center text-sm text-fog">Tidak ada data.</p> : (
            <table className="w-full border-collapse">
              <thead>
                <tr><Th>Produk</Th><Th right>Qty</Th><Th right>Pendapatan</Th><Th right>Profit</Th></tr>
              </thead>
              <tbody>
                {[...byProduct.entries()].sort((a, b) => b[1].qty - a[1].qty).map(([pid, v]) => {
                  const p = db.products.find((x) => x.id === pid)
                  return (
                    <tr key={pid}>
                      <Td><span className="font-medium text-fg">{p?.name ?? '—'}</span></Td>
                      <Td right>{v.qty}</Td>
                      <Td right>{fmtRp(v.rev)}</Td>
                      <Td right>{fmtRp(v.profit)}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'profit' && (
        <section className="overflow-x-auto rounded-2xl bg-cream p-5">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-fog">Profit per transaksi ({period})</h2>
          {completed.length === 0 ? <p className="py-8 text-center text-sm text-fog">Tidak ada data.</p> : (
            <table className="w-full border-collapse">
              <thead>
                <tr><Th>Tanggal</Th><Th>ID</Th><Th right>Total</Th><Th right>HPP</Th><Th right>Profit</Th></tr>
              </thead>
              <tbody>
                {completed.map((t) => {
                  const hpp = t.items.reduce((n, i) => n + i.buyPrice * i.qty, 0)
                  return (
                    <tr key={t.id}>
                      <Td mono>{fmtDate(t.time)}</Td>
                      <Td mono>{t.id}</Td>
                      <Td right>{fmtRp(t.total)}</Td>
                      <Td right>{fmtRp(hpp)}</Td>
                      <Td right><span className="font-medium text-fg">{fmtRp(t.total - hpp)}</span></Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'stock' && (
        <section className="overflow-x-auto rounded-2xl bg-cream p-5">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-fog">Stok saat ini</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr><Th>Produk</Th><Th>SKU</Th><Th right>Stok</Th><Th right>Harga beli</Th><Th right>Harga jual</Th><Th right>Nilai stok</Th></tr>
            </thead>
            <tbody>
              {db.products.map((p) => (
                <tr key={p.id}>
                  <Td><span className="font-medium text-fg">{p.name}</span></Td>
                  <Td mono>{p.sku}</Td>
                  <Td right><span className={p.stock <= 5 ? 'text-ember' : ''}>{p.stock}</span></Td>
                  <Td right>{fmtRp(p.buyPrice)}</Td>
                  <Td right>{fmtRp(p.sellPrice)}</Td>
                  <Td right>{fmtRp(p.stock * p.buyPrice)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}