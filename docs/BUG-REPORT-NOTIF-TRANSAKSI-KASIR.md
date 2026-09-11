# Bug Report — Notifikasi Transaksi Dibuat Juga untuk Checkout Admin

> Untuk backend developer (`adrr-dev/openPOS`).
> Status: **tereproduksi** (11 Sep 2026). Patch siap tempel:
> `docs/patches/fix-notif-transaksi-kasir.patch` (1 file, 8+/7−).
> Frontend tidak perlu diubah — bel notifikasi hanya menampilkan apa yang
> dikirim backend.

---

## 1. Ringkasan

Setiap checkout — termasuk yang dilakukan **admin tanpa switch** — memicu
notifikasi `transaction_created` (`category: transaksi`) yang muncul di bel
notifikasi admin. Admin sudah tahu transaksinya sendiri; yang diinginkan:
**hanya checkout kasir** yang masuk notifikasi.

## 2. Akar masalah (kode)

`service/transaction.go` (`Checkout`): `s.notif.Emit(... "transaction_created" ...)`
dipanggil untuk semua checkout; tidak ada cek `actingAsCashierID`.
Notifikasi terakhir (setelah patch `cashier_id=0`) juga memakai `actor_id`
kosong untuk admin, sehingga tidak bisa dibedakan dari kasir tanpa cek JWT.

## 3. Patch

File: `docs/patches/fix-notif-transaksi-kasir.patch` — `git apply` dari root
repo backend. Isi: bungkus `Emit` transaksi dengan `if actingAsCashierID != nil`.
Cek stok menipis (`CheckAndNotifyLowStock`) **tetap** jalan untuk semua
checkout — checkout admin pun bisa menurunkan stok dan tetap perlu peringatan.

Perilaku setelah patch:

| Checkout | `transaction_created` | `low_stock`/`out_of_stock` |
|---|---|---|
| Kasir (`acting_as`) | ✅ terkirim, `actor_name` = nama kasir | ✅ |
| Admin (tanpa switch) | ❌ tidak dikirim | ✅ |

## 4. Verifikasi

- `go test ./...` di Docker (image `golang:1.26`) pada main `67b7a15` +
  patch: **lolos semua** (`router` 2.9s).
- Manual setelah deploy:
  1. Checkout sebagai admin (tanpa switch) → `GET /notifications` tidak
     memuat `transaction_created` baru.
  2. Switch ke kasir → checkout → `GET /notifications` memuat
     `transaction_created` dengan `actor_name` nama kasir.
  3. Checkout admin sampai stok ≤ 5 → notifikasi `low_stock` tetap muncul.

## 5. Bersihkan notifikasi lama (opsional)

Notifikasi transaksi milik admin yang sudah terlanjur masuk bisa dibersihkan.
Preview dulu:

```sql
SELECT n.id, n.actor_id, n.actor_name, n.message, n.created_at
FROM notifications n
JOIN users u ON u.store_id = n.store_id AND u.role = 'admin' AND u.name = n.actor_name
WHERE n.type = 'transaction_created' AND n.deleted_at IS NULL;
```

Kalau daftarnya benar (semua milik admin), soft-delete:

```sql
UPDATE notifications n SET deleted_at = now()
FROM users u
WHERE u.store_id = n.store_id AND u.role = 'admin' AND u.name = n.actor_name
  AND n.type = 'transaction_created' AND n.deleted_at IS NULL;
```

Alternatif cepat tanpa SQL: hapus satu-satu dari bel notifikasi di UI admin
(aksi hapus sudah tersedia).
