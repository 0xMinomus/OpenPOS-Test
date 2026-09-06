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
  const cbRef = useRef(onToken)
  cbRef.current = onToken
  const clientId = getGoogleClientId()

  useEffect(() => {
    if (!clientId) return
    let dead = false
    loadGsi()
      .then(() => {
        if (dead || !ref.current) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp: { credential?: string }) => { if (resp?.credential) cbRef.current(resp.credential) },
        })
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard', theme: 'outline', size: 'large', width: 320, text, locale: 'id',
        })
      })
      .catch(() => { if (!dead) setLoadErr('Gagal memuat login Google. Periksa koneksi lalu muat ulang.') })
    return () => { dead = true }
  }, [clientId, text])

  if (!clientId) {
    return (
      <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">
        Login Google belum dikonfigurasi (VITE_GOOGLE_CLIENT_ID kosong).
      </p>
    )
  }
  return (
    <div className="flex flex-col items-center gap-2">
      {busy && <p className="text-[13px] text-muted">Memproses login Google…</p>}
      <div ref={ref} aria-label="Login dengan Google" className="flex justify-center" />
      {loadErr && <p className="text-[13px] text-ember">{loadErr}</p>}
    </div>
  )
}
