# API Contract — Login Google tanpa Passcode (passcode pindah ke menu pilih akun)

> Untuk backend developer (`adrr-dev/openPOS`).
> Status: **diajukan** — frontend saat ini di-revert ke form PIN karena backend masih menagih passcode.
> Tujuan: login Google **langsung masuk** (tanpa PIN). Passcode tetap dipakai saat memilih akun (`POST /auth/switch`).

---

## 1. Perubahan yang diminta (minimal)

Di `service/auth.go`, fungsi `GoogleLogin`, **hapus blok cek passcode** untuk akun lama:

```go
// SEBELUMNYA — dihapus:
if user.PasscodeHash != nil && *user.PasscodeHash != "" {
    if passcode == "" {
        return nil, nil, ErrPasscodeRequired
    }
    if bcrypt.CompareHashAndPassword([]byte(*user.PasscodeHash), []byte(passcode)) != nil {
        return nil, nil, ErrPasscodeWrong
    }
}
```

Setelah blok itu, akun lama langsung `issueTokens` seperti jalur normal.

Yang **tidak perlu diubah**:
- `handler/auth.go`: field `Passcode` di `googleReq` boleh dipertahankan (diabaikan) — tidak wajib dihapus.
- `respondGoogleErr`: kasus `ErrPasscodeRequired`/`ErrPasscodeWrong` boleh dibiarkan (tidak akan terpanggil).
- Akun Google **baru** tetap onboarding seperti sekarang (nama toko + passcode admin di frontend).

## 2. Kontrak

**Request:** `POST /auth/google`
```json
{ "id_token": "eyJ...", "storeName": "Toko Sembako Sari" }
```
`storeName` opsional (hanya untuk akun baru). `passcode` boleh tetap didukung untuk kompatibilitas, tapi tidak diwajibkan.

**Response sukses:** `200` format sama seperti `/auth/register` (token pair + user).

**Error:** tidak ada lagi `401 PASSCODE_REQUIRED` / `PASSCODE_WRONG` dari endpoint ini. Error lain tetap: `401 login Google tidak valid`, `400 Email Google belum diverifikasi.`, `403 Akun dinonaktifkan.`, `500 GOOGLE_CLIENT_ID` belum diset.

## 3. Yang wajib tetap berjalan setelah perubahan

- `POST /auth/switch` ke **admin** tetap wajib passcode — bila admin belum set PIN, tetap `401 passcode_required`. (Di sinilah passcode diminta sekarang: menu pilih admin/kasir.)
- Login email/sandi tetap memakai OTP email (`OTP_REQUIRED`), tidak berubah.
- Registration OTP, forgot-password, presence — tidak tersentuh.

## 4. Cara menguji setelah deploy

1. Login Google dengan akun lama yang **punya passcode** → harus `200` + token (sebelumnya `401 PASSCODE_REQUIRED`).
2. Setelah dapat token, `POST /auth/switch { "target_user_id": <id admin>, "role": "admin" }` tanpa passcode → harus tetap `401 {"code":"PASSCODE_REQUIRED"}`.
3. Kirim passcode yang benar → `200`.
4. Akun Google baru → tetap dibuat + onboarding.

## 5. Koordinasi dengan frontend

Setelah backend live, kabari Andika. Frontend akan menghapus form PIN di halaman login Google (`Masuk.tsx`/`Daftar.tsx`) dan langsung mengarahkan ke `/pilih-akun`. Sebelum itu, frontend sengaja mempertahankan form PIN karena backend masih menagih passcode.
