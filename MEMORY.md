# MEMORY.md — OpenPOS Frontend (Session Handoff)

> Baca file ini dulu sebelum bekerja. Ringkasan project, arsitektur, repo,
> deploy, kebiasaan kerja, dan keputusan teknis semua sesi.
> Referensi detail: `PROJECT.md`, `updatelist9sep.MD`, `docs/*`.
> Backend dokumen: repo `adrr-dev/openPOS` (README = kontrak API).
> **Repo ini publik — JANGAN pernah menulis kredensial/secret ke file mana pun.**

---

## 1. Identitas & Repo

| Item | Nilai |
|---|---|
| Project | **OpenPOS** — sistem kasir (POS) web gratis untuk UMKM Indonesia |
| Repo frontend (aktif) | **`https://github.com/0xMinomus/OpenPOS-Test`** — branch `main`, **PUBLIK** |
| Repo backend | **`https://github.com/adrr-dev/openPOS`** — ditangani teman (Adrr) |
| Frontend produksi | **`https://open-pos-deploy.vercel.app`** (Vercel, auto-deploy tiap push) |
| Backend produksi | **`https://openpos-api.vercel.app/api/v1`** (Vercel) |
| Stack frontend | Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui (preset `nova`, Base UI) + Recharts + lucide + Poppins |
| Stack backend | Go + gin/GORM, PostgreSQL (Supabase), JWT HS256, di Vercel |

Folder kerja: `C:\Users\Andika\Documents\OpenPOS - Backendtest\` (frontend di `web/`).
Konfigurasi opencode: `opencode.json` (MCP: hanya context7; Playwright TIDAK ter-wire).

**Peristiwa penting 10 Sep 2026:** history git di-rewrite (166 commit) untuk
menghapus kredensial akun yang tak sengaja ter-commit. **Semua SHA commit lama
yang disebut di dokumen lama (updatelist9sep dll) sudah TIDAK valid** — pakai
`git log`. Branch `main` + tag `v0.1.0`–`v0.2.2` sudah bersih di GitHub;
releases + assets utuh. Sisa: rotate password + passcode akun demo (belum
dilakukan; lihat §9).

---

## 2. Kebiasaan Kerja (WAJIB diikuti)

1. **Auto-push**: setelah selesai perubahan frontend, SELALU `git add -A` → `git commit -m "..."` → `git push origin main` (tanpa diminta lagi). Commit message gaya conventional + bahasa Indonesia.
2. **`cd web`** untuk semua perintah npm/tsc/vite.
3. Setiap perubahan wajib lolos: `npx tsc -b` lalu `npm run build` (build sudah include `tsc -b`). Lint: `npm run lint` (oxlint; warning lama yang ada jangan ditambah).
4. **Jangan pakai data dummy/mock lokal** untuk fitur bisnis. Kalau butuh endpoint baru → buat file API contract (Method, Path, Request, Response, Error) di `docs/`, serahkan ke backend, jangan menunggu implementasi — frontend siap dengan fallback/empty-state jujur.
5. **Pengecualian dummy**: Landing page BOLEH data demo (produk statis + grafik random) — diminta user, jangan dihapus.
6. **SECURITY HYGIENE (baru, wajib)**: repo publik → jangan commit kredensial, token, `op_access`, `.env`, laporan celah. Sebelum commit besar, cek `git diff --cached` untuk string sensitif. `.env.local` sudah gitignored (`*.local`) dan tidak pernah ke-track.
7. Bahasa komunikasi: Indonesia. Komunikasi dengan AI = gaya caveman/ponytail; kode, komentar, commit, docs = normal.

---

## 3. Arsitektur & Alur Data

```
Browser (React SPA) ──REST/JSON──▶ Backend Go (Vercel) ──▶ PostgreSQL (Supabase)
        ▲  JWT access (15 mnt) + refresh (7 hari) ────────┘
