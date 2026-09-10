import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import {
  LayoutDashboard, Store, Package, Boxes, ReceiptText, BarChart3, Users, Settings, IdCard,
  Moon, Sun, LogOut, ChevronsUpDown, Check, UserRound, Bell,
} from 'lucide-react'
import { ApiError, apiListNotifications, apiListUsers, apiLogout, apiMarkAllNotifsRead, apiMarkNotifRead, apiMe, apiSwitchAccount, getCachedAccounts, hasToken, setCachedAccounts, type Notification, type User } from '../lib/api'
import { fmtDate, fmtTime, setSession, toSession, useDB, useTheme } from '../lib/store'
import { Logo } from '../lib/ui'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarRail, SidebarTrigger,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

const MENU: { label: string; to: string; icon: React.ComponentType<{ className?: string }>; adminOnly?: boolean }[] = [
  { label: 'Dashboard', to: '/app', icon: LayoutDashboard },
  { label: 'POS Kasir', to: '/app/pos', icon: Store },
  { label: 'Produk', to: '/app/produk', icon: Package, adminOnly: true },
  { label: 'Stok', to: '/app/stok', icon: Boxes, adminOnly: true },
  { label: 'Transaksi', to: '/app/transaksi', icon: ReceiptText },
  { label: 'Laporan', to: '/app/laporan', icon: BarChart3, adminOnly: true },
  { label: 'Karyawan', to: '/app/karyawan', icon: IdCard, adminOnly: true },
  { label: 'User Management', to: '/app/users', icon: Users, adminOnly: true },
  { label: 'Pengaturan', to: '/app/pengaturan', icon: Settings, adminOnly: true },
]

