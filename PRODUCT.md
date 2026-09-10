# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pemilik toko UMKM Indonesia (role admin) mengelola katalog, stok, transaksi,
dan kasir; kasir (role cashier, sub-akun tanpa email) menjalankan penjualan
via POS. Admin bekerja dari dashboard di desktop; kasir dari halaman POS.

## Product Purpose

Sistem kasir web gratis untuk UMKM Indonesia: catat penjualan, kelola produk
dan stok, pantau transaksi dan laporan per toko. Sukses = pemilik toko bisa
berjualan dan memantau kondisi toko hari itu dalam hitungan klik.

## Positioning

POS gratis dengan akun kasir per toko, passcode per akun, dan mode offline
desktop — tanpa perangkat khusus.

## Operating Context

Toko fisik Indonesia (WIB/WITA/WIT). Alur harian: buka POS → jual →
pantau dashboard/laporan. Rupiah (Rp) di semua nominal; tanggal format
Indonesia. Dua distribusi: web cloud (data di backend) dan aplikasi desktop
Electron offline (data di perangkat, single owner).

## Capabilities and Constraints

- Web cloud: Vite + React + TypeScript + Tailwind + shadcn/ui; REST ke
  backend Go (PostgreSQL). Auth JWT access (15 mnt) + refresh (7 hari),
  OTP email saat daftar, passcode 5 digit per akun opsional.
- RBAC server-side; kasir otomatis ter-scope ke transaksinya.
- Threshold stok existing: 0 = Habis, <= 5 = Menipis. Tidak ada field
  stok minimum di API.
- Movement tercatat: sale, refund, adjust, initial (tanpa SKU,
  tanpa stok sebelum/sesudah di API).
- Aturan repo: tanpa data dummy untuk fitur bisnis; setiap perubahan
  lolos `tsc` + build; auto-push ke `main`.
- Halaman offline (`pages/offline/*`) adalah salinan cloud via adapter
  `local-api`; perubahan cloud diporting manual per panduan update list.

## Brand Commitments

Nama OpenPOS. Font Poppins. Token warna/font existing tidak boleh
diganti; tidak ada palet atau identitas visual baru.

## Evidence on Hand

- Repo frontend aktif, branch `main`; backend Go repo terpisah (kontrak API
  di README-nya).
- Akun uji produksi tersedia untuk verifikasi visual (kredensial di catatan
  lokal `MEMORY.md` — gitignored, tidak ada di repo ini).
- Dokumen sesi: `PROJECT.md`, `docs/`, `updatelist9sep.MD`; catatan lokal
  `MEMORY.md` (tidak ikut repo).

## Product Principles

1. Data selalu dari server (atau adapter offline); tidak ada mock bisnis.
2. Kasir secepat mungkin; admin sejelas mungkin.
3. Satu pola UI untuk masalah yang sama di semua halaman.
4. Perubahan terkecil yang terbukti di browser.

## Accessibility & Inclusion

Bahasa Indonesia di seluruh UI. Target keyboard dasar (fokus terlihat,
aksi via keyboard) mengikuti perilaku bawaan komponen.
