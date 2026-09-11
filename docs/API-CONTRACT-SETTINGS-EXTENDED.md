# API Contract — Extended Store Settings (Toko, Struk, Pajak)

> Diserahkan ke backend developer (`adrr-dev/openPOS`) untuk diimplementasikan.
> Status: **diajukan**, belum tersedia di backend produksi.
> Frontend (`web/src/pages/Pengaturan.tsx`) menampilkan field di bawah ini
> sebagai **nonaktif + badge "Segera"** sampai kontrak ini live. Field existing
> (`storeName`, `address`, `phone`, `timezone`, `receiptHeader`,
> `receiptFooter`, `paper`, `taxEnabled`, `taxPct`) tidak berubah.

---

## 1. `GET /settings` — field tambahan

Response tetap objek settings, ditambah (semua opsional saat transisi;
kosong = belum diatur):

```json
{
  "storeName": "Toko Andika",
  "address": "Jl. Merdeka No. 1",
  "phone": "081234567890",
  "timezone": "Asia/Jakarta",
  "receiptHeader": "Terima kasih sudah berbelanja",
  "receiptFooter": "Barang yang sudah dibeli tidak dapat ditukar",
  "paper": "80mm",
  "taxEnabled": true,
  "taxPct": 11,
  "businessType": "retail",
  "email": "tokoandika@gmail.com",
  "city": "Jakarta",
  "province": "DKI Jakarta",
  "currency": "IDR",
  "logoUrl": "",
  "hours": [
    { "days": "Senin – Jumat", "open": "08:00", "close": "21:00" },
    { "days": "Sabtu", "open": "08:00", "close": "21:00" },
    { "days": "Minggu", "open": null, "close": null }
  ],
  "receiptShowLogo": true,
  "receiptShowCashier": true,
  "receiptShowMethod": true,
  "receiptShowTax": true,
  "receiptShowDiscount": true,
  "receiptShowNote": true,
  "taxName": "PPN",
  "taxInclusive": false,
  "taxRounding": "none",
  "taxApplyTo": "all"
}
```

## 2. `PUT /settings` — validasi field baru

Menerima objek yang sama; validasi:

| Field | Aturan |
|---|---|
| `businessType` | salah satu `retail` \| `fnb` \| `fashion` \| `jasa` \| `lainnya` |
| `email` | format email bila diisi |
| `currency` | kode ISO 3 huruf (frontend hanya memakai `IDR`; tanpa konversi) |
| `logoUrl` | URL publik bila diisi (lihat §3 untuk upload) |
| `hours[]` | `open`/`close` format `HH:MM`; keduanya `null` = tutup |
| `receiptShow*` | boolean |
| `receiptFooter` | max 200 karakter (frontend menampilkan counter `n/200`) |
| `taxName` | max 20 karakter |
| `taxPct` | 0–100, desimal diizinkan (aturan lama dipertahankan) |
| `taxRounding` | `none` \| `down` \| `up` (berlaku bila `taxInclusive=false`) |
| `taxApplyTo` | `all` (category-specific menyusul; frontend menampilkan `all`) |

Error: `400` dengan `{ "error": "<pesan Indonesia>" }` seperti validasi lama.

## 3. Upload logo (opsional, salah satu)

- Opsi A (disarankan): `POST /settings/logo` multipart `file` (PNG/JPG,
  max 2MB) → `200 { "logoUrl": "https://…" }`.
- Opsi B: frontend kirim `logoUrl` langsung bila toko sudah hosting gambar
  sendiri (tanpa endpoint baru).

Beri tahu opsi yang dipilih agar frontend disesuaikan.

## 4. Formula pajak (tidak berubah kecuali disepakati)

- `taxInclusive=false` (default & satu-satunya mode saat ini):
  `tax = round_half_up((subtotal - discount) * taxPct / 100)`,
  `total = subtotal - discount + tax` — frontend memakai rumus yang sama
  untuk contoh perhitungan.
- `taxRounding`: `none` = seperti sekarang; `down`/`up` = `floor`/`ceil`
  dari nilai pajak.
- `taxInclusive=true`: tentukan bersama sebelum implementasi (pajak
  included = `total - total/(1+pct/100)` atau definisi lain) — **jangan
  deploy tanpa kesepakatan**, agar mesin kasir dan laporan tidak beda hasil.

## 5. Alur frontend setelah backend live

1. `GET /settings` mengembalikan field baru → form aktif otomatis
   (frontend mengaktifkan field bila nilai/dukungan terdeteksi).
2. `PUT /settings` menyimpan semua field sekaligus seperti sekarang.
3. Tidak ada endpoint lain yang berubah; struk, laporan, dan POS membaca
   field yang sama.

## 6. Checklist accept backend

- [ ] `GET /settings` mengembalikan field §1 (boleh kosong)
- [ ] `PUT /settings` memvalidasi §2, error `400` berbahasa Indonesia
- [ ] Logo: opsi A atau B (§3) diputuskan + diimplementasikan
- [ ] Formula §4 disepakati untuk `taxInclusive=true` sebelum live
- [ ] Prod deploy lalu verifikasi halaman Pengaturan: field aktif, tersimpan,
      tampil di preview + struk
