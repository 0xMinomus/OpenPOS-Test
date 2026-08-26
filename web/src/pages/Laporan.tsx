import { useEffect, useState } from 'react'
import { apiGetReport, type ReportBundle } from '../lib/api'
import { exportCSV, fmtRp } from '../lib/store'
import { Button, PageHead, Pill, Td, Th } from '../lib/ui'

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hari ini' },
  { id: 'yesterday', label: 'Kemarin' },
  { id: 'week', label: 'Minggu ini' },
  { id: 'month', label: 'Bulan ini' },
  { id: 'all', label: 'Semua' },
]

export default function Laporan() {
  const [period, setPeriod] = useState<Period>('today')
  const [tab, setTab] = useState<'sales' | 'products' | 'profit' | 'stock'>('sales')
  const [data, setData] = useState<ReportBundle | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    setData(null); setErr('')
    apiGetReport(period).then(setData).catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat laporan.'))
  }, [period])

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

      {err && <p className="mb-4 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>}
      {!data ? (
        <p className="py-14 text-center text-sm text-fog">Memuat…</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl bg-cream p-5">
              <p className="text-xs text-steel">Total penjualan</p>
              <p className="mt-2 font-mono text-xl tabular-nums">{fmtRp(data.summary.omzet)}</p>
            </div>
            <div className="rounded-2xl bg-cream p-5">
              <p className="text-xs text-steel">Jumlah transaksi</p>
              <p className="mt-2 font-mono text-xl tabular-nums">{data.summary.trx_count}</p>
            </div>
            <div className="rounded-2xl bg-cream p-5">
              <p className="text-xs text-steel">Item terjual</p>
              <p className="mt-2 font-mono text-xl tabular-nums">{data.summary.items_sold}</p>
            </div>
            <div className="rounded-2xl bg-cream p-5">
              <p className="text-xs text-steel">Profit kotor</p>
              <p className="mt-2 font-mono text-xl tabular-nums">{fmtRp(data.summary.gross_profit)}</p>
            </div>
          </div>

          {tab === 'sales' && (
            <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <section className="overflow-x-auto rounded-2xl bg-cream p-5">
                <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-fog">Transaksi ({period})</h2>
                {data.transactions.length === 0 ? <p className="py-8 text-center text-sm text-fog">Tidak ada data pada periode ini.</p> : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr><Th>Tanggal</Th><Th>ID</Th><Th>Kasir</Th><Th>Metode</Th><Th right>Total</Th></tr>
                    </thead>
                    <tbody>
                      {data.transactions.slice(0, 50).map((t) => (
                        <tr key={t.id}>
                          <Td mono>{t.date}</Td>
                          <Td mono>{t.id}</Td>
                          <Td>{t.cashier}</Td>
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
                {data.by_method.length === 0 && <p className="py-8 text-center text-sm text-fog">Tidak ada data.</p>}
                {data.by_method.map((m) => (
                  <div key={m.method} className="flex justify-between border-b border-dove py-2 text-sm last:border-0">
                    <span>{m.method}</span><span className="font-mono tabular-nums">{fmtRp(m.total)}</span>
                  </div>
                ))}
                <h2 className="mb-3 mt-6 font-mono text-xs uppercase tracking-wider text-fog">Transaksi per status</h2>
                {data.by_status.map((st) => (
                  <div key={st.status} className="flex justify-between border-b border-dove py-2 text-sm last:border-0">
                    <span><Pill tone={st.status === 'completed' ? 'ok' : st.status === 'refunded' ? 'warn' : 'muted'}>{st.status}</Pill></span>
                    <span className="font-mono tabular-nums">{st.count}</span>
                  </div>
                ))}
              </section>
            </div>
          )}

          {tab === 'products' && (
            <section className="overflow-x-auto rounded-2xl bg-cream p-5">
              <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-fog">Produk terjual ({period})</h2>
              {data.products.length === 0 ? <p className="py-8 text-center text-sm text-fog">Tidak ada data.</p> : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr><Th>Produk</Th><Th right>Qty</Th><Th right>Pendapatan</Th><Th right>Profit</Th></tr>
                  </thead>
                  <tbody>
                    {[...data.products].sort((a, b) => b.qty - a.qty).map((p) => (
                      <tr key={p.product_id}>
                        <Td><span className="font-medium text-fg">{p.name}</span></Td>
                        <Td right>{p.qty}</Td>
                        <Td right>{fmtRp(p.revenue)}</Td>
                        <Td right>{fmtRp(p.profit)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {tab === 'profit' && (
            <section className="overflow-x-auto rounded-2xl bg-cream p-5">
              <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-fog">Profit per transaksi ({period})</h2>
              {data.transactions.length === 0 ? <p className="py-8 text-center text-sm text-fog">Tidak ada data.</p> : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr><Th>Tanggal</Th><Th>ID</Th><Th right>Total</Th><Th right>HPP</Th><Th right>Profit</Th></tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((t) => (
                      <tr key={t.id}>
                        <Td mono>{t.date}</Td>
                        <Td mono>{t.id}</Td>
                        <Td right>{fmtRp(t.total)}</Td>
                        <Td right>{fmtRp(t.hpp)}</Td>
                        <Td right><span className="font-medium text-fg">{fmtRp(t.profit)}</span></Td>
                      </tr>
                    ))}
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
                  {data.stock.map((s, i) => (
                    <tr key={i}>
                      <Td><span className="font-medium text-fg">{s.name}</span></Td>
                      <Td mono>{s.sku}</Td>
                      <Td right><span className={s.stock <= 5 ? 'text-ember' : ''}>{s.stock}</span></Td>
                      <Td right>{fmtRp(s.buy_price)}</Td>
                      <Td right>{fmtRp(s.sell_price)}</Td>
                      <Td right>{fmtRp(s.stock_value)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </>
  )
}