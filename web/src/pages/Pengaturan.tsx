import { useState } from 'react'
import { mutate, useDB } from '../lib/store'
import { Button, Input, PageHead } from '../lib/ui'

export default function Pengaturan() {
  const db = useDB()
  const st = db.settings
  const [form, setForm] = useState({ ...st })
  const [passcodes, setPasscodes] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.values(db.accounts).map((a) => [a.email, a.passcode ?? ''])),
  )
  const [passcodeMsg, setPasscodeMsg] = useState('')

  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v })

  function save() {
    mutate((d) => { Object.assign(d.settings, form) })
    alert('Pengaturan disimpan.')
  }

  function savePasscode(email: string) {
    const pc = passcodes[email] ?? ''
    if (pc && !/^\d{5}$/.test(pc)) {
      setPasscodeMsg(`Passcode harus 5 angka.`)
      return
    }
    mutate((d) => {
      const a = d.accounts[email]
      if (a) {
        if (pc) a.passcode = pc
        else delete a.passcode
      }
    })
    setPasscodeMsg('Passcode disimpan.')
  }

  return (
    <>
      <PageHead title="Pengaturan" sub="Konfigurasi toko, struk, dan pajak." />
      <div className="max-w-xl space-y-6">
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
          <p className="mb-4 text-[13px] text-muted">Passcode 5 angka diminta saat login atau ganti akun. Kosongkan untuk menonaktifkan.</p>
          <div className="space-y-3">
            {Object.values(db.accounts).map((a) => (
              <div key={a.email} className="flex flex-wrap items-center gap-3 rounded-lg border border-dove bg-paper px-3.5 py-2.5">
                <div className="min-w-36 flex-1">
                  <p className="text-sm font-medium text-fg">{a.name}</p>
                  <p className="font-mono text-[11px] text-fog">{a.role === 'admin' ? 'Admin' : 'Kasir'} · {a.email}</p>
                </div>
                <input
                  value={passcodes[a.email] ?? ''}
                  onChange={(e) => setPasscodes({ ...passcodes, [a.email]: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                  inputMode="numeric"
                  placeholder="5 angka"
                  aria-label={`Passcode ${a.name}`}
                  className="w-28 rounded-md border border-border bg-paper px-3 py-2 text-center font-mono tracking-[0.3em] focus:border-jet focus:outline-none"
                />
                <Button variant="ghost" className="!px-4 !py-1.5 text-xs" onClick={() => savePasscode(a.email)}>Simpan</Button>
              </div>
            ))}
          </div>
          {passcodeMsg && <p className="mt-3 text-xs text-sprout">{passcodeMsg}</p>}
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
          <p className="text-sm text-muted">Currency: <strong className="text-fg">IDR (Rupiah)</strong> — default, tidak dapat diubah pada MVP. Data demo disimpan lokal di browser Anda (localStorage), tidak ada backend.</p>
        </section>

        <Button onClick={save}>Simpan Pengaturan</Button>
      </div>
    </>
  )
}