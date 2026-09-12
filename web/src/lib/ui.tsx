import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { TrxItem } from './api'
import { fmtDate } from './store'

export function TrxItems({ items, className }: { items: TrxItem[]; className?: string }) {
  const shown = items.slice(0, 2)
  const rest = items.length - shown.length
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ''}`}>
      {shown.map((i) => (
        <span
          key={i.product_id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-dove bg-surface px-2 py-1"
        >
          <span className="truncate text-[13px] leading-none text-fg">{i.name}</span>
          <span className="rounded-sm bg-paper px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none tabular-nums text-steel ring-1 ring-dove">
            ×{i.qty}
          </span>
        </span>
      ))}
      {rest > 0 && <span className="text-[13px] text-fog">+{rest} lainnya</span>}
    </div>
  )
}

// Logo dua varian: Hitam di mode terang, Putih di mode gelap.
// Varian auto menumpuk kedua gambar + preload (lihat index.html)
// sehingga ganti tema hanya crossfade opacity — tanpa flicker jaringan.
export function Logo({ className = 'h-8 w-auto', tone = 'auto' }: { className?: string; tone?: 'auto' | 'light' | 'dark' }) {
  if (tone === 'dark') return <img src="/Logo-Putih.png" alt="OpenPOS" draggable={false} className={className} />
  if (tone === 'light') return <img src="/Logo-Hitam.png" alt="OpenPOS" draggable={false} className={className} />
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} role="img" aria-label="OpenPOS">
      <img src="/Logo-Hitam.png" alt="" aria-hidden="true" draggable={false} className="h-full w-auto transition-opacity duration-150 dark:opacity-0" />
      <img src="/Logo-Putih.png" alt="" aria-hidden="true" draggable={false} className="absolute inset-0 h-full w-auto opacity-0 transition-opacity duration-150 dark:opacity-100" />
    </span>
  )
}

export function Button({
  children, onClick, type = 'button', variant = 'primary', disabled, className = '',
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  className?: string
}) {
  const styles = {
    primary: 'bg-jet text-paper border-jet hover:opacity-85',
    ghost: 'bg-transparent text-fg border-dove hover:border-jet',
    danger: 'bg-transparent text-ember border-dove hover:border-ember',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-[15px] font-medium transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Input({
  label, value, onChange, type = 'text', placeholder, required, hint,
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  hint?: string
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-paper px-3.5 py-2.5 text-[15px] text-fg placeholder:text-fog focus:border-jet focus:outline-2 focus:outline-accent-soft"
      />
      {hint && <span className="text-xs font-normal text-fog">{hint}</span>}
    </label>
  )
}

// Input angka dengan pengelompokan ribuan otomatis (1000 → 1.000).
// Titik/koma yang diketik manual diabaikan sebagai pemisah ribuan; nilai
// mentah (hanya digit, desimal pakai titik) diteruskan via onValue.
// allowDecimal = dukung desimal (mis. pajak 11,5%) — tampil pakai koma.
export function NumInput({
  label, value, onValue, placeholder, required, disabled, hint, allowDecimal, autoFocus, className,
}: {
  label?: string
  value: string | number
  onValue: (raw: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  hint?: string
  allowDecimal?: boolean
  autoFocus?: boolean
  className?: string
}) {
  const raw = String(value ?? '')
  const parts = raw.split('.')
  const intDigits = (parts[0] ?? '').replace(/\D/g, '')
  const fracDigits = (parts[1] ?? '').replace(/\D/g, '').slice(0, 2)
  const display = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (allowDecimal && fracDigits ? `,${fracDigits}` : '')

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.replace(/[^\d.,]/g, '')
    if (!allowDecimal) {
      onValue(v.replace(/\D/g, ''))
      return
    }
    v = v.replace(/,/g, '.')
    const seg = v.split('.')
    if (seg.length > 2) v = seg[0] + '.' + seg.slice(1).join('')
    onValue(v)
  }

  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
      {label}
      <input
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        value={display}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={handle}
        className={`w-full rounded-md border border-border bg-paper px-3.5 py-2.5 text-[15px] text-fg placeholder:text-fog focus:border-jet focus:outline-none disabled:opacity-50 ${className ?? ''}`}
      />
      {hint && <span className="text-xs font-normal text-fog">{hint}</span>}
    </label>
  )
}

export function Modal({
  open, title, onClose, children, wide,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-3 sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`max-h-[calc(100dvh-1.5rem)] w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-y-auto rounded-2xl bg-cream p-4 shadow-xl sm:p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium tracking-tight">{title}</h3>
          <button className="rounded-full p-1 text-fog hover:text-fg" onClick={onClose} aria-label="Tutup">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Pill({ children, tone = 'ok' }: { children: ReactNode; tone?: 'ok' | 'warn' | 'muted' }) {
  const styles = {
    ok: 'bg-success-bg text-sprout',
    warn: 'bg-sand text-steel',
    muted: 'bg-surface text-muted',
  }[tone]
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${styles}`}>{children}</span>
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Selesai', cls: 'bg-success-bg text-sprout' },
    pending: { label: 'Proses', cls: 'bg-sand text-steel' },
    cancelled: { label: 'Dibatalkan', cls: 'bg-surface text-muted' },
    refunded: { label: 'Refund', cls: 'bg-sand text-sunbeam' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-surface text-muted' }
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.label}</span>
}

export function Empty({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-dove px-6 py-14 text-center">
      <p className="font-medium text-fg">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{sub}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[clamp(26px,3vw,34px)] font-normal leading-[1.1] tracking-[-0.025em]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function Th({ children, right }: { children?: ReactNode; right?: boolean }) {
  return (
    <th className={`border-b border-dove px-2.5 py-2 font-mono text-[11px] font-medium uppercase tracking-wider text-fog ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

export function Td({ children, mono, right }: { children: ReactNode; mono?: boolean; right?: boolean }) {
  return (
    <td className={`border-b border-dove px-2.5 py-2.5 text-[13px] text-muted ${mono ? 'font-mono text-xs text-fg' : ''} ${right ? 'text-right tabular-nums' : ''}`}>
      {children}
    </td>
  )
}

// Nomor halaman ringkas: semua bila <=7, else 1 … jendela … akhir.
function pageNums(cur: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const keep = [...new Set([0, total - 1, cur - 1, cur, cur + 1].filter((n) => n >= 0 && n < total))].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = -1
  for (const n of keep) {
    if (n - prev > 1) out.push('…')
    out.push(n)
    prev = n
  }
  return out
}

// Pager angka rata kanan: ‹ › ringkas + lompat langsung. Null bila 1 halaman.
export function Pager({ page, total, onChange, className = 'mt-3' }: { page: number; total: number; onChange: (p: number) => void; className?: string }) {
  if (total <= 1) return null
  const btn = 'rounded-lg border border-dove bg-paper px-3 py-1.5 text-sm transition hover:border-jet disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className={`flex flex-wrap items-center justify-end gap-1.5 ${className}`}>
      <button aria-label="Halaman sebelumnya" disabled={page === 0} onClick={() => onChange(page - 1)} className={btn}>‹</button>
      {pageNums(page, total).map((n, i) => n === '…' ? (
        <span key={`e${i}`} className="px-1 text-fog">…</span>
      ) : (
        <button
          key={n} onClick={() => onChange(n)} aria-label={`Halaman ${n + 1}`} aria-current={n === page || undefined}
          className={`min-w-9 rounded-lg border px-2.5 py-1.5 font-mono text-[13px] tabular-nums transition ${n === page ? 'border-jet bg-jet font-medium text-paper' : 'border-dove bg-paper hover:border-jet'}`}
        >{n + 1}</button>
      ))}
      <button aria-label="Halaman berikutnya" disabled={page >= total - 1} onClick={() => onChange(page + 1)} className={btn}>›</button>
    </div>
  )
}

