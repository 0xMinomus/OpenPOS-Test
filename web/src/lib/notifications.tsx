import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Bell, Boxes, ChevronRight, Info, PackageX, ReceiptText } from 'lucide-react'
import {
  apiDeleteNotif,
  apiGetNotifUnreadCount,
  apiListNotifications,
  apiMarkAllNotifsRead,
  apiMarkNotifRead,
  type NotifCategory,
  type Notification,
} from './api'
import { fmtDate, useDB } from './store'
import { Skeleton } from '@/components/ui/skeleton'

export type NotifTab = 'all' | NotifCategory

const TABS: { id: NotifTab; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'stok', label: 'Stok' },
  { id: 'transaksi', label: 'Transaksi' },
  { id: 'sistem', label: 'Sistem' },
]

const PAGE_SIZE = 10

// Batas simpan per jenis notifikasi.
const MAX_PER_TYPE = 10

const STOK_TYPES = new Set(['low_stock', 'out_of_stock', 'restock', 'stock_low', 'stock_out'])

// Kategori turunan untuk payload lama yang belum kirim `category`.
export function categoryOf(n: Notification): NotifCategory {
  if (n.category) return n.category
  const t = (n.type ?? '').toLowerCase()
  if (STOK_TYPES.has(t) || t.startsWith('stock') || t.startsWith('stok')) return 'stok'
  if (
    t.startsWith('transaction') || t.startsWith('transaksi') || t.startsWith('refund') ||
    t.startsWith('void') || t.startsWith('discount') || t === 'large_transaction'
  ) return 'transaksi'
  return 'sistem'
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (isNaN(t)) return ''
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return 'Baru saja'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} mnt lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} hari lalu`
  return fmtDate(iso)
}

const CAT_STYLE: Record<NotifCategory, { icon: typeof Boxes; box: string }> = {
  stok: { icon: Boxes, box: 'bg-sunbeam/15 text-sunbeam' },
  transaksi: { icon: ReceiptText, box: 'bg-success-bg text-sprout' },
  sistem: { icon: Info, box: 'bg-sand text-steel' },
}

// Derajat stok: backend belum bedakan menipis/habis (selalu
// `low_stock` + judul sama) — turunkan dari sisa di pesan
// ("tersisa 0 unit" = habis). Hapus bila kontrak §6 live.
// ponytail: regex spesifik format backend; fallback menipis.
const OUT_TYPES = new Set(['out_of_stock', 'stock_out'])
export function stockSeverity(n: Notification): 'habis' | 'menipis' {
  const t = (n.type ?? '').toLowerCase()
  if (OUT_TYPES.has(t)) return 'habis'
  const m = /tersisa\s+(\d+)/i.exec(n.message ?? '')
  if (m && Number(m[1]) === 0) return 'habis'
  return 'menipis'
}

export function displayTitle(n: Notification): string {
  if (categoryOf(n) === 'stok') return stockSeverity(n) === 'habis' ? 'Stok habis' : 'Stok menipis'
  return n.title
}

const EMPTY_SUB: Record<NotifTab, string> = {
  all: 'Aktivitas stok, transaksi kasir, dan sistem akan muncul di sini.',
  stok: 'Belum ada peringatan stok menipis atau habis.',
  transaksi: 'Belum ada aktivitas transaksi dari kasir.',
  sistem: 'Belum ada pemberitahuan sistem.',
}

export function NotifBell() {
  const { session } = useDB()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<NotifTab>('all')
  const [items, setItems] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [fetched, setFetched] = useState(0)
  const [page, setPage] = useState(1)
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const cleaning = useRef(false)

  // Admin saja; kasir tak punya panel ini.
  const isAdmin = session?.role === 'admin'

  // Batas 10 per jenis: hapus kelebihan terlama. Best-effort client;
  // enforcement beneran di server (kontrak §9).
  async function enforceCap() {
    if (cleaning.current) return
    cleaning.current = true
    try {
      // ponytail: scan max 5 halaman (1000 item); volume UMKM jauh di bawah.
      const pool: Notification[] = []
      for (let page = 1; page <= 5; page++) {
        const d = await apiListNotifications({ page, limit: 200 })
        pool.push(...d.items)
        if (d.items.length === 0 || pool.length >= d.total) break
      }
      pool.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      const kept = new Map<string, number>()
      const del: (number | string)[] = []
      for (const n of pool) {
        const k = (n.type ?? '').toLowerCase() || 'unknown'
        const c = kept.get(k) ?? 0
        if (c < MAX_PER_TYPE) kept.set(k, c + 1)
        else del.push(n.id)
      }
      for (const id of del) {
        try { await apiDeleteNotif(id) } catch { /* best-effort */ }
      }
      if (del.length > 0) {
        setTick((t) => t + 1)
        apiGetNotifUnreadCount().then((c) => setUnread(c)).catch(() => {})
      }
    } catch {
      // best-effort; panel tetap tampil apa adanya
    } finally {
      cleaning.current = false
    }
  }

  // Badge unread, poll 60 dtk (bukan realtime).
  useEffect(() => {
    if (!isAdmin) return
    let dead = false
    enforceCap()
    let timer: ReturnType<typeof setTimeout>
    const poll = () => {
      apiGetNotifUnreadCount()
        .then((c) => { if (!dead) setUnread(c) })
        .catch(() => {})
        .finally(() => { if (!dead) timer = setTimeout(poll, 60_000) })
    }
    poll()
    return () => { dead = true; clearTimeout(timer) }
  }, [isAdmin])

  // Daftar per tab + halaman.
  useEffect(() => {
    if (!isAdmin) return
    let dead = false
    const first = page === 1
    if (first) setLoading(true)
    else setMore(true)
    setErr('')
    apiListNotifications({ page, limit: PAGE_SIZE, category: tab === 'all' ? undefined : tab })
      .then((d) => {
        if (dead) return
        // Backend lama abaikan param `category` (semua tab dapat semua
        // item) — saring di client. No-op bila backend kontrak §2 live.
        const shown = tab === 'all' ? d.items : d.items.filter((x) => categoryOf(x) === tab)
        setItems((xs) => (first ? shown : [...xs, ...shown]))
        setTotal(d.total)
        setFetched((c) => (first ? d.items.length : c + d.items.length))
      })
      .catch((e) => { if (!dead && first) setErr(e instanceof Error ? e.message : 'Gagal memuat notifikasi.') })
      .finally(() => { if (!dead) { setLoading(false); setMore(false) } })
    return () => { dead = true }
  }, [isAdmin, tab, page, tick])

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
  }, [open])

  if (!isAdmin) return null

  function pickTab(t: NotifTab) {
    if (t === tab) return
    setTab(t)
    setPage(1)
    setFetched(0)
  }

  function toggle() {
    setOpen((o) => {
      if (!o) {
        // buka = segarkan halaman pertama tab aktif + tegakkan batas 10/jenis
        setPage(1)
        setFetched(0)
        setTick((t) => t + 1)
        enforceCap()
      }
      return !o
    })
  }

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
    const cat = categoryOf(n)
    setOpen(false)
    if (cat === 'stok') nav('/app/stok')
    else if (cat === 'transaksi') nav('/app/transaksi')
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

  const hasMore = fetched < total

  return (
    <div ref={box} className="relative">
      <button
        onClick={toggle}
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
        <div
          role="dialog"
          aria-label="Notifikasi"
          className="absolute right-0 top-full z-50 mt-2 flex max-h-[70vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-dove bg-paper shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
            <p className="text-sm font-medium text-fg">Notifikasi</p>
            {unread > 0 && (
              <button onClick={readAll} className="rounded text-xs text-muted transition outline-none hover:text-fg hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div role="tablist" aria-label="Filter kategori" className="mx-4 mb-1 flex gap-1 rounded-lg bg-surface p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={t.id === tab}
                onClick={() => pickTab(t.id)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs transition outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  t.id === tab ? 'bg-paper font-medium text-fg shadow-sm' : 'text-muted hover:text-fg'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
            {loading ? (
              <div className="space-y-1 px-4 py-3" aria-label="Memuat notifikasi">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-3 py-2">
                    <Skeleton className="size-9 shrink-0 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : err ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-fg">Gagal memuat notifikasi.</p>
                <p className="mt-1 text-[13px] text-muted">{err}</p>
                <button
                  onClick={() => setTick((t) => t + 1)}
                  className="mt-3 rounded-lg border border-dove bg-paper px-4 py-1.5 text-sm text-fg transition outline-none hover:border-jet focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Coba lagi
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-surface text-fog">
                  <Bell className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-medium text-fg">Belum ada notifikasi</p>
                <p className="mx-auto mt-1 max-w-60 text-[13px] leading-snug text-muted">{EMPTY_SUB[tab]}</p>
              </div>
            ) : (
              <ul className="divide-y divide-dove">
                {items.map((n) => (
                  <NotifItem key={String(n.id)} n={n} onOpen={() => readOne(n)} />
                ))}
              </ul>
            )}
            {more && (
              <p role="status" className="px-4 py-2 text-center font-mono text-[11px] text-fog">
                Memuat…
              </p>
            )}
          </div>

          {!loading && !err && (hasMore || tab !== 'all') && (
            <div className="border-t border-dove px-4 py-2.5">
              {hasMore ? (
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={more}
                  className="w-full rounded-lg py-1.5 text-center text-[13px] font-medium text-fg transition outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {more ? 'Memuat…' : `Muat lebih banyak (${total - fetched} lagi)`}
                </button>
              ) : (
                <button
                  onClick={() => pickTab('all')}
                  className="w-full rounded-lg py-1.5 text-center text-[13px] font-medium text-fg transition outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Lihat semua notifikasi
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NotifItem({ n, onOpen }: { n: Notification; onOpen: () => void }) {
  const cat = categoryOf(n)
  const sev = cat === 'stok' ? stockSeverity(n) : null
  const { icon: Icon, box } = sev === 'habis'
    ? { icon: PackageX, box: 'bg-ember/10 text-ember' }
    : CAT_STYLE[cat]
  const title = displayTitle(n)
  return (
    <li>
      <button
        onClick={onOpen}
        aria-label={`${title}${n.read ? '' : ', belum dibaca'}`}
        className={`group flex w-full items-start gap-3 px-4 py-3 text-left transition outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
          n.read ? '' : 'bg-surface/60'
        }`}
      >
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${box}`} aria-hidden="true">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${n.read ? 'text-fg' : 'font-medium text-fg'}`}>
            {title}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted">
            {n.actor_name ? `${n.actor_name} — ${n.message}` : n.message}
          </span>
          <span title={`${fmtDate(n.created_at)}`} className="mt-1 block font-mono text-[11px] tabular-nums text-fog">
            {timeAgo(n.created_at)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end justify-between self-stretch py-0.5" aria-hidden="true">
          <span className={`size-2 rounded-full ${n.read ? 'bg-transparent' : 'bg-ember'}`} />
          <ChevronRight className="size-4 text-fog opacity-0 transition group-hover:opacity-100" />
        </span>
      </button>
    </li>
  )
}