```

- Semua data bisnis lewat API. Tidak ada DB lokal.
- **Auth (10 Sep)**: token disimpan di **`sessionStorage` per-tab** (`op_access` + `op_refresh`) — dua tab/akun di browser yang sama tidak saling menimpa. Token legacy di `localStorage` dimigrasikan sekali saat load lalu dihapus. Auto-refresh: 401 → `POST /auth/refresh` sekali (single-flight) → ulang request. Logout mengirim header `Authorization` + `refresh_token` lalu `clearTokens()` (termasuk cache akun).
- **Konsekuensi**: sesi tidak bertahan setelah tab/browser ditutup (trade-off keamanan; login ulang).
- **Passcode/PIN**: akun ber-passcode → login balas `401 {"error":"passcode_required","code":"PASSCODE_REQUIRED"}` (field `code` menyusul deploy Adrr; frontend baca `data.code ?? data.error`) → frontend tampil form PIN → ulang request dengan `passcode`. Google login juga butuh passcode; frontend sudah punya alur PIN Google (`Masuk.tsx`/`Daftar.tsx`).
- **RBAC**: server-side. Kasir otomatis di-scope ke transaksinya sendiri; menu admin disembunyikan (`AppShell` `MENU` `adminOnly`) **dan** route admin diblokir `AdminOnly` guard (`App.tsx` → redirect `/app`). Backend juga `ActiveCheck` per request (akun nonaktif → 401 langsung).
- **Kasir = sub-akun** (tanpa email/password): dibuat admin via `POST /users {name}`, ganti akun via `POST /auth/switch {target_user_id, passcode?, role?}` dari menu profil kiri bawah. Switch ke admin WAJIB passcode admin (backend enforce).
- **Nomor transaksi `TRX-XXXX`** dihitung GLOBAL di backend (seq global — JANGAN ubah).

### File frontend penting (`web/src/`)
- `lib/api.ts` — semua helper API + tipe server (`snake_case`) + `request()` (auto-refresh, `ApiError.code = data.code ?? data.error`) + `fetchAll()` + `useFetch()`. Notifikasi: `Notification` (type string, `category?`, `actor_name?`, `reference_*`) + `apiListNotifications` (category/status/page/limit) + `apiGetNotifUnreadCount` (fallback list) + `apiMarkNotifRead`/`apiMarkAllNotifsRead` + `apiDeleteNotif`. Presence: `apiHeartbeat` (`POST /presence/heartbeat`, best-effort 404-diabaikan). Audit: `apiListActivity` (null bila endpoint belum live). Token helpers: `getToken/hasToken/clearTokens/saveTokens` (sessionStorage + migrasi + `op_accounts` per-tab).
- `lib/cache.ts` — `useCache(key, fn)` stale-while-revalidate (TTL 60 dtk, key wajib identitas sesi); ganti key set `loading:true` jujur.
- `lib/notifications.tsx` — **`NotifBell`** baru (admin-only): tab Semua/Stok/Transaksi/Sistem, paginasi "Muat lebih banyak", tandai semua, waktu relatif, ikon per kategori (`low_stock` menipis kuning vs habis merah dari parsing "tersisa 0"), deep-link stok/transaksi, batas 10 per jenis (hapus terlama, best-effort client). `categoryOf` = **type menang atas `category`** (backend pernah salah label).
- **Aplikasi native offline (Electron)** — lihat `docs/NATIVE-OFFLINE-APP.md`. Ringkas: `lib/localdb.ts` (`localStorage` `op_offline_db`) + `lib/local-api.ts` (adapter signature `api.ts`, baca via `getLocalDB()` — jangan `useLocalDB` di fungsi non-hook). Halaman `pages/offline/*` = salinan cloud. Entry `offline.html` + `offline-main.tsx` (HashRouter, base `./`, `dist-offline/`). Shell `web/electron/`. Build: `npm run electron:build` → `release-out/`. `/unduh` → link GitHub Releases. Kendala mesin Andika: app "Orca" mengunci dir build → EPERM (tutup Orca / build ke temp).
- `lib/store.ts` — sesi (`useDB()`, `setSession`, `toSession`), theme, format (`fmtRp/fmtShort/fmtDate/fmtTime`, **`fmtInv`** `#TRX-00050`), `exportCSV`.
- `lib/ui.tsx` — Button, Input, **NumInput** (autospacing ribuan, `allowDecimal` untuk pajak), Modal, Pill, Td/Th, PageHead, Empty, StatusPill, **`TrxItems`**, **`SkeletonRows`**, **`Pager`** (angka + ‹ ›, null bila 1 halaman), **`DatePicker`** (kalender popover tanpa dep, `YYYY-MM-DD`, panel `right-0`).
- `lib/google.tsx` — `GoogleButton` (GIS), `getGoogleClientId`.
- `lib/ErrorBoundary.tsx` — tampil pesan error, bukan blank.
- `pages/` — Landing, Masuk, Daftar, AppShell (menu + `NotifBell` + heartbeat 30 dtk), Dashboard, Pos, Produk, Stok, Transaksi, Laporan, **Karyawan** (`/app/karyawan`, menu admin, ikon IdCard), Users, Pengaturan, Unduh. Route admin di-guard `AdminOnly` (`App.tsx`).
- `web/vercel.json` — rewrite SPA + **header keamanan** (XFO DENY, CSP `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy).
- `vite.config.ts` — proxy dev `/api` → `http://localhost:8080`.
- `.env.local` — `VITE_API_URL` + `VITE_GOOGLE_CLIENT_ID` (gitignored).

---

## 4. Auth & Google Login

- **Daftar email** (`Daftar.tsx`, 4 langkah): Akun → **OTP** → Nama Toko → Passcode admin 5 digit → register. `POST /auth/otp/send` dipanggil di langkah 1. **Sejak deploy backend 10 Sep**, email terdaftar dibalas `200` generik (bukan 409) — wizard lanjut ke langkah 2; frontend memberi hint "Jika email ini sudah terdaftar, masuk di sini" + link `/masuk`. (409 lama tetap ditangani bila backend balekkan.)
- **Pilih akun** (`/pilih-akun`): setelah login email/Google, bila toko punya kasir aktif → pilih Admin/Kasir; akun ber-`has_passcode` server ke form PIN; helper `apiHasActiveCashiers()` fail-open. Switch selalu kirim `role`.
- **Google** (`POST /auth/google {id_token, storeName?, passcode?}`): user baru (created_at < 2 menit) → onboarding `/daftar?google=onboard`; akun lama ber-passcode → **PIN dulu** (backend baru enforce; frontend sudah siap dua arah — `googleCred` state lalu ulangi dengan passcode).
- Env wajib: **`VITE_GOOGLE_CLIENT_ID`** di Vercel (prefix `VITE_`). Origin frontend harus terdaftar di Google Cloud Console.
- Register/OTP: `POST /auth/register` tolak email belum verified OTP.
- Backend sedang menyiapkan field `code` machine-readable (`PASSCODE_REQUIRED`/`PASSCODE_WRONG`) — belum di-push/deploy per 10 Sep malam; frontend sudah kompatibel.

---

## 5. Fitur & Halaman (status terkini)

- **Landing** — selalu light (`.landing-light`); demo POS + grafik random; tanpa menu Shift.
- **Dashboard** — admin: KPI, chart "Penjualan" (bar biru `--chart-1`, `cursor={false}`, `[&_:focus]:outline-none`), donut metode + legenda %, tabel Transaksi Terbaru statis tanpa hover (invoice `#TRX-` dari `id`), ranking produk. Kasir: sapaan, KPI hari ini, "Transaksi Saya".
- **POS Kasir** — katalog server, keranjang stok efektif, diskon/pajak settings, 5 metode bayar, Uang Pas, checkout, struk (`#receipt`; print CSS jangan diubah melebar).
- **Produk** — CRUD server, search server-side, filter kategori client, import/export CSV, kategori di modal toolbar, paging 15 (`Pager`).
- **Stok** — inventory workspace: 4 kartu, toolbar, tab Stok Saat Ini (10/hal) | Riwayat, baris statis, aksi teks Penyesuaian, deep-link `?tab=riwayat`.
- **Transaksi** — workspace: 4 kartu, search + `DatePicker` + pill metode, tabel (Pelanggan dari `t.customer`, Kasir admin-only, `TrxItems`, aksi Detail/Refund, baris statis), mobile kartu, 10/hal, export CSV. Waktu = **`created_at`** (JANGAN `time`).
- **Laporan** — 5 tab (Penjualan/Produk/Profit/Stok/Karyawan) + 5 periode + Export CSV. Loading jujur saat pindah periode/tab; sticky dibatalkan (overflow-x global). Detail di `updatelist9sep.MD` item 13–20.
- **Karyawan** — halaman analitik kasir (menu mandiri `/app/karyawan`).
- **Notifikasi (LIVE, admin-only)** — `lib/notifications.tsx`: badge unread, tab kategori, muat lebih banyak, tandai baca, poll 60 dtk, batas 10 per jenis (best-effort; kontrak retensi §9 untuk backend). Backend kini kirim `low_stock`/`out_of_stock`/`transaction_created` + `category`.
- **Users** — redesign: 4 kartu (Total/Kasir Aktif/Admin/Nonaktif), toolbar search + status + sort, tabel 7 kolom (Aksi 3-dot: Nonaktifkan/Aktifkan/Hapus + konfirmasi) + kartu mobile, paging 10, Export CSV semua akun, section "Aktivitas Pengguna Terbaru" (audit live bila ada, fallback turunan user+trx) + "Kasir Teraktif Hari Ini" (top3, link `/app/karyawan`). **Status tunggal Online/Offline** (dari `online`/`last_seen_at`; heartbeat 30 dtk; tanpa data = Offline). Filter role & tulisan passcode dihapus (permintaan user).
- **Pengaturan** — tab Akun/Toko/Struk/Pajak/Passcode.
- **Tema** — default light; dark via `op_theme`.
- **SISTEM SHIFT = DIBUANG** (arsip `docs/archive/API-CONTRACT-CASHIER-SHIFT.md`). Jangan pasang ulang.

---

## 6. Endpoint yang Dipakai Frontend

| Modul | Endpoint |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` (+`passcode`) · `POST /auth/refresh` · `POST /auth/logout` (+Authorization) · `GET /auth/me` · `POST /auth/google` `{id_token, storeName?, passcode?}` |
| OTP | `POST /auth/otp/send` `{email}` (200 generik bila terdaftar) · `POST /auth/otp/verify` `{email,code}` |
| Switch akun | `POST /auth/switch` `{target_user_id, passcode?, role?}` |
| Users (admin) | `GET /users` · `POST /users` `{name}` · `PATCH /users/{id}/active` · `DELETE /users/{id}` · `PUT /users/{id}/passcode` `{passcode, role?}` |
| Presence | `POST /presence/heartbeat` (tiap 30 dtk; 404 diabaikan) |
| Katalog | `GET|POST /categories` · `DELETE /categories/{id}` · `GET /products` (q/categoryId/active/page/limit) · `POST /products` · `PUT /products/{id}` · `PATCH /products/{id}/active` |
| Stok | `POST /stock/adjustments` `{productId,direction,qty,reason}` · `GET /movements` |
| Transaksi | `POST /transactions` · `GET /transactions` (q/method/date/page/limit; limit di-clamp 200) · `POST /transactions/{id}/refund` |
| Settings | `GET|PUT /settings` |
| Analitik | `GET /dashboard` (role-aware) · `GET /reports?period=today|yesterday|week|month|all` |
| Notifikasi (LIVE, admin-only; kasir 403) | `GET /notifications` (category/status/page/limit) · `GET /notifications/unread-count` (kontrak; fallback list) · `PATCH /notifications/{id}/read` · `PATCH /notifications/read-all` · `DELETE /notifications/{id}` |
| Activity (kontrak, belum live) | `GET /activity` (page/limit; null → fallback turunan) |

Pola: error `{error: "pesan Indonesia"}` (+`code` opsional). Pagination `{items,total,page,limit}` (page 1-based, limit max 200). Field `snake_case`. Rate limit auth: login 5/mnt/IP, switch 10/mnt/user+IP, forgot 3/mnt/IP (429 + pesan Indonesia).

---

## 7. Kontrak & Endpoint Baru (untuk backend developer)

- `docs/API-CONTRACT-EMAIL-OTP.md` — **sudah diimplementasikan**.
- `docs/API-CONTRACT-ADMIN-NOTIFICATIONS.md` — notifikasi admin + event pemicu + retensi 10/jenis (sebagian sudah live; `unread-count` + retensi menyusul).
- `docs/API-CONTRACT-PRESENCE.md` — heartbeat + `online`/`last_seen_at` (sudah live).
- `docs/API-CONTRACT-USER-ACTIVITY.md` — audit log (belum live; section pakai fallback).
- `docs/BUG-REPORT-AUTH-REFRESH-CASHIER.md` + `docs/patches/fix-refresh-acting-as.patch` — **sudah diterapkan & deploy oleh Adrr** (arsip).
- Aturan: buat kontrak dulu, serahkan ke Adrr, frontend siap fallback jujur.

---

## 8. Bug-fix penting (jangan regresi)

- **`created_at`** bukan `time` untuk transaksi.
- **Kategori/users null** → normalisasi `?? []`.
- **Chart dashboard**: `type="monotone"`, `domain=[0,'auto']`, XAxis `height={30}` + `interval={0}`, CartesianGrid horizontal + YAxis `fmtShort`.
- **Session/role switch**: data dashboard dikunci per `sessionKey = id:role`.
- **`sendOtp()` di Daftar** harus `throw` setelah `setErr` (tetap dipertahankan untuk 409 bila backend balek).
- **Vite env**: hanya `VITE_*` yang kebaca.
- **Landing** force light via `.landing-light` — jangan hapus.
- **Recharts**: kutipan lengkap di `updatelist9sep.MD` item 1/3 (`cursor={false}`, `[&_:focus]:outline-none`, `--color-<key>` harus cocok, artefak full-page capture).
- **Laporan `t.date` hanya tanggal**; agregat jam dari `created_at`.
- **Token sesi = `sessionStorage` per-tab** (10 Sep) — jangan balik ke localStorage global; migrasi legacy hanya sekali di `api.ts`.
- **`ApiError.code`** = `data.code ?? data.error` — jangan ganti ke `data.error` saja.
- **`app` route guard**: `AdminOnly` untuk produk/stok/laporan/karyawan/users/pengaturan — jangan hapus.
- **Notif kategori**: `type` menang atas `category` (backend pernah kirim `low_stock` berlabel `sistem`).
- **`otp/send` email terdaftar kini `200` generik** (anti-enumerasi) — jangan asumsikan 409.
- **Rate limit auth**: jangan spam login/switch saat uji (5–10/mnt) atau kena 429.

---

## 9. Verifikasi & Testing

- Verifikasi cepat: `npx tsc -b`, `npm run build`, `npm run lint`.
- Browser uji: **Playwright** (terinstall no-save di `C:\Users\Andika\AppData\Local\Temp\opencode\pw`, dipakai via `require('playwright')` + `channel: 'msedge'`) dan/atau Edge headless + CDP. Vercel auto-deploy ±90–110 dtk setelah push — tunggu sebelum verify.
- **Jebakan harness (terbukti)**: `/json/new` TIDAK otomatis navigasi — selalu `Page.navigate` + poll `location.href` sebelum inject storage; `--disable-web-security` membuat `sessionStorage` "Access denied" di `about:blank` (artefak, bukan bug app); dev server listen `::1` (pakai `localhost:`); backend preflight CORS dari `localhost:5173` 403 → browser dev butuh `--disable-web-security`; token access 15 mnt (login ulang tiap sesi uji); rate limit auth bisa 429 saat uji beruntun.
- **Akun demo**: kredensial TIDAK disimpan di repo (repo publik). Minta ke owner. **TODO owner: rotate password (Lupa sandi) + passcode — kredensial lama pernah terekspos dan sudah dibersihkan dari repo, tapi belum dirotasi.**
- **Laporan audit keamanan**: privat di `C:\Users\Andika\AppData\Local\Temp\opencode\SECURITY-AUDIT-OPENPOS-2026-09-10.md` — JANGAN commit ke repo publik. Backup pra-rewrite: `C:\Users\Andika\AppData\Local\Temp\opencode\openpos-test-backup.bundle`.

---

## 10. Arsitektur Backend (konteks)

- Go (gin + GORM), tabel: stores, users, cashiers, categories, products, stock_movements, transactions, transaction_items, refunds, refresh_tokens, email_otps, notifications.
- `users` = admin (email/password), `cashiers` = sub-akun; ID bisa bentrok antar tabel → `role` disambiguasi di `PUT /users/{id}/passcode` & switch.
- Refresh token kini menyimpan `acting_as_cashier_id` (fix 10 Sep) — sesi kasir bertahan lintas refresh; `Logout` menandai entity presence yang benar.
- Middleware: `Auth` (JWT) + `ActiveCheck` (cek akun aktif tiap request — ada biaya query; kandidat cache) + rate limit + security headers.
- Deploy Vercel: env `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`. OTP via SMTP Gmail (App Password).
- Adrr punya perubahan lokal yang **belum push/deploy** per 10 Sep malam: `code:"PASSCODE_REQUIRED"/"PASSCODE_WRONG"` + `GoogleLogin` cek passcode. Frontend sudah siap dua arah.

---

## 11. Catatan gaya

- Komunikasi AI: caveman/ponytail (tersingkat). Kode/komentar/commit/docs normal.
- Push tiap perubahan, commit jelas (feat:/fix:/style:/docs:/refactor:).
- **Jangan sentuh repo backend** (hanya frontend `OpenPOS-Test`); kontrak/laporan ditulis di `docs/` untuk diteruskan.
- Skill `impeccable` dipakai untuk redesign; `PRODUCT.md` wajib ada; reviewer bawaan tak ada di harness → ronde screenshot + detector sebagai pengganti.

---

## 12. Aplikasi Native Offline (Electron) — status

- Dua produk: web cloud + desktop Windows offline (Electron, `localStorage`).
- Offline 1:1 dengan webapp (halaman disalin + adapter `local-api.ts`); fitur akun kasir/RBAC/passcode tidak ada (single owner).
- Rilis: v0.1.0 → v0.2.0 → v0.2.1 → **v0.2.2** (versi di `web/package.json`). Installer via GitHub Releases; `/unduh` menunjuk daftar rilis.
- Dokumentasi: `docs/NATIVE-OFFLINE-APP.md`. Verifikasi: `npm run electron:smoke`.
- **Porting offline BELUM dikerjakan** untuk seluruh perubahan 9–10 Sep (checklist di `updatelist9sep.MD`; perhatikan SHA lama di dokumen itu sudah tidak valid karena history rewrite).

---

## 13. Sesi 9 Sep 2026 — ringkasan (detail: `updatelist9sep.MD`)

1. Dashboard: tooltip kecil + `cursor={false}`, bar biru, outline klik mati, baris statis.
2. Produk: baris statis + paging 15.
3. Stok: redesign workspace + 5 revisi.
4. Transaksi: redesign + `DatePicker` + 10/halaman.
5. Laporan: header + loading jujur + tab + slot jam + komparasi kemarin + `fmtInv`.
6. Karyawan: subpage baru.
7. Notifikasi: bel header (kini sudah dikembangkan jadi panel penuh — lihat §14).
8. File bersama: `PRODUCT.md`, `Pager`/`DatePicker`/`fmtInv`, `useCache` loading jujur.
9. Porting offline belum — ikut §12.

---

## 14. Sesi 10 Sep 2026 — notifikasi, Users, auth, keamanan

### Notifikasi admin (redesign, LIVE)
- `lib/notifications.tsx` (admin-only): tab kategori, paginasi, tandai baca, cap 10/jenis (best-effort), waktu relatif, ikon per kategori, deep-link. `type` menang atas `category`.
- Backend notification system sudah live (admin bisa list; kasir 403). `unread-count` + retensi 10/jenis menyusul (kontrak §7).

### User Management (redesign)
- 4 kartu, toolbar, tabel + mobile, aksi 3-dot + konfirmasi, aktivitas (fallback turunan), kasir teraktif top3, Export CSV, paging 10.
- Presence: heartbeat 30 dtk (`AppShell`) + status tunggal Online/Offline. Filter role dihapus.

### BUG kritis sesi/auth — SELESAI & TERVERIFIKASI
- **C1**: refresh token tak simpan `acting_as` → sesi kasir jadi admin tiap refresh. Fix backend (patch diterapkan Adrr, deploy `e69f7d1`): kolom `acting_as_cashier_id`, validasi, Logout presence benar. Terverifikasi live: refresh kasir tetap `acting_as`, admin tetap admin, token lama 401.
- **Frontend**: sesi per-tab `sessionStorage`, migrasi legacy, `op_accounts` per-tab, logout kirim Authorization. Terverifikasi: dua tab beda akun tidak saling menimpa.

### Hardening keamanan (deploy backend `e69f7d1` + frontend)
- Backend: rate limit login/switch/forgot (XFF tidak bisa bypass), `ActiveCheck` per request, header keamanan, revoke semua sesi saat reset sandi, passcode wajib untuk switch ke admin, respons anti-enumerasi, clamp limit transaksi.
- Frontend: header `vercel.json`, route guard `AdminOnly`, `ApiError.code`, alur PIN Google, hint OTP email terdaftar.
- Residual (boleh skip untuk lomba): pesan `otp/send` masih beda antar kasus, rate limiter in-memory (Redis), perf ActiveCheck, backoff switch per akun, kompleksitas sandi, JWT aud/iss.

### Kebersihan repo (10 Sep)
- History rewrite 166 commit + force-push main/tags → kredensial email/password/passcode akun demo hilang dari semua ref GitHub (main + tag bersih; releases + assets utuh). Commit lama masih bisa diakses via URL SHA langsung (praktis rendah; rotate kredensial = solusi final).
- Aturan baru: kredensial TIDAK boleh masuk repo. `MEMORY.md` §9 diarahkan ke owner.

---

## 15. TODO lanjutan (untuk sesi berikutnya)

**Owner (Andika):**
1. **Rotate kredensial akun demo**: password via "Lupa sandi" + passcode di Pengaturan (WAJIB, belum dilakukan).
2. Kirim ke Adrr: push+deploy perubahan lokal (`code` field + Google passcode), lalu beri kabar untuk verifikasi final dari frontend.
3. Putuskan N1: samakan pesan `otp/send` (rekomendasi) atau balekkan 409 — frontend sudah aman dua arah.
4. Porting offline (opsional, saat mau rilis desktop lagi) — §12.
5. Gladi bersih alur utama sekali sebelum lomba.

**Adrr (backend):**
1. Push+deploy `code:"PASSCODE_REQUIRED"/"PASSCODE_WRONG"` + cek passcode di `GoogleLogin`.
2. Samakan pesan `otp/send` email terdaftar vs baru.
3. Opsional: cache `ActiveCheck`, rate-limit store terdistribusi, backoff switch per akun.

**Catatan lomba:** semua celah serius sudah tertutup; sisa item = hardening yang boleh diskip. Jangan deploy besar-besaran mepet hari-H; freeze setelah gladi.