// DatePicker — pemilih tanggal kalender popover (Senin dulu, label Indonesia).
// Nilai string 'YYYY-MM-DD' ('' = kosong), tanpa dependensi tanggal baru.
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const WEEKDAYS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

function isoDay(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseISODate(s: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  return [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
}

function todayParts(): [number, number, number] {
  const t = new Date()
  return [t.getFullYear(), t.getMonth(), t.getDate()]
}

export function DatePicker({ value, onChange, label = 'Pilih tanggal', placeholder = 'Pilih tanggal' }: {
  value: string
  onChange: (v: string) => void
  label?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const today = todayParts()
  const parsed = parseISODate(value)
  const [view, setView] = useState<[number, number]>([parsed?.[0] ?? today[0], parsed?.[1] ?? today[1]])
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open ])

  const [vy, vm] = view
  const todayISO = isoDay(today[0], today[1], today[2])
  const offset = (new Date(vy, vm, 1).getDay() + 6) % 7
  const dim = new Date(vy, vm + 1, 0).getDate()
  const prevDim = new Date(vy, vm, 0).getDate()
  const cells: { key: string; d: number; iso: string; outside: boolean }[] = []
  for (let i = offset - 1; i >= 0; i--) {
    const d = prevDim - i
    cells.push({ key: `p${d}`, d, iso: isoDay(vm === 0 ? vy - 1 : vy, (vm + 11) % 12, d), outside: true })
  }
  for (let d = 1; d <= dim; d++) cells.push({ key: `c${d}`, d, iso: isoDay(vy, vm, d), outside: false })
  for (let d = 1; cells.length % 7 !== 0; d++) {
    cells.push({ key: `n${d}`, d, iso: isoDay(vm === 11 ? vy + 1 : vy, (vm + 1) % 12, d), outside: true })
  }

  function pick(iso: string) {
    onChange(iso)
    setOpen(false)
  }

  function openMenu() {
    const p = parseISODate(value)
    setView([p?.[0] ?? today[0], p?.[1] ?? today[1]])
    setOpen((o) => !o)
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button" aria-label={label} aria-expanded={open} onClick={openMenu}
        className="flex w-full items-center gap-2.5 rounded-md border border-border bg-paper px-3.5 py-2 text-sm transition outline-none hover:border-jet focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CalendarDays className="size-4 shrink-0 text-fog" />
        <span className={`min-w-0 flex-1 truncate text-left tabular-nums ${value ? 'text-fg' : 'text-fog'}`}>
          {value ? fmtDate(value) : placeholder}
        </span>
        {value ? (
          <span
            role="button" tabIndex={0} aria-label="Hapus tanggal"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onChange(''); } }}
            className="grid shrink-0 place-items-center rounded-full p-0.5 text-fog transition outline-none hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" />
          </span>
        ) : (
          <ChevronDown className="size-4 shrink-0 text-fog" />
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Kalender" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-dove bg-paper p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <button
              type="button" aria-label="Bulan sebelumnya"
              onClick={() => setView([vm === 0 ? vy - 1 : vy, (vm + 11) % 12])}
              className="grid size-8 place-items-center rounded-lg text-muted transition outline-none hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-medium">{MONTHS_ID[vm]} {vy}</p>
            <button
              type="button" aria-label="Bulan berikutnya"
              onClick={() => setView([vm === 11 ? vy + 1 : vy, (vm + 1) % 12])}
              className="grid size-8 place-items-center rounded-lg text-muted transition outline-none hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 text-center font-mono text-[11px] uppercase text-fog">
            {WEEKDAYS_ID.map((d) => <span key={d} className="py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((c) => {
              const selected = c.iso === value
              const isToday = c.iso === todayISO
              return (
                <button
                  key={c.key} type="button" aria-label={fmtDate(c.iso)} aria-pressed={selected}
                  onClick={() => { setView([Number(c.iso.slice(0, 4)), Number(c.iso.slice(5, 7)) - 1]); pick(c.iso) }}
                  className={`grid size-9 place-items-center rounded-full text-[13px] tabular-nums transition outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected
                    ? 'bg-jet font-medium text-paper'
                    : isToday
                      ? 'border border-jet font-medium text-fg hover:bg-surface'
                      : `border border-transparent hover:bg-surface ${c.outside ? 'text-fog/60' : 'text-fg'}`}`}
                >
                  {c.d}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-dove pt-2">
            <button
              type="button" onClick={() => { setView([today[0], today[1]]); pick(todayISO) }}
              className="text-[13px] font-medium text-jet hover:underline"
            >
              Hari ini
            </button>
            {value && (
              <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="text-[13px] text-ember hover:underline">
                Hapus filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Baris skeleton dalam tabel asli (pakai setelah <thead> saat data null)
// agar kolom & padding sama persis dengan isi sebenarnya.
export function SkeletonRows({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="border-b border-dove px-2.5 py-2.5">
              <Skeleton className="h-4 w-full max-w-36" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}