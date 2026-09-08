# MEMORY.md — OpenPOS Frontend (Session Handoff)

> Baca file ini dulu sebelum bekerja. Ini ringkasan lengkap project, arsitektur,
> repo, deploy, kebiasaan kerja, dan seluruh keputusan teknis dari sesi sebelumnya.
> Referensi detail: `PROJECT.md` (di root), `docs/API-CONTRACT-EMAIL-OTP.md`.
> Backend dokumen: repo `adrr-dev/openPOS` (README = kontrak API).

---

## 1. Identitas & Repo

| Item | Nilai |
|---|---|
| Project | **OpenPOS** — sistem kasir (POS) web gratis untuk UMKM Indonesia |
| Repo frontend (aktif) | **`https://github.com/0xMinomus/OpenPOS-Test`** — branch `main` |
| Repo backend | **`https://github.com/adrr-dev/openPOS`** — ditangani teman (Adrr) |
| Frontend produksi | **`https://open-pos-deploy.vercel.app`** (Vercel, auto-deploy tiap push) |
| Backend produksi | **`https://openpos-api.vercel.app/api/v1`** (Vercel) |
| Stack frontend | Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui (preset `nova`, Base UI) + Recharts + lucide + Poppins |
| Stack backend | Go + chi/gin + GORM, PostgreSQL (Supabase), JWT HS256, di Vercel |

Folder kerja: `C:\Users\Andika\Documents\OpenPOS - Backendtest\` (frontend di `web/`).
Konfigurasi opencode: `opencode.json` di root.

---

## 2. Kebiasaan Kerja (WAJIB diikuti)

1. **Auto-push**: setelah selesai perubahan frontend, SELALU `git add -A` → `git commit -m "..."` → `git push origin main` (tanpa diminta lagi). Commit message gaya conventional + bahasa Indonesia.
2. **`cd web`** untuk semua perintah npm/tsc/vite.
3. Setiap perubahan wajib lolos: `npx tsc -b` lalu `npm run build` (atau `npm run build` yang sudah include `tsc -b`). Lint: `npm run lint` (oxlint).
4. **Jangan pakai data dummy/mock lokal** untuk fitur bisnis. Asumsikan backend berjalan penuh sesuai kontrak. Kalau butuh endpoint baru → buat file API contract (Method, Path, Request, Response) untuk diserahkan ke backend developer (lihat §7).
5. **Pengecualian dummy**: Landing page BOLEH data demo (produk statis + grafik random) — diminta user, jangan dihapus.
6. Bahasa komunikasi: Indonesia. Komunikasi dengan AI = gaya caveman/ponytail; tapi kode, komentar, commit, docs = normal.

---

## 3. Arsitektur & Alur Data

```
Browser (React SPA) ──REST/JSON──▶ Backend Go (Vercel) ──▶ PostgreSQL (Supabase)
        ▲  JWT access (15 mnt) + refresh (7 hari) ────────┘
```

- Semua data bisnis lewat API. Tidak ada DB lokal (kecuali token & preferensi di localStorage).
- **Auth**: login/register → pasangan token; disimpan `localStorage` `op_access` + `op_refresh`. Auto-refresh: 401 → `POST /auth/refresh` sekali (single-flight) → ulang request.
- **Passcode/PIN**: akun ber-passcode → login balas `401 {"error":"passcode_required"}` → frontend tampil form PIN → ulang request dengan `passcode`.
- **RBAC**: server-side. Kasir (role `cashier`) otomatis di-scope ke transaksinya sendiri; menu admin disembunyikan frontend (`AppShell` `MENU` dengan `adminOnly`).
- **Kasir = sub-akun** (tanpa email/password): dibuat admin via `POST /users {name}`, ganti akun via `POST /auth/switch {target_user_id, passcode?}` dari menu profil kiri bawah.
- **Nomor transaksi `TRX-XXXX`** dihitung GLOBAL di backend (bug PK conflict antar toko sudah diperbaiki backend dengan seq global — JANGAN ubah).

### File frontend penting (`web/src/`)
- `lib/api.ts` — semua helper API + tipe server (`snake_case`) + `request()` (auto-refresh) + `fetchAll()` + `useFetch()`.
- `lib/cache.ts` — `useCache(key, fn)` stale-while-revalidate (TTL 60 dtk, key wajib identitas sesi); semua halaman data memakainya agar navigasi balik instan.
- `lib/store.ts` — sesi (`useDB()`, `setSession`, `toSession`), theme, format (`fmtRp/fmtShort/fmtDate/fmtTime`), `exportCSV`.
- `lib/ui.tsx` — komponen internal (Button, Input, Modal, Pill, Td/Th, PageHead, Empty, StatusPill) + **`TrxItems`** (chip produk + badge qty untuk list transaksi) + **`SkeletonRows`** (baris skeleton dalam `<thead>` asli agar kolom sama persis).
- `lib/google.tsx` — `GoogleButton` (Google Identity Services / GIS), `getGoogleClientId`.
- `lib/ErrorBoundary.tsx` — tampil pesan error, bukan blank.
- `pages/` — Landing, Masuk, Daftar, AppShell, Dashboard, Pos, Produk, Stok, Transaksi, Laporan, Users, Pengaturan.
- `vite.config.ts` — proxy dev `/api` → `http://localhost:8080`.
- `.env.local` — `VITE_API_URL` + `VITE_GOOGLE_CLIENT_ID` (tidak ikut git; `*.local` di gitignore).

