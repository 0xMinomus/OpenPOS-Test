import type { StoreSettings, Trx } from './api'
import { fmtInv, fmtRp } from './store'
import { Button } from './ui'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Format struk: DD-MM-YYYY HH:MM (24 jam), zona lokal perangkat.
function fmtTrxDateTime(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Hr() {
  return <div className="receipt-hr my-2.5" aria-hidden="true" />
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1 text-[12px] leading-snug">
      <span className="w-[4.75rem] shrink-0">{label}</span>
      <span className="shrink-0">:</span>
      <span className="min-w-0 flex-1 break-words">{value}</span>
    </div>
  )
}

function SumRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="receipt-row flex items-baseline justify-between gap-2 text-[12px]">
      <span className={strong ? 'font-bold' : undefined}>{label}</span>
      <span className={`tabular-nums ${strong ? 'font-bold' : ''}`}>{value}</span>
    </div>
  )
}

function ReceiptPaper({ trx, settings }: { trx: Trx; settings: StoreSettings | null }) {
  const st = settings ?? { storeName: '', address: '', phone: '', receiptHeader: '', receiptFooter: '', paper: '58mm' } as StoreSettings
  const payLabel = trx.method.trim().toUpperCase() === 'CASH' ? 'TUNAI' : trx.method.toUpperCase()
  return (
    <div id="receipt" className="rounded-lg border border-dove bg-white px-4 py-5 font-mono text-[12px] leading-relaxed text-black" style={{ width: st.paper }}>
      <p className="text-center text-[15px] font-bold uppercase leading-snug">{st.storeName}</p>
      {st.address && <p className="mt-0.5 text-center text-[11px] leading-snug">{st.address}</p>}
      {st.phone && <p className="text-center text-[11px] leading-snug">{st.phone}</p>}
      <Hr />
      <MetaRow label="Tanggal" value={fmtTrxDateTime(trx.created_at)} />
      <MetaRow label="Kasir" value={trx.cashier_name} />
      <MetaRow label="No Trx" value={fmtInv(trx.id)} />
      <MetaRow label="Metode" value={trx.method} />
      {trx.customer && <MetaRow label="Pelanggan" value={trx.customer} />}
      <Hr />
      <div className="space-y-1.5">
        {trx.items.map((i) => (
          <div key={i.product_id} className="receipt-row">
            <p className="break-words leading-snug">{i.name}</p>
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="tabular-nums">{i.qty} × {fmtRp(i.price)}</span>
              <span className="tabular-nums">{fmtRp(i.price * i.qty)}</span>
            </div>
          </div>
        ))}
      </div>
      <Hr />
      <div className="space-y-1">
        <SumRow label="Subtotal" value={fmtRp(trx.subtotal)} />
        {trx.discount > 0 && <SumRow label="Diskon" value={`-${fmtRp(trx.discount)}`} />}
        {trx.tax > 0 && <SumRow label="Pajak" value={fmtRp(trx.tax)} />}
        <SumRow label="TOTAL" value={fmtRp(trx.total)} strong />
        <SumRow label={payLabel} value={fmtRp(trx.paid)} strong />
        {trx.change > 0 && <SumRow label="Kembalian" value={fmtRp(trx.change)} />}
      </div>
      <Hr />
      {st.receiptHeader && <p className="text-center text-[11px] leading-snug">{st.receiptHeader}</p>}
      {st.receiptFooter && <p className="mt-1 text-center text-[11px] leading-snug">{st.receiptFooter}</p>}
    </div>
  )
}

// Render inline di dalam Modal seperti semula (desain kertas tetap baru).
export function Receipt({ trx, settings, onClose }: { trx: Trx; settings: StoreSettings | null; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center">
      <ReceiptPaper trx={trx} settings={settings} />
      <div className="mt-4 flex justify-center gap-3 print:hidden">
        <Button onClick={() => window.print()}>Cetak Struk</Button>
        <Button variant="ghost" onClick={onClose}>Tutup</Button>
      </div>
    </div>
  )
}
