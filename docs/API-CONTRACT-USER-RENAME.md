# API Contract — Ganti Nama Kasir

> Untuk backend developer (Adrr). Frontend sudah siap memanggil endpoint ini
> (`apiRenameUser` di `web/src/lib/api.ts`, menu "Ganti nama" di User Management).
> Sampai endpoint live, aksi ini 404 dan frontend menampilkan error apa adanya.

## PATCH /users/{id}

Mengganti nama akun kasir dalam toko yang sama.

- **Auth:** Bearer Token (Hanya Admin, seperti endpoint `/users` lain).
- **Path params:** `id` — ID angka akun kasir (lihat catatan tabrakan ID
  `users` vs `cashiers` di catatan lokal `MEMORY.md` §10; disambiguasi seperti
  endpoint `/users/{id}` lain yang sudah ada).
- **Request:**

```json
{ "name": "Andi Kasir Baru" }
```

- **Response sukses (`200 OK`):**

```json
{ "message": "Nama kasir diperbarui." }
```

atau objek user terbaru — salah satu, konsisten dengan gaya endpoint lain.

- **Error yang diharapkan:**
  - `400 Bad Request` — `{"error": "Nama kasir wajib diisi."}` (nama kosong).
  - `400 Bad Request` — `{"error": "Hanya akun kasir yang dapat diubah."}` (bila id milik admin).
  - `404 Not Found` — `{"error": "Akun tidak ditemukan di toko Anda."}`

## Catatan frontend

- Menu hanya tampil untuk akun kasir (bukan admin, bukan diri sendiri).
- Validasi client: nama non-kosong; tanpa perubahan = tutup modal.
- Setelah sukses: reload daftar + cache akun (`op:accounts-changed` flow existing).
