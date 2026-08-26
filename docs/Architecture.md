# Architecture.md — OpenPOS Backend & Integrasi

**Versi:** 1.0 (disetujui)
**Status:** Siap implementasi
**Referensi:** `docs/PRD.md` (FR-*, NFR-*), frontend di `web/`

---

## 1. Keputusan Arsitektur (disetujui)

| # | Keputusan | Pilihan |
|---|---|---|
| Q1 | Stack backend | Node.js + TypeScript + **Fastify** (satu bahasa dengan frontend, share tipe via `shared/`) |
| Q2 | Database | **PostgreSQL** — default Railway Postgres (satu platform dengan deploy), alternatif Neon/Supabase |
| Q3 | Deployment | Server persistent di **Railway / Fly.io / Render** (bukan serverless) |
| Q4 | Auth | **JWT access (15 menit) + refresh token (httpOnly cookie, 7 hari)**; passcode PIN 5 digit tetap ada, di-hash |
| Q5 | Struktur repo | Folder **`server/`** di repo ini + **`shared/`** untuk tipe bersama frontend/backend |
| Q6 | Data lama | **Mulai bersih** — fresh DB, seed produk demo + admin/123, tanpa migrasi localStorage |
| Q7 | Multi-device sync | **Polling ~30 detik** saat app aktif (WebSocket = future, G6) |
| Q8 | Upload | **Cloudflare R2 (S3-compatible)** presigned upload; logo toko + foto produk (opsional) |
| Q9 | Forgot password | **Ditunda** (P1) — MVP: admin reset password kasir; akun sendiri via passcode |

Non-negosiasi (dari PRD): uang **integer**, stok **atomic dengan row locking**, RBAC **di API**, audit log **immutable**, pagination **server-side**, validasi **di setiap endpoint**.

---

## 2. Struktur Repo

```
.
├── docs/
├── web/                     # frontend (Vite + React, sudah ada)
├── shared/                  # tipe bersama (dipakai web/ & server/)
│   └── types.ts             # Product, Trx, Category, Account, API request/response
├── server/
│   ├── package.json
│   ├── drizzle.config.ts
│   ├── migrations/
│   ├── scripts/seed.ts
│   └── src/
│       ├── index.ts         # entry: build Fastify app, listen
│       ├── app.ts           # buildApp(): plugin wiring (testable)
│       ├── config.ts        # env parsing + validasi
│       ├── db/
│       │   ├── client.ts    # Pool + drizzle instance
│       │   └── schema.ts    # tabel drizzle (satu sumber kebenaran skema)
│       ├── plugins/
│       │   ├── cors.ts
│       │   ├── auth.ts      # JWT verify preHandler + RBAC helper
│       │   └── error.ts     # error handler terpusat
│       ├── routes/
│       │   ├── auth.ts      # register/login/refresh/logout/me/passcode
│       │   ├── products.ts
│       │   ├── categories.ts
│       │   ├── stock.ts
│       │   ├── transactions.ts
│       │   ├── refunds.ts
│       │   ├── users.ts
│       │   ├── settings.ts
│       │   ├── reports.ts
│       │   ├── import.ts
│       │   ├── uploads.ts
│       │   └── audit.ts
│       ├── services/        # logika bisnis berat (stok, transaksi, laporan)
│       │   ├── stock.ts     # adjustStock() — atomic
│       │   ├── checkout.ts  # createTransaction() — atomic
│       │   └── reports.ts   # agregasi SQL
│       ├── lib/
│       │   ├── jwt.ts
│       │   ├── hash.ts      # bcrypt
│       │   └── r2.ts        # presigned URL (opsional)
│       └── utils/errors.ts  # AppError + kode error
└── vercel.json / web/       # frontend deploy (tidak berubah)
```

Prinsip: **routes tipis, services pegang transaksi DB** (satu tempat untuk atomic stock), semua input lewat **zod schema per route**.

---

## 3. Database Schema (PostgreSQL + Drizzle)

Konvensi: `uuid` PK (`gen_random_uuid()`), timestamps `timestamptz`, uang **integer** (rupiah, tanpa desimal), `created_at` default `now()`.

