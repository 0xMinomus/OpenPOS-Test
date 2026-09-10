# Bug Report — Sesi Kasir Berubah Jadi Admin Tiap Refresh (Auth)

> Untuk backend developer (`adrr-dev/openPOS`). Terkait: `docs/API-CONTRACT-PRESENCE.md`.
> Status: **tereproduksi di produksi**, patch siap tempel:
> `docs/patches/fix-refresh-acting-as.patch` (5 file, 141 baris).
> Frontend sudah ditambal di repo ini (sesi per-tab, `web/src/lib/api.ts`).

---

## 1. Ringkasan

Refresh token menyimpan hanya `UserID` owner (admin). Konteks "sedang
bertindak sebagai kasir" (`acting_as`) hanya hidup di JWT access token,
tidak ikut tersimpan. Akibatnya `POST /auth/refresh` selalu menerbitkan
sesi **admin**, apa pun sesi sebelumnya.

**Dampak keamanan:** pengguna yang mengira memakai akun kasir (scope data
kasir) tanpa sadar memegang token admin — atau sebaliknya, sesi berganti
identitas tanpa login ulang. Batch kasir yang bekerja lama (access token
kedaluwarsa 15 menit) pasti mengalaminya: begitu auto-refresh jalan, sesi
jadi admin. Berlaku lintas perangkat, bukan cuma satu browser.

---

## 2. Reproduksi live (produksi, 10 Sep 2026)

```
POST /auth/login (admin)            → 200
POST /auth/switch {cashier 16}      → 200 user.role=cashier
  access claims: {"sub":"2","sid":"2","acting_as":"16",...}
POST /auth/refresh (token di atas)  → 200
  respRole: admin
  access claims: {"sub":"2","sid":"2",...}        ← acting_as hilang
```

Setelah refresh, response `user.role: "admin"` dan access token baru tidak
punya `acting_as` — sesi kasir resmi jadi admin.

---

## 3. Akar masalah (kode)

| Lokasi | Masalah |
|---|---|
| `model/models.go:134` | `RefreshToken` tak punya kolom identitas sesi |
| `service/auth.go:766` (`issueTokens`) | `Create(owner.ID, hash, ...)` — `actingAsCashierID` dibuang |
| `service/auth.go:541` (`Refresh`) | `issueTokens(ctx, user.ID, nil)` — hardcoded admin |
| `handler/auth.go:202` | Response refresh pakai `user.Public()` (owner) |
| `service/auth.go:559` (`Logout`) | Menandai `rt.UserID` (owner) offline, bukan entity sesi |

Alur: `Switch` → `issueTokens(owner.ID, &cashierID)` → `acting_as` masuk JWT
tapi **tidak** masuk baris `refresh_tokens`. `Refresh` → baca baris → tak
tahu pernah jadi kasir → terbitkan token admin.

---

## 4. Patch

File: `docs/patches/fix-refresh-acting-as.patch` — `git apply` dari root repo
backend. Ringkas:

1. **`model/models.go`** — `RefreshToken` + kolom `ActingAsCashierID *uint`
   (`json:"-"`, indexed). AutoMigrate (`db/db.go:84`) menambah kolom sendiri.
2. **`repo/refresh.go`** + **`service/interfaces.go`** — `Create` terima
   `actingAsCashierID` dan simpan.
3. **`service/auth.go`**
   - `issueTokens` meneruskan `actingAsCashierID` ke `Create`.
   - `Refresh` memakai `rt.ActingAsCashierID`; validasi kasir masih aktif
     dan satu toko dengan owner; response kembali `*model.PublicUser`
     (kasir bila sesi kasir) dan token baru meneruskan `acting_as`.
   - `Logout` menandai offline entity yang benar (kasir vs owner).
4. **`handler/auth.go`** — `Refresh` merespons `*pubUser` (format sama
   seperti `Switch`); tidak ada perubahan kontrak HTTP.

Belum di-build/di-test di mesin ini (toolchain Go tidak tersedia) — mohon
`go vet ./... && go build ./... && go test ./...` sebelum deploy.

---

## 5. Catatan deploy

- Kolom baru nullable; baris `refresh_tokens` lama bernilai `NULL` (sesi
  lama). Sesi kasir lama tetap balik admin **sekali** setelah deploy —
  kasir cukup switch ulang sekali. Alternatif paling ketat: cabut semua
  refresh token saat deploy (semua orang login ulang).
- `Switch` dan `Login` tidak berubah perilaku. `Me` tidak berubah.
- Setelah deploy, jalankan ulang reproduksi §2: refresh harus mempertahankan
  `acting_as` dan `user.role: "cashier"`.

---

## 6. Sisi frontend (sudah diperbaiki di repo ini)

Akar tambahan: token disimpan di `localStorage` global sehingga dua tab /
akun di browser yang sama saling menimpa (tab admin memakai token kasir
setelah tab lain switch, dan sebaliknya saat reload).

Perbaikan (`web/src/lib/api.ts`):
- Token pindah ke `sessionStorage` — sesi per-tab, dua akun di satu browser
  tidak lagi tabrakan. Token legacy di `localStorage` dimigrasikan sekali.
- Cache daftar akun (`op_accounts`) ikut `sessionStorage` dan dibersihkan
  saat logout — mencegah daftar akun admin terbaca sesi lain.
- `apiLogout` mengirim header `Authorization` agar backend lama/baru dapat
  menandai entity presence yang benar (dan tidak memicu auto-refresh).

Sisa ketergantungan: **patch backend di atas wajib** — tanpa itu, sesi kasir
tetap menjadi admin saat refresh, di browser mana pun.
