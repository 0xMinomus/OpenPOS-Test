import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { apiCreateUser, apiDeleteUser, apiListUsers, apiSetUserActive, setCachedAccounts, type User } from '../lib/api'
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
  const [deleteFor, setDeleteFor] = useState<User | null>(null)
  const [deleteTyped, setDeleteTyped] = useState('')
  const [deleteErr, setDeleteErr] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

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

  async function remove() {
    if (!deleteFor) return
    if (deleteTyped !== 'Konfirmasi') return setDeleteErr('Ketik "Konfirmasi" untuk menghapus.')
    setDeleteErr(''); setDeleteBusy(true)
    try {
      await apiDeleteUser(deleteFor.id)
      setDeleteFor(null); setDeleteTyped('')
      load()
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : 'Gagal menghapus akun.')
    } finally {
      setDeleteBusy(false)
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
                      <div className="flex justify-end gap-3 text-[13px]">
                        <button className="text-muted hover:underline" onClick={() => toggle(u)}>
                          {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button className="text-ember hover:underline" onClick={() => { setDeleteFor(u); setDeleteTyped(''); setDeleteErr('') }}>
                          Hapus
                        </button>
                      </div>
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

      <Modal open={!!deleteFor} title={`Hapus Kasir · ${deleteFor?.name ?? ''}`} onClose={() => setDeleteFor(null)}>
        <div className="space-y-4">
          {deleteErr && <p className="rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ember">{deleteErr}</p>}
          <p className="text-sm text-muted">
            Tindakan ini <strong className="text-ember">permanen</strong>. Riwayat transaksi kasir ini tetap tersimpan, tapi akunnya tidak bisa dipakai lagi untuk ganti akun.
          </p>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-steel">
            Ketik <span className="font-mono text-ember">Konfirmasi</span> untuk menghapus
            <input
              value={deleteTyped}
              onChange={(e) => setDeleteTyped(e.target.value)}
              placeholder="Konfirmasi"
              className="rounded-md border border-border bg-paper px-3.5 py-2.5 text-[15px] focus:border-jet focus:outline-none"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteFor(null)}>Batal</Button>
            <Button variant="danger" onClick={remove} disabled={deleteTyped !== 'Konfirmasi' || deleteBusy}>
              {deleteBusy ? 'Menghapus…' : 'Hapus Kasir'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}