### users
| kolom | tipe | catatan |
|---|---|---|
| id | uuid PK | |
| store_id | uuid FK → stores | |
| email | text | unik per store (`unique(store_id, email)`) |
| password_hash | text | bcrypt |
| passcode_hash | text nullable | PIN 5 digit, bcrypt |
| name | text | |
| role | enum('admin','cashier') | |
| active | boolean default true | login/refresh tolak bila false (EC-007) |
| created_at | timestamptz | |

### stores
| kolom | tipe | catatan |
|---|---|---|
| id | uuid PK | |
| name | text | |
| timezone | text default 'Asia/Makassar' | |
| created_at | timestamptz | |

### store_settings
| kolom | tipe | catatan |
|---|---|---|
| store_id | uuid PK FK → stores | |
| address | text default '' | |
| phone | text default '' | |
| tax_enabled | boolean default false | |
| tax_pct | numeric(5,2) default 0 | persen, dihitung server |
| receipt_header | text | |
| receipt_footer | text | |
| paper | text default '58mm' | '58mm' \| '80mm' |
| logo_url | text nullable | dari R2 |
| currency | text default 'IDR' | FR-SET-004 (fixed MVP) |

### categories
| kolom | tipe | catatan |
|---|---|---|
| id | uuid PK | |
| store_id | uuid FK | |
| name | text | |
| active | boolean default true | soft-delete bila masih dipakai (FR-CAT-002, EC-003) |
| created_at | timestamptz | |
| unik: `(store_id, name)` | | |

### products
| kolom | tipe | catatan |
|---|---|---|
| id | uuid PK | |
| store_id | uuid FK | |
| category_id | uuid FK nullable → categories | |
| name | text | |
| sku | text | unik per store (FR-PROD-003) |
| barcode | text nullable | unik per store bila diisi (FR-PROD-004) |
| buy_price | integer | |
| sell_price | integer | |
| stock | integer default 0 | `>= 0` constraint |
| unit | text default 'pcs' | FR-PROD-007 |
| image_url | text nullable | R2 |
| active | boolean default true | nonaktif = tidak muncul di POS (FR-PROD-006), histori aman (FR-PROD-005) |
| created_at | timestamptz | |
| unik: `(store_id, sku)`, `(store_id, barcode)` | | |

### stock_movements
| kolom | tipe | catatan |
|---|---|---|
| id | uuid PK | |
| store_id | uuid FK | |
| product_id | uuid FK | |
| type | enum('initial','sale','refund','adjust') | |
| qty | integer | + tambah / − kurang |
| reason | text | wajib untuk 'adjust' (FR-INV-002) |
| ref | text nullable | mis. TRX-0001 / REF-... |
| actor_id | uuid FK → users | FR-INV-003 |
| created_at | timestamptz | |
| indeks: `(product_id, created_at)` | | |

### transactions
| kolom | tipe | catatan |
|---|---|---|
| id | uuid PK | |
| store_id | uuid FK | |
| seq | integer | per store, dihitung via `nextval`-like (lihat layanan) |
| trx_no | text | `TRX-` + padStart(4) dari seq, unik per store |
| cashier_id | uuid FK → users | |
| status | enum('pending','completed','cancelled','refunded') | FR-POS-011 |
| subtotal | integer | |
| discount | integer default 0 | |
| tax | integer default 0 | dihitung server |
| total | integer | |
| method | enum('Cash','Bank Transfer','QRIS','E-Wallet','Card') | |
| paid | integer | cash: input; non-cash: = total |
| change | integer default 0 | |
| customer_name | text nullable | CUST-001 (opsional) |
| created_at | timestamptz | |
| indeks: `(store_id, created_at desc)`, `(store_id, status)` | | |

### transaction_items
| kolom | tipe | catatan |
|---|---|---|
| id | uuid PK | |
| transaction_id | uuid FK → transactions | |
| product_id | uuid FK nullable | |
| name | text | **snapshot** (EC-008) |
| sku | text | snapshot |
| buy_price | integer | snapshot (profit laporan) |
| price | integer | snapshot |
| qty | integer | |

