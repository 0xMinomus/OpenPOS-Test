import { useEffect, useRef, useState } from 'react'

// Cache GET sederhana pola stale-while-revalidate: buka halaman langsung
// render data kunjungan terakhir, lalu refresh diam-diam di latar belakang.
// Setiap mount tetap fetch penuh, jadi data selalu segar — cache hanya
// mempercepat paint awal. Key wajib menyertakan identitas sesi agar data
// tak bocor antar akun/toko saat ganti akun.
const TTL = 60_000
const store = new Map<string, { data: unknown; at: number }>()

function read<T>(key: string): T | null {
  const hit = store.get(key)
  if (!hit || Date.now() - hit.at > TTL) return null
  return hit.data as T
}

export function useCache<T>(key: string, fn: () => Promise<T>, errMsg = 'Gagal memuat data.'): {
  data: T | null
  err: string
  loading: boolean
  reload: () => void
  mutate: (d: T) => void
} {
  const [data, setData] = useState<T | null>(() => read<T>(key))
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState<boolean>(() => read<T>(key) === null)
  const [tick, setTick] = useState(0)
  const prevKey = useRef(key)
  useEffect(() => {
    let dead = false
    if (prevKey.current !== key) {
      // Ganti filter/halaman: data lama tetap tampil tapi status wajib jujur
      // loading agar UI bisa kasih umpan balik (mount/remount tak berubah).
      prevKey.current = key
      setLoading(true)
      setErr('')
    } else if (read<T>(key) === null) setLoading(true)
    fn()
      .then((d) => {
        store.set(key, { data: d, at: Date.now() })
        if (!dead) { setData(d); setErr(''); setLoading(false) }
      })
      .catch((e) => {
        if (!dead) { setErr(e instanceof Error ? e.message : errMsg); setLoading(false) }
      })
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick])
  return {
    data,
    err,
    loading,
    reload: () => setTick((t) => t + 1),
    mutate: (d: T) => { store.set(key, { data: d, at: Date.now() }); setData(d) },
  }
}
