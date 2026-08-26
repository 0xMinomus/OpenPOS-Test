import type { ReactNode } from 'react'

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl bg-cream p-6 shadow-xl`}
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