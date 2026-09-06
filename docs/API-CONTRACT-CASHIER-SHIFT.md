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
- Shift dianggap dimulai saat login/switch ke akun itu; `started_at` = waktu login terakhir akun tersebut (atau waktu shift dibuka — mengikuti keputusan backend).

**Error:** `401` token invalid · `500` gagal memuat.

## 2. `POST /cashier/shift/close` — 🔒 kasir (admin boleh)

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

---

## Frontend (yang akan memakai kontrak ini)

- `GET /cashier/shift` → mengisi card "Shift sedang berjalan", chart "Penjualan Hari Ini" (per jam), dan "Produk Terlaris".
- `POST /cashier/shift/close` → tombol "Tutup Shift", lalu muat ulang dashboard.
- Jika endpoint belum tersedia (404/405), dashboard kasir menampilkan fallback dari `GET /dashboard` (`today.omzet`, `today.trx_count`, `today.items_sold`) dan bagian yang tidak punya data menampilkan empty state — tanpa dummy.