### refunds
| kolom | tipe | catatan |
|---|---|---|
| id | uuid PK | |
| store_id | uuid FK | |
| transaction_id | uuid FK | FR-REF-002 |
| ref_no | text | `REF-` + padStart(4), unik per store |
| reason | text | |
| items | jsonb | `[{productId, qty}]` (refund parsial per item, P1) |
| by_id | uuid FK → users | |
| created_at | timestamptz | |

### refresh_tokens
| kolom | tipe | catatan |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| token_hash | text | hash refresh token |
| expires_at | timestamptz | 7 hari |
| revoked | boolean default false | |
| created_at | timestamptz | |

### audit_logs
| kolom | tipe | catatan |
|---|---|---|
| id | bigserial PK | |
| store_id | uuid FK | |
| actor_id | uuid FK nullable → users | |
| action | text | mis. `product.update`, `transaction.refund`, `user.create` |
| entity | text nullable | id target |
| meta | jsonb default '{}' | |
| created_at | timestamptz | |

Append-only: **tanpa UPDATE/DELETE** (NFR-010). Semua aksi administratif + transaksi + refund ditulis dalam transaction DB yang sama dengan aksinya.

---

## 4. Autentikasi & Otorisasi

### Flow
1. **Register** → buat store + user admin (FR-AUTH-001) → auto login (set cookie refresh + return access).
2. **Login** → cek email (per store? email login global `(store_id, email)`; MVP: satu store per akun — email unik **global** untuk simpel, cek `where email`) → bcrypt verify → kalau `passcode_hash` ada: balas `{ passcodeRequired: true }` → client kirim `POST /auth/passcode` → verify PIN → issue token.
3. **Refresh** → cookie httpOnly → validasi hash di `refresh_tokens`, cek `active` (EC-007) → issue access baru.
4. **Logout** → revoke refresh token + hapus cookie.

### Token
- **Access JWT**: payload `{ sub: userId, storeId, role }`, 15 menit, HS256, secret `JWT_SECRET`.
- **Refresh**: random 256-bit, disimpan **hash** di DB, httpOnly cookie `openpos_refresh`, `SameSite=None; Secure` (frontend & API beda domain), `Path=/api/auth`.

### RBAC (NFR-004, EC-002)
- Middleware `requireAuth` (verify JWT) + `requireAdmin` (role admin).
- Matriks per route — lihat tabel §5 kolom **Akses** (admin/kasir).
- Kasir: transaksi sendiri (FR-TRX-002), dashboard ringkas (FR-DASH-003), produk read-only.

### Passcode (PIN 5 digit)
- Di-hash bcrypt di `passcode_hash`. Wajib 5 digit, diset/dihapus via `PUT /settings/passcodes/:userId` (admin).
- `POST /auth/passcode` rate-limited 5/menit.

---

## 5. REST API — Referensi Lengkap

Base: `/api`. Header: `Authorization: Bearer <access>` kecuali dinyatakan. Error format:
```json
{ "error": { "code": "STOCK_INSUFFICIENT", "message": "Stok tidak cukup untuk Beras Premium 5 kg", "details": {} } }
```
Kode HTTP: 400 validasi, 401 token, 403 role, 404, 409 konflik (SKU duplikat), 422 stok, 500.

### 5.1 Auth — `auth.ts`
| Method & Path | Akses | Body | Sukses |
|---|---|---|---|
| POST `/api/auth/register` | publik | `{storeName, name, email, password}` | `201 {user, store, accessToken}` + cookie refresh |
| POST `/api/auth/login` | publik | `{email, password}` | `200 {user, accessToken}` atau `{passcodeRequired: true}` + cookie |
| POST `/api/auth/passcode` | publik (rate-limit) | `{email, passcode}` | `200 {user, accessToken}` |
| POST `/api/auth/refresh` | publik (cookie) | — | `200 {accessToken}` |
| POST `/api/auth/logout` | auth | — | `204` + hapus cookie |
| GET `/api/auth/me` | auth | — | `200 {user, store, settings}` |
| PUT `/api/auth/password` | auth | `{oldPassword, newPassword}` | `204` (min 8 char) |

