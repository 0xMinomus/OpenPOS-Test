# API Contract — User Activity Log (Audit Akun)

> Diserahkan ke backend developer (`adrr-dev/openPOS`) untuk diimplementasikan.
> Status: **diajukan**, belum tersedia di backend produksi.
> Frontend (`web/src/pages/Users.tsx` section Aktivitas Pengguna Terbaru)
> kini memakai data turunan (akun dibuat + transaksi) dan otomatis memakai
> endpoint ini bila sudah live — tanpa perubahan frontend.

---

## 1. `GET /activity` — admin only

Riwayat aktivitas akun dalam toko, terbaru dulu.

**Query opsional** (tak dikenal wajib diabaikan):

| Param | Nilai | Default |
|---|---|---|
| `actor` | nama/id pelaku (substring) | semua |
| `action` | kode aksi (tabel §3) | semua |
| `date` | `YYYY-MM-DD` | semua |
| `page` | 1-based | `1` |
| `limit` | 1–200 | `20` |

**Response `200`:**

```json
{
  "items": [
    {
      "id": 101,
      "actor_id": "7",
      "actor_name": "Kasir Andi",
      "action": "LOGIN",
      "detail": "Login ke sistem",
      "reference_type": "",
      "reference_id": "",
      "created_at": "2026-09-10T02:15:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

**Error:** `401` tanpa token · `403` bila role kasir.

---

## 2. Model

| Field | Wajib | Keterangan |
|---|---|---|
| `id` | ya | unik global |
| `actor_id` / `actor_name` | ya | pelaku (nama tampil di panel) |
| `action` | ya | kode aksi (tabel §3) |
| `detail` | ya | kalimat Indonesia siap tampil |
| `reference_type` / `reference_id` | tidak | mis. `user` / id akun terkait |
| `created_at` | ya | ISO-8601 presisi detik |

---

## 3. Event pemicu (backend wajib catat)

| `action` | Pemicu | Contoh `detail` |
|---|---|---|
| `LOGIN` | login/switch akun sukses | "Andika login ke sistem" |
| `USER_CREATED` | kasir dibuat | "Anggra ditambahkan sebagai kasir" |
| `PROFILE_UPDATED` | profil diubah | "Abi memperbarui profil" |
| `ACCOUNT_DISABLED` | akun dinonaktifkan | "Sari dinonaktifkan" |
| `ACCOUNT_ENABLED` | akun diaktifkan kembali | "Sari diaktifkan kembali" |
| `PASSCODE_CHANGED` | passcode diganti | "Passcode Andi diperbarui" |

**Aturan:**
- Hanya untuk user dalam toko yang sama; kasir tak bisa membaca (403).
- `detail` kalimat Indonesia siap tampil, max ±80 karakter.
- Idempoten: retry request yang sama tidak boleh duplikat
  (kunci = request/event id).

---

## 4. Checklist accept backend

- [ ] `GET /activity` live, admin-only, 403 kasir
- [ ] Event §3 tercatat dengan `created_at` presisi detik
- [ ] Prod deploy lalu verifikasi section Aktivitas (jam tampil, bukan tanggal saja)
