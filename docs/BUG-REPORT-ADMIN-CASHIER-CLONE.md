# Bug Report — Admin Checkout Membuat Akun Kasir Kloningan (Cashier Auto-Create)

> Untuk backend developer (`adrr-dev/openPOS`).
> Status: **tereproduksi di produksi** (10 Sep 2026). Patch siap tempel:
> `docs/patches/fix-admin-cashier-clone.patch` (3 file, 46 baris).
> Frontend tidak perlu diubah — kolom Kasir sudah memakai `cashier_name`
> dari transaksi.

---

## 1. Ringkasan

Saat **admin checkout tanpa switch** (tidak sedang "bertindak sebagai kasir"),
backend memanggil `GetOrCreateByName` sehingga otomatis **membuat baris baru
di tabel `cashiers`** bernama sama dengan admin. Transaksi admin ikut tercatat
di akun kloningan itu.

Akibatnya muncul akun kasir palsu di halaman **User Management** dan menu
**pilih akun**, dan statistik per-kasir (`/shifts`, laporan per kasir) jadi
bercabang. Yang diinginkan: admin punya pencatatan transaksi sendiri
**tanpa** membuat akun kasir.

## 2. Reproduksi (produksi)

```
1. Login admin (tidak switch ke kasir lain).
2. POST /transactions { items..., method... }      → 201 completed
3. GET /users                                       → muncul cashier baru,
                                                      name = nama admin
4. GET /transactions                                → trx tadi cashier_name = nama admin
                                                      (terikat ke id cashier kloningan)
```

Pemakaian berikutnya memakai baris yang sama (idempotent per `store_id+name`),
jadi satu kloningan per nama admin.

## 3. Akar masalah (kode)

| Lokasi | Masalah |
|---|---|
| `service/transaction.go:51` | `Checkout`: cabang `else` (admin tanpa acting-as) memanggil `s.cashiers.GetOrCreateByName(ctx, storeID, fallbackName)` |
| `service/shift.go:35` | `resolveCashier`: pola sama untuk shift admin (`GetOrCreateByName`) |
| `repo/cashier.go:71` | `GetOrCreateByName` — pembuat baris `cashiers` otomatis |

## 4. Patch

File: `docs/patches/fix-admin-cashier-clone.patch` — `git apply` dari root
repo backend. Ringkas:

1. **`service/transaction.go`** — hapus cabang `else`; admin (tanpa
   `acting_as`) memakai **`cashier_id = 0`** dan `cashier_name` dari JWT.
   `actor_id` notifikasi diisi `""` bila tidak ada kasir (konsisten dengan
   notifikasi refund).
2. **`service/shift.go`** — `resolveCashier` tidak lagi membuat cashier;
   admin memakai `cashier_id = 0`, kasir tetap memakai id-nya.
3. **`router/endpoints_test.go`** — komentar tes disesuaikan (perilaku tes
   tetap sama: admin lihat semua, kasir1 tetap 1 trx).

Kenapa `cashier_id = 0` aman:
- Semua query admin (list transaksi, dashboard, laporan) memang **tanpa
  filter cashier**; filter `cashier_id = ?` hanya aktif untuk sesi kasir.
- `GetActiveShift` / `GetTrxStatsForShift` dengan `cashier_id = 0` valid —
  shift admin terpisah dari shift kasir mana pun.
- Kolom `cashier_id` tetap `not null`; tidak ada FK ke `cashiers`, jadi 0
  tidak melanggar constraint.

`GetOrCreateByName` jadi tidak terpakai setelah patch ini (boleh dihapus
menyusul, tidak wajib).

## 5. Bersihkan data lama (wajib, sekali)

Kloningan yang sudah terlanjur dibuat harus dibersihkan. **Jalankan preview
dulu**, pastikan barisnya memang kloningan admin, baru bersihkan:

```sql
-- 1) PREVIEW
SELECT c.id, c.name, c.store_id, c.created_at
FROM cashiers c
JOIN users u ON u.store_id = c.store_id AND u.role = 'admin' AND u.name = c.name
WHERE c.passcode_hash IS NULL AND c.deleted_at IS NULL;
```

```sql
-- 2) BERSIHKAN (satu transaksi)
BEGIN;

CREATE TEMP TABLE clone_ids ON COMMIT DROP AS
SELECT c.id
FROM cashiers c
JOIN users u ON u.store_id = c.store_id AND u.role = 'admin' AND u.name = c.name
WHERE c.passcode_hash IS NULL AND c.deleted_at IS NULL;

-- riwayat admin dikembalikan ke admin (cashier_id=0)
UPDATE transactions SET cashier_id = 0
WHERE cashier_id IN (SELECT id FROM clone_ids);

UPDATE cashier_shifts SET cashier_id = 0
WHERE cashier_id IN (SELECT id FROM clone_ids);

-- sesi yang sedang acting-as kloningan dicabut (login/switch ulang)
UPDATE refresh_tokens SET revoked = true
WHERE acting_as_cashier_id IN (SELECT id FROM clone_ids);

-- soft delete (sama seperti tombol Hapus di User Management)
UPDATE cashiers SET deleted_at = now()
WHERE id IN (SELECT id FROM clone_ids);

COMMIT;
```

Catatan: transaksi tidak kehilangan apa pun — nama petugas sudah tersimpan
di kolom `transactions.cashier_name`. Kalau ingin hard delete, ganti langkah
terakhir dengan `DELETE FROM cashiers WHERE id IN (...)` setelah yakin.

## 6. Verifikasi setelah patch

1. `git apply docs/patches/fix-admin-cashier-clone.patch` lalu
   `go vet ./... && go build ./... && go test ./...`.
   *Patch belum dikompilasi di mesin penulis (toolchain Go tidak tersedia) —
   mohon jalankan tes di atas sebelum deploy.*
2. Live: login admin (tanpa switch) → `POST /transactions` → `GET /users`
   **tidak** memunculkan kasir baru; transaksi `cashier_name` = nama admin.
3. Shift admin: `POST /cashier/shift/start` → tidak ada kasir baru;
   `GET /shifts` menampilkan nama admin.
4. Regresi kasir: switch ke kasir → checkout → `GET /transactions` kasir
   hanya berisi transaksinya; transaksi kasir lain tetap 404.

## 7. Sementara sebelum deploy

Kloningan yang sudah muncul bisa dihapus manual dari halaman **Users**
(aksi tiga titik → Hapus). Transaksi lama tetap utuh karena nama petugas
tersimpan di transaksi, bukan di akun kasir.