### 5.2 Produk — `products.ts`
| Method & Path | Akses | Body | Sukses |
|---|---|---|---|
| GET `/api/products?search=&categoryId=&page=1&limit=20&includeInactive=false` | admin, kasir (read-only, tanpa includeInactive) | — | `200 {items, total, page, limit}` (NFR-008) |
| GET `/api/products/:id` | admin, kasir | — | `200 product` |
| POST `/api/products` | admin | `{name, sku, barcode?, categoryId?, buyPrice, sellPrice, stock, unit}` | `201` (SKU dup → 409) |
| PUT `/api/products/:id` | admin | sama + opsional | `200` |
| DELETE `/api/products/:id` | admin | — | `204` (**soft**: `active=false`, FR-PROD-005) |
| POST `/api/products/import` | admin | CSV multipart | lihat §8 |

Validasi: `buyPrice >= 0`, `sellPrice >= 0`, `stock >= 0`, integer.

### 5.3 Kategori — `categories.ts`
| Method & Path | Akses | Body | Sukses |
|---|---|---|---|
| GET `/api/categories` | admin, kasir | — | `200 [{id, name, active, productCount}]` |
| POST `/api/categories` | admin | `{name}` | `201` (dup → 409) |
| PUT `/api/categories/:id` | admin | `{name}` | `200` |
| DELETE `/api/categories/:id` | admin | — | `204` (soft-delete bila dipakai produk — EC-003) |

### 5.4 Stok — `stock.ts`
| Method & Path | Akses | Body | Sukses |
|---|---|---|---|
| GET `/api/stock/movements?productId=&page=1&limit=50` | admin | — | `200 {items, total}` |
| POST `/api/stock/adjustments` | admin | `{productId, delta, reason}` | `201 movement` |
| GET `/api/stock/summary` | admin, kasir | — | `200 [{productId, name, sku, stock, status}]` |

**Aturan** (FR-INV-002/006/007): `reason` wajib; `stock + delta >= 0` wajib (422 kalau negatif); ditulis bersama `stock_movements` dalam **satu transaction** + audit log.

### 5.5 Transaksi — `transactions.ts`
| Method & Path | Akses | Body | Sukses |
|---|---|---|---|
| POST `/api/transactions` | admin, kasir | `{items: [{productId, qty}], discount, method, paid?, customerName?}` | `201 trx` (status `completed`) |
| GET `/api/transactions?from=&to=&method=&status=&search=&page=1&limit=20` | admin: semua; kasir: otomatis `cashierId = me` (FR-TRX-002) | — | `200 {items, total}` |
| GET `/api/transactions/:id` | admin; kasir hanya miliknya | — | `200 trx + items` |
| GET `/api/transactions/receipt/:id` | admin, kasir | — | `200 trx + items` (client cetak) |
| POST `/api/transactions/:id/refund` | admin | `{items: [{productId, qty}], reason}` | `201 refund` |

**Checkout (service `checkout.ts`)** — **satu DB transaction** (FR-POS-009, EC-001, AC):
1. `SELECT ... FOR UPDATE` semua produk yang dibeli.
2. Validasi stok `>= qty` per item → gagal: `422 STOCK_INSUFFICIENT` + **rollback** (semua perubahan batal).
3. Hitung subtotal, diskon, pajak (server!), total. Uang integer.
4. **Round rule (RULE-MONEY-001)**: `tax = Math.round((subtotal - discount) * taxPct / 100)`, `total = subtotal - discount + tax`.
5. Cash: `paid` wajib dan `>= total` (FR-POS-008); non-cash: `paid = total`.
6. Insert transaction (+ items snapshot), decrement stok, insert stock_movements (`sale`), increment `seq`, audit log.
7. Balas `201` + `trxNo`.

Kasir **tidak bisa**: refund (FR-REF-001), cancel.

### 5.6 Refund — `refunds.ts` (FR-REF-001/004/005/006)
- Input: item + qty per item (partial/full — FR-REF-003).
- Dalam satu transaction: cek status `completed` (EC-004 — tolak bila `refunded`), insert refund, **restore stok**, insert movements (`refund`), status → `refunded` bila penuh, audit log.
- Refund tidak menghapus transaksi asli (FR-REF-002).

