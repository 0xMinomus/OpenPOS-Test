import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window { google?: any }
}

export function getGoogleClientId(): string | undefined {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
}

function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[data-gsi]')) {
      const iv = setInterval(() => {
        if (window.google?.accounts?.id) { clearInterval(iv); resolve() }
      }, 100)
      setTimeout(() => { clearInterval(iv); reject(new Error('Gagal memuat login Google.')) }, 10000)
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.dataset.gsi = '1'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Gagal memuat login Google.'))
    document.head.appendChild(s)
  })
}

export function GoogleButton({ onToken, busy, text }: { onToken: (credential: string) => void; busy: boolean; text: 'signin_with' | 'signup_with' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [loadErr, setLoadErr] = useState('')
  const [ready, setReady] = useState(false)
  const cbRef = useRef(onToken)
  cbRef.current = onToken
  const clientId = getGoogleClientId()

  useEffect(() => {
    if (!clientId) return
    let dead = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let mo: MutationObserver | undefined
    const markReady = (delay: number) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { if (!dead) setReady(true) }, delay)
    }
    loadGsi()
      .then(() => {
        if (dead || !ref.current) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp: { credential?: string }) => { if (resp?.credential) cbRef.current(resp.credential) },
        })
        // Overlay dipertahankan sampai iframe tombol selesai muat + font
        // di dalamnya stabil — renderButton kembali langsung padahal
        // iframe masih memuat font secara async.
        const box = ref.current
        mo = new MutationObserver(() => {
          const frame = box.querySelector('iframe')
          if (!frame) return
          mo?.disconnect()
          frame.addEventListener('load', () => markReady(900), { once: true })
          markReady(5000)
        })
        mo.observe(box, { childList: true })
        window.google.accounts.id.renderButton(box, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'pill',
          width: Math.round(box.clientWidth) || 320, text, locale: 'id',
        })
        markReady(8000)
      })
      .catch(() => { if (!dead) setLoadErr('Gagal memuat login Google. Periksa koneksi lalu muat ulang.') })
    return () => { dead = true; if (timer) clearTimeout(timer); mo?.disconnect() }
  }, [clientId, text])

  if (!clientId) {
    return (
      <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">
        Login Google belum dikonfigurasi (VITE_GOOGLE_CLIENT_ID kosong).
      </p>
    )
  }
  return (
    <div className="w-full">
      {busy && <p className="mb-2 text-center text-[13px] text-muted">Memproses login Google…</p>}
      <div className="relative w-full" aria-busy={!ready} aria-label="Login dengan Google">
        {!ready && <div className="absolute inset-0 animate-pulse rounded-full border border-dove bg-surface" aria-hidden="true" />}
        <div ref={ref} className="flex h-12 items-center justify-center" />
      </div>
      {loadErr && <p className="mt-2 text-center text-[13px] text-ember">{loadErr}</p>}
    </div>
  )
}
