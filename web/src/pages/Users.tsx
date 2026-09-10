// User Management — workspace administrasi akun (admin).
// Token font/warna milik sistem (tidak ada token baru di file ini).
// Aktivitas + kinerja diturunkan dari data reliable (users + laporan);
// log audit beneran menunggu kontrak docs/API-CONTRACT-USER-ACTIVITY.md.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  Check, ChevronDown, ChevronUp, Download, Ellipsis, Plus, ReceiptText,
  Search, ShieldCheck, UserPlus, UserRound, UserX, UsersRound,
} from 'lucide-react'
import {
  apiCreateUser, apiDeleteUser, apiGetReport, apiListActivity, apiListUsers, apiSetUserActive,
  setCachedAccounts, type ActivityItem, type Page, type ReportBundle, type User,
} from '../lib/api'
import { useCache } from '../lib/cache'
import { exportCSV, fmtDate, fmtInv, fmtRp, fmtTime, useDB } from '../lib/store'
import { Button, Input, Modal, PageHead, Pager, Pill, Td, Th } from '../lib/ui'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const PAGE_SIZE = 10

type RoleF = '' | 'admin' | 'cashier'
type StatusF = '' | 'active' | 'inactive'
type SortId = 'new' | 'old' | 'az' | 'za'

const SORTS: { id: SortId; label: string }[] = [
  { id: 'new', label: 'Terbaru' },
  { id: 'old', label: 'Terlama' },
  { id: 'az', label: 'Nama A-Z' },
  { id: 'za', label: 'Nama Z-A' },
]

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

// Presence: online bila flag server true atau last_seen < 2 mnt.
// Null = backend lama tanpa field → badge tak tampil (interim).
// ponytail: ambang client 2 mnt (interval heartbeat 30 dtk + toleransi).
function presenceOf(u: User): boolean | null {
  if (typeof u.online === 'boolean') return u.online
  if (!u.last_seen_at) return null
  const t = +new Date(u.last_seen_at)
  return isNaN(t) ? null : Date.now() - t < 120_000
}

