import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import {
  LayoutDashboard, Store, Package, Boxes, ReceiptText, BarChart3, Users, Settings,
  Moon, Sun, LogOut, ChevronsUpDown,
} from 'lucide-react'
import { apiLogout, apiMe, hasToken } from '../lib/api'
import { setSession, toSession, useDB, useTheme } from '../lib/store'
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
                  <img src="/logo.png" alt="OpenPOS" className="h-8 w-auto shrink-0" />
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
        </header>
        <main className="flex-1 space-y-6 p-4 lg:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function UserMenu() {
  const db = useDB()
  const nav = useNavigate()
  const s = db.session!
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function keluar() {
    setBusy(true)
    await apiLogout()
    setSession(null)
    nav('/masuk', { replace: true })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <Avatar className="size-8 rounded-lg">
          <AvatarFallback className="rounded-lg font-mono">{s.name.charAt(0).toUpperCase()}</AvatarFallback>
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
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="size-7 rounded-md">
                <AvatarFallback className="rounded-md font-mono text-xs">{s.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="grid flex-1 leading-tight">
                <span className="truncate text-sm font-medium">{s.name}</span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">{s.role === 'admin' ? 'Admin' : 'Kasir'} · {s.email}</span>
              </span>
            </div>
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
          </div>
        </>
      )}
    </div>
  )
}