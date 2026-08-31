# API Contract — Verifikasi Email OTP + Passcode Admin (Registrasi)

> Diserahkan ke backend developer (`adrr-dev/openPOS`) untuk diimplementasikan.
> Status: **diajukan**, belum tersedia di backend produksi.
> Terkait alur registrasi frontend: akun → OTP → nama toko → passcode admin → selesai.

---

## 1. `POST /auth/otp/send` — publik

Mengirim kode OTP 6 digit ke email. Tersimpan di server dengan masa berlaku.

**Request:**
```json
{ "email": "sari@tokosaya.com" }
```

**Response `200`:**
```json
{ "message": "Kode OTP terkirim ke email Anda." }
```

**Error:**
| Status | Body |
|---|---|
| 400 | `{ "error": "Email tidak valid." }` |
| **409** | `{ "error": "Email sudah terdaftar. Silakan masuk." }` — **email sudah punya akun, OTP tidak dikirim** |
| 429 | `{ "error": "Terlalu sering meminta kode. Coba lagi dalam 60 detik." }` |

> **Amendemen:** `POST /auth/otp/send` wajib menolak (409) email yang sudah terdaftar sebagai user/cashier — frontend memakai ini untuk menampilkan larangan di langkah pertama pendaftaran sebelum OTP dikirim.

**Aturan:**
- OTP 6 digit, **kedaluwarsa 10 menit** sejak dikirim.
- Cooldown kirim ulang 60 detik per email (429 bila dilanggar).
- OTP terbaru menggantikan OTP lama untuk email yang sama.
- Email yang sudah terdaftar → **409, OTP tidak dikirim**.

## 2. `POST /auth/otp/verify` — publik

Memverifikasi kode OTP. Sukses → email ditandai **terverifikasi** di server (kolom `email_verified_at` di tabel `users`), sehingga `POST /auth/register` untuk email itu diizinkan.

**Request:**
```json
{ "email": "sari@tokosaya.com", "code": "482913" }
```

**Response `200`:**
```json
{ "verified": true, "message": "Email berhasil diverifikasi." }
```

**Error:**
| Status | Body |
|---|---|
| 400 | `{ "error": "Kode OTP salah." }` (sisa percobaan berkurang) |
| 410 | `{ "error": "Kode OTP sudah kedaluwarsa. Kirim ulang." }` |
| 429 | `{ "error": "Terlalu banyak percobaan. Kirim ulang kode OTP." }` |

**Aturan:**
- Maksimal **3 percobaan** salah per OTP; habis → OTP dicabut, wajib kirim ulang.
- OTP yang sudah dipakai/kedaluwarsa tidak bisa dipakai lagi.

## 3. Perubahan `POST /auth/register` — validasi verifikasi email

Kontrak request/response register **tidak berubah** (`{ name, email, password, storeName }` → user + token pair). Hanya menambah validasi server:

| Status | Body | Kondisi |
|---|---|---|
| 400 | `{ "error": "Email belum diverifikasi. Silakan verifikasi kode OTP terlebih dahulu." }` | `email_verified_at` kosong |

Register tetap sekali jalan: buat Store + akun Admin + langsung login (response sama seperti sekarang).

## 4. Passcode admin — endpoint **sudah ada**, tidak perlu perubahan

`PUT /users/{id}/passcode` `{ "passcode": "12345" }` — dipakai frontend **setelah** register berhasil (user sudah login, jadi bearer token valid; `{id}` dari response register `user.id`). Passcode 5 digit; string kosong = hapus.

---

## Catatan untuk backend developer

- Skema: tambah kolom `email_verified_at TIMESTAMPTZ NULL` di `users` (migrasi baru), plus tabel OTP (atau kolom `otp_code_hash`, `otp_expires_at`, `otp_attempts` di tabel tersendiri `email_otps`).
- Hash OTP pakai bcrypt/SHA-256 seperti passcode (jangan plaintext).
- Kirim email via layanan SMTP/transactional email (mis. Resend/SendGrid) — nilai kredensial lewat env `SMTP_*` / `RESEND_API_KEY`.
- Di lingkungan pengembangan tanpa SMTP, log kode OTP ke stdout agar bisa diuji.

## Alur frontend yang akan memakai kontrak ini

```
1. POST /auth/otp/send {email}
2. POST /auth/otp/verify {email, code}     ← 3x salah → minta kirim ulang
3. POST /auth/register {name, email, password, storeName}   ← 400 bila belum verified
4. PUT /users/{id}/passcode {passcode}     ← passcode admin 5 digit
5. Masuk dashboard
```