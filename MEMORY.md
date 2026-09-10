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
- `lib/api.ts` — semua helper API + tipe server (`snake_case`) + `request()` (auto-refresh) + `fetchAll()` + `useFetch()`. Notifikasi: `Notification` + `apiListNotifications`/`apiMarkNotifRead`/`apiMarkAllNotifsRead` (kontrak `frontend_notifications.ts` backend; prod masih 404 — pending deploy).
- `lib/cache.ts` — `useCache(key, fn)` stale-while-revalidate (TTL 60 dtk, key wajib identitas sesi); **ganti key kini set `loading:true` jujur** (mount/back-nav tak berubah; filter/paging dapat indikator).
- **Aplikasi native offline (Electron)** — lihat `docs/NATIVE-OFFLINE-APP.md` (dokumen khusus). Ringkas: `lib/localdb.ts` (data `localStorage` `op_offline_db`) + `lib/local-api.ts` (adapter signature `api.ts`, baca via `getLocalDB()` — jangan `useLocalDB` di fungsi non-hook). Halaman `pages/offline/*` = salinan cloud (impor data diganti `../../lib/local-api`). Entry `offline.html` + `offline-main.tsx` (HashRouter, base `./`, `dist-offline/`). Onboarding nama pemilik+toko di `OfflineShell`. Shell `web/electron/`. Build: `npm run electron:build` → `release-out/`. `/unduh` → link GitHub Releases. Kendala mesin Andika: app "Orca" mengunci dir build → EPERM (tutup Orca / build ke temp).
- `lib/store.ts` — sesi (`useDB()`, `setSession`, `toSession`), theme, format (`fmtRp/fmtShort/fmtDate/fmtTime`, **`fmtInv`** `#TRX-00050`), `exportCSV`.
- `lib/ui.tsx` — komponen internal (Button, Input, **NumInput** (angka: autospacing ribuan 1000→1.000, titik/koma manual diabaikan, `allowDecimal` untuk pajak), Modal, Pill, Td/Th, PageHead, Empty, StatusPill) + **`TrxItems`** (chip produk + badge qty untuk list transaksi) + **`SkeletonRows`** (baris skeleton dalam `<thead>` asli agar kolom sama persis) + **`Pager`** (angka + ‹ › ringkas, window >7, `page/total/onChange/className?`, null bila 1 halaman — dipakai Produk/Stok/Transaksi) + **`DatePicker`** (kalender popover tanpa dep baru: trigger + nav bulan + Sen–Min + today/selected + Hari ini/Hapus; nilai `YYYY-MM-DD`; panel `right-0` anti-overflow; dipakai filter tanggal Transaksi).
- `lib/google.tsx` — `GoogleButton` (Google Identity Services / GIS), `getGoogleClientId`.
- `lib/ErrorBoundary.tsx` — tampil pesan error, bukan blank.
- `pages/` — Landing, Masuk, Daftar, AppShell (menu + **`NotifBell`** bel notifikasi header kanan), Dashboard, Pos, Produk, Stok, Transaksi, Laporan, **Karyawan** (`/app/karyawan`, menu admin setelah Laporan, ikon IdCard), Users, Pengaturan.
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
- **Dashboard** — admin: KPI (Omzet/Transaksi/Produk/Stok menipis, tanpa tren), chart "Penjualan" (label tanggal asli `3 Sep` dari `sales7[].date`; bar biru `--chart-1`; tooltip `cursor={false}` + box kecil; `[&_:focus]:outline-none` anti-outline klik), donut metode + legenda %, tabel Transaksi Terbaru statis tanpa hover (invoice `#TRX-00046` dari `id`; `seq` tak dikirim list), ranking Produk Terlaris + revenue. donut metode bayar, produk terlaris, list "Transaksi Terbaru" (produk + qty via `TrxItems`). Kasir: sapaan, kartu "Kasir siap" + Buka POS, 3 KPI hari ini, "Transaksi Saya".
- **POS Kasir** — katalog server, keranjang stok efektif, diskon/pajak dari settings, 5 metode bayar, **Uang Pas** (checkbox di metode Cash → paid=total, tanpa input), checkout ke server, struk redesigned (`#receipt`; print CSS di `index.css` — jangan `inset:0`/width:auto supaya tidak melebar A4).
- **Produk** — CRUD server, search server-side, filter kategori client + badge jumlah, import/export CSV, kategori dikelola di modal toolbar (hapus = pindahkan produk ke Tanpa Kategori dulu agar hard-delete tanpa popup). Paging 15/halaman (`Pager` angka + ‹ ›, kanan).
- **Stok** — REDESIGN jadi inventory workspace: 4 kartu (Total/Aman/Menipis/Habis, threshold existing 0/<=5), toolbar search + dropdown kategori proper, tab Stok Saat Ini (15→10/halaman via `Pager`) | Riwayat, baris statis, kolom Stok tengah, aksi teks Penyesuaian, modal penyesuaian utuh (alasan wajib, cegah negatif). Deep-link `?tab=riwayat`.
- **Transaksi** — REDESIGN jadi workspace: 4 kartu (Total, Omzet, Hari Ini via dashboard, Rata-rata; fetch-all ikut filter), toolbar search + **`DatePicker`** + pill metode, tabel (Invoice `#TRX-`, tanggal compact, Pelanggan dari `t.customer`, Kasir admin-only, Produk chips, Total menonjol, aksi teks Detail/Refund, baris statis), mobile kartu, detail modal + Pelanggan, 10/halaman `Pager`, export CSV. Field waktu = **`created_at`** (backend GORM — JANGAN pakai `time`).
- **Laporan** — REDESIGN 5 tab (Penjualan/Produk/Profit/Stok/**Karyawan**) + 5 periode + Export CSV. Header: pill periode + segmented tab + loading jujur (dim + "Memuat…", tanpa layout shift; sticky dibatalkan — `overflow-x:hidden` global mematikan sticky). Penjualan: KPI + komparasi kemarin (khusus Hari ini), chart Bar+Line (slot Pagi/Siang/Sore/Malam untuk 1 hari; tooltip range jam), donut center+%, tabel invoice+status, top5 revenue. Produk: KPI (Qty/Unik/Pendapatan/Aktif x-dari-y), bar horizontal, donut kategori (join katalog), tabel + Selengkapnya, Perlu Perhatian. Profit: KPI + komparasi (HPP invert panah), chart Pendapatan+HPP+Profit, line margin %, tabel profit, insight valid ≤5. Stok: KPI, bar nilai/kategori, donut status, tabel menipis, movement 5 global. **Karyawan** (tab ke-5, data = bundle laporan): KPI, bar per kasir (selector Nilai/Transaksi/Rata-rata), donut proporsi, tren 5 garis, ranking inisial, transaksi 8, Perubahan vs kemarin.
- **Notifikasi (baru, pending backend deploy)** — `NotifBell` header kanan: badge unread, panel 20 terbaru, klik = tandai baca (+ ke `/app/stok` untuk low_stock), tandai semua, poll 60 dtk, empty jujur.
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
| Notifikasi (PENDING deploy — prod masih 404) | `GET /notifications` (page/limit/unread) · `PATCH /notifications/{id}/read` · `PATCH /notifications/read-all` · `DELETE /notifications/{id}` |

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
- **Recharts tooltip cursor**: CSS `ChartContainer` (`[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted`) mengalahkan prop `fill` — untuk matikan highlight pakai `cursor={false}`, bukan `fill:'transparent'`.
- **Outline klik chart (Recharts 3)**: fokus jatuh ke `g.recharts-zIndex-layer_*` dalam state `:focus` (BUKAN `:focus-visible`) + outline default browser — varian `[&_:focus-visible]` GAGAL; pakai `[&_:focus]:outline-none` scoped ke chart.
- **Bar hitam karena salah nama var**: `fill="var(--color-x)"` harus cocok dengan key config ChartContainer (`--color-<key>`); salah nama = hitam pekat (ketahuan via screenshot, bukan tsc).
- **Headless full-page capture** kadang tak merender bar/donut (artefak harness); verifikasi via screenshot viewport + geometri DOM (`getBoundingClientRect` + jumlah path).
- **Laporan `t.date` hanya tanggal** (`YYYY-MM-DD`) — agregat per jam ambil dari `created_at` daftar transaksi (`Trx.items[].buy_price` untuk HPP/slot).
- **Report transactions tak ada**: `customer` (kolom Pelanggan laporan dibatalkan), `created_at`/`status` per baris (pakai `date`/tanpa status), `min_stock`, movement `SKU`/`before`/`after`.

---

## 9. Verifikasi & Testing

- Untuk test visual end-to-end: bisa pakai Edge headless + CDP (port 9222/9223, `--remote-debugging-port`), inject token ke localStorage (`op_access`/`op_refresh`), screenshot. Vercel auto-deploy ±90–110 detik setelah push — tunggu sebelum verify.
- **Jebakan harness CDP (terbukti)**: dev server hanya listen `::1` (pakai `localhost:`, bukan `127.0.0.1`); `/json/new` butuh PUT; `localStorage` hanya setelah navigasi komit (poll `location.href`); backend **preflight CORS dari localhost:5173 sedang 403** → browser butuh `--disable-web-security`; token access 15 mnt (login ulang tiap sesi uji); target baru kadang blank (profil fresh + tanpa poll-hammer).
- Skrip CDP reusable di `C:\Users\Andika\AppData\Local\Temp\opencode\cdp_*.js` (login, klik, baca DOM, screenshot).
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
- Skill `impeccable` dipakai untuk redesign (Stok/Transaksi/Laporan/Karyawan): Q&ACollege dulu untuk gap data, `PRODUCT.md` (root) wajib ada, detector `scripts/detect.mjs` bersih tiap selesai, reviewer bawaan tak ada di harness → ronde screenshot jadi pengganti (disclose).

---

## 13. Sesi 9 Sep 2026 — ringkasan perubahan (detail: `updatelist9sep.MD` 22 item)

1. Dashboard: tooltip tanpa box besar (undo → box kecil + `cursor={false}`), bar biru, outline klik mati, baris Transaksi statis.
2. Produk: baris statis + paging 15 (`Pager` angka).
3. Stok: redesign workspace + 5 revisi (statis, stok tengah, aksi teks, tanpa angka tab, dropdown kategori, 10/halaman).
4. Transaksi: redesign + `DatePicker` kalender + baris statis + 10/halaman.
5. Laporan: header global (tanpa dot, tanpa sticky) + loading jujur + tab Penjualan/Produk/Profit/Stok + slot jam Pagi–Malam + komparasi kemarin + `fmtInv`.
6. Karyawan: subpage baru (menu mandiri, ikon IdCard) — rencana tab di-undo.
7. Notifikasi: bel header (pending backend deploy).
8. File bersama: `PRODUCT.md` (baru), `Pager`/`DatePicker`/`fmtInv`, `useCache` loading jujur.
9. Porting offline BELUM dikerjakan — checklist di `updatelist9sep.MD`.

---

## 12. Aplikasi Native Offline (Electron) — status

- **Dua produk**: web cloud (backend) + desktop Windows offline (Electron, `localStorage`).
- Offline 1:1 dengan webapp (halaman disalin + adapter `local-api.ts`); fitur akun
  kasir/RBAC/passcode TIDAK ada di offline (single owner, onboarding nama+toko).
- **Rilis**: v0.1.0 (awal) → v0.2.0 (1:1) → v0.2.1 (one-click, ukuran dikecilkan) → **v0.2.2** (input angka autospacing `NumInput` di semua field cloud+offline; installer kembali wizard pilih lokasi). Versi di `web/package.json`.
- Installer di `web/release-out/` (gitignored), didistribusikan via GitHub Releases;
  `/unduh` menunjuk daftar rilis.
- Dokumentasi lengkap: `docs/NATIVE-OFFLINE-APP.md`. Verifikasi: `npm run electron:smoke`.

---

## 14. Sesi 10 Sep 2026 — notifikasi, Users, auth (BUG PENTING)

### Notifikasi admin (redesign)
- Komponen pindah ke `web/src/lib/notifications.tsx` (bell admin-only, tab
  Semua/Stok/Transaksi/Sistem, muat lebih banyak, tandai baca, batas 10 per
  jenis hapus-terlama best-effort). Kontrak: `docs/API-CONTRACT-ADMIN-NOTIFICATIONS.md`.
- Kategori: `type` menang atas label `category` (backend sempat kirim
  `low_stock` berlabel `sistem`). Sistem khusus event akun (passcode, kasir on/off).

### User Management (redesign)
- `web/src/pages/Users.tsx` rewrite: 4 kartu, toolbar search/status/sort,
  tabel 7 kolom + kartu mobile, aksi 3-dot, aktivitas + kasir teraktif,
  Export CSV semua akun. Filter role & tulisan passcode dihapus (permintaan).
- Status tunggal Online/Offline (presence). Heartbeat 30 dtk di `AppShell` →
  `POST /presence/heartbeat`. Kontrak: `docs/API-CONTRACT-PRESENCE.md`.
  Interim tanpa data: semua tampil Offline (jujur).
- Audit log user menunggu `docs/API-CONTRACT-USER-ACTIVITY.md`; section
  aktivitas sementara dari data turunan (akun dibuat + transaksi).

### BUG sesi/auth (root cause + fix)
- **Backend**: refresh token tak menyimpan `acting_as` → `POST /auth/refresh`
  selalu terbitkan sesi admin; sesi kasir berubah jadi admin tiap access
  token kedaluwarsa (≤15 mnt). Tereproduksi live di produksi.
  Laporan: `docs/BUG-REPORT-AUTH-REFRESH-CASHIER.md`,
  patch siap `git apply`: `docs/patches/fix-refresh-acting-as.patch`
  (kolom `acting_as_cashier_id` di refresh_tokens + validasi + Logout benar).
  **Menunggu Adrr terapkan + deploy.**
- **Frontend** (sudah jalan): token pindah ke `sessionStorage` per-tab →
  dua akun di satu browser tak saling menimpa; `localStorage` legacy
  dimigrasikan sekali lalu dibersihkan; `op_accounts` per-tab + dibersihkan
  saat logout; `apiLogout` kirim header Authorization (presence benar).
- Konsekuensi: sesi tidak lagi bertahan setelah tab/browser ditutup
  (trade-off keamanan; login ulang). Bila ingin persist, bahas ulang desain.

### Catatan verifikasi
- Harness CDP: `/json/new` TIDAK otomatis navigasi — selalu `Page.navigate`
  + poll `location.href` sebelum inject storage. `--disable-web-security`
  membuat `sessionStorage` "Access denied" di `about:blank` (artefak, bukan bug app).
- Uji migrasi per-tab lolos di dev: SS terisi, LS legacy bersih, tab baru
  tidak mewarisi sesi.

## 15. Sesi 10 Sep 2026 — hardening keamanan (audit privat)

- Audit keamanan penuh dijalankan (Playwright + API); laporan detail
  disimpan **privat** di luar repo (repo publik — jangan commit detail celah).
- Backend deploy `e69f7d1`: rate limit login/switch/forgot, ActiveCheck
  per-request, header keamanan API, revoke sesi saat reset sandi, passcode
  wajib untuk switch ke admin, respons anti-enumerasi, clamp limit transaksi.
  Terverifikasi live (termasuk X-Forwarded-For tidak bisa bypass).
- Frontend: header keamanan `web/vercel.json` (XFO/CSP frame-ancestors/
  nosniff/Referrer/Permissions), route guard `AdminOnly` di `App.tsx`,
  `ApiError.code` baca `data.code ?? data.error`, alur passcode Google di
  `Masuk.tsx` + `Daftar.tsx` (PIN lalu ulangi `apiGoogleLogin(cred, store, pin)`),
  hint "email sudah terdaftar → masuk" di langkah OTP `Daftar.tsx`.
- Backend belum push/deploy perbaikan `code:"PASSCODE_REQUIRED"` dan
  GoogleLogin-passcode (diverifikasi prod masih lama) — frontend sudah siap
  dua arah.
- Sisa item backend (rate-limit cache Redis, perf ActiveCheck, enumerasi
  `otp/send` pesan beda) ada di laporan privat.