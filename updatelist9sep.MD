# Update List — 9 Sep 2026

Daftar perubahan sesi ini. Tujuan: mempermudah porting ke aplikasi native
(Electron offline) nantinya. Diurut kronologis dari awal sesi;
item nomor terbesar adalah update terakhir.

> Konvensi: semua path di bawah relatif ke root repo (`OpenPOS-Test`).
> Frontend cloud di `web/src/pages/*`, salinan offline di
> `web/src/pages/offline/*` (adapter `../../lib/local-api`).

---

## 1. Dashboard — hapus highlight besar saat hover chart Penjualan (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Dashboard.tsx` (baris 186).
- **File offline terkait (BELUM diubah, untuk porting):**
  `web/src/pages/offline/Dashboard.tsx` (baris 186, masih kode lama).

### Masalah

Saat hover bar pada chart "Penjualan — 7 hari terakhir", muncul **kotak
highlight besar** (pita vertikal abu-abu terang di light mode / gelap di
dark mode) di belakang bar. Kotak kecil tooltip berisi tanggal + nominal
Rp harus tetap ada — yang dihapus hanya kotak besarnya.

### Perbaikan (final, 1 baris)

```diff
- <ChartTooltip cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />} />
+ <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />} />
```

Efek: tidak ada lagi cursor/highlight saat hover; tooltip kecil
(`ChartTooltipContent`: tanggal + `fmtRp(omzet)`) tetap muncul normal.
Layout, warna, font, data, dan chart lain (donut Metode Pembayaran)
tidak berubah.

### Riwayat percobaan (agar tidak diulang)

1. **Percobaan pertama (dibatalkan via undo):** tooltip diganti komponen
   custom transparan `SalesTip` (teks polos tanpa box) + cursor
   transparan. Commit `dc940f2`.
   - Hasil: box kecil ikut hilang, hanya tersisa teks. Tidak sesuai
     permintaan ("hapus box besarnya, bukan box kecil").
2. **Perbaikan final:** `SalesTip` dihapus, `ChartTooltipContent`
   dikembalikan, cursor dimatikan total (`cursor={false}`).
   Commit `1b23f42`.

### Catatan teknis: kenapa `cursor={false}`, bukan `fill: 'transparent'`

`ChartContainer` (`web/src/components/ui/chart.tsx`, baris 68) punya
aturan CSS:

```css
[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted
```

Aturan CSS ini mengalahkan atribut presentasi `fill="transparent"` dari
prop cursor, sehingga `cursor={{ fill: 'transparent' }}` **tidak**
menghilangkan kotak besar. `cursor={false}` membuat Recharts tidak
merender elemen cursor sama sekali, sehingga aturan CSS tersebut tidak
relevan. Ini alasan `cursor={false}` dipilih.

### Verifikasi

- `npx tsc -b` + `npm run build` di `web/` — lolos.
- Commit: `dc940f2` (percobaan) → `1b23f42` (final). Net diff sesi ini
  untuk file ini = 1 baris (lihat diff di atas).

### Panduan porting ke native (offline)

Terapkan perubahan 1 baris yang sama di:

- `web/src/pages/offline/Dashboard.tsx` baris 186:

```tsx
<ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => fmtRp(Number(v))} />} />
```

Tidak perlu menyalin `SalesTip` (sudah dihapus dari cloud).
Tidak ada perubahan di `chart.tsx`, `store.ts`, atau file offline lain.
Setelah edit, verifikasi offline: `npx tsc -b`, `npm run build`,
`npm run electron:smoke`.

---

## 2. Dashboard — baris tabel Transaksi Terbaru dibuat statis (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Dashboard.tsx` (`RecentTable`, ±baris 344).
- **File offline terkait (BELUM diubah, untuk porting):**
  `web/src/pages/offline/Dashboard.tsx` (baris 344, masih kode lama).

### Masalah

Saat kursor diarahkan ke salah satu baris transaksi di card "Transaksi
Terbaru", baris tersorot pita hitam/putih (hover highlight). Minta
dihilangkan, tabel statis.

### Perbaikan (1 baris)

```diff
- <tr key={t.id} className="transition-colors hover:bg-muted/50">
+ <tr key={t.id}>
```

Efek: tidak ada lagi highlight saat hover di tabel Transaksi Terbaru
Dashboard (berlaku untuk tampilan admin maupun kasir, keduanya memakai
`RecentTable` yang sama). Tabel lain dan menu lain tidak berubah.

### Verifikasi

- `npx tsc -b` + `npm run build` di `web/` — lolos.

### Panduan porting ke native (offline)

Terapkan perubahan 1 baris yang sama di:

- `web/src/pages/offline/Dashboard.tsx` baris 344
  (`RecentTable`, ganti `<tr key={t.id} className="transition-colors hover:bg-muted/50">`
  menjadi `<tr key={t.id}>`).

Setelah edit, verifikasi offline: `npx tsc -b`, `npm run build`,
`npm run electron:smoke`.

---

## 3. Dashboard — bar Penjualan biru + tanpa outline saat klik (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Dashboard.tsx` (2 baris: `salesConfig`
  ±baris 21, `ChartContainer` chart Penjualan ±baris 181).
- **File offline terkait (BELUM diubah, untuk porting):**
  `web/src/pages/offline/Dashboard.tsx` (baris 21 dan 181, masih kode lama).

### Minta

1. Candle/bar chart "Penjualan — 7 hari terakhir" dari hijau menjadi biru.
2. Klik candle tidak lagi memunculkan outline putih.
3. Klik tanggal (label sumbu X) tidak lagi memunculkan outline
   yang menyelimuti satu kotak chart.

### Perbaikan (2 baris)

```diff
- omzet: { label: 'Penjualan', color: 'var(--chart-omzet)' },
+ omzet: { label: 'Penjualan', color: 'var(--chart-1)' },
```