---

## 4. Auth & Google Login

- **Daftar email** (`Daftar.tsx`, 4 langkah): Akun (nama/email/sandi) → **OTP** (kode 6 digit; `POST /auth/otp/send` panggil di langkah 1; 409 = email terdaftar → tetap di langkah 1, pesan "Email sudah terdaftar. Silakan masuk."; `sendOtp()` harus `throw` supaya tidak lanjut step) → Nama Toko → Passcode admin 5 digit → register → dashboard.
- **Pilih akun** (`/pilih-akun`, `PilihAkun.tsx`): setelah login email/Google, bila toko punya kasir aktif → pilih Admin (nama+email) atau Kasir (nama; Nonaktif = tak bisa diklik; akun ber-`has_passcode` server langsung ke form PIN, sisanya masuk langsung; kartu Admin verifikasi via switch-to-self). Tanpa kasir aktif → langsung `/app`. Helper `apiHasActiveCashiers()` (fail-open ke `/app`). Switch selalu kirim `role` (hint anti-tabrakan ID admin vs kasir).
- **Google** (`POST /auth/google {id_token, storeName?}`): user baru (created_at < 2 menit) → onboarding nama toko + passcode di `/daftar?google=onboard`; akun lama → langsung `/app`.
- Env yang harus ada: **`VITE_GOOGLE_CLIENT_ID`** di Vercel (wajib prefix `VITE_`, tanpa prefix TIDAK terbaca Vite). Google Cloud Console harus punya origin frontend di Authorized JavaScript origins.
- Register/OTP wajib: `POST /auth/register` tolak email belum verified OTP.

---

## 5. Fitur & Halaman (status terkini)

- **Landing** — selalu light (class `.landing-light` menimpa token tema); demo POS + grafik random; tombol window di card demo sudah dihapus; tanpa menu Shift.
- **Dashboard** — admin: KPI (Omzet/Transaksi/Produk/Stok menipis), bar chart "Penjualan minggu ini" (Senin–Minggu, reset tiap Senin; tanggal backend dipetakan ke bucket minggu berjalan — JANGAN labeli by index), donut metode bayar, produk terlaris, list "Transaksi Terbaru" (produk + qty via `TrxItems`). Kasir: sapaan, kartu "Kasir siap" + Buka POS, 3 KPI hari ini, "Transaksi Saya".
- **POS Kasir** — katalog server, keranjang stok efektif, diskon/pajak dari settings, 5 metode bayar, **Uang Pas** (checkbox di metode Cash → paid=total, tanpa input), checkout ke server, struk redesigned (`#receipt`; print CSS di `index.css` — jangan `inset:0`/width:auto supaya tidak melebar A4).
- **Produk** — CRUD server, search server-side, import/export CSV, kategori (soft-delete `soft_deleted`).
- **Stok** — status + penyesuaian (alasan wajib, cegah negatif) + riwayat movement.
- **Transaksi** — list server-side (filter q/method/date), kolom **Produk** (`TrxItems`), detail, refund (admin), export CSV. Field waktu = **`created_at`** (backend GORM — JANGAN pakai `time`).
- **Laporan** — tab Penjualan/Produk/Profit/Stok + 5 periode + Export CSV; KPI + bar chart omzet harian (agregat frontend dari `transactions[].date`), donut metode, status, top produk, profit trx, nilai stok.
- **Users** — tambah kasir (cukup nama), aktif/nonaktif, **hapus kasir** (modal minta ketik "Konfirmasi" → `DELETE /users/{id}`). Passcode via Pengaturan.
- **Pengaturan** — tab Akun/Toko/Struk/Pajak/Passcode (Akun: profil sesi + keluar + tema; timezone select WIB/WITA/WIT; passcode per akun tombol Ganti/Pasang + badge Aktif •••••/Mati dari `has_passcode` server; section dummy Informasi dihapus).
- **Tema** — default light; dark hanya kalau user memilih (`op_theme`).
- **SISTEM SHIFT = DIBUANG** (di-arsip). Jangan pasang ulang kecuali diminta. Arsip: `docs/archive/API-CONTRACT-CASHIER-SHIFT.md` + history git.

---

## 6. Endpoint yang Dipakai Frontend

