import { useEffect, useState } from 'react'
import { apiCreateUser, apiListUsers, apiSetUserActive, type User } from '../lib/api'
import { fmtDate, useDB } from '../lib/store'
import { Button, Input, Modal, PageHead, Pill, Td, Th } from '../lib/ui'

export default function Users() {
  const db = useDB()
  const s = db.session!
  const [data, setData] = useState<User[] | null>(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formErr, setFormErr] = useState('')
  const [busy, setBusy] = useState(false)

  function load() {
    setErr('')
    apiListUsers().then(setData).catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat pengguna.'))
  }
  useEffect(() => { load() }, [])

  async function create() {
    setFormErr('')
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setFormErr('Nama dan email valid wajib diisi.')
    if (password.length < 8) return setFormErr('Kata sandi minimal 8 karakter.')
    setBusy(true)
    try {
      await apiCreateUser({ name: name.trim(), email: email.trim().toLowerCase(), password })
      setOpen(false); setName(''); setEmail(''); setPassword('')
      load()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Gagal membuat akun.')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(u: User) {
    try {
      await apiSetUserActive(u.id, !u.active)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal mengubah status.')
    }
  }

  return (
    <>
      <PageHead
        title="User Management"
        sub="Kelola akun kasir toko Anda."
        right={<Button onClick={() => setOpen(true)}>+ Tambah Kasir</Button>}
      />

      {err && <p className="mb-4 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>}

      <div className="overflow-x-auto rounded-2xl bg-cream p-2">
        {!data ? (
          <p className="py-14 text-center text-sm text-fog">Memuat…</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>Nama</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Bergabung</Th><Th />
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <Td><span className="font-medium text-fg">{u.name}</span></Td>
                  <Td mono>{u.email}</Td>
                  <Td><Pill tone={u.role === 'admin' ? 'ok' : 'muted'}>{u.role === 'admin' ? 'Admin' : 'Kasir'}</Pill></Td>
                  <Td><Pill tone={u.active ? 'ok' : 'warn'}>{u.active ? 'Aktif' : 'Nonaktif'}</Pill></Td>
                  <Td mono>{fmtDate(u.created_at)}</Td>
                  <Td>
                    {u.role === 'cashier' && u.id !== s.id && (
                      <button className="text-[13px] text-muted hover:underline" onClick={() => toggle(u)}>
                        {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} title="Tambah Kasir" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          {formErr && <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{formErr}</p>}
          <Input label="Nama" value={name} onChange={setName} placeholder="Nama kasir" />
          <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="kasir@tokosaya.com" />
          <Input label="Kata sandi" type="password" value={password} onChange={setPassword} placeholder="Minimal 8 karakter" />
          <Button className="w-full" onClick={create} disabled={busy}>{busy ? 'Membuat…' : 'Buat Akun Kasir'}</Button>
        </div>
      </Modal>
    </>
  )
}