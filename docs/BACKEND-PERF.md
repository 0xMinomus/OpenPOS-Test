# Catatan Performa Backend (untuk Adrr)

Navigasi antar halaman di aplikasi terasa lambat (1–2 detik per pindah halaman,
kadang lebih). Hasil ukur: `GET /api/v1/health` (tanpa DB) saja 550–830 ms
dari Indonesia. Penyebab utama: fungsi serverless jalan di region default
Vercel (US East), jauh dari pengguna.

## 1. Pindahkan region ke Singapore (efek terbesar)

Di `vercel.json` tambah:

```json
{
  "regions": ["sin1"]
}
```

Lalu redeploy. Ini memotong RTT dari Indonesia kira-kira setengahnya untuk
semua endpoint.

## 2. Hilangkan cold start (keep-warm)

Tambah cron di `vercel.json` agar instance tak pernah idle sampai mati:

```json
{
  "crons": [{ "path": "/api/v1/health", "schedule": "*/5 * * * *" }]
}
```

## 3. Bila masih kurang (jangka panjang)

Pertimbangkan hosting non-serverless (VPS) agar tak ada cold start sama
sekali dan koneksi DB persisten.

---
Catatan frontend: sisi kami sudah dipasang cache stale-while-revalidate
(`web/src/lib/cache.ts`, TTL 60 detik) — halaman langsung render data
kunjungan terakhir lalu refresh di latar belakang. Jadi yang tersisa murni
latensi jaringan + cold start di atas.