### 5.7 Users — `users.ts` (FR-USR-*)
| Method & Path | Akses | Body | Sukses |
|---|---|---|---|
| GET `/api/users` | admin | — | `200 [{id, name, email, role, active, createdAt}]` (tanpa hash) |
| POST `/api/users` | admin | `{name, email, password}` (role cashier) | `201` |
| PUT `/api/users/:id/active` | admin | `{active}` | `204` (soft — histori aman, FR-USR-004) |
| PUT `/api/users/:id/password` | admin | `{newPassword}` | `204` (reset kasir, pengganti forgot password) |

### 5.8 Pengaturan — `settings.ts` (FR-SET-*)
| Method & Path | Akses | Body | Sukses |
|---|---|---|---|
| GET `/api/settings` | admin, kasir (baca) | — | `200 settings` |
| PUT `/api/settings` | admin | `{address, phone, taxEnabled, taxPct, receiptHeader, receiptFooter, paper, timezone}` | `200` |
| PUT `/api/settings/passcodes/:userId` | admin | `{passcode}` (5 digit) atau `{passcode: null}` hapus | `204` |
| PUT `/api/settings/logo` | admin | presigned → `{url}` | `200` (R2) |

### 5.9 Laporan — `reports.ts` (FR-RPT-*)
Semua menerima `from` & `to` (ISO date, server timezone) + `period` preset (`today|yesterday|week|month`) — FR-RPT-006. Admin only (FR-RPT-008).
| Method & Path | Sukses |
|---|---|
| GET `/api/reports/sales` | `{totalSales, totalTransactions, itemsSold, profit, byMethod[], byCashier[], byCategory[], series[]}` |
| GET `/api/reports/products` | best/lowest: `[{productId, name, sku, qty, revenue, profit}]` |
| GET `/api/reports/profit` | per transaksi + ringkasan |
| GET `/api/reports/inventory` | current stock + nilai |
| GET `/api/reports/transactions?status=` | by status |
| GET `/api/reports/export?report=&from=&to=&format=csv` | file CSV (XLSX/PDF P1) |

Agregasi **SQL di server** — frontend hanya render (FR-DASH-004, NFR-008).

### 5.10 Upload — `uploads.ts` (R2, Q8)
| Method & Path | Akses | Body | Sukses |
|---|---|---|---|
| POST `/api/uploads/presign` | admin | `{filename, contentType}` | `200 {uploadUrl, publicUrl}` |
| GET `/api/uploads/:key` | admin, kasir | — | file (atau public URL langsung dari R2) |

Client upload langsung ke `uploadUrl` (presigned PUT), simpan `publicUrl` ke produk/logo. **Foto produk opsional — frontend tidak wajib mengirim.**

### 5.11 Audit — `audit.ts` (NFR-010)
| Method & Path | Akses | Sukses |
|---|---|---|
| GET `/api/audit?page=1&limit=50&action=` | admin | `200 {items, total}` |

---

## 6. Validasi & Security

- **Zod** schema per route (`server/src/routes/*.schema.ts` atau inline) — body/query/params. Fastify `schema` + manual verify untuk yang kompleks.
- **Bcrypt** (cost 10) untuk password & passcode (FR-AUTH-004).
- **@fastify/rate-limit**: `/auth/login`, `/auth/passcode`, `/auth/register` → 5/menit/IP.
- **CORS**: allow `FRONTEND_URL` (Vercel domain), `credentials: true`, metode terbatas.
- **Helmet** (via `@fastify/helmet`).
- **Uang integer di semua lapisan** (NFR-003) — `z.number().int()`.
- **Input penuh**: nama trim, email lowercase + regex, SKU uppercase-normalisasi, diskon `0 <= d <= subtotal`.
- **SQL injection**: hanya via Drizzle parameterized.
- **JWT secret** minimal 32 char, dari env.
- **Pagination wajib** di semua list (NFR-008): `page >= 1`, `limit <= 100`.

---

## 7. Audit Log (immutable)

Ditulis **di dalam transaction** aksi untuk: product create/update/deactivate, category create/update/delete, stock adjustment, transaction create, refund, user create/deactivate/password reset, settings update, passcode set. `action` format: `module.verb` (`product.update`). Tidak ada endpoint update/delete.

