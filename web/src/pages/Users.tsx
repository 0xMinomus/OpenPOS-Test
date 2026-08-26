import { useState } from 'react'
import { fmtDate, mutate, useDB } from '../lib/store'
import { Button, Input, Modal, PageHead, Pill, Td, Th } from '../lib/ui'

export default function Users() {
  const db = useDB()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  const users = Object.values(db.accounts)

  function create() {
    setErr('')
    const em = email.trim().toLowerCase()
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setErr('Nama dan email valid wajib diisi.')
    if (db.accounts[em]) return setErr('Email sudah terdaftar.')
    if (password.length < 8) return setErr('Kata sandi minimal 8 karakter.')
    mutate((db2) => {
      db2.accounts[em] = { email: em, name: name.trim(), password, store: db2.settings.storeName, role: 'cashier', active: true, createdAt: new Date().toISOString() }
    })
    setOpen(false); setName(''); setEmail(''); setPassword('')
  }

  function toggle(id: string) {
    mutate((db2) => { const a = db2.accounts[id]; if (a && a.role === 'cashier') a.active = !a.active })
  }

  return (
    <>
      <PageHead
        title="User Management"
        sub="Kelola akun kasir toko Anda."
        right={<Button onClick={() => setOpen(true)}>+ Tambah Kasir</Button>}
      />

      <div className="overflow-x-auto rounded-2xl bg-cream p-2">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>Nama</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Bergabung</Th><Th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email}>
                <Td><span className="font-medium text-fg">{u.name}</span></Td>
                <Td mono>{u.email}</Td>
                <Td><Pill tone={u.role === 'admin' ? 'ok' : 'muted'}>{u.role === 'admin' ? 'Admin' : 'Kasir'}</Pill></Td>
                <Td><Pill tone={u.active ? 'ok' : 'warn'}>{u.active ? 'Aktif' : 'Nonaktif'}</Pill></Td>
                <Td mono>{u.createdAt ? fmtDate(u.createdAt) : '—'}</Td>
                <Td>
                  {u.role === 'cashier' && (
                    <button className="text-[13px] text-muted hover:underline" onClick={() => toggle(u.email)}>
                      {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} title="Tambah Kasir" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          {err && <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{err}</p>}
          <Input label="Nama" value={name} onChange={setName} placeholder="Nama kasir" />
          <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="kasir@tokosaya.com" />
          <Input label="Kata sandi" type="password" value={password} onChange={setPassword} placeholder="Minimal 8 karakter" />
          <Button className="w-full" onClick={create}>Buat Akun Kasir</Button>
        </div>
      </Modal>
    </>
  )
}