function Presence({ u }: { u: User }) {
  const p = presenceOf(u)
  if (p === null) return null
  return (
    <span className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${p ? 'text-sprout' : 'text-ember'}`}>
      <span className={`size-1.5 rounded-full ${p ? 'bg-sprout' : 'bg-ember'}`} aria-hidden="true" />
      {p ? 'Online' : 'Offline'}
    </span>
  )
}

function todayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export default function Users() {
  const db = useDB()
  const s = db.session!
  const today = todayStr()

  const list = useCache<User[]>(`users:${s.id}`, () => apiListUsers(), 'Gagal memuat pengguna.')
  const todayRep = useCache<ReportBundle>(`users-today:${s.id}`, () => apiGetReport('today'))
  const allRep = useCache<ReportBundle>(`users-all:${s.id}`, () => apiGetReport('all'))
  const actRep = useCache<Page<ActivityItem> | null>(`users-activity:${s.id}`, () => apiListActivity({ page: 1, limit: 20 }))
  const data = list.data ?? null

  const [q, setQ] = useState('')
  const [roleF, setRoleF] = useState<RoleF>('')
  const [statusF, setStatusF] = useState<StatusF>('')
  const [sort, setSort] = useState<SortId>('new')
  const [page, setPage] = useState(0)

  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [formErr, setFormErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [offFor, setOffFor] = useState<User | null>(null)
  const [offBusy, setOffBusy] = useState(false)
  const [deleteFor, setDeleteFor] = useState<User | null>(null)
  const [deleteTyped, setDeleteTyped] = useState('')
  const [deleteErr, setDeleteErr] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [actAll, setActAll] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0) }, [q, roleF, statusF, sort])
  useEffect(() => { if (list.data) setCachedAccounts(list.data) }, [list.data])

  // Kinerja hari ini per nama kasir (pola Karyawan: agregat transaksi laporan).
  const perf = useMemo(() => {
    const m = new Map<string, { omzet: number; trx: number }>()
    for (const t of todayRep.data?.transactions ?? []) {
      const e = m.get(t.cashier) ?? { omzet: 0, trx: 0 }
      e.omzet += t.total
      e.trx += 1
      m.set(t.cashier, e)
    }
    return m
  }, [todayRep.data])

  // Aktivitas terakhir per nama = tanggal transaksi terakhir (laporan semua).
  const lastDate = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of allRep.data?.transactions ?? []) {
      if ((m.get(t.cashier) ?? '') < t.date) m.set(t.cashier, t.date)
    }
    return m
  }, [allRep.data])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const rows = (data ?? []).filter((u) => {
      if (roleF && u.role !== roleF) return false
      if (statusF && (u.active ? 'active' : 'inactive') !== statusF) return false
      if (needle && !`${u.name} ${u.email}`.toLowerCase().includes(needle)) return false
      return true
    })
    const ts = (u: User) => (u.created_at ? +new Date(u.created_at) : 0)
    return rows.sort((a, b) => {
      if (sort === 'az' || sort === 'za') return sort === 'az' ? a.name.localeCompare(b.name, 'id') : b.name.localeCompare(a.name, 'id')
      return sort === 'new' ? ts(b) - ts(a) : ts(a) - ts(b)
    })
  }, [data, q, roleF, statusF, sort])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pg = Math.min(page, pages - 1)
  const shown = filtered.slice(pg * PAGE_SIZE, pg * PAGE_SIZE + PAGE_SIZE)

  // Feed aktivitas: audit log bila live, else turunan
  // (akun dibuat + 8 transaksi terakhir).
  const feed = useMemo(() => {
    type Ev = { key: string; date: string; ts: number; kind: 'login' | 'user' | 'trx'; text: string; label: string }
    const live = actRep.data?.items ?? []
    if (live.length > 0) {
      return live.slice(0, 15).map((a) => {
        const d = a.created_at.slice(0, 10)
        return {
          key: `a-${a.id}`,
          date: d,
          ts: +new Date(a.created_at),
          kind: (a.action === 'LOGIN' ? 'login' : 'user') as Ev['kind'],
          text: a.detail || `${a.actor_name} · ${a.action}`,
          label: d >= today ? `Hari ini, ${fmtTime(a.created_at)}` : `${fmtDate(a.created_at)}, ${fmtTime(a.created_at)}`,
        }
      })
    }
    const evs: Ev[] = (data ?? []).filter((u) => u.created_at).map((u) => ({
      key: `u-${u.role}-${u.id}`,
      date: u.created_at!.slice(0, 10),
      ts: +new Date(u.created_at!),
      kind: 'user' as const,
      text: `${u.name} ditambahkan sebagai ${u.role === 'admin' ? 'admin' : 'kasir'}`,
      label: u.created_at!.slice(0, 10) >= today ? 'Hari ini' : fmtDate(u.created_at!),
    }))
    const trxs = [...(allRep.data?.transactions ?? [])]
      .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id))
      .slice(0, 8)
    for (const t of trxs) {
      evs.push({
        key: `t-${t.id}`,
        date: t.date.slice(0, 10),
        ts: +new Date(t.date),
        kind: 'trx',
        text: `${t.cashier} · Transaksi ${fmtInv(t.id)} · ${fmtRp(t.total)}`,
        label: t.date.slice(0, 10) >= today ? 'Hari ini' : fmtDate(t.date),
      })
    }
    return evs.sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts).slice(0, 15)
  }, [data, allRep.data, actRep.data, today])

  const top3 = useMemo(
    () => [...perf.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.omzet - a.omzet).slice(0, 3),
    [perf],
  )

  const total = data?.length ?? 0
  const cashiers = data?.filter((u) => u.role === 'cashier') ?? []
  const activeCashiers = cashiers.filter((u) => u.active).length
  const admins = (data?.filter((u) => u.role === 'admin') ?? []).length
  const inactive = (data?.filter((u) => !u.active) ?? []).length
  const hasFilter = q.trim() !== '' || roleF !== '' || statusF !== ''
  const boot = !data || todayRep.data === null || allRep.data === null || actRep.loading
  const loadErr = err || list.err || todayRep.err || allRep.err

  function reload() {
    setErr('')
    list.reload()
    todayRep.reload()
    allRep.reload()
    actRep.reload()
  }

  async function create() {
    setFormErr('')
    if (!name.trim()) return setFormErr('Nama kasir wajib diisi.')
    setBusy(true)
    try {
      await apiCreateUser({ name: name.trim() })
      setOpen(false); setName('')
      reload()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Gagal membuat akun.')
    } finally {
      setBusy(false)
    }
  }

  async function setActive(u: User, active: boolean) {
    if (!active) setOffBusy(true)
    try {
      await apiSetUserActive(u.id, active)
      setOffFor(null)
      reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal mengubah status.')
    } finally {
      if (!active) setOffBusy(false)
    }
  }

  async function remove() {
    if (!deleteFor) return
    if (deleteTyped !== 'Konfirmasi') return setDeleteErr('Ketik "Konfirmasi" untuk menghapus.')
    setDeleteErr(''); setDeleteBusy(true)
    try {
      await apiDeleteUser(deleteFor.id)
      setDeleteFor(null); setDeleteTyped('')
      reload()
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : 'Gagal menghapus akun.')
    } finally {
      setDeleteBusy(false)
    }
  }

  function resetFilter() {
    setQ(''); setRoleF(''); setStatusF(''); setSort('new')
  }

  function exportAll() {
    if (!data) return
    exportCSV(`pengguna-${today}.csv`, [
      ['Nama', 'Email', 'Role', 'Status', 'Bergabung'],
      ...[...data]
        .sort((a, b) => a.name.localeCompare(b.name, 'id'))
        .map((u) => [
          u.name,
          u.email || 'Tanpa email',
          u.role === 'admin' ? 'Admin' : 'Kasir',
          u.active ? 'Aktif' : 'Nonaktif',
          u.created_at ? fmtDate(u.created_at) : '—',
        ]),
    ])
  }

  function lastAct(u: User): string {
    const d = lastDate.get(u.name)
    if (!d) return '—'
    return d >= today ? 'Hari ini' : fmtDate(d)
  }

  function perfCell(u: User) {
    if (u.role === 'admin') return <span className="text-fog">—</span>
    const p = perf.get(u.name)
    if (!p || p.trx === 0) return <span className="text-fog">Belum ada transaksi</span>
    return (
      <span className="whitespace-nowrap">
        <span className="font-medium text-fg">{fmtRp(p.omzet)}</span>
        <span className="text-fog"> · {p.trx} trx</span>
      </span>
    )
  }

  function actionMenu(u: User) {
    // Backend hanya dukung aktif/nonaktif + hapus untuk kasir —
    // menu tak tampil untuk admin maupun diri sendiri.
    if (u.role !== 'cashier' || u.id === s.id) return null
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Aksi untuk ${u.name}`}
          className="grid size-8 place-items-center rounded-lg text-muted transition outline-none hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Ellipsis className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {u.active ? (
            <DropdownMenuItem onClick={() => setOffFor(u)}>Nonaktifkan</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setActive(u, true)}>Aktifkan kembali</DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => { setDeleteFor(u); setDeleteTyped(''); setDeleteErr('') }}>
            <span className="text-ember">Hapus</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const cards = [
    { icon: UsersRound, box: 'bg-sand text-steel', label: 'Total Pengguna', value: String(total), sub: 'Semua akun terdaftar' },
    { icon: UserRound, box: 'bg-sand text-steel', label: 'Kasir Aktif', value: String(activeCashiers), sub: `Dari ${cashiers.length} akun kasir` },
    { icon: ShieldCheck, box: 'bg-success-bg text-sprout', label: 'Admin', value: String(admins), sub: 'Akun dengan akses penuh' },
    {
      icon: UserX, box: inactive > 0 ? 'bg-ember/10 text-ember' : 'bg-sand text-steel',
      label: 'Akun Nonaktif', value: String(inactive),
      sub: inactive > 0 ? `${inactive} akun perlu perhatian` : 'Tidak ada akun nonaktif',
    },
  ]

  return (
    <>
      <PageHead
        title="User Management"
        sub="Kelola akun admin dan kasir, status akun, serta akses pengguna."
        right={(
          <div className="flex gap-2">
            <Button variant="ghost" onClick={exportAll} disabled={!data}>
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Tambah Kasir
            </Button>
          </div>
        )}
      />

      {loadErr && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-dove bg-paper px-4 py-3">
          <p className="flex-1 text-[13px] text-ember">{loadErr}</p>
          <button onClick={reload} className="rounded-lg border border-dove px-3 py-1.5 text-[13px] font-medium transition hover:border-jet">
            Coba Lagi
          </button>
        </div>
      )}

      {/* Ringkasan */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {boot ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} aria-hidden="true"><CardContent className="flex items-center gap-3 p-4"><Skeleton className="size-10 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-12" /></div></CardContent></Card>
          ))
        ) : (
          cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${c.box}`} aria-hidden="true">
                  <c.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted">{c.label}</span>
                  <span className="block text-2xl font-medium tabular-nums leading-tight text-fg">{c.value}</span>
                  <span className="block truncate text-xs text-fog">{c.sub}</span>
                </span>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Workspace tabel */}
      <div className="mt-4 rounded-2xl border border-dove bg-paper p-3 sm:p-4">
        {boot ? (
          <div className="space-y-3" aria-label="Memuat pengguna">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1 lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fog" />
                <input
                  value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama pengguna…"
                  aria-label="Cari nama pengguna"
                  className="w-full rounded-md border border-border bg-paper py-2.5 pl-10 pr-3.5 text-sm text-fg placeholder:text-fog focus:border-jet focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2.5 lg:ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label="Filter role" className="flex items-center justify-between gap-2 rounded-md border border-border bg-paper px-3.5 py-2.5 text-sm transition outline-none hover:border-jet focus-visible:ring-2 focus-visible:ring-ring">
                    <span>{roleF === 'admin' ? 'Admin' : roleF === 'cashier' ? 'Kasir' : 'Semua Role'}</span>
                    <ChevronDown className="size-4 shrink-0 text-fog" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {([['', 'Semua Role'], ['admin', 'Admin'], ['cashier', 'Kasir']] as [RoleF, string][]).map(([v, l]) => (
                      <DropdownMenuItem key={l} onClick={() => setRoleF(v)}>
                        <Check className={`size-4 ${roleF === v ? 'opacity-100' : 'opacity-0'}`} />{l}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label="Filter status" className="flex items-center justify-between gap-2 rounded-md border border-border bg-paper px-3.5 py-2.5 text-sm transition outline-none hover:border-jet focus-visible:ring-2 focus-visible:ring-ring">
                    <span>{statusF === 'active' ? 'Aktif' : statusF === 'inactive' ? 'Nonaktif' : 'Semua Status'}</span>
                    <ChevronDown className="size-4 shrink-0 text-fog" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {([['', 'Semua Status'], ['active', 'Aktif'], ['inactive', 'Nonaktif']] as [StatusF, string][]).map(([v, l]) => (
                      <DropdownMenuItem key={l} onClick={() => setStatusF(v)}>
                        <Check className={`size-4 ${statusF === v ? 'opacity-100' : 'opacity-0'}`} />{l}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label="Urutkan" className="flex items-center justify-between gap-2 rounded-md border border-border bg-paper px-3.5 py-2.5 text-sm transition outline-none hover:border-jet focus-visible:ring-2 focus-visible:ring-ring">
                    <span>Urut: {SORTS.find((x) => x.id === sort)?.label}</span>
                    <ChevronDown className="size-4 shrink-0 text-fog" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {SORTS.map((o) => (
                      <DropdownMenuItem key={o.id} onClick={() => setSort(o.id)}>
                        <Check className={`size-4 ${sort === o.id ? 'opacity-100' : 'opacity-0'}`} />{o.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-dove px-6 py-14 text-center">
                <p className="font-medium text-fg">{hasFilter ? 'Pengguna tidak ditemukan' : 'Belum ada kasir'}</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                  {hasFilter
                    ? 'Coba ubah kata pencarian atau filter.'
                    : 'Tambahkan kasir pertama untuk mulai menggunakan akun kasir.'}
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  {hasFilter && <Button variant="ghost" onClick={resetFilter}>Reset Filter</Button>}
                  {!hasFilter && <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Tambah Kasir</Button>}
                </div>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <table className="mt-3 hidden w-full border-collapse md:table">
                  <thead>
                    <tr>
                      <Th>Nama</Th><Th>Role</Th><Th>Status</Th><Th>Bergabung</Th><Th>Aktivitas Terakhir</Th><Th>Kinerja Hari Ini</Th><Th />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((u) => (
                      <tr key={`${u.role}-${u.id}`} className="transition-colors hover:bg-surface/60">
                        <Td>
                          <span className="flex items-center gap-2.5">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sand text-[13px] font-medium text-steel" aria-hidden="true">
                              {initials(u.name)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-fg">
                                {u.name}{u.id === s.id && <span className="ml-1.5 font-normal text-fog">(Anda)</span>}
                              </span>
                              <span className="block truncate text-xs text-fog">{u.email || 'Tanpa email'}</span>
                            </span>
                          </span>
                        </Td>
                        <Td><Pill tone={u.role === 'admin' ? 'ok' : 'muted'}>{u.role === 'admin' ? 'Admin' : 'Kasir'}</Pill></Td>
                        <Td>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${u.active ? 'bg-success-bg text-sprout' : 'bg-sand text-steel'}`}>
                            <span className={`size-1.5 rounded-full ${u.active ? 'bg-sprout' : 'bg-ember'}`} aria-hidden="true" />
                            {u.active ? 'Aktif' : 'Nonaktif'}
                          </span>
                          <Presence u={u} />
                        </Td>
                        <Td mono>{u.created_at ? fmtDate(u.created_at) : '—'}</Td>
                        <Td><span className="whitespace-nowrap text-muted">{lastAct(u)}</span></Td>
                        <Td>{perfCell(u)}</Td>
                        <Td><span className="flex justify-end">{actionMenu(u)}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile */}
                <div className="mt-3 space-y-2.5 md:hidden">
                  {shown.map((u) => (
                    <div key={`${u.role}-${u.id}`} className="rounded-xl border border-dove bg-paper p-4">
                      <div className="flex items-start gap-2.5">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sand text-sm font-medium text-steel" aria-hidden="true">
                          {initials(u.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-fg">
                            {u.name}{u.id === s.id && <span className="ml-1.5 font-normal text-fog">(Anda)</span>}
                          </span>
                          <span className="block truncate text-xs text-fog">{u.email || 'Tanpa email'}</span>
                        </span>
                        {actionMenu(u)}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Pill tone={u.role === 'admin' ? 'ok' : 'muted'}>{u.role === 'admin' ? 'Admin' : 'Kasir'}</Pill>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${u.active ? 'bg-success-bg text-sprout' : 'bg-sand text-steel'}`}>
                          <span className={`size-1.5 rounded-full ${u.active ? 'bg-sprout' : 'bg-ember'}`} aria-hidden="true" />
                          {u.active ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <Presence u={u} />
                      </div>
                      <dl className="mt-3 space-y-1.5 text-[13px]">
                        <div className="flex justify-between gap-3"><dt className="text-fog">Bergabung</dt><dd className="font-mono text-xs text-fg">{u.created_at ? fmtDate(u.created_at) : '—'}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-fog">Aktivitas</dt><dd className="text-muted">{lastAct(u)}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-fog">Hari ini</dt><dd>{perfCell(u)}</dd></div>
                      </dl>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-1 pt-3">
                  <p className="text-[13px] tabular-nums text-muted">
                    {filtered.length <= PAGE_SIZE
                      ? `Menampilkan ${filtered.length} dari ${filtered.length} pengguna`
                      : `Menampilkan ${pg * PAGE_SIZE + 1}–${Math.min(filtered.length, pg * PAGE_SIZE + PAGE_SIZE)} dari ${filtered.length} pengguna`}
                  </p>
                  <Pager page={pg} total={pages} onChange={setPage} className="mt-0" />
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Bottom */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-dove bg-paper p-5">
          <p className="font-medium text-fg">Aktivitas Pengguna Terbaru</p>
          <p className="mt-0.5 text-[13px] text-muted">Riwayat aktivitas akun dan kasir terbaru.</p>
          {boot ? (
            <div className="mt-4 space-y-3" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (<div key={i} className="flex items-center gap-3"><Skeleton className="size-8 rounded-full" /><Skeleton className="h-4 flex-1" /></div>))}
            </div>
          ) : feed.length === 0 ? (
            <p className="py-8 text-center text-sm text-fog">Belum ada aktivitas.</p>
          ) : (
            <>
              <ul className="mt-4 divide-y divide-dove">
                {(actAll ? feed : feed.slice(0, 5)).map((e) => (
                  <li key={e.key} className="flex items-center gap-3 py-2.5">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full ${e.kind === 'user' ? 'bg-success-bg text-sprout' : 'bg-sand text-steel'}`} aria-hidden="true">
                      {e.kind === 'user' ? <UserPlus className="size-4" /> : e.kind === 'login' ? <UserRound className="size-4" /> : <ReceiptText className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{e.text}</span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-fog">{e.label}</span>
                  </li>
                ))}
              </ul>
              {feed.length > 5 && (
                <button
                  onClick={() => setActAll((v) => !v)}
                  aria-expanded={actAll}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dove bg-paper py-2 text-[13px] font-medium transition outline-none hover:border-jet focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {actAll ? 'Ringkas' : 'Selengkapnya'}
                  {actAll ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
              )}
            </>
          )}
        </div>

        <div className="rounded-2xl border border-dove bg-paper p-5">
          <p className="font-medium text-fg">Kasir Teraktif Hari Ini</p>
          <p className="mt-0.5 text-[13px] text-muted">Daftar kasir dengan total penjualan tertinggi hari ini.</p>
          {boot ? (
            <div className="mt-4 space-y-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (<div key={i} className="flex items-center gap-3"><Skeleton className="size-7 rounded-full" /><Skeleton className="size-9 rounded-full" /><Skeleton className="h-4 flex-1" /></div>))}
            </div>
          ) : top3.length === 0 ? (
            <p className="py-8 text-center text-sm text-fog">Belum ada transaksi hari ini.</p>
          ) : (
            <>
              <ul className="mt-4 divide-y divide-dove">
                {top3.map((r, i) => (
                  <li key={r.name} className="flex items-center gap-3 py-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sand font-mono text-xs font-medium tabular-nums text-steel" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sand text-[13px] font-medium text-steel" aria-hidden="true">
                      {initials(r.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                      <span className="block text-xs tabular-nums text-fog">{r.trx} transaksi</span>
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-fg">{fmtRp(r.omzet)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-right">
                <Link to="/app/karyawan" className="text-[13px] font-medium text-fg hover:underline">
                  Lihat Semua →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="mt-4 text-[13px] text-muted">
        Passcode tiap akun diatur di <Link to="/app/pengaturan" className="font-medium text-jet hover:underline">Pengaturan</Link>.
      </p>

      <Modal open={open} title="Tambah Kasir" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          {formErr && <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{formErr}</p>}
          <Input label="Nama kasir" value={name} onChange={setName} placeholder="cth: Andi" />
          <p className="text-[13px] text-muted">Kasir tidak butuh email dan kata sandi. Setelah dibuat, ganti ke akun ini lewat menu profil di kiri bawah.</p>
          <Button className="w-full" onClick={create} disabled={busy}>{busy ? 'Membuat…' : 'Buat Akun Kasir'}</Button>
        </div>
      </Modal>

      <Modal open={!!offFor} title="Nonaktifkan akun?" onClose={() => setOffFor(null)}>
        <div className="space-y-4">
          <p className="text-sm text-muted">
            <strong className="text-fg">{offFor?.name}</strong> tidak dapat menggunakan akun ini sampai diaktifkan kembali.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOffFor(null)}>Batal</Button>
            <Button variant="danger" onClick={() => offFor && setActive(offFor, false)} disabled={offBusy}>
              {offBusy ? '…' : 'Nonaktifkan'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteFor} title={`Hapus Kasir · ${deleteFor?.name ?? ''}`} onClose={() => setDeleteFor(null)}>
        <div className="space-y-4">
          {deleteErr && <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{deleteErr}</p>}
          <p className="text-sm text-muted">
            Tindakan ini dapat menghapus akses pengguna secara permanen. Riwayat transaksi kasir ini tetap tersimpan.
          </p>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
            Ketik <span className="font-mono text-ember">Konfirmasi</span> untuk menghapus
            <input
              value={deleteTyped}
              onChange={(e) => setDeleteTyped(e.target.value)}
              placeholder="Konfirmasi"
              className="rounded-md border border-border bg-paper px-3.5 py-2.5 text-[15px] text-fg focus:border-jet focus:outline-none"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteFor(null)}>Batal</Button>
            <Button variant="danger" onClick={remove} disabled={deleteTyped !== 'Konfirmasi' || deleteBusy}>
              {deleteBusy ? 'Menghapus…' : 'Hapus Kasir'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
