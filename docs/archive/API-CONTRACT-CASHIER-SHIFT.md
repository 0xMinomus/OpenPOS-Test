# API Contract — Shift Kasir (Dashboard Kasir)

> Diserahkan ke backend developer (`adrr-dev/openPOS`).
> Status: **diajukan**. Dashboard kasir saat ini hanya menerima `today` + `recent`
> dari `GET /dashboard` — data shift, omzet per jam, dan produk terlaris kasir belum ada.

---

## 1. `GET /cashier/shift` — 🔒 semua role (kasir & admin)

Ringkasan shift kasir yang sedang berjalan + data analitik untuk dashboard kasir.

**Response `200`:**
```json
{
  "shift": {
    "started_at": "2026-09-06T08:42:00Z",
    "opening_cash": 500000,
    "sales": 637500,
    "trx_count": 1
  },
  "hourly": [
    { "hour": 8, "omzet": 0 },
    { "hour": 9, "omzet": 125000 }
  ],
  "top_products": [
    { "product_id": 1, "name": "Beras Premium 5kg", "qty": 12 }
  ]
}
```

**Aturan:**
- `hourly`: omzet per jam dari mulai shift sampai sekarang (jam 0–23), hanya jam yang sudah lewat/diisi; `omzet` 0 tetap boleh ada. Kalau shift belum ada datanya, array boleh kosong.
- `top_products`: 4–5 produk terbanyak terjual **selama shift berjalan** (qty), urut menurun.
- Kasir → data milik shift kasir aktif; admin → data shift admin saat ini.
- **Shift bersifat eksplisit**: hanya `POST /cashier/shift/start` yang membuka shift. Login/switch ke akun **tidak** membuka shift.

**Error:**
| Status | Body | Kondisi |
|---|---|---|
| 401 | `{ "error": "sesi tidak valid..." }` | token invalid |
| **404** | `{ "error": "tidak ada shift yang berjalan" }` | **belum pernah `start`** — frontend memakai ini untuk mengunci dashboard/POS/Transaksi |
| 500 | `{ "error": "Gagal memuat shift." }` | error lain |

> **Amendemen penting (mengubah perilaku):** `GET /cashier/shift` **tidak boleh auto-create shift**. Kalau tidak ada shift aktif → balas `404` dengan pesan di atas. Frontend: kasir yang dapat 404 hanya boleh mengakses halaman Shift (mulai shift), dashboard/POS/Transaksi diredirect ke sana.

## 2. `POST /cashier/shift/start` — 🔒 kasir (admin boleh)

Memulai shift baru. Shift sebelumnya (yang masih berjalan) otomatis ditutup.

**Request:**
```json
{ "opening_cash": 500000 }
```
`opening_cash` opsional (jumlah uang awal di laci, integer rupiah).

**Response `201`:**
```json
{
  "shift": { "started_at": "2026-09-06T08:42:00Z", "opening_cash": 500000, "sales": 0, "trx_count": 0 }
}
```

**Error:** `400` `{ "error": "Masih ada shift yang berjalan. Tutup dulu sebelum membuka yang baru." }` (bila tidak auto-close).

## 3. `POST /cashier/shift/close` — 🔒 kasir (admin boleh)

Menutup shift berjalan. Di backend: berhenti mencatat shift aktif (bila ada tabel shift), atau cukup mengembalikan ringkasan dan menandai shift selesai.

**Request:**
```json
{ }
```

**Response `200`:**
```json
{ "message": "Shift ditutup.", "summary": { "sales": 637500, "trx_count": 1 } }
```

**Error:** `400` `{ "error": "Tidak ada shift yang berjalan." }`

## 4. `GET /shifts` — 🔒 admin (kasir → 403)

Log seluruh shift di toko, terbaru dulu — untuk halaman Shift admin (ringkasan kinerja per kasir).

**Response `200`:**
```json
{
  "shifts": [
    {
      "id": 1,
      "cashier_name": "Andi Kasir",
      "started_at": "2026-09-06T08:42:00Z",
      "closed_at": "2026-09-06T15:30:00Z",
      "opening_cash": 500000,
      "sales": 637500,
      "trx_count": 1
    }
  ]
}
```

**Aturan:**
- `closed_at` null = shift masih berjalan (frontend menampilkan badge "Berjalan").
- `sales` = total omzet transaksi selama shift; `trx_count` = jumlah transaksi.
- Satu shift = satu kasir; kasir baru yang dibuka saat shift lama belum ditutup → shift lama otomatis ditutup (dengan `closed_at`-nya).

**Error:** `401` token invalid · `403` bukan admin · `500` gagal memuat.

---

## Frontend (yang akan memakai kontrak ini)

- `GET /cashier/shift` → mengisi card "Shift sedang berjalan", chart "Penjualan Hari Ini" (per jam), dan "Produk Terlaris". `404` → kasir diblokir dari Dashboard/POS/Transaksi dan diredirect ke halaman Shift.
- `POST /cashier/shift/start` → tombol "Mulai Shift" (dengan input kas awal opsional), lalu pindah ke dashboard.
- `POST /cashier/shift/close` → tombol "Tutup Shift", lalu muat ulang dashboard.
- `GET /shifts` → halaman Shift admin: tabel log shift per kasir (mulai, tutup, durasi, penjualan, transaksi).
- Data dashboard/POS/Transaksi kasir otomatis mengikuti shift aktif saat itu (omzet/transaksi dihitung sejak `started_at`).
- Jika endpoint belum tersedia (404/405 selain "tidak ada shift"), bagian yang tidak punya data menampilkan empty state — tanpa dummy.