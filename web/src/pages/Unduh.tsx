import { useState } from 'react'
import { Link } from 'react-router'
import { Download, MonitorDown, HardDrive, Archive, ArrowRight, ShieldCheck } from 'lucide-react'
import Navbar from './Navbar'

const REPO = '0xMinomus/OpenPOS-Test'
const RELEASES_URL = `https://github.com/${REPO}/releases`

const FEATURES = [
  {
    icon: MonitorDown,
    title: 'Aplikasi desktop asli',
    sub: 'Terpasang seperti program biasa. Buka dari desktop, tanpa browser.',
  },
  {
    icon: HardDrive,
    title: 'Data aman di perangkat',
    sub: 'Produk dan transaksi tersimpan lokal di komputer kasir Anda.',
  },
  {
    icon: Archive,
    title: 'Backup satu file',
    sub: 'Pindah perangkat tinggal ekspor JSON, lalu pulihkan di komputer baru.',
  },
]

const STEPS = [
  { n: '1', t: 'Unduh installer', d: 'Klik tombol, versi terbaru langsung terunduh.' },
  { n: '2', t: 'Pasang & buat akun', d: 'Install, isi nama pemilik dan nama toko.' },
  { n: '3', t: 'Mulai jualan', d: 'Tambah produk, layani pelanggan, cetak struk.' },
]

export default function Unduh() {
  const [busy, setBusy] = useState(false)
  const [dlErr, setDlErr] = useState('')

  async function downloadLatest() {
    if (busy) return
    setBusy(true)
    setDlErr('')
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      if (!res.ok) throw new Error(String(res.status))
      const rel = await res.json()
      const asset = (rel.assets ?? []).find((a: { name: string }) => /\.exe$/i.test(a.name))
      if (!asset?.browser_download_url) throw new Error('no-asset')
      window.location.href = asset.browser_download_url
    } catch {
      setDlErr('Gagal mengambil versi terbaru.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="landing-light bg-bg text-fg">
      <style>{`
        @keyframes ud-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        .ud-reveal { opacity: 0; animation: ud-rise 0.6s cubic-bezier(0.2, 0, 0, 1) both; }
        .ud-1 { animation-delay: 0.05s; }
        .ud-2 { animation-delay: 0.15s; }
        .ud-3 { animation-delay: 0.25s; }
        .ud-4 { animation-delay: 0.35s; }
        .ud-5 { animation-delay: 0.45s; }
        @media (prefers-reduced-motion: reduce) { .ud-reveal { animation: none; opacity: 1; } }
      `}</style>
      <Navbar logoTone="light" />
      <main>
        <section className="overflow-hidden pt-[clamp(40px,5vw,88px)] pb-12">
          <div className="container mx-auto max-w-4xl px-5 text-center md:px-8">
            <p className="ud-reveal ud-1 font-mono text-xs uppercase tracking-widest text-steel">Unduh · OpenPOS Desktop</p>
            <h1 className="ud-reveal ud-2 mx-auto mt-4 max-w-3xl text-[clamp(32px,6vw,56px)] font-normal leading-[1.05] tracking-[-0.025em]">
              Kasir Windows yang jalan tanpa internet.
            </h1>
            <p className="ud-reveal ud-3 mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Pasang OpenPOS di komputer kasir Anda. Semua data tersimpan di perangkat,
              transaksi tetap jalan walau koneksi mati. Pindah komputer? Cukup pindahkan satu file backup.
            </p>
            <div className="ud-reveal ud-4 mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={downloadLatest}
                disabled={busy}
                className="group inline-flex items-center gap-2 rounded-full bg-jet px-7 py-3.5 text-[15px] font-medium text-paper transition hover:opacity-85 active:translate-y-px disabled:opacity-60"
              >
                <Download className="size-4 transition-transform group-hover:translate-y-0.5" />
                {busy ? 'Menyiapkan…' : 'Unduh untuk Windows'}
              </button>
              <span className="text-[13px] text-muted">Installer .exe · Windows 10/11 64-bit · versi terbaru otomatis</span>
              {dlErr && (
                <p className="w-full text-center text-[13px] text-ember">
                  {dlErr}{' '}
                  <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="font-medium text-jet hover:underline">
                    Buka halaman rilis
                  </a>
                  .
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="container mx-auto max-w-5xl px-5 pb-16 md:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`ud-reveal ud-${i + 2} rounded-2xl border border-dove bg-cream p-6`}>
                <span className="grid size-10 place-items-center rounded-xl bg-jet text-paper">
                  <f.icon className="size-5" />
                </span>
                <h2 className="mt-4 font-medium">{f.title}</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{f.sub}</p>
              </div>
            ))}
          </div>

          <div className="ud-reveal ud-4 mt-12 rounded-2xl border border-dove bg-cream p-6 md:p-8">
            <h2 className="font-medium">Mulai dalam tiga langkah</h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface font-mono text-sm text-jet ring-1 ring-dove">{s.n}</span>
                  <div>
                    <p className="text-sm font-medium">{s.t}</p>
                    <p className="mt-0.5 text-[13px] text-muted">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ud-reveal ud-5 mt-12 flex flex-wrap items-center gap-3 rounded-2xl border border-dove bg-cream p-6">
            <ShieldCheck className="size-6 shrink-0 text-sprout" />
            <p className="flex-1 text-sm text-muted">
              Butuh data tersinkron antar perangkat otomatis? Coba{' '}
              <Link to="/daftar" className="inline-flex items-center gap-1 font-medium text-jet hover:underline">
                OpenPOS Cloud <ArrowRight className="size-3.5" />
              </Link>
              {' '}yang berjalan di browser.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
