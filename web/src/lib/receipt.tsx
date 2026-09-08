import type { StoreSettings, Trx } from './api'
import { fmtRp } from './store'
import { Button } from './ui'

export function Receipt({ trx, settings, onClose }: { trx: Trx; settings: StoreSettings | null; onClose: () => void }) {
  const st = settings ?? { storeName: '', address: '', phone: '', receiptHeader: '', receiptFooter: '', paper: '58mm' } as StoreSettings
  const t = new Date(trx.created_at)
  const date = t.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="flex flex-col items-center">
      <div id="receipt" className="w-full max-w-80 rounded-lg border border-dove bg-paper px-4 py-5 font-mono text-[12px] leading-relaxed" style={{ width: st.paper }}>
        <p className="text-center text-[15px] font-semibold uppercase tracking-[0.15em]">{st.storeName}</p>
        {st.address && <p className="mt-0.5 text-center text-[11px] text-muted">{st.address}</p>}
        {st.phone && <p className="text-center text-[11px] text-muted">{st.phone}</p>}
        <div className="my-2.5 border-t border-dashed border-dove" />
        <div className="flex justify-between text-[11px]">
          <span>{date}</span><span>{time}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span>ID {trx.id}</span><span>{trx.cashier_name}</span>
        </div>
        <div className="my-2.5 border-t border-dashed border-dove" />
        <div className="space-y-1.5">
          {trx.items.map((i) => (
            <div key={i.product_id}>
              <p className="leading-snug">{i.name}</p>
              <div className="flex justify-between text-[11px]">
                <span className="tabular-nums">{i.qty} × {fmtRp(i.price)}</span>
                <span className="tabular-nums">{fmtRp(i.price * i.qty)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="my-2.5 border-t border-dashed border-dove" />
        <div className="space-y-1">
          <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="tabular-nums">{fmtRp(trx.subtotal)}</span></div>
          {trx.discount > 0 && <div className="flex justify-between"><span className="text-muted">Diskon</span><span className="tabular-nums">-{fmtRp(trx.discount)}</span></div>}
          {trx.tax > 0 && <div className="flex justify-between"><span className="text-muted">Pajak</span><span className="tabular-nums">{fmtRp(trx.tax)}</span></div>}
        </div>
        <div className="my-2.5 flex items-center justify-between border-t border-dashed border-dove pt-2">
          <span className="text-sm font-semibold">TOTAL</span>
          <span className="text-sm font-semibold tabular-nums">{fmtRp(trx.total)}</span>
        </div>
        <div className="flex justify-between"><span className="text-muted">Bayar ({trx.method})</span><span className="tabular-nums">{fmtRp(trx.paid)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Kembalian</span><span className="tabular-nums">{fmtRp(trx.change)}</span></div>
        <div className="my-2.5 border-t border-dashed border-dove" />
        <p className="text-center text-[11px] leading-snug">{st.receiptHeader}</p>
        <p className="mt-1 text-center text-[10px] text-fog leading-snug">{st.receiptFooter}</p>
      </div>
      <div className="mt-4 flex justify-center gap-3 print:hidden">
        <Button onClick={() => window.print()}>Cetak Struk</Button>
        <Button variant="ghost" onClick={onClose}>Tutup</Button>
      </div>
    </div>
  )
}
