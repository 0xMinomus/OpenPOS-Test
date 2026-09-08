import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Download, WifiOff, HardDrive, Archive, Check } from 'lucide-react'
import Navbar from './Navbar'

export default function Unduh() {
  const deferred = useRef<{ prompt: () => void; userChoice: Promise<unknown> } | null>(null)
  const [installed, setInstalled] = useState(false)
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    if (standalone) { setInstalled(true); setCanInstall(false) }
    const onBefore = (e: Event) => {
      e.preventDefault()
      deferred.current = e as unknown as { prompt: () => void; userChoice: Promise<unknown> }
      setCanInstall(true)
    }
    const onInstalled = () => { setInstalled(true); setCanInstall(false) }
    window.addEventListener('beforeinstallprompt', onBefore)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    const ev = deferred.current
    if (!ev) return
    ev.prompt()
    await ev.userChoice
    deferred.current = null
    setCanInstall(false)
  }

  return (
    <div className="landing-light bg-bg text-fg">
      <Navbar logoTone="light" />
      <main className="container mx-auto max-w-4xl px-5 py-14 md:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-steel">Unduh · OpenPOS Offline</p>
        <h1 className="mt-3 text-[clamp(32px,5vw,48px)] font-normal leading-[1.08] tracking-[-0.025em]">
          Kasir tanpa internet,<br />data tetap aman di perangkat.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          Instal OpenPOS sebagai aplikasi di perangkat Anda. Bekerja penuh offline — produk, transaksi, dan struk
          tersimpan di perangkat. Pindah perangkat? Backup satu file JSON, pulihkan di perangkat baru.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {installed ? (
            <Link to="/app-offline" className="inline-flex items-center gap-2 rounded-full bg-jet px-7 py-3.5 text-[15px] font-medium text-paper transition hover:opacity-85">
              <Check className="size-4" />Buka Aplikasi
            </Link>
          ) : canInstall ? (
            <button onClick={install} className="inline-flex items-center gap-2 rounded-full bg-jet px-7 py-3.5 text-[15px] font-medium text-paper transition hover:opacity-85">
              <Download className="size-4" />Instal Aplikasi
            </button>
          ) : (
            <Link to="/app-offline" className="inline-flex items-center gap-2 rounded-full bg-jet px-7 py-3.5 text-[15px] font-medium text-paper transition hover:opacity-85">
              <Download className="size-4" />Buka di Browser
            </Link>
          )}
          <p className="text-[13px] text-muted">
            {installed ? 'Aplikasi sudah terpasang.' : canInstall ? 'Klik untuk pasang sebagai aplikasi.' : 'Browser tak menampilkan tombol pasang — buka dulu aplikasinya, lalu pasang dari menu browser.'}
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-dove bg-cream p-6">
            <WifiOff className="size-6 text-jet" />
            <h2 className="mt-3 font-medium">100% Offline</h2>
            <p className="mt-1 text-[13px] text-muted">Kasir, produk, dan transaksi jalan tanpa internet sama sekali.</p>
          </div>
          <div className="rounded-2xl border border-dove bg-cream p-6">
            <HardDrive className="size-6 text-jet" />
            <h2 className="mt-3 font-medium">Data di Perangkat</h2>
            <p className="mt-1 text-[13px] text-muted">Semua tersimpan lokal di perangkat Anda, bukan di server.</p>
          </div>
          <div className="rounded-2xl border border-dove bg-cream p-6">
            <Archive className="size-6 text-jet" />
            <h2 className="mt-3 font-medium">Backup JSON</h2>
            <p className="mt-1 text-[13px] text-muted">Ekspor ke file, pulihkan di perangkat lain kapan saja.</p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-dove bg-cream p-6">
          <h2 className="font-medium">Cara pindah perangkat</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
            <li>Di perangkat lama: buka app offline → menu <strong className="text-fg">Backup</strong> → <strong className="text-fg">Unduh Backup</strong>.</li>
            <li>Kirim file JSON-nya (WhatsApp, email, Google Drive).</li>
            <li>Di perangkat baru: instal app → menu <strong className="text-fg">Backup</strong> → <strong className="text-fg">Restore</strong> → pilih file.</li>
          </ol>
        </div>

        <p className="mt-10 text-[13px] text-muted">
          Terhubung internet dan punya toko online? Coba <Link to="/daftar" className="font-medium text-jet hover:underline">OpenPOS Cloud</Link> — data tersinkron antar perangkat.
        </p>
      </main>
    </div>
  )
}
