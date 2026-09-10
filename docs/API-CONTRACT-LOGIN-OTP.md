# API Contract — Login Email/Sandi dengan OTP (pengganti passcode di login)

> Diserahkan ke backend developer (`adrr-dev/openPOS`) untuk diimplementasikan.
> Status: **diajukan**, belum tersedia di backend produksi.
> Tujuan: login manual (email + kata sandi) memakai **OTP email** sebagai faktor
> kedua, bukan passcode. Passcode tetap dipakai di `/auth/switch` (pilih akun)
> dan Google login **tidak berubah**.
> Frontend sudah siap: menerima `OTP_REQUIRED` dan tetap fallback ke form PIN
> bila backend belum diperbarui.

---

## 1. `POST /auth/otp/send` — tambah `purpose` opsional

**Request:**
```json
{ "email": "sari@tokosaya.com", "purpose": "login" }
```

| `purpose` | Perilaku |
|---|---|
| `"login"` | Kirim OTP **walau email sudah terdaftar** (untuk login). Aturan sama: 6 digit, kedaluwarsa 10 menit, cooldown 60 detik, OTP baru menggantikan yang lama. |
| tidak dikirim / nilai lain | Perilaku registrasi sekarang: email terdaftar **tidak dikirim**, tetap balas `200` generik (anti-enumerasi). |

**Response `200`:** sama seperti sekarang (`{ "message": "..." }`).

**Error:** `400 Email tidak valid.` · `429 Terlalu sering meminta kode. Coba lagi dalam 60 detik.`

> OTP login dan OTP registrasi memakai tabel `email_otps` yang sama (satu baris per email), jadi kirim ulang otomatis menggantikan kode sebelumnya.

## 2. `POST /auth/login` — terima `otp` sebagai faktor kedua

**Request:**
```json
{ "email": "sari@tokosaya.com", "password": "...", "otp": "482913" }
```
Field baru `otp` opsional (6 digit). `passcode` tetap diterima untuk kompatibilitas.

**Aturan untuk akun ber-passcode** (kolom `users.passcode_hash` terisi):

| Kondisi request | Hasil |
|---|---|
| password salah | `401` `Email atau kata sandi tidak cocok. Coba lagi.` (OTP **tidak** dikirim/dibuat) |
| `passcode` benar | `200` token pair (jalur lama, dipertahankan) |
| `otp` benar (kode terbaru, belum kedaluwarsa, attempts < 3) | `200` token pair; OTP **dikonsumsi** (setara `RevokeOTP`) agar tidak bisa dipakai ulang |
| `otp` salah | `401` `{"error":"Kode OTP salah.","code":"OTP_WRONG"}` (attempts bertambah) |
| `otp` kedaluwarsa | `410` `{"error":"Kode OTP sudah kedaluwarsa. Kirim ulang.","code":"OTP_EXPIRED"}` |
| attempts ≥ 3 | `429` `{"error":"Terlalu banyak percobaan. Kirim ulang kode OTP.","code":"OTP_MAX_ATTEMPTS"}` |
| tanpa `passcode` dan tanpa `otp` | `401` `{"error":"otp_required","code":"OTP_REQUIRED"}` — **menggantikan** `PASSCODE_REQUIRED` untuk jalur login email/sandi |

Akun **tanpa** passcode: tetap seperti sekarang (langsung token pair).

**Yang tidak berubah:**
- Rate limit login `5/menit/IP` → `429`.
- `POST /auth/google` tetap `401 PASSCODE_REQUIRED` bila akun Google punya passcode.
- `POST /auth/switch` tetap wajib passcode.
- OTP login **tidak** menandai `email_verified_at` (verifikasi registrasi lewat `/auth/otp/verify` tidak tersentuh).

**Catatan implementasi (saran):** `SendOTP` sekarang menolak email terdaftar (`ErrEmailTaken`) — pisahkan helper kirim (mis. `SendLoginOTP`) yang melewati cek itu, lalu di `Login`: bila `passcode_hash` ada dan `passcode == ""` dan `otp == ""` → `ErrOTPRequired`; bila `otp != ""` → verifikasi kode persis seperti `VerifyOTP` lalu `RevokeOTP`.

---

## Alur frontend setelah backend live

```
1. POST /auth/login {email, password}                     → 401 OTP_REQUIRED
2. POST /auth/otp/send {email, purpose:"login"}           → OTP dikirim
3. POST /auth/login {email, password, otp}                → token pair
4. /pilih-akun → POST /auth/switch (+passcode bila perlu)
```

Frontend menampilkan form OTP otomatis pada langkah 1, tombol "Kirim ulang"
dengan cooldown 60 detik, dan membersihkan input saat `OTP_WRONG`.

## Fallback backend lama

Bila backend belum diperbarui (login masih membalas `PASSCODE_REQUIRED`),
frontend **tetap menampilkan form PIN** seperti sekarang — login tidak rusak.
Setelah kontrak ini live, form PIN di jalur login email/sandi tidak pernah muncul lagi.
