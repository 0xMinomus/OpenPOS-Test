import { useEffect, useState } from 'react'
import { apiGetSettings, apiListUsers, apiSetPasscode, apiUpdateSettings, type StoreSettings, type User } from '../lib/api'
import { Button, Input, PageHead } from '../lib/ui'

export default function Pengaturan() {
  const [form, setForm] = useState<StoreSettings | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [passcodes, setPasscodes] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    apiGetSettings().then(setForm).catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat pengaturan.'))
    apiListUsers().then((u) => {
      setUsers(u)
      setPasscodes(Object.fromEntries(u.map((x) => [x.id, ''])))
    }).catch(() => {})
  }, [])

  const set = (k: keyof StoreSettings) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f))

  async function save() {
    if (!form) return
    setMsg(''); setErr(''); setBusy(true)
    try {
      const saved = await apiUpdateSettings(form)
      setForm(saved)
      setMsg('Pengaturan disimpan.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan.')
    } finally {
      setBusy(false)
    }
  }

  async function savePasscode(u: User) {
    const pc = passcodes[u.id] ?? ''
    if (pc && !/^\d{5}$/.test(pc)) return setErr('Passcode harus 5 angka.')
    setMsg(''); setErr(''); setBusy(true)
    try {
      await apiSetPasscode(u.id, pc)
      setPasscodes({ ...passcodes, [u.id]: '' })
      setMsg(pc ? 'Passcode disimpan.' : 'Passcode dihapus.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan passcode.')
    } finally {
      setBusy(false)
    }
  }

  if (!form) return <p className="py-14 text-center text-sm text-fog">Memuat…</p>

  return (
    <>
      <PageHead title="Pengaturan" sub="Konfigurasi toko, struk, dan pajak." />
      <div className="max-w-xl space-y-6">
        {err && <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>}
        {msg && <p className="rounded-lg bg-surface px-3.5 py-2.5 text-[13px] text-sprout">{msg}</p>}

        <section className="rounded-2xl bg-cream p-6">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-fog">Profil toko</h2>
          <div className="space-y-4">
            <Input label="Nama toko" value={form.storeName} onChange={set('storeName')} />
            <Input label="Alamat" value={form.address} onChange={set('address')} />
            <Input label="Telepon" value={form.phone} onChange={set('phone')} />
            <Input label="Timezone" value={form.timezone} onChange={set('timezone')} />
          </div>
        </section>

        <section className="rounded-2xl bg-cream p-6">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-fog">Struk</h2>
          <div className="space-y-4">
            <Input label="Header struk" value={form.receiptHeader} onChange={set('receiptHeader')} />
            <Input label="Footer struk" value={form.receiptFooter} onChange={set('receiptFooter')} />
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
              Ukuran kertas default
              <select value={form.paper} onChange={(e) => set('paper')(e.target.value)} className="rounded-md border border-border bg-paper px-3.5 py-2.5 text-[15px] focus:border-jet focus:outline-none">
                <option value="58mm">58 mm</option>
                <option value="80mm">80 mm</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-2xl bg-cream p-6">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-fog">Passcode akun</h2>
          <p className="mb-4 text-[13px] text-muted">Passcode 5 angka diminta saat login. Kosongkan lalu simpan untuk menonaktifkan.</p>
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-dove bg-paper px-3.5 py-2.5">
                <div className="min-w-36 flex-1">
                  <p className="text-sm font-medium text-fg">{u.name}</p>
                  <p className="font-mono text-[11px] text-fog">{u.role === 'admin' ? 'Admin' : 'Kasir'} · {u.email}</p>
                </div>
                <input
                  value={passcodes[u.id] ?? ''}
                  onChange={(e) => setPasscodes({ ...passcodes, [u.id]: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                  inputMode="numeric"
                  placeholder="5 angka"
                  aria-label={`Passcode ${u.name}`}
                  className="w-28 rounded-md border border-border bg-paper px-3 py-2 text-center font-mono tracking-[0.3em] focus:border-jet focus:outline-none"
                />
                <Button variant="ghost" className="!px-4 !py-1.5 text-xs" onClick={() => savePasscode(u)} disabled={busy}>Simpan</Button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-cream p-6">
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input type="checkbox" checked={form.taxEnabled} onChange={(e) => setForm({ ...form, taxEnabled: e.target.checked })} className="h-4 w-4 accent-jet" />
              Aktifkan pajak transaksi
            </label>
            {form.taxEnabled && <Input label="Persentase pajak (%)" type="number" value={form.taxPct} onChange={set('taxPct')} />}
          </div>
        </section>

        <section className="rounded-2xl bg-cream p-6">
          <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-fog">Informasi</h2>
          <p className="text-sm text-muted">Currency: <strong className="text-fg">IDR (Rupiah)</strong> — default, tidak dapat diubah pada MVP. Data tersimpan aman di server.</p>
        </section>

        <Button onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan Pengaturan'}</Button>
      </div>
    </>
  )
}