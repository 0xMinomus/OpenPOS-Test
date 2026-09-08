# Kontrak API: Tren KPI Dashboard (untuk backend developer)

Dashboard butuh perbandingan hari ini vs kemarin di 3 KPI agar bisa tampil
`↑ 12% dari kemarin`. Frontend siap render; field absen = baris tren
disembunyikan (fallback jujur, tanpa angka palsu).

## Perubahan: `GET /dashboard` (role `admin`, bentuk kasir tak berubah)

Tambahkan objek `trends` di root respons admin:

```json
{
  "role": "admin",
  "today": { "omzet": 4827000, "trx_count": 48, "items_sold": 132, "low_stock": 3 },
  "trends": {
    "omzet_pct": 12,
    "trx_pct": 8,
    "items_pct": 15
  },
  "sales7": [],
  "methods": [],
  "top_products": [],
  "recent": []
}
```

## Aturan hitung

- `xxx_pct = round((today - yesterday) / yesterday * 100)`.
- `yesterday` = agregat yang sama dengan `today` (omzet = SUM total completed,
  trx_count = COUNT, items_sold = SUM qty) untuk rentang kemarin 00:00–24:00
  di timezone toko (ikut pola `dayStart`/`dayEnd` yang sudah ada).
- Kemarin nol & hari ini nol → `0`. Kemarin nol & hari ini > 0 → `100`.
- Boleh negatif (turun). Integer, tanpa desimal.
- Zona waktu: sama seperti `today` (parameter `tz` yang sudah dipakai).

## Error

Tak ada error baru. Bila agregat kemarin gagal dihitung, kirim `trends`
dengan semua nilai `0` (jangan 500) — frontend anggap datar.