| Modul | Endpoint |
|---|---|
| Auth | `POST /auth/register` `{name,email,password,storeName}` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/google` `{id_token}` |
| OTP | `POST /auth/otp/send` `{email}` (409 kalau email terdaftar) · `POST /auth/otp/verify` `{email,code}` |
| Switch akun | `POST /auth/switch` `{target_user_id, passcode?}` |
| Users (admin) | `GET /users` · `POST /users` `{name}` · `PATCH /users/{id}/active` · `DELETE /users/{id}` · `PUT /users/{id}/passcode` `{passcode, role?}` |
| Katalog | `GET|POST /categories` · `DELETE /categories/{id}` · `GET /products` (q/categoryId/active/page/limit) · `POST /products` · `PUT /products/{id}` · `PATCH /products/{id}/active` |
| Stok | `POST /stock/adjustments` `{productId,direction,qty,reason}` · `GET /movements` |
| Transaksi | `POST /transactions` `{items:[{productId,qty}],discount,method,paid,customer}` · `GET /transactions` (q/method/date/page/limit) · `POST /transactions/{id}/refund` |
| Settings | `GET|PUT /settings` |
| Analitik | `GET /dashboard` (role-aware) · `GET /reports?period=today|yesterday|week|month|all` |

Pola: error `{error: "pesan Indonesia"}` langsung ditampilkan. Pagination `{items,total,page,limit}` (page 1-based, limit max 200). Field `snake_case`.

---

## 7. Kontrak & Endpoint Baru (untuk backend developer)

- `docs/API-CONTRACT-EMAIL-OTP.md` — **sudah diimplementasikan backend** (OTP + verifikasi email + 409 di otp/send + register wajib verified).
- Kalau butuh endpoint baru di masa depan: buat file contract (Method, Path, Request, Response, Error) di `docs/`, serahkan ke teman backend, jangan menunggu implementasi — frontend siap dengan fallback/empty-state jujur.

---

## 8. Bug-fix penting (jangan regresi)

- **`created_at`** bukan `time` untuk transaksi (backend GORM).
- **Kategori/users null** → `api.ts` normalisasi `?? []` (backend kadang kirim `null` untuk toko kosong).
- **Chart dashboard**: pakai `type="monotone"` (natural spline overshoot → garis turun menabrak label); `domain=[0,'auto']`; XAxis `height={30}` + `interval={0}` + `padding` supaya label Sen/Min tidak kepotong; bar chart 7 hari ada `CartesianGrid` horizontal + YAxis `fmtShort`.
- **Session/role switch**: data dashboard dikunci per `sessionKey = id:role` (crash `Cannot read properties of undefined (reading 'map')` saat kasir→admin karena data bentuk lama dirender sebelum fetch ulang). Dashboard & Transaksi fetch ulang saat `sessionKey` berubah.
- **`sendOtp()` di Daftar** harus `throw` setelah `setErr` (kalau tidak, `.then(setStep(2))` tetap jalan walau 409).
- **Vite env**: hanya `VITE_*` yang kebaca frontend.
- **Landing** force light via `.landing-light` CSS (menimpa token) — jangan hapus.

---

## 9. Verifikasi & Testing

- Untuk test visual end-to-end: bisa pakai Edge headless + CDP (port 9222/9223, `--remote-debugging-port`), inject token ke localStorage (`op_access`/`op_refresh`), screenshot. Vercel auto-deploy ±90–110 detik setelah push — tunggu sebelum verify.
- Akun test produksi: `akun-demo@example.com` / password `REDACTED` / passcode `REDACTED` (akun demo, role admin, terverifikasi).
- Ganti ke kasir: buat kasir via `POST /users` lalu `POST /auth/switch` (tanpa passcode kalau kasir baru), injek token ke browser.

---

## 10. Arsitektur Backend (konteks, dari repo adrr-dev/openPOS)

- Go (gin + GORM), migrasi SQL di `migrations/`, tabel: stores, users, cashiers, categories, products, stock_movements, transactions, transaction_items, refunds, refresh_tokens, email_otps.
- `users` = admin (email/password), `cashiers` = sub-akun (nama saja), nomor ID bisa bentrok antar tabel → `role` disambiguasi di `PUT /users/{id}/passcode`.
- Deploy Vercel: env `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` (isi domain frontend + localhost:5173). Tanpa CORS yang benar → browser "Failed to fetch".
- OTP dikirim via SMTP Gmail (App Password) — kalau "Username and Password not accepted" itu config SMTP, bukan kode.

---

## 11. Catatan gaya

- Komunikasi AI sesi ini: caveman/ponytail (tersingkat). Kode tetap normal.
- Push tiap perubahan, commit jelas (feat:/fix:/style:/docs:/revert:).
- Jangan sentuh backend repo (hanya frontend `OpenPOS-Test`).