---

## 8. Import Produk (CSV) — `import.ts` (FR-IE-001)

1. `POST /api/products/import` multipart CSV (kolom: `nama,sku,barcode,kategori,harga_beli,harga_jual,stok`).
2. Server parse → validasi per baris (SKU wajib/unik, harga angka) → balas **preview**: `{rows: [{row, status: 'ok'|'error', message}], okCount, errorCount}`.
3. `POST /api/products/import/commit` dengan `{strategy: 'skip'|'update'}` (EC-006) → insert/update dalam satu transaction + audit.
4. Response `{imported, updated, skipped, errors}`.

---

## 9. Env Variables (server)

```env
PORT=4000
DATABASE_URL=postgres://...
JWT_SECRET=<min 32 char acak>
FRONTEND_URL=https://openpos.vercel.app
NODE_ENV=production
# R2 (opsional)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=openpos-uploads
R2_PUBLIC_URL=https://pub-xxx.r2.dev
# Seed (dev)
SEED_ADMIN_EMAIL=admin
SEED_ADMIN_PASSWORD=123
```

Frontend env (`web/.env`): `VITE_API_URL=https://api-domain.com/api`.

---

## 10. Integrasi Frontend (setelah backend siap)

1. **`web/src/lib/api.ts`** — fetch wrapper: baseURL dari `VITE_API_URL`, inject Bearer, refresh-on-401 (1× retry), error normalize ke `AppError`.
2. **Auth**: `useSession()` menggantikan `store.ts` session — state dari `GET /auth/me`; login/register/logout panggil API. Passcode flow: login → `passcodeRequired` → prompt PIN.
3. **Data**: `store.ts` (localStorage) dihapus bertahap → hook `useQuery`-style polling: setiap 30 detik fetch data aktif (POS, dashboard, stok) — polling ditaruh di halaman yang butuh (POS + dashboard).
4. **Seed local** (produk demo) hanya untuk dev; production murni API.
5. **Akun demo**: seed server `admin`/`123` (tanpa passcode) — konsisten dengan frontend saat ini.

---

## 11. Testing (minimal wajib)

- Vitest + Fastify `app.inject()` (tanpa jaringan) untuk: checkout (stok cukup/kurang, atomic), refund, auth flow, RBAC (kasir kena 403 produk write), SKU duplikat.
- Helper: build app dengan DB test terpisah + migrate + seed.
- Satu test per aturan bisnis kritis (EC-001 simulasi dua checkout).

---

## 12. Milestones Implementasi (urutan)

1. **Scaffold**: `server/` + `shared/`, Fastify + Drizzle + config + healthcheck + CORS.
2. **DB**: schema lengkap + migration pertama + seed script.
3. **Auth**: register/login/refresh/logout/me/passcode + RBAC middleware + rate limit.
4. **Master data**: kategori + produk (CRUD, soft-delete, validasi, pagination).
5. **Stok**: adjustment + movements + summary (atomic).
6. **POS**: checkout service (transaksi DB atomic + stok) + transaksi list/detail.
7. **Refund**: full/partial + status lifecycle.
8. **Users + Settings** (termasuk passcode per akun).
9. **Laporan**: 5 endpoint agregasi + export CSV.
10. **Import CSV** + **Upload R2**.
11. **Audit log** terpasang di semua aksi + endpoint audit.
12. **Hardening**: rate limit, helmet, error format seragam, test suite.
13. **Integrasi frontend**: `api.ts`, ganti store, polling, env, deploy bersama.

Setiap milestone deployable terpisah — frontend tetap jalan dengan localStorage sampai integrasi (milestone 13).

---

## 13. Deploy (Railway/Fly.io)

- Dockerfile sederhana: `node:22-alpine` → build TS → run `node dist/index.js`.
- Plugin Postgres Railway (DATABASE_URL otomatis).
- Domain API: `https://openpos-api.up.railway.app` → set `FRONTEND_URL` di env, CORS.
- Vercel frontend: tambah `VITE_API_URL` di Project Settings → Rebuild.
- Backup: Railway volume / pg_dump terjadwal (opsional).