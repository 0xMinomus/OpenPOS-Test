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
(search/kategori) via komponen **`Pager`** baru di
`web/src/lib/ui.tsx` (angka langsung 1 … N + `‹` / `›` ringkas,
window bila > 7 halaman, rata kanan, null bila 1 halaman).
`Produk.tsx` memakai `Pager` (helper lokal `pageNums` dihapus).
Halaman reset ke 1 setiap search/kategori berubah. Search, filter
kategori, CRUD, import/export tidak berubah.

---

## 6. Stok — paging 15 baris di Status stok (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Stok.tsx` + `web/src/lib/ui.tsx`
  (komponen `Pager` paylaş).
- **File offline terkait (BELUM diubah, untuk porting):**
  `web/src/pages/offline/Stok.tsx` (tambah state/slice/`Pager`;
  `Pager` sendiri di `lib/ui.tsx` paylaş cloud+offline, tak perlu porting).
  Sama untuk `OfflineProduk.tsx` item 4–5 (tambah state/slice/`Pager` saja).

### Minta

Terapkan paging produk ke menu Stok.

### Perbaikan

Tabel "Status stok" dipaging 15 baris/halaman pakai `Pager` yang sama
dengan Produk. Tabel "Riwayat pergerakan" TIDAK diubah (sudah dibatasi
50 server-side + scroll internal).

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

## 7. Stok — redesign jadi inventory monitoring workspace (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Stok.tsx` (rewrite tampilan, logic data
  sama). Baru: `PRODUCT.md` (root, konteks produk untuk skill desain).
- **File offline terkait (BELUM diubah, untuk porting):**
  `web/src/pages/offline/Stok.tsx` (rewrite tampilan mengikuti cloud,
  impor data diganti `local-api` sesuai pola offline).

### Minta (brief user, mode Operate)

Header + 4 kartu ringkasan + toolbar search/kategori + tab
Stok Saat Ini | Riwayat Pergerakan + tabel + pager. Token font/warna
existing, tanpa palet/identitas baru, tanpa chart tambahan.

### Keputusan Q&A sesi (mengikat)

1. Kolom "Stok Minimum" DIBATALKAN — tidak ada field di API/DB.
2. Tabel riwayat pakai kolom existing (Tanggal, Produk, Jenis, Jumlah,
   Keterangan, Aktor) — tanpa SKU/sebelum/sesudah.
3. Aksi baris = dropdown 3-dot BARU dari shadcn terinstall
   (`components/ui/dropdown-menu`), isi: Penyesuaian stok.

### Isi perubahan

- 4 kartu: Total Produk, Stok Aman, Stok Menipis, Stok Habis (threshold
  existing 0 / <=5, ikon + tint semantic existing).
- Toolbar (tab stok saja): search nama/SKU + select kategori.
- Tab dengan count; tabel stok (Produk, SKU, Kategori, Stok, Status,
  Aksi) + `Pager` 15/halaman; tabel riwayat + `Pager` 15/halaman.
- Mobile (<sm): daftar kartu, tanpa horizontal overflow.
- Hover baris subtle di tabel stok (permintaan brief halaman ini).
- Skeleton + empty state di semua kondisi. Modal penyesuaian utuh.
- Page lain, API, DB, routing tidak disentuh.

### Verifikasi

- `npx tsc -b` + `npm run build` — lolos.
- Detector desain (`scripts/detect.mjs`) — bersih.
- Edge headless + CDP: desktop + mobile + tab riwayat + menu 3-dot
  terbuka — semua sesuai (screenshot sesi di temp `opencode/`).
- Reviewer bawaan skill tidak tersedia di harness ini; verifikasi
  diganti ronde screenshot + detector (dinyatakan di sini).

### Panduan porting ke native (offline)

- Tulis ulang `web/src/pages/offline/Stok.tsx` mengikuti cloud item 7,
  dengan impor data (`apiListProducts`, `apiListMovements`,
  `apiListCategories`) diganti padanan `../../lib/local-api`
  (cek ketersediaan; bila belum ada buat mengikuti pola file offline
  lain). `Pager`, komponen `ui`, dropdown, Card paylaş cloud+offline.
- Setelah edit, verifikasi offline: `npx tsc -b`, `npm run build`,
  `npm run electron:smoke`.

---

## 8. Stok — revisi: baris statis, stok tengah, aksi teks, tanpa angka tab, dropdown kategori proper (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Stok.tsx`.
- **File offline terkait:** `web/src/pages/offline/Stok.tsx` (ikut item 7;
  revisi ini bagian dari rewrite yang diporting).

### Minta + perbaikan

1. Baris tabel stok statis — hapus `hover:bg-muted/50` (seperti
   Dashboard/Produk).
2. Kolom Stok rata tengah — header + isi (`flex justify-center`),
   tanpa ubah komponen `Th`/`Td` paylaş.
3. Aksi 3-dot dikembalikan jadi tombol teks "Penyesuaian" (underline
   saat hover, seperti sebelumnya); komponen `RowMenu` dihapus
   (file `dropdown-menu.tsx` tetap dipakai untuk filter kategori).
4. Angka count di tab "Stok Saat Ini" / "Riwayat Pergerakan" dihapus.
5. Filter kategori DIGANTI dari native `<select>` ke dropdown proper
   (shadcn `DropdownMenu`: trigger + chevron + checkmark item aktif).
   Penyebab "tidak bekerja": logika filter benar (terverifikasi:
   Minuman → 12 baris, Tanpa kategori → 37), masalahnya di UX —
   kini ada umpan balik visual (label trigger + checkmark).

