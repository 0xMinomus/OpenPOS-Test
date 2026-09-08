import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { LayoutDashboard, Store, Package, Boxes, ReceiptText, BarChart3, Settings, Archive } from 'lucide-react'
import { useLocalDB, createAccount, hasAccount } from '../../lib/localdb'
import { setSession, useDB, useTheme } from '../../lib/store'
import { Button, Input, Logo } from '../../lib/ui'
import { Sun, Moon } from 'lucide-react'

const MENU = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'POS Kasir', to: '/pos', icon: Store },
  { label: 'Produk', to: '/produk', icon: Package },
  { label: 'Stok', to: '/stok', icon: Boxes },
  { label: 'Transaksi', to: '/transaksi', icon: ReceiptText },
  { label: 'Laporan', to: '/laporan', icon: BarChart3 },
  { label: 'Pengaturan', to: '/pengaturan', icon: Settings },
  { label: 'Backup', to: '/backup', icon: Archive },
]

export default function OfflineShell() {
  const db = useLocalDB()
  const { session } = useDB()
  const [theme, setTheme] = useTheme()
  const loc = useLocation()

  useEffect(() => {
    if (hasAccount() && (!session || session.id !== 'local')) {
      setSession({
        id: 'local', email: '', name: db.settings.ownerName, role: 'admin', store: db.settings.storeName,
      })
    }
  }, [db.settings.ownerName, db.settings.storeName, session])

  if (!hasAccount()) return <Onboarding />

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Logo className="h-7 w-auto" />
          <span className="truncate text-xs text-sidebar-foreground">{db.settings.storeName}</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Menu">
          {MENU.map((m) => {
            const active = loc.pathname === m.to || (m.to !== '/' && loc.pathname.startsWith(m.to))
            return (
              <Link
                key={m.to}
                to={m.to}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${active ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/60'}`}
              >
                <m.icon className="size-4" />
                {m.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t px-5 py-4 text-xs text-muted-foreground">
          <p className="truncate font-medium text-foreground">{db.settings.ownerName}</p>
          <p className="truncate">Pemilik toko</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b bg-background px-4 lg:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{db.settings.storeName}</p>
            <p className="font-mono text-[11px] text-muted-foreground">Mode offline · data di perangkat</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Tema terang' : 'Tema gelap'}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            {window.offline?.isElectron ? (
              <button onClick={() => window.offline?.close()} className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                Tutup Aplikasi
              </button>
            ) : (
              <Link to="/" className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Keluar</Link>
            )}
          </div>
        </header>
        <main className="flex-1 space-y-6 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Onboarding() {
  const db = useLocalDB()
  const [ownerName, setOwnerName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [err, setErr] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ownerName.trim() || !storeName.trim()) return setErr('Nama pemilik dan nama toko wajib diisi.')
    createAccount(ownerName.trim(), storeName.trim())
    setSession({ id: 'local', email: '', name: ownerName.trim(), role: 'admin', store: storeName.trim() })
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Logo className="mx-auto h-10 w-auto" />
        <div className="mt-8 rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Selamat datang di OpenPOS</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {db.settings.ownerName
              ? `Akun "${db.settings.ownerName}" ada di perangkat ini — lanjutkan untuk masuk.`
              : 'Buat akun lokal untuk mulai. Semua data tersimpan di perangkat ini.'}
          </p>
          {err && <p className="mt-3 rounded-lg bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">{err}</p>}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Input label="Nama pemilik" value={ownerName} onChange={setOwnerName} placeholder="cth: Andika" required />
            <Input label="Nama toko" value={storeName} onChange={setStoreName} placeholder="cth: Toko Kelontong Serba Ada" required />
            <Button type="submit" className="w-full">Masuk</Button>
          </form>
        </div>
        <p className="mt-4 text-center text-[13px] text-muted-foreground">OpenPOS Offline · tanpa internet, data di perangkat.</p>
      </div>
    </div>
  )
}
