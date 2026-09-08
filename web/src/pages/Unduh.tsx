import { Link } from 'react-router'
import { Download, MonitorDown, HardDrive, Archive, Check } from 'lucide-react'
import Navbar from './Navbar'

const WINDOWS_DOWNLOAD_URL = 'https://github.com/0xMinomus/OpenPOS-Test/releases'

export default function Unduh() {
  return (
    <div className="landing-light bg-bg text-fg">
      <Navbar logoTone="light" />
      <main className="container mx-auto max-w-4xl px-5 py-14 md:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-steel">Unduh · OpenPOS Offline</p>
        <h1 className="mt-3 text-[clamp(32px,5vw,48px)] font-normal leading-[1.08] tracking-[-0.025em]">
          Kasir native untuk Windows,<br />jalan tanpa internet.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          Pasang OpenPOS sebagai aplikasi desktop di komputer kasir Anda. Bekerja penuh offline — produk,
          transaksi, dan struk tersimpan di perangkat. Pindah komputer? Backup satu file JSON, pulihkan di
          perangkat baru.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={WINDOWS_DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-jet px-7 py-3.5 text-[15px] font-medium text-paper transition hover:opacity-85"
          >
            <Download className="size-4" />Unduh untuk Windows
          </a>
          <p className="text-[13px] text-muted">Installer .exe · Windows 10/11 (64-bit)</p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-dove bg-cream p-6">
            <MonitorDown className="size-6 text-jet" />
            <h2 className="mt-3 font-medium">Aplikasi Desktop</h2>
            <p className="mt-1 text-[13px] text-muted">Terpasang seperti program biasa, buka dari desktop tanpa browser.</p>
          </div>
          <div className="rounded-2xl border border-dove bg-cream p-6">
            <HardDrive className="size-6 text-jet" />
            <h2 className="mt-3 font-medium">Data di Perangkat</h2>
            <p className="mt-1 text-[13px] text-muted">Semua tersimpan lokal di komputer Anda, bukan di server.</p>
          </div>
          <div className="rounded-2xl border border-dove bg-cream p-6">
            <Archive className="size-6 text-jet" />
            <h2 className="mt-3 font-medium">Backup JSON</h2>
            <p className="mt-1 text-[13px] text-muted">Ekspor ke file, pulihkan di komputer lain kapan saja.</p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-dove bg-cream p-6">
          <h2 className="font-medium">Cara pindah perangkat</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
            <li>Di komputer lama: buka aplikasi → menu <strong className="text-fg">Backup</strong> → <strong className="text-fg">Unduh Backup</strong>.</li>
            <li>Kirim file JSON-nya (flashdisk, WhatsApp, Google Drive).</li>
            <li>Di komputer baru: pasang aplikasi → menu <strong className="text-fg">Backup</strong> → <strong className="text-fg">Restore</strong> → pilih file.</li>
          </ol>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-2 rounded-2xl border border-dove bg-cream p-6">
          <Check className="size-5 text-sprout" />
          <p className="text-sm text-muted">
            Butuh data tersinkron antar perangkat? Coba{' '}
            <Link to="/daftar" className="font-medium text-jet hover:underline">OpenPOS Cloud</Link> — berjalan di browser, data di server.
          </p>
        </div>
      </main>
    </div>
  )
}