### Verifikasi

- `npx tsc -b` + `npm run build` — lolos.
- Edge headless + CDP: dropdown terbuka + checkmark, filter Minuman /
  Tanpa kategori tepat, kolom tengah, aksi teks, tab tanpa angka,
  pill Menipis + kartu Stok Menipis = 1 tampil semantik benar.

---

## 9. Ukuran halaman: Produk 15, Stok 10, Transaksi 10 (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Produk.tsx` (`PAGE_SIZE = 15`),
  `web/src/pages/Stok.tsx` (`PAGE_SIZE = 10`, stok + riwayat),
  `web/src/pages/Transaksi.tsx` (`PAGE = 10`, server-side existing).
- **File offline terkait (BELUM diubah):** `OfflineProduk.tsx`,
  `offline/Stok.tsx`, `OfflineTransaksi.tsx` — ikut rewrite/porting
  masing-masing item (6 untuk Stok).

---

## 10. Transaksi — pager angka paylaş (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Transaksi.tsx` (ganti pager lama
  Sebelumnya/X/Y/Berikutnya dengan `Pager` paylaş),
  `web/src/lib/ui.tsx` (`Pager` terima prop `className` opsional).
- **File offline terkait (BELUM diubah):**
  `web/src/pages/offline/OfflineTransaksi.tsx` (ganti pager lama
  dengan `Pager` paylaş).

---

## 11. Transaksi — redesign transaction workspace (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Transaksi.tsx` (rewrite tampilan,
  data flow + refund/export/detail sama).
- **File offline terkait (BELUM diubah, untuk porting):**
  `web/src/pages/offline/OfflineTransaksi.tsx` (rewrite tampilan
  mengikuti cloud, impor data diganti `local-api`; `Pager` paylaş).

### Keputusan Q&A sesi (mengikat)

1. Kartu pakai fetch-all loop + filter aktif (pola Export) untuk
   Total/Rata-rata; Hari Ini dari `apiGetDashboard`.
2. Filter tetap existing (search, 1 tanggal, metode) — tanpa status,
   tanpa rentang tanggal (backend tak dukung).
3. Aksi tetap tombol teks Detail (+ Refund admin).

### Isi perubahan

- 4 kartu: Total Transaksi, Total Penjualan, Transaksi Hari Ini,
  Rata-rata Transaksi (nilai mobile mengecil agar muat).
- Toolbar: search + date sebaris (desktop), pill metode.
- Tabel: Invoice `#TRX-00050`, Tanggal compact 2 baris, Pelanggan
  (kolom baru dari `t.customer` yang selama ini tak dipakai), Kasir
  (admin saja), Produk chips, Total paling menonjol, Metode teks,
  Status pill, aksi teks. Hover subtle.
- Mobile: daftar kartu. Detail modal: format invoice + baris Pelanggan.
- Refund/export/pagination (`Pager` 10) utuh.

### Verifikasi

- `npx tsc -b` + `npm run build` — lolos. Detector desain — bersih.
- Edge headless + CDP: desktop + mobile + modal detail sesuai;
  1 ronde Micro-fix (angka kartu mobile) + konfirmasi ulang.
- Reviewer bawaan skill tak ada di harness; ronde screenshot +
  detector jadi pengganti.

### Panduan porting ke native (offline)

- Tulis ulang `OfflineTransaksi.tsx` mengikuti cloud item 11
  (fetch-all ringkasan via `local-api` bila tersedia, jika tidak
  kartu pakai data halaman + tandai di checklist).

---

## Checklist porting native

| No | Perubahan cloud | File offline tujuan | Sudah diporting |
|----|-----------------|---------------------|-----------------|
| 1  | `cursor={false}` chart Penjualan | `web/src/pages/offline/Dashboard.tsx:186` | Belum |
| 2  | Baris Transaksi Terbaru statis | `web/src/pages/offline/Dashboard.tsx:344` | Belum |
| 3  | Bar biru + tanpa outline klik | `web/src/pages/offline/Dashboard.tsx:21,181` | Belum |
| 4  | Baris tabel produk statis | `web/src/pages/offline/OfflineProduk.tsx:298` | Belum |
| 5  | Paging produk 15/halaman (`Pager` di `lib/ui.tsx` paylaş) | `web/src/pages/offline/OfflineProduk.tsx` (state/slice/`Pager`) | Belum |
| 6  | Paging status stok 15/halaman | `web/src/pages/offline/Stok.tsx` (state/slice/`Pager`) | Belum |
| 7  | Redesign Stok (kartu+tab+toolbar+3-dot) | `web/src/pages/offline/Stok.tsx` (rewrite ikut cloud) | Belum |
| 8  | Revisi Stok (item 8 di atas) | `web/src/pages/offline/Stok.tsx` (bagian rewrite) | Belum |
| 9  | Ukuran halaman 15/10/10 | `OfflineProduk.tsx`, `offline/Stok.tsx`, `OfflineTransaksi.tsx` | Belum |
| 10 | Pager angka transaksi | `web/src/pages/offline/OfflineTransaksi.tsx` | Belum |
| 11 | Redesign Transaksi | `web/src/pages/offline/OfflineTransaksi.tsx` (rewrite ikut cloud) | Belum |