```diff
- <ChartContainer config={salesConfig} className="h-56 w-full">
+ <ChartContainer config={salesConfig} className="h-56 w-full [&_:focus]:outline-none">
```

### Catatan teknis

- `--chart-omzet` = hijau (`oklch ... 160`), `--chart-1` = biru
  (`oklch ... 252`). `salesConfig` hanya dipakai chart Penjualan ini,
  jadi ikon hijau lain (mis. kartu "Kasir siap") tidak ikut berubah.
- Akar outline (terverifikasi via Edge headless + CDP, klik asli):
  Recharts 3 me-render grup fokus `g.recharts-zIndex-layer_300`
  (klik bar) dan `g.recharts-zIndex-layer_2000` (klik tanggal) yang
  menerima `:focus` saat diklik — perhatikan `:focus`, BUKAN
  `:focus-visible`, sehingga aturan global `index.css:237`
  (`:focus-visible {...}`) maupun varian `[&_:focus-visible]` TIDAK
  menangkapnya (percobaan pertama dengan `:focus-visible` gagal,
  outline masih muncul). Browser lalu menggambar outline default
  (`5px auto`) di sekitar grup tersebut. Aturan tambahan
  `[&_:focus]:outline-none` spesifik ke chart ini saja dan mematikan
  outline pada kedua kasus; tooltip kecil tanggal+Rp tetap muncul.
  Chart lain dan menu lain tidak tersentuh.

### Verifikasi

- `npx tsc -b` + `npm run build` di `web/` — lolos.
- Klik bar dan klik tanggal diuji di browser asli: elemen fokus
  terkomputasi `outline-style: none`, screenshot tanpa outline,
  bar biru, tooltip kecil utuh, tabel statis.
- Aturan override terkonfirmasi ada di CSS produksi
  (`:focus { outline-style: none }` scoped ke chart).

### Panduan porting ke native (offline)

Terapkan 2 baris yang sama di:

- `web/src/pages/offline/Dashboard.tsx` baris 21 (`salesConfig`
  `color: 'var(--chart-1)'`) dan baris 181 (`className` tambah
  `[&_:focus-visible]:outline-none`).

Setelah edit, verifikasi offline: `npx tsc -b`, `npm run build`,
`npm run electron:smoke`.

---

## 4. Produk — baris tabel produk dibuat statis (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Produk.tsx` (baris 298).
- **File offline terkait (BELUM diubah, untuk porting):**
  `web/src/pages/offline/OfflineProduk.tsx` (baris 298, masih kode lama).

### Masalah

Saat kursor diarahkan ke salah satu baris produk, baris tersorot
pita hitam/putih (hover highlight). Minta dihilangkan, tabel statis.
Pola sama seperti item 2 (Transaksi Terbaru di Dashboard).

### Perbaikan (1 baris)

```diff
- <tr key={p.id} className="transition-colors hover:bg-muted/50">
+ <tr key={p.id}>
```

### Verifikasi

- `npx tsc -b` + `npm run build` di `web/` — lolos.

### Panduan porting ke native (offline)

Terapkan perubahan 1 baris yang sama di:

- `web/src/pages/offline/OfflineProduk.tsx` baris 298.

Setelah edit, verifikasi offline: `npx tsc -b`, `npm run build`,
`npm run electron:smoke`.

---

## 5. Produk — paging 15 produk per halaman (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Produk.tsx` (state `page`,
  `PAGE_SIZE = 15`, slice + tombol pager).
- **File offline terkait (BELUM diubah, untuk porting):**
  `web/src/pages/offline/OfflineProduk.tsx` (masih full list 1 halaman).

### Minta

Produk menumpuk dalam 1 halaman. Batasi 15 produk per halaman +
tombol pindah halaman di bawah tabel.

### Perbaikan

Paging client-side di atas data yang sudah di-fetch + filter
(search/kategori). Pager di bawah tabel: tombol angka langsung
(1 … N, bisa lompat mis. 1 → 3) + tombol `‹` / `›` ringkas di kiri
kanan. Bila halaman > 7, angka diringkas model window
(`1 … 4 5 6 … 12`); halaman aktif hitam solid, sisanya outline.
Halaman reset ke 1 setiap search/kategori berubah; pager hanya
muncul bila halaman lebih dari 1. Search, filter kategori, CRUD,
import/export tidak berubah.

### Catatan teknis

- `// ponytail:` di kode: paging client-side cukup untuk skala UMKM;
  pindah ke paging server-side bila katalog puluhan ribu.

### Verifikasi

- `npx tsc -b` + `npm run build` di `web/` — lolos.

### Panduan porting ke native (offline)

Terapkan perubahan yang sama di:

- `web/src/pages/offline/OfflineProduk.tsx` (tambah `page` state,
  `PAGE_SIZE`, slice, pager; impor `useEffect`).

Setelah edit, verifikasi offline: `npx tsc -b`, `npm run build`,
`npm run electron:smoke`.

---

## Checklist porting native

| No | Perubahan cloud | File offline tujuan | Sudah diporting |
|----|-----------------|---------------------|-----------------|
| 1  | `cursor={false}` chart Penjualan | `web/src/pages/offline/Dashboard.tsx:186` | Belum |
| 2  | Baris Transaksi Terbaru statis | `web/src/pages/offline/Dashboard.tsx:344` | Belum |
| 3  | Bar biru + tanpa outline klik | `web/src/pages/offline/Dashboard.tsx:21,181` | Belum |
| 4  | Baris tabel produk statis | `web/src/pages/offline/OfflineProduk.tsx:298` | Belum |
| 5  | Paging produk 15/halaman | `web/src/pages/offline/OfflineProduk.tsx` | Belum |
