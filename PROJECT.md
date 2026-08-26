# OpenPOS

Sistem kasir (Point of Sale) berbasis web — gratis selamanya, khusus untuk UMKM di Indonesia. Kelola produk, stok, transaksi, dan laporan dari satu dashboard sederhana. Terjangkau lintas perangkat (desktop, tablet, mobile).

> **simple enough for anyone, powerful enough for a growing business**

---

## Status

- **Fase:** Frontend MVP (tanpa backend)
- **Penyimpanan data:** `localStorage` browser (sementara, sampai backend masuk)
- **Akun demo:** `admin` / `123` (akun admin otomatis di-seed saat pertama kali dipakai)

## Struktur Proyek

```
.
├── PROJECT.md            ← dokumen ini
├── opencode.json         ← konfigurasi opencode (plugin + MCP)
├── docs/                 ← dokumentasi produk & desain
│   ├── PRD.md            ← Product Requirements Document (MVP)
│   ├── xAi-Design.md     ← panduan sistem desain (monochrome editorial)
│   ├── DESIGN-MANIFEST.json
│   ├── DESIGN-HANDOFF.md
│   └── brand-spec.md
└── web/                  ← aplikasi frontend (Vite + React + TypeScript)
    ├── src/
    │   ├── components/ui/   ← komponen shadcn/ui (Base UI)
    │   ├── hooks/
    │   ├── lib/
    │   │   ├── store.ts     ← "database" localStorage + auth + tema
    │   │   ├── ui.tsx       ← komponen kecil internal (Button, Input, Modal, …)
    │   │   └── utils.ts     ← cn() dari shadcn
    │   └── pages/           ← halaman (Landing, Masuk, Daftar, AppShell, Dashboard, …)
    ├── components.json    ← konfigurasi shadcn/ui
    ├── index.html
    ├── package.json
    ├── tsconfig*.json
    └── vite.config.ts
```

## Teknologi

| Bagian | Pilihan |
|---|---|
| Framework | [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript |
| Routing | [react-router](https://reactrouter.com) v8 |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) (plugin Vite) |
| UI kit | [shadcn/ui](https://ui.shadcn.com) — preset `nova`, primitive **Base UI** |
| Ikon | [lucide-react](https://lucide.dev) |
| Grafik | [Recharts](https://recharts.org) via komponen `Chart` shadcn |
| Font | Geist + Geist Mono (self-hosted via `@fontsource-variable/geist`) |

## Cara Menjalankan

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

Script lain (`cd web`):

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan dengan HMR |
| `npm run build` | Type-check (`tsc -b`) + build produksi ke `dist/` |
| `npm run preview` | Pratinjau build produksi |
| `npm run lint` | Lint (oxlint) |

## Fitur (MVP, semua berfungsi di frontend)

- **Landing page** — hero + demo POS interaktif, fitur, cara kerja, quote, tentang, CTA
- **Autentikasi** — daftar (buat Admin + Toko sekaligus), masuk, keluar, guard route
- **Dashboard** — omzet, transaksi, produk terjual, stok menipis; grafik penjualan 7 hari (AreaChart), ringkasan metode pembayaran (donut), produk terlaris, transaksi terbaru
- **POS Kasir** — cari produk (nama/SKU/barcode), filter kategori, keranjang, cegah qty > stok, diskon & pajak, 5 metode bayar (Cash/Transfer/QRIS/E-Wallet/Card), kembalian otomatis, checkout atomic (stok berkurang + transaksi tercatat), struk + cetak (58mm/80mm via setting)
- **Produk** — CRUD, nonaktifkan, SKU unik per toko, import CSV (preview per baris), export CSV
- **Kategori** — CRUD, soft-delete bila masih dipakai produk
- **Stok** — status stok, penyesuaian (alasan wajib, cegah negatif), riwayat pergerakan
- **Transaksi** — daftar + filter (tanggal/metode/kasir) + pagination, detail, refund penuh/parsial (stok kembali, status jadi `refunded`), export CSV
- **Laporan** — penjualan / produk / profit / stok, 5 periode, export CSV
- **User Management** — admin membuat akun kasir, aktif/nonaktif
- **Pengaturan** — profil toko, preferensi struk, pajak, timezone
- **Tema** — Terang / Gelap / Sistem (dropdown di header app, persisted)
- **RBAC** — Admin vs Kasir: menu & logika dibatasi di frontend (kasir tidak lihat produk/stok/laporan/users/pengaturan, hanya transaksi miliknya)

## Arsitektur Data (sementara)

Tanpa backend, semua data disimpan di `localStorage` dengan satu kunci `op_db_v1` (`src/lib/store.ts`):

- `accounts` — akun user (password plaintext — **hanya untuk prototipe**)
- `session` — sesi login aktif
- `categories`, `products`, `trx`, `refunds`, `movements` — data bisnis
- `seq` — penghitung nomor transaksi (`TRX-0001`)
- `settings` — pengaturan toko

UI membaca data via hook `useDB()` (re-render otomatis saat data berubah) dan menulis via `mutate(fn)`. Tema disimpan di `op_theme`.

> Saat backend masuk, `store.ts` cukup diganti lapisan API tanpa mengubah halaman.

## Dokumen Referensi

| Dokumen | Isi |
|---|---|
| `docs/PRD.md` | Persyaratan produk & fungsional lengkap (FR-*, role matrix, acceptance criteria) |
| `docs/xAi-Design.md` | Sistem desain: palet, tipografi, spacing, komponen |
| `docs/DESIGN-MANIFEST.json` | Manifest token/komponen desain |
| `docs/DESIGN-HANDOFF.md` | Catatan handoff desain ke implementasi |
| `docs/brand-spec.md` | Spesifikasi merek |

## Catatan Pengembangan

- Tidak ada backend / API / database server pada fase ini — semua data lokal di browser. Data hilang jika localStorage dibersihkan.
- Password disimpan plaintext di localStorage — jangan pakai untuk data produksi nyata.
- Bundle besar (Recharts + lucide) — code-split per route dapat ditambahkan bila perlu.
- File HTML prototipe lama telah dihapus (sudah dipindah penuh ke React).
