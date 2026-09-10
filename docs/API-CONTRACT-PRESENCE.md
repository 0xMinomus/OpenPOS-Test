# API Contract — Presence Kasir (Online / Offline)

> Diserahkan ke backend developer (`adrr-dev/openPOS`) untuk diimplementasikan.
> Status: **diajukan**, belum tersedia di backend produksi.
> Frontend sudah kirim heartbeat tiap 30 dtk (`AppShell`) dan otomatis
> tampilkan Online/Offline bila field di bawah sudah live — tanpa perubahan
> frontend. Interim: kolom Status tetap Aktif/Nonaktif (status akun).

---

## 1. Syarat

Online = akun kasir sedang dipakai (ada sesi aktif), delay maksimal ±1 menit.
Logout / tutup aplikasi = offline. Akun yang tak dipakai siapa pun = offline.

---

## 2. `POST /presence/heartbeat` — semua role (BARU)

Frontend memanggil tiap 30 dtk selagi login. Server catat
`last_seen_at = now()` untuk user + toko itu.

**Response `200`:** `{ "status": "ok" }`

**Aturan:**
- Tanpa body, tanpa rate-limit di bawah 1/detik.
- 404 diabaikan frontend (backend lama) — jangan ubah ke method lain.

---

## 3. `GET /users` — tambah 2 field per user

```json
{
  "users": [
    {
      "id": "7",
      "name": "Andi Kasir",
      "role": "cashier",
      "active": true,
      "online": false,
      "last_seen_at": "2026-09-10T08:12:00Z"
    }
  ]
}
```

| Field | Keterangan |
|---|---|
| `online` | `true` bila `last_seen_at` < 90 dtk; `false` bila tidak |
| `last_seen_at` | ISO-8601 heartbeat terakhir (null bila belum pernah) |

Tetap kirim `last_seen_at` apa adanya — frontend pakai ambang sendiri
(2 mnt) bila `online` absen.

---

## 4. Offline instan (tanpa tunggu 90 dtk)

- `POST /auth/logout` → tandai user offline langsung.
- `POST /auth/switch` → user lama offline (kecuali masih ada sesi lain),
  user target online.

---

## 5. Checklist accept backend

- [ ] `POST /presence/heartbeat` live, update `last_seen_at`
- [ ] `GET /users` kirim `online` + `last_seen_at`
- [ ] Logout/switch tandai offline langsung
- [ ] Prod deploy lalu verifikasi: buka kasir → Online; tutup → Offline ≤90 dtk
