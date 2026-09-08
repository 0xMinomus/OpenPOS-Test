import { useRef, useState } from 'react'
import { exportDB, replaceDB, resetDB, useLocalDB, validateImport } from '../../lib/localdb'
import { Button, PageHead } from '../../lib/ui'
import { Download, Upload } from 'lucide-react'

export default function OfflineBackup() {
  const db = useLocalDB()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  function doExport() {
    const blob = new Blob([exportDB()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `openpos-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('Backup diunduh. Simpan file ini — data semua tercakup (produk, kategori, transaksi, pengaturan).')
    setErr('')
  }

  function onImport(f: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const next = validateImport(String(reader.result))
      if (!next) {
        setErr('File bukan backup OpenPOS yang valid.')
        setMsg('')
        return
      }
      if (!confirm(`Ganti seluruh data perangkat ini dengan ${next.products.length} produk dan ${next.transactions.length} transaksi dari file backup?`)) return
      replaceDB(next)
      setErr('')
      setMsg('Backup dipulihkan. Semua data kini dari file.')
    }
    reader.readAsText(f)
  }

  return (
    <>
      <PageHead title="Backup & Restore" sub="Pindah perangkat? Simpan data ke file JSON, lalu pulihkan di perangkat lain." />

      {msg && <p className="mb-4 rounded-lg bg-surface px-3.5 py-2.5 text-[13px] text-sprout">{msg}</p>}
      {err && <p className="mb-4 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>}

      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <section className="rounded-2xl bg-cream p-6">
          <h2 className="font-mono text-xs uppercase tracking-wider text-fog">Backup</h2>
          <p className="mt-2 text-sm text-muted">
            Unduh seluruh data ({db.products.length} produk, {db.categories.length} kategori, {db.transactions.length} transaksi) sebagai satu file JSON.
          </p>
          <Button className="mt-4" onClick={doExport}><Download className="size-4" />Unduh Backup</Button>
        </section>

        <section className="rounded-2xl bg-cream p-6">
          <h2 className="font-mono text-xs uppercase tracking-wider text-fog">Restore</h2>
          <p className="mt-2 text-sm text-muted">
            Pilih file backup. Seluruh data perangkat ini akan diganti data dari file.
          </p>
          <Button variant="ghost" className="mt-4" onClick={() => fileRef.current?.click()}><Upload className="size-4" />Pilih File</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
        </section>
      </div>

      <section className="mt-4 max-w-3xl rounded-2xl border border-dove bg-cream p-6">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ember">Zona berbahaya</h2>
        <p className="mt-2 text-sm text-muted">Kosongkan semua data di perangkat ini. Tak bisa dibatalkan — backup dulu bila masih dibutuhkan.</p>
        <Button variant="danger" className="mt-4" onClick={() => { if (confirm('Hapus SEMUA data offline di perangkat ini?') && confirm('Benar-benar yakin? Data tak bisa dikembalikan.')) { resetDB(); setMsg('Semua data dihapus.'); setErr('') } }}>Reset Semua Data</Button>
      </section>

      <p className="mt-4 max-w-3xl text-[13px] text-muted">
        Tips pindah perangkat: di perangkat lama pilih <strong className="text-fg">Unduh Backup</strong>, kirim file-nya (WhatsApp/email/Drive), di perangkat baru pilih <strong className="text-fg">Restore</strong>.
      </p>
    </>
  )
}
