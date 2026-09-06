import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { apiCreateUser, apiListUsers, apiSetUserActive, setCachedAccounts, type User } from '../lib/api'
import { fmtDate, useDB } from '../lib/store'
import { Button, Input, Modal, PageHead, Pill, Td, Th } from '../lib/ui'

export default function Users() {
  const db = useDB()
  const s = db.session!
  const [data, setData] = useState<User[] | null>(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [formErr, setFormErr] = useState('')
  const [busy, setBusy] = useState(false)

  function load() {
    setErr('')
    apiListUsers()
      .then((users) => { setData(users); setCachedAccounts(users) })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat pengguna.'))
  }
  useEffect(() => { load() }, [])

  async function create() {
    setFormErr('')
    if (!name.trim()) return setFormErr('Nama kasir wajib diisi.')
    setBusy(true)
    try {
      await apiCreateUser({ name: name.trim() })
      setOpen(false); setName('')
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
        sub="Tambah kasir tanpa email — mereka tidak perlu login, cukup ganti akun dari menu profil."
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
                <Th>Nama</Th><Th>Role</Th><Th>Status</Th><Th>Bergabung</Th><Th />
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={`${u.role}-${u.id}`}>
                  <Td>
                    <span className="font-medium text-fg">{u.name}</span>
                    {u.id === s.id && <span className="ml-2 text-[11px] text-fog">(Anda)</span>}
                  </Td>
                  <Td><Pill tone={u.role === 'admin' ? 'ok' : 'muted'}>{u.role === 'admin' ? 'Admin' : 'Kasir'}</Pill></Td>
                  <Td><Pill tone={u.active ? 'ok' : 'warn'}>{u.active ? 'Aktif' : 'Nonaktif'}</Pill></Td>
                  <Td mono>{u.created_at ? fmtDate(u.created_at) : '—'}</Td>
                  <Td>
                    {u.role === 'cashier' && (
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

      <p className="mt-4 text-[13px] text-muted">
        Passcode tiap akun diatur di <Link to="/app/pengaturan" className="font-medium text-jet hover:underline">Pengaturan</Link>.
      </p>

      <Modal open={open} title="Tambah Kasir" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          {formErr && <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{formErr}</p>}
          <Input label="Nama kasir" value={name} onChange={setName} placeholder="cth: Andi" />
          <p className="text-[13px] text-muted">Kasir tidak butuh email dan kata sandi. Setelah dibuat, ganti ke akun ini lewat menu profil di kiri bawah.</p>
          <Button className="w-full" onClick={create} disabled={busy}>{busy ? 'Membuat…' : 'Buat Akun Kasir'}</Button>
        </div>
      </Modal>
    </>
  )
}