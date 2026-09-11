# API Contract — Extended Store Settings (Toko, Struk, Pajak)

> Diserahkan ke backend developer (`adrr-dev/openPOS`) untuk diimplementasikan.
> Status: **diajukan**, belum tersedia di backend produksi.
> Frontend (`web/src/pages/Pengaturan.tsx`) menampilkan field di bawah ini
> sebagai **nonaktif + badge "Segera"** sampai kontrak ini live. Field existing
> (`storeName`, `address`, `phone`, `timezone`, `receiptHeader`,
> `receiptFooter`, `paper`, `taxEnabled`, `taxPct`) tidak berubah.

---

## 1. `GET /settings` — response lengkap

Response tetap satu objek settings. Field baru **selalu ada sebagai key**
(meski kosong) agar frontend bisa mendeteksi dukungan backend dari keberadaan
key, lalu mengaktifkan form otomatis:

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
  "taxApplyTo": "all",
  "passcodeUpdatedAt": null
}
```

Catatan:
- `hours[].days` memakai 3 label tetap di atas (grup tampilan frontend).
- `passcodeUpdatedAt`: read-only, diisi server (lihat §7).

## 2. Peta label UI → field

| Label di Pengaturan | Field | Status |
|---|---|---|
| Header Toko | `storeName` | live |
| Footer Struk | `receiptHeader` | live |
| Nama Toko | `storeName` | live |
| No. Telepon | `phone` | live |
| Alamat | `address` | live |
| Timezone | `timezone` | live |
| Lebar Kertas | `paper` (`58mm`/`80mm`) | live |
| Pesan Footer (+counter `n/200`) | `receiptFooter` | live |
| Status Pajak, Tarif Pajak (%) | `taxEnabled`, `taxPct` | live |
| Jenis Usaha | `businessType` | kontrak ini |
| Email (toko) | `email` | kontrak ini |
| Kota, Provinsi | `city`, `province` | kontrak ini |
| Mata Uang | `currency` | kontrak ini |
| Logo Toko | `logoUrl` (+ §4) | kontrak ini |
| Jam Operasional | `hours` | kontrak ini |
| Tampilkan Logo/Kasir/Metode/Pajak/Diskon/QRIS-Catatan | `receiptShow*` | kontrak ini |
| Nama Pajak | `taxName` | kontrak ini |
| Harga Sudah Termasuk Pajak | `taxInclusive` | kontrak ini |
| Pembulatan Pajak | `taxRounding` | kontrak ini |
| Terapkan Pajak Pada | `taxApplyTo` | kontrak ini |
| Terakhir diubah (passcode) | `passcodeUpdatedAt` | kontrak ini (§7) |

## 3. `PUT /settings` — validasi field baru

Menerima objek yang sama; validasi:

| Field | Aturan | Contoh error `400` |
|---|---|---|
| `businessType` | salah satu `retail` \| `fnb` \| `fashion` \| `jasa` \| `lainnya` | `{ "error": "Jenis usaha tidak valid." }` |
| `email` | format email bila diisi | `{ "error": "Email tidak valid." }` |
| `currency` | kode ISO 3 huruf (tanpa konversi) | `{ "error": "Kode mata uang tidak valid." }` |
| `logoUrl` | URL publik bila diisi (lihat §4) | `{ "error": "URL logo tidak valid." }` |
| `hours[]` | tepat 3 entri, label `days` tetap §1; `open`/`close` format `HH:MM`; keduanya `null` = tutup; `open < close` | `{ "error": "Jam operasional tidak valid." }` |
| `receiptShow*` | boolean | `{ "error": "body JSON tidak valid" }` |
| `receiptFooter` | max 200 karakter | `{ "error": "Pesan footer maksimal 200 karakter." }` |
| `taxName` | max 20 karakter | `{ "error": "Nama pajak maksimal 20 karakter." }` |
| `taxPct` | 0–100, desimal diizinkan (aturan lama) | pesan lama |
| `taxRounding` | `none` \| `down` \| `up` | `{ "error": "Pembulatan pajak tidak valid." }` |
| `taxApplyTo` | `all` (category-specific menyusul) | `{ "error": "Cakupan pajak tidak valid." }` |

Aturan transisi: **field tak dikenal wajib diabaikan** (jangan `400`) agar
frontend lama/baru tetap kompatibel selama masa transisi.

## 4. Upload logo (opsional, salah satu)

- Opsi A (disarankan): `POST /settings/logo` multipart `file` (PNG/JPG,
  max 2MB) → `200 { "logoUrl": "https://…" }`,
  error `400 { "error": "File harus PNG/JPG maksimal 2MB." }`.
- Opsi B: frontend kirim `logoUrl` langsung bila toko sudah hosting gambar
  sendiri (tanpa endpoint baru).

Beri tahu opsi yang dipilih agar frontend disesuaikan.

## 5. Formula pajak (tidak berubah kecuali disepakati)

- `taxInclusive=false` (default & satu-satunya mode saat ini):
  `tax = round_half_up((subtotal - discount) * taxPct / 100)`,
  `total = subtotal - discount + tax` — frontend memakai rumus yang sama
  untuk contoh perhitungan.
- `taxRounding`: `none` = seperti sekarang; `down`/`up` = `floor`/`ceil`
  dari nilai pajak. Hanya berlaku bila `taxInclusive=false`.
- `taxInclusive=true`: tentukan bersama sebelum implementasi (pajak
  included = `total - total/(1+pct/100)` atau definisi lain) — **jangan
  deploy tanpa kesepakatan**, agar mesin kasir dan laporan tidak beda hasil.

## 6. Efek ke struk (frontend, setelah live)

Flag `receiptShow*` mengontrol elemen struk (`false` = sembunyikan):

| Flag `false` | Elemen disembunyikan |
|---|---|
| `receiptShowLogo` | logo toko |
| `receiptShowCashier` | baris Kasir |
| `receiptShowMethod` | baris Metode + label bayar |
| `receiptShowTax` | baris Pajak (perhitungan tetap jalan) |
| `receiptShowDiscount` | baris Diskon (perhitungan tetap jalan) |
| `receiptShowNote` | `receiptHeader` + `receiptFooter` |

Perhitungan tidak berubah — hanya tampilan.

## 7. Audit passcode (opsional tapi disarankan)

- `PUT /users/{id}/passcode`: setiap berhasil set/hapus, server mengisi
  `passcodeUpdatedAt = now()` pada settings toko (atau per-akun bila
  arsitektur mendukung).
- Frontend menampilkan baris "Terakhir diubah" di
  `Pengaturan > Akun > Keamanan` bila nilainya non-`null`
  (format: `7 Sep 2026, 14:30`).

## 8. Migrasi

- Kolom baru nullable dengan default aman: string `''`, boolean
  (`receiptShow*` default `true`, `taxInclusive` default `false`),
  `currency` default `'IDR'`, `taxRounding` default `'none'`,
  `taxApplyTo` default `'all'`, `hours` default `[]`,
  `passcodeUpdatedAt` default `NULL`.
- GORM AutoMigrate menambah kolom sendiri; tidak ada perubahan kolom lama.

## 9. Alur frontend setelah backend live

1. `GET /settings` mengembalikan key §1 → form aktif otomatis
   (frontend mengaktifkan field bila key terdeteksi, apa pun isinya).
2. `PUT /settings` menyimpan semua field sekaligus seperti sekarang.
3. Tidak ada endpoint lain yang berubah; struk, laporan, dan POS membaca
   field yang sama.

## 10. Checklist accept backend

- [ ] `GET /settings` mengembalikan semua key §1 (boleh kosong)
- [ ] `PUT /settings` memvalidasi §3, error `400` berbahasa Indonesia
- [ ] Field tak dikenal diabaikan (bukan `400`)
- [ ] Logo: opsi A atau B (§4) diputuskan + diimplementasikan
- [ ] Formula §5 disepakati untuk `taxInclusive=true` sebelum live
- [ ] `passcodeUpdatedAt` terisi saat passcode diubah (§7, bila diambil)
- [ ] Prod deploy lalu verifikasi halaman Pengaturan: field aktif, tersimpan,
      tampil di preview + struk
