# OpenPOS

Sistem kasir (Point of Sale) berbasis web — gratis selamanya, khusus untuk UMKM di Indonesia. Kelola produk, stok, transaksi, dan laporan dari satu dashboard sederhana. Terjangkau lintas perangkat (desktop, tablet, mobile).

---

## Status

- **Fase:** MVP terintegrasi penuh frontend ↔ backend
- **Frontend:** Vite + React + TypeScript (repo ini, folder `web/`)
- **Backend:** REST API Go/chi + PostgreSQL (Supabase), di-deploy di Vercel
  - Repo: <https://github.com/adrr-dev/openPOS>
  - Kontrak API & panduan integrasi: `EXPECTED.md` / `PROJECT.md` di repo backend
  - Base URL produksi: `https://openpos-api.vercel.app/api/v1`
- **Deploy frontend:** Vercel (<https://open-pos-deploy.vercel.app>)

## Arsitektur

```
Browser (React SPA) ──REST/JSON──▶ Backend (Go/chi, Vercel) ──▶ PostgreSQL (Supabase)
        ▲                                   │
        └──── JWT access + refresh token ────┘
```

- **Auth:** `POST /auth/login|register` → pasangan JWT; access token (15 menit) dikirim via header `Authorization: Bearer <token>`, refresh token (7 hari) dipakai sekali ke `POST /auth/refresh` (rotasi). Auto-refresh di frontend: 401 → refresh sekali → ulang request; gagal → sesi berakhir.
- **RBAC:** ditegakkan **server** (kasir mendapat 403 di endpoint admin). Frontend hanya menyembunyikan menu.
- **Data bisnis:** semua operasi lewat REST (produk, kategori, stok, transaksi, refund, users, settings, dashboard, laporan). Tidak ada data lokal untuk data bisnis.
- **Pengecualian dummy:** hanya widget demo POS + grafik omzet di Landing page (data statis/random untuk keperluan demo publik, tidak terhubung backend). Landing memuat produk asli bila user sedang login.

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
    │   │   ├── api.ts       ← lapisan API: base URL, token, auto-refresh, helper endpoint
    │   │   ├── store.ts     ← sesi user, tema, util format (tidak ada DB lokal)
    │   │   ├── ui.tsx       ← komponen kecil internal (Button, Input, Modal, …)
    │   │   ├── ErrorBoundary.tsx ← penangkap error render (tampil pesan, bukan blank)
    │   │   └── utils.ts     ← cn() dari shadcn
    │   └── pages/           ← halaman (Landing, Masuk, Daftar, AppShell, Dashboard, …)
    ├── .env.local        ← VITE_API_URL (tidak ikut git, di-set juga di Vercel)
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
| Font | Poppins (sans, self-host via `@fontsource/poppins`) + mono system stack |
| Backend | Go + chi (repo `adrr-dev/openPOS`), PostgreSQL (Supabase), JWT HS256 |

## Cara Menjalankan

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

Backend tidak perlu dijalankan lokal — arahkan ke produksi via env:

```bash
# web/.env.local
VITE_API_URL=https://openpos-api.vercel.app/api/v1
```

Tanpa `VITE_API_URL`, fallback `/api/v1` diproxy ke backend lokal `http://localhost:8080` (lihat `vite.config.ts`) untuk pengembangan bersama tim backend.

Script lain (`cd web`):

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan dengan HMR (proxy `/api` → localhost:8080) |
| `npm run build` | Type-check (`tsc -b`) + build produksi ke `dist/` |
| `npm run preview` | Pratinjau build produksi |
| `npm run lint` | Lint (oxlint) |

## Integrasi API (ringkas)

Semua helper ada di `src/lib/api.ts`. Kontrak detail ada di repo backend (`PROJECT.md` — kontrak API, `EXPECTED.md` — panduan integrasi frontend).

| Modul | Endpoint utama |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` (passcode opsional) · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| Users (admin) | `GET /users` · `POST /users` · `PATCH /users/{id}/active` · `PUT /users/{id}/passcode` |
| Katalog | `GET|POST /categories` · `DELETE /categories/{id}` · `GET|POST /products` · `PUT /products/{id}` · `PATCH /products/{id}/active` |
| Stok | `POST /stock/adjustments` · `GET /movements` |
| Transaksi | `POST /transactions` (checkout, hitung server) · `GET /transactions` · `POST /transactions/{id}/refund` |
| Settings | `GET|PUT /settings` |
| Analitik | `GET /dashboard` (role-aware) · `GET /reports?period=` |

Pola penting:
- Error server selalu `{ "error": "pesan Indonesia siap-tampil" }` → ditampilkan langsung di UI (`ApiError`).
- Semua respons pagination: `{ items, total, page, limit }` (page mulai 1, limit maks 200).
- Tipe data server `snake_case` (mis. `buy_price`, `cashier_name`) — dibaca langsung tanpa konversi.
- Login/passcode: akun ber-passcode → server balas `401 { "error": "passcode_required" }` → UI tampilkan form passcode lalu login ulang dengan argumen `passcode`.

## Fitur (MVP, semua jalan di atas backend)

- **Landing page** — hero + demo POS interaktif (produk demo statis, grafik random), fitur, cara kerja, quote, tentang, CTA
- **Autentikasi** — daftar (buat Admin + Toko sekaligus), masuk (dengan passcode), keluar, guard route, bootstrap sesi via `/auth/me`
- **Dashboard** — KPI hari ini, grafik penjualan 7 hari (AreaChart), metode pembayaran (donut), produk terlaris, transaksi terbaru; bentuk berbeda per role (kasir: ringkasan shift sendiri)
- **POS Kasir** — katalog dari server, keranjang dengan stok efektif (stok − qty di keranjang), diskon & pajak dari settings, 5 metode bayar, checkout ke server (harga/total dihitung server), struk dari respons + cetak (58mm/80mm)
- **Produk** — CRUD via API, search & pagination server-side, nonaktifkan, import CSV baris-per-baris, export CSV
- **Kategori** — tambah/hapus; masih dipakai produk → soft-delete (respons `soft_deleted`)
- **Stok** — status stok, penyesuaian (alasan wajib, cegah negatif), riwayat movement (terbaru dulu)
- **Transaksi** — list + filter (q/metode/tanggal) + pagination server-side, detail, refund penuh/parsial (admin), export CSV
- **Laporan** — komposit dari server: summary, by_method, by_status, produk, transaksi (HPP+profit), stok; 5 periode; export CSV
- **User Management** — admin buat akun kasir, aktif/nonaktif (hanya kasir)
- **Pengaturan** — profil toko, struk, pajak, timezone, passcode per akun
- **Tema** — Terang / Gelap (persisted di `op_theme`)
- **RBAC** — server-side; kasir otomatis hanya melihat transaksi miliknya

## Deploy

**Frontend (Vercel):**
1. Import repo ini → preset Vite (build `npm run build`, output `dist`, rewrites SPA di `vercel.json`)
2. Environment variable: `VITE_API_URL=https://openpos-api.vercel.app/api/v1` (di-set saat build — ganti nilai = build ulang)
3. `.env.local` tidak ikut ter-deploy

**Backend (Vercel, repo `adrr-dev/openPOS`):** env `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` (wajib berisi domain frontend + `http://localhost:5173` untuk dev lokal). Setiap ubah env → Redeploy.

## Catatan Pengembangan

- **Auto-refresh token:** access token disimpan di `localStorage` (`op_access`), refresh di `op_refresh`. Satu refresh berjalan di waktu bersamaan untuk semua request (single-flight).
- **ErrorBoundary** global menampilkan pesan error alih-alih halaman blank saat crash render.
- **Toleransi `null`:** backend kadang mengirim `categories: null` / `users: null` untuk toko kosong (nil slice Go) — `api.ts` menormalkan ke `[]`.
- **Nomor transaksi:** `TRX-XXXX` dihitung global di backend (bukan per toko) sejak perbaikan bug konflik PK antar toko — dua toko tidak mungkin mendapat ID sama.
- **Landing page** sengaja memakai data demo (produk & grafik random) untuk keperluan publik; data bisnis asli tidak pernah ditampilkan ke pengunjung tanpa login.
- Bundle besar (Recharts + lucide) — code-split per route dapat ditambahkan bila perlu.

## Dokumen Referensi

| Dokumen | Isi |
|---|---|
| `docs/PRD.md` | Persyaratan produk & fungsional lengkap (FR-*, role matrix, acceptance criteria) |
| `docs/xAi-Design.md` | Sistem desain: palet, tipografi, spacing, komponen |
| `docs/DESIGN-MANIFEST.json` | Manifest token/komponen desain |
| `docs/DESIGN-HANDOFF.md` | Catatan handoff desain ke implementasi |
| `docs/brand-spec.md` | Spesifikasi merek |
| Repo backend (`adrr-dev/openPOS`) | Kontrak API lengkap, skema DB, panduan deploy backend |