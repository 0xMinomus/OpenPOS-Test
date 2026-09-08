import { Link, Outlet, useLocation } from 'react-router'
import { Store, Package, ReceiptText, Archive } from 'lucide-react'
import { useLocalDB } from '../../lib/localdb'
import { Logo } from '../../lib/ui'

const TABS = [
  { id: 'kasir', to: '/app-offline/kasir', label: 'Kasir', icon: Store },
  { id: 'produk', to: '/app-offline/produk', label: 'Produk', icon: Package },
  { id: 'transaksi', to: '/app-offline/transaksi', label: 'Transaksi', icon: ReceiptText },
  { id: 'backup', to: '/app-offline/backup', label: 'Backup', icon: Archive },
]

export default function OfflineShell() {
  const loc = useLocation()
  const db = useLocalDB()
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Logo className="h-7 w-auto shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">{db.settings.storeName}</p>
              <p className="font-mono text-[11px] text-fog">Mode offline · data di perangkat</p>
            </div>
          </div>
          <Link to="/" className="text-[13px] font-medium text-jet hover:underline">Keluar</Link>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4 pb-2" aria-label="Menu offline">
          {TABS.map((t) => {
            const active = loc.pathname === t.to
            return (
              <Link
                key={t.id}
                to={t.to}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${active ? 'bg-jet text-paper' : 'text-muted hover:bg-surface hover:text-fg'}`}
              >
                <t.icon className="size-4" />
                {t.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