export default function AppShell() {
  const db = useDB()
  const loc = useLocation()
  const [theme, setTheme] = useTheme()
  const [boot, setBoot] = useState(!hasToken())
  const s = db.session

  useEffect(() => {
    if (!hasToken() || s) return
    let dead = false
    apiMe()
      .then((r) => { if (!dead) setSession(toSession(r.user)) })
      .catch(() => { if (!dead) { apiLogout(); setSession(null) } })
      .finally(() => { if (!dead) setBoot(true) })
    return () => { dead = true }
  }, [s])

  if (!s) {
    if (hasToken() && !boot) return null
    return <Navigate to="/masuk" replace />
  }

  const menu = MENU.filter((m) => !m.adminOnly || s.role === 'admin')

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link to="/app" />}>
                  <Logo className="h-8 w-auto shrink-0" />
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-mono text-xs text-muted-foreground">{s.store}</span>
                  </span>
                </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarMenu>
              {menu.map((m) => {
                const active = loc.pathname === m.to || (m.to !== '/app' && loc.pathname.startsWith(m.to))
                return (
                  <SidebarMenuItem key={m.to}>
                    <SidebarMenuButton isActive={active} render={<Link to={m.to} />}>
                      <m.icon />
                      <span>{m.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <UserMenu />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
            title={theme === 'dark' ? 'Tema terang' : 'Tema gelap'}
            className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <div className="ml-auto">
            <NotifBell />
          </div>
        </header>
        <main className="flex-1 space-y-6 p-4 lg:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function NotifBell() {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let dead = false
    let timer: ReturnType<typeof setTimeout>
    // ponytail: poll 60 dtk (bukan realtime); cukup untuk peringatan stok.
    const poll = () => {
      Promise.all([
        apiListNotifications({ unread: true, limit: 1 }),
        apiListNotifications({ limit: 20 }),
      ])
        .then(([u, all]) => {
          if (dead) return
          setUnread(u.total)
          setItems(all.items)
        })
        .catch(() => {})
        .finally(() => { if (!dead) timer = setTimeout(poll, 60_000) })
    }
    poll()
    return () => { dead = true; clearTimeout(timer) }
  }, [])

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

  async function readOne(n: Notification) {
    if (!n.read) {
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      setUnread((c) => Math.max(0, c - 1))
      try {
        await apiMarkNotifRead(n.id)
      } catch {
        // best-effort; badge diselaraskan saat poll berikutnya
      }
    }
    if (n.type === 'low_stock') nav('/app/stok')
  }

  async function readAll() {
    setItems((xs) => xs.map((x) => ({ ...x, read: true })))
    setUnread(0)
    try {
      await apiMarkAllNotifsRead()
    } catch {
      // best-effort
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `${unread} notifikasi belum dibaca` : 'Notifikasi'}
        aria-expanded={open}
        title="Notifikasi"
        className="relative inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-ember px-1 font-mono text-[10px] font-medium leading-5 text-paper">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifikasi" className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-dove bg-paper shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-dove px-4 py-3">
            <p className="text-sm font-medium">Notifikasi</p>
            {unread > 0 && (
              <button onClick={readAll} className="text-xs text-muted hover:text-fg hover:underline">
                Tandai semua dibaca
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-fog">Tidak ada notifikasi.</p>
          ) : (
            <div>
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => readOne(n)}
                  className={`flex w-full items-start gap-2.5 border-b border-dove px-4 py-3 text-left transition last:border-0 hover:bg-surface ${n.read ? '' : 'bg-surface/60'}`}
                >
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? 'bg-dove' : n.type === 'low_stock' ? 'bg-ember' : 'bg-sunbeam'}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{n.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{n.message}</span>
                    <span className="mt-1 block font-mono text-[11px] text-fog">{fmtDate(n.created_at)} {fmtTime(n.created_at)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const db = useDB()
  const nav = useNavigate()
  const s = db.session!
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [accounts, setAccounts] = useState<User[]>(() => getCachedAccounts())
  const [pending, setPending] = useState<User | null>(null)
  const [passcode, setPasscode] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (s.role !== 'admin') return
    apiListUsers()
      .then((users) => { setAccounts(users); setCachedAccounts(users) })
      .catch(() => {})
  }, [s.role, s.id])

  // Ikut cache terbaru (tambah/hapus kasir di halaman Users) tanpa reload.
  useEffect(() => {
    const sync = () => setAccounts(getCachedAccounts())
    window.addEventListener('op:accounts-changed', sync)
    return () => window.removeEventListener('op:accounts-changed', sync)
  }, [])

  function resetMenu() {
    setOpen(false)
    setPending(null)
    setPasscode('')
    setErr('')
  }

  async function keluar() {
    setBusy(true)
    await apiLogout()
    setSession(null)
    nav('/masuk', { replace: true })
  }

  async function pick(u: User) {
    if (u.id === s.id) return resetMenu()
    setErr('')
    setBusy(true)
    try {
      const r = await apiSwitchAccount(u.id, undefined, u.role)
      setSession(toSession(r.user))
      resetMenu()
      nav('/app')
    } catch (x) {
      if (x instanceof ApiError && x.code === 'passcode_required') {
        setPending(u)
        setPasscode('')
      } else {
        setErr(x instanceof Error ? x.message : 'Gagal ganti akun.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function submitPasscode() {
    if (!pending) return
    setErr('')
    setBusy(true)
    try {
      const r = await apiSwitchAccount(pending.id, passcode, pending.role)
      setSession(toSession(r.user))
      resetMenu()
      nav('/app')
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Passcode salah. Coba lagi.')
      setPasscode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); setPending(null); setErr('') }}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <Avatar className="size-8 rounded-lg">
          <AvatarFallback className="rounded-lg"><UserRound className="size-5 text-white dark:text-black" /></AvatarFallback>
        </Avatar>
        <span className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{s.name}</span>
          <span className="truncate text-xs text-muted-foreground">{s.role === 'admin' ? 'Admin' : 'Kasir'}</span>
        </span>
        <ChevronsUpDown className="ml-auto size-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute bottom-full left-0 z-50 mb-2 w-full min-w-64 rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            {pending ? (
              <div className="space-y-2 p-2">
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Passcode · {pending.name}
                </p>
                <input
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitPasscode() }}
                  inputMode="numeric"
                  autoFocus
                  placeholder="•••••"
                  aria-label="Passcode 5 angka"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-center font-mono text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {err && <p className="text-xs text-destructive">{err}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setPending(null); setErr('') }}
                    className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                  >
                    Batal
                  </button>
                  <button
                    onClick={submitPasscode}
                    disabled={passcode.length !== 5 || busy}
                    className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? '…' : 'Masuk'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Ganti akun</p>
                <div className="max-h-64 overflow-y-auto">
                  {accounts.filter((a) => a.active).map((a) => {
                    const active = a.id === s.id
                    return (
                      <button
                        key={`${a.role}-${a.id}`}
                        role="menuitem"
                        disabled={busy}
                        onClick={() => pick(a)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-50 ${active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
                      >
                        <Avatar className="size-7 rounded-md">
                          <AvatarFallback className="rounded-md"><UserRound className="size-4 text-white dark:text-black" /></AvatarFallback>
                        </Avatar>
                        <span className="grid flex-1 leading-tight">
                          <span className="truncate font-medium">{a.name}</span>
                          <span className="truncate font-mono text-[11px] text-muted-foreground">
                            {a.role === 'admin' ? 'Admin' : 'Kasir'}
                          </span>
                        </span>
                        {active && <Check className="size-4 shrink-0" />}
                      </button>
                    )
                  })}
                  {accounts.length === 0 && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">Daftar akun tidak tersedia.</p>
                  )}
                </div>
                {err && <p className="px-2 py-1 text-xs text-destructive">{err}</p>}
                <div className="my-1 h-px bg-border" />
                <button
                  role="menuitem"
                  onClick={keluar}
                  disabled={busy}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <LogOut className="size-4" />
                  {busy ? 'Keluar…' : 'Keluar'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}