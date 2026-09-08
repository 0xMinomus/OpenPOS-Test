# OpenPOS Native (Windows Desktop) — Aplikasi Offline

> Dokumen pengetahuan & memori khusus aplikasi **desktop Windows** OpenPOS
> (Electron), versi offline penuh yang 1:1 dengan webapp cloud.
> Ringkasan cepat di `MEMORY.md` §3; detail di file ini.

---

## 1. Apa ini

- **Aplikasi kasir desktop Windows** (installer NSIS `.exe`), dibungkus **Electron**.
- **100% offline**: semua data di `localStorage` perangkat, tanpa backend.
- **1:1 dengan webapp cloud** (UI, layout, dan fungsi sama persis), hanya sumber data
  yang diganti dari REST API → `lib/local-api.ts` (adapter lokal).
- Versi saat ini: **0.2.0** (`web/release-out/OpenPOS Setup 0.2.0.exe`).

### Bedanya dengan webapp cloud (sengaja)
| Aspek | Cloud (web) | Native (offline) |
|---|---|---|
| Data | Server (Vercel + Supabase) | `localStorage` perangkat |
| Login | Email/Google + passcode + kasir | Onboarding lokal (nama pemilik + nama toko) |
| Akun kasir / RBAC | Ada (admin + kasir, switch akun) | Tidak ada — satu pemilik, role admin |
| Sinkron lintas perangkat | Real-time via server | Manual: backup/restore JSON |
| Struk | `window.print()` | `window.print()` |

---

## 2. Arsitektur & Alur Data

```
Electron (BrowserWindow, WebView2)
   └─ dist-offline/offline.html  (file://, HashRouter)
        └─ React (pages/offline/*)
             └─ lib/local-api.ts  ──(signature identik api.ts)──▶ lib/localdb.ts
                                                                    └─ localStorage 'op_offline_db'
```

- Entry terpisah: `web/offline.html` + `web/src/offline-main.tsx` (HashRouter).
- Build offline terpisah: `vite.offline.config.ts` → **`base: './'`** (wajib agar
  asset relatif jalan dari `file://` di Electron) → output `dist-offline/`.
- Elektron memuat `dist-offline/offline.html` via `loadFile`.
- Sesi sintetis: setelah onboarding, `setSession({ id:'local', role:'admin', ... })`
  agar halaman (yang memakai `useDB()`) tahu pengguna admin.
- Backup/pindah device: satu file JSON (semua data), ekspor/impor via halaman Backup.

---

## 3. Struktur File

```
web/
├── offline.html                  ← entry HTML offline
├── vite.offline.config.ts        ← build offline (base './', outDir dist-offline)
├── electron/
│   ├── main.cjs                  ← window + loadFile + IPC close + mode --smoke
│   └── preload.cjs               ← expose window.offline.{isElectron, close}
├── build/icon.png                ← ikon 256px (sumber .exe/installer)
├── release-out/                  ← hasil installer (gitignored)
└── src/
    ├── offline-main.tsx          ← mount router offline (HashRouter)
    ├── lib/
    │   ├── localdb.ts            ← data layer localStorage (mutasi + version bump)
    │   ├── local-api.ts          ← adapter ber-signature api.ts (tidak pakai hook;
    │   │                            baca via getLocalDB() — oxlint menolak useLocalDB
    │   │                            di fungsi non-hook)
    │   └── receipt.tsx           ← komponen struk (dipakai cloud + offline)
    └── pages/offline/
        ├── OfflineShell.tsx      ← sidebar + header + gerbang Onboarding
        ├── Dashboard.tsx         ← salinan cloud (adapter lokal)
        ├── OfflinePos.tsx        ← POS Kasir (salinan cloud)
        ├── OfflineProduk.tsx     ← Produk (CRUD + kategori + CSV)
        ├── Stok.tsx              ← Stok (status + penyesuaian + riwayat)
        ├── OfflineTransaksi.tsx  ← Transaksi (filter + detail + refund)
        ├── Laporan.tsx           ← Laporan (4 tab + 5 periode + chart)
        ├── Pengaturan.tsx        ← Akun/Toko/Struk/Pajak (tanpa users/passcode)
        └── OfflineBackup.tsx     ← Export/Import/Reset JSON
```

Catatan: halaman offline adalah **salinan** halaman cloud dengan impor data
diganti `'../../lib/local-api'` (dan path lib lain digeser `../`→`../../`).
Bila memperbarui fitur cloud, salin ulang + alihkan impor (lihat §7).

---

## 4. Model Data (`localdb.ts`)

Satu blok JSON `op_offline_db`:

```
{
  settings: { ownerName, storeName, address, phone, receiptHeader, receiptFooter,
              paper, timezone, taxEnabled, taxPct },
  categories: [{ id, name, active, created_at }],
  products:   [{ id, name, sku, categoryId, categoryName, buyPrice, sellPrice,
                 stock, unit, active, created_at }],
  transactions: [{ id:'TRX-XXXXX', items:[{productId,name,buyPrice,price,qty}],
                   subtotal, discount, tax, total, method, paid, change,
                   status:'completed'|'refunded', cashier_name, created_at }],
  movements:  [{ id, productId, productName, type:'sale'|'refund'|'adjust'|'initial',
                 qty(+/-), reason, actor, created_at }],
  seq: number
}
```

- `useLocalDB()` = hook subscribe (re-render saat mutasi); `getLocalDB()` = pembaca
  biasa untuk `local-api.ts`.
- `commit()` bump versi + tulis localStorage; gagal menulis → data tetap di memori
  sesi (langit-langit ~5MB, upgrade ke IndexedDB bila lebih).

---

## 5. Onboarding (Akun Lokal)

- Pertama kali dibuka (belum ada `settings.ownerName` + `storeName`) → `OfflineShell`
  render `Onboarding`: form **Nama pemilik** + **Nama toko** → `createAccount()` →
  `setSession({id:'local', name, role:'admin', store})` → masuk dashboard.
- `hasAccount()` jadi gerbang; reset data (halaman Backup) mengembalikan onboarding.
- Tidak ada password/PIN offline.

---

## 6. Build, Rilis & Unduh

| Perintah | Hasil |
|---|---|
| `npm run build` | Web cloud (`dist/`, tsc + vite) |
| `npm run build:offline` | App offline (`dist-offline/`) |
| `npm run electron:smoke` | Tes render headless (exit 0 = OK; seed akun+produk lalu cek dashboard) |
| `npm run electron:build` | build web + offline + installer → `release-out/OpenPOS Setup X.Y.Z.exe` |

- **Versi**: `web/package.json` → `version` (tentukan nama installer).
- **Distribusi**: upload installer ke GitHub Releases (`…/releases`); tombol
  "Unduh untuk Windows" di halaman `/unduh` menunjuk ke daftar rilis (selalu tampil
  rilis terbaru — tak perlu ubah URL tiap rilis).
- **Release terakhir**: v0.1.0 (app offline awal, minim fitur) → v0.2.0 (1:1 webapp).

### ⚠️ Kendala build di mesin Andika
App **"Orca"** (StablyAI, memonitor folder `Documents`) mengunci direktori build
→ `npm run electron:build` gagal `EPERM`/`EBUSY` pada `default_app.asar`.
Solusi:
1. Tutup aplikasi Orca, atau
2. Build ke luar Documents:
   ```
   npx electron-builder --win nsis "--config.directories.output=C:\Users\Andika\AppData\Local\Temp\opencode\exe-out"
   ```
   lalu salin installer ke `web/release-out/`.

---

## 7. Menjaga 1:1 dengan Webapp (kapan salin ulang)

Saat fitur cloud berubah dan harus ikut ke offline:
1. `Copy-Item web/src/pages/<X>.tsx → web/src/pages/offline/<X>.tsx`
2. Ganti impor di salinan:
   - `'../lib/api'` → `'../../lib/local-api'`
   - `'../lib/cache'` → `'../../lib/cache'`
   - `'../lib/store'` → `'../../lib/store'`
   - `'../lib/ui'` → `'../../lib/ui'`
   - `'../lib/receipt'` → `'../../lib/receipt'`
3. Pastikan fungsi yang dipakai ada di `local-api.ts` (tambahkan bila belum).
4. `npm run build` (tsc), `npm run build:offline`, `npm run electron:smoke`.

Perhatian tipe: `local-api.ts` **tidak boleh memanggil `useLocalDB`** (oxlint
`rules-of-hooks`) — pakai `getLocalDB()`.

---

## 8. Verifikasi

- `npm run electron:smoke` → log `SMOKE-RENDER:true`, exit 0.
- Smoke seed akun + 1 produk lalu cek dashboard render (lihat `electron/main.cjs`).
- Uji manual (Windows): install, onboarding, tambah produk, transaksi + struk,
  refund, laporan, backup export → hapus data → restore.

---

## 9. Arah Ke Depan

- **Mobile**: bangun dari entry offline yang sama (Capacitor untuk APK/iOS, atau
  Tauri-mobile). Belum dikerjakan.
- **Tauri**: pengganti Electron bila mau ukuran kecil (butuh toolchain Rust).
- **Sync**: bila nanti butuh sinkronisasi otomatis antar perangkat — keluar dari
  "offline murni" (perlu desain ulang; sekarang pindah device via JSON backup).
