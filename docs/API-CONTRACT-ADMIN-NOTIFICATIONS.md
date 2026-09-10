# API Contract — Notifikasi Admin (Stok + Transaksi Kasir + Sistem)

> Diserahkan ke backend developer (`adrr-dev/openPOS`) untuk diimplementasikan.
> Status: **diajukan**, belum tersedia di backend produksi
> (`GET /notifications` prod masih 404 — panel lama juga menunggu deploy).
> Frontend (panel baru di `web/src/lib/notifications.tsx`) sudah siap:
> memanggil endpoint di bawah bila ada, fallback jujur bila belum.

---

## 0. Prinsip (mengikat)

1. **Hanya admin yang menerima.** Semua notifikasi panel ini dibuat untuk
   user role `admin` dalam toko yang sama. **Kasir tidak menerima** dan
   tidak bisa membaca notifikasi panel ini (403 bila dicoba).
2. **Reuse prefix existing**, jangan `/api/admin/*` baru:
   base tetap `{API}/notifications` agar frontend lama tidak breaking.
   Server membedakan hak via JWT role.
3. Error body tetap pola existing: `{ "error": "pesan Indonesia" }`.
4. Pagination tetap pola existing: `{ items, total, page, limit }`
   (page 1-based, limit max 200). Terbaru paling atas (`created_at` DESC).

---

## 1. Model notifikasi

```json
{
  "id": 42,
  "title": "Stok menipis",
  "message": "Kopi Susu tinggal 3 pcs",
  "category": "stok",
  "type": "low_stock",
  "actor_id": "7",
  "actor_name": "Andi",
  "reference_type": "transaction",
  "reference_id": "231",
  "read": false,
  "created_at": "2026-09-10T08:12:00Z"
}
```

| Field | Wajib | Keterangan |
|---|---|---|
| `id` | ya | unik global |
| `title` | ya | judul singkat Indonesia |
| `message` | ya | deskripsi singkat Indonesia |
| `category` | ya | `stok` \| `transaksi` \| `sistem` |
| `type` | ya | kode event (tabel §4), mis. `transaction_created` |
| `actor_id` / `actor_name` | tidak | kasir/admin pelaku (nama tampil di panel) |
| `reference_type` | tidak | mis. `transaction`, `product` |
| `reference_id` | tidak | id invoice / produk terkait |
| `read` | ya | status baca |
| `created_at` | ya | ISO-8601 |

---

## 2. `GET /notifications` — daftar (admin)

Query opsional (yang tak dikenal wajib diabaikan, bukan error):

| Param | Nilai | Default |
|---|---|---|
| `category` | `stok` \| `transaksi` \| `sistem` | semua |
| `status` | `all` \| `unread` \| `read` | `all` |
| `unread` | `true` (legacy, setara `status=unread`) | — |
| `page` | angka 1-based | `1` |
| `limit` | 1–200 | `10` |

**Response `200`:**

```json
{
  "items": [
    {
      "id": 42,
      "title": "Transaksi baru",
      "message": "Rp125.000 · Tunai",
      "category": "transaksi",
      "type": "transaction_created",
      "actor_id": "7",
      "actor_name": "Kasir Andi",
      "reference_type": "transaction",
      "reference_id": "231",
      "read": false,
      "created_at": "2026-09-10T08:12:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

**Error:** `401` tanpa token · `403` bila role kasir.

---

## 3. `GET /notifications/unread-count` — badge (admin, BARU)

**Response `200`:**

```json
{ "total": 5 }
```

**Error:** `401` · `403` bila kasir. (Frontend fallback ke
`GET /notifications?unread=true&limit=1` bila endpoint ini belum live.)

---

## 4. `PATCH /notifications/{id}/read` — sudah ada, pertahankan

## 5. `PATCH /notifications/read-all` — sudah ada, pertahankan

Keduanya admin-only (403 untuk kasir).

---

## 6. Event pemicu (backend wajib emit ke admin toko yang sama)

### Transaksi (actor = kasir pembuat aksi)

| `type` | Pemicu | Contoh `title` / `message` |
|---|---|---|
| `transaction_created` | transaksi sukses (kasir mana pun) | "Transaksi baru · Kasir Andi" / "Rp125.000 · Tunai" |
| `transaction_cancelled` | transaksi dibatalkan | "Transaksi dibatalkan" / "Invoice #TRX-00231 oleh Kasir Budi" |
| `refund_created` | refund dilakukan | "Refund oleh Kasir Budi" / "Invoice #TRX-00231" |
| `transaction_voided` | void transaksi | "Void oleh Kasir Citra" / "Invoice #TRX-00240" |
| `discount_used` | diskon manual dipakai | "Diskon manual" / "Rp10.000 oleh Kasir Andi" |
| `large_transaction` | nominal ≥ ambang toko (saran: Rp1.000.000, konfigurabel) | "Transaksi besar" / "Rp2.500.000 oleh Kasir Andi" |
| `transaction_failed` | transaksi gagal/error | "Transaksi gagal" / "Stok tidak cukup" |

### Stok (sudah ada `low_stock`, tambah)

| `type` | Pemicu |
|---|---|
| `low_stock` | stok ≤ 5 (threshold existing) |
| `out_of_stock` | stok = 0 |
| `restock` | stok kembali aman setelah penyesuaian/restock |

### Sistem

| `type` | Pemicu |
|---|---|
| `admin_login` | login admin (opsional, low priority) |
| `sync_failed` | sinkronisasi gagal |
| `system_error` | error penting |

**Aturan emit:**
- Satu event = satu notifikasi per admin toko (fan-out ke semua admin toko itu).
- Jangan emit untuk aksi admin sendiri yang langsung terlihat (opsional).
- Idempoten: retry webhook/internal yang sama tidak boleh duplikat
  (kunci idempotensi = event id transaksi).
- Pembuatan internal via service backend langsung (tanpa endpoint publik).
  Bila perlu endpoint internal, proteksi via service key, bukan JWT kasir.

---

## 7. Contoh isi (acuan redaksi panel)

- "Transaksi baru dibuat oleh Kasir Andi sebesar Rp125.000"
- "Refund dilakukan oleh Kasir Budi untuk invoice #TRX-00231"
- "Void transaksi dilakukan oleh Kasir Citra"

---

## 8. Checklist accept backend

- [ ] `GET /notifications` dukung `category` + `status`, scope admin, 403 kasir
- [ ] `GET /notifications/unread-count` live
- [ ] Event §6 ter-emit ke semua admin toko yang sama (kasir tak menerima)
- [ ] Retensi §9 jalan (tipe `low_stock` lama ikut dibatasi)
- [ ] Prod deploy (frontend + backend) lalu verifikasi badge + tab + tandai baca

---

## 9. Retensi — maksimal 10 per jenis (BARU)

Server menyimpan maksimal **10 notifikasi terbaru per `type`** per toko
(mis. 10 `low_stock` + 10 `transaction_created` + …).
Saat event baru masuk dan jumlah tipe itu sudah 10, hapus yang terlama
(`created_at` terkecil) dulu — FIFO per jenis, per toko.

Frontend menegakkan best-effort saat panel dibuka (scan + `DELETE`
kelebihan via `DELETE /notifications/{id}` yang sudah ada), tapi
enforcement beneran wajib di server agar berlaku lintas perangkat dan sesi.
