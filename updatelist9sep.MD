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

## 12. Transaksi — DatePicker kalender proper (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/lib/ui.tsx` (komponen `DatePicker` baru,
  tanpa dependensi tanggal baru), `web/src/pages/Transaksi.tsx`
  (ganti native `input[type=date]`).
- **File offline terkait:** `OfflineTransaksi.tsx` ikut rewrite item 11
  (pakai `DatePicker` paylaş dari `lib/ui.tsx`, tanpa porting tambahan).

### Isi perubahan

- Trigger gaya input existing (ikon kalender + label `8 Sep 2026` /
  placeholder `Semua tanggal`, tombol × hapus).
- Panel kalender: navigasi bulan, header Senin–Min, tanggal di luar
  bulan redup, hari ini berbingkai, pilihan solid, footer Hari ini +
  Hapus filter. Pilih tanggal → panel tutup + filter jalan.
- Tutup via klik luar / Escape; `aria-label`/`aria-pressed`/`role`
  dialog; panel `right-0` agar tak overflow di layar sempit.
- Nilai tetap string `YYYY-MM-DD` — API/data flow tak berubah.

### Verifikasi

- `npx tsc -b` + `npm run build` — lolos. Detector desain — bersih.
- Edge headless + CDP: kalender render benar (grid Sept 2026),
  pilih 8 → trigger `8 Sep 2026` + tabel 5 baris; 1024px panel penuh
  tanpa overflow halaman.

---

## 13. Laporan — redesign header/filter/tab global (prompt 1/5, cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Laporan.tsx` (blok header saja;
  KPI/chart/tabel isi tak disentuh).
- **File offline terkait (BELUM diubah):**
  `web/src/pages/offline/Laporan.tsx` (terapkan blok header sama;
  impor data ikut pola offline).

### Isi perubahan

- Header: `PageHead` existing (Laporan + sub + Export CSV ghost).
- Period: pill prominent + dot aktif (`[● Hari ini]`), scroll
  horizontal + scrollbar hidden di mobile, `aria-pressed`.
- Report tabs: segmented compact dalam container `bg-surface`,
  aktif `bg-paper shadow-sm`; `role=tablist/tab` + `aria-selected`.
- Period state sudah global per komponen (pindah tab tak reset) —
  dipertahankan, tanpa routing baru. Satu implementasi untuk 4 report.
- Sticky DICOBA lalu DIBATALKAN: `overflow-x: hidden` di html/body
  mematikan `position: sticky` (terbukti di screenshot); prompt
  membolehkan skip bila mengganggu.

### Verifikasi

- `npx tsc -b` + `npm run build` — lolos. Detector — bersih.
- Edge headless + CDP: desktop + mobile + scroll sesuai.

---

## 14. Laporan — jujur loading saat pindah periode (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/lib/cache.ts` (`useCache` jujur `loading`
  saat key berubah), `web/src/pages/Laporan.tsx` (indikator switching).

### Akar masalah (hasil inspect, bukan tebakan)

`useCache` menyimpan `data` lama saat key periode berubah, tapi
`loading` tetap `false` selama fetch — klik periode tak memicu
indikator apa pun sampai data baru datang (server Vercel + Supabase
butuh detik). Jadi lag server tak terlihat: "delay misterius".

### Perbaikan

- `useCache`: bedakan mount/remount (key sama → perilaku cache instan
  tetap) vs ganti key (filter/halaman → `loading: true` + `err: ''`).
  Konsumen lain aman: Produk (kategori tak pakai loading), Transaksi
  (kini skeleton jujur tiap pindah halaman — membaik), Dashboard
  (kunci sesi tak berubah perilaku).
- Laporan: saat switching, konten lama redup (`opacity-60`,
  tanpa layout shift) + baris status "Memuat periode X…" (spinner,
  `role=status`, `aria-busy`).

### Verifikasi

- `npx tsc -b` + `npm run build` — lolos.
- Edge headless + CDP klik "Minggu ini": status muncul + `aria-busy`,
  lalu hilang dan pill aktif = Minggu ini. Screenshot sesuai.

---

## 15. Laporan — redesign tab Penjualan (prompt 2/5, cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Laporan.tsx` (blok tab sales saja;
  produk/profit/stok/header/export tak disentuh) + `web/src/lib/store.ts`
  (`fmtInv` paylaş baru).
- **File offline terkait (BELUM diubah):**
  `web/src/pages/offline/Laporan.tsx` (terapkan blok sales sama;
  `fmtInv`/`Pager`/komponen paylaş).

### Keputusan Q&A sesi (mengikat)

1. Komparasi ↑% DIIMPLEMENTASI via fetch periode kemarin (bukan drop).
2. Kolom Pelanggan DIBATALKAN — API tak kirim data.
3. Aksi baris: tanpa kolom Aksi (tak ada di existing); "Lihat semua →"
   ke `/app/transaksi` + ke tab Produk (in-page).

### Isi perubahan

- KPI: Total Penjualan, Jumlah Transaksi, Rata-rata Transaksi (ganti
  Profit Kotor → ranah tab Profit), Produk Terjual. Komparasi vs
  kemarin HANYA di periode "Hari ini" (satu-satunya yang previous-nya
  bisa di-fetch; API tak punya periode-lalu untuk kemarin/minggu/
  bulan/semua) — periode lain fallback sub existing.
- Chart Bar omzet + Line transaksi (dual axis, legenda HTML, tooltip
  compact   `Tanggal | Rp | N transaksi` box kecil (pola tooltip yang dipertahankan).
- Donut: center total + legenda nominal · %.
- Bawah 65/35: Transaksi Terbaru (Invoice `#TRX-…`, Tanggal, Kasir,
  Metode, Total, Status) + Produk Terlaris ranking + revenue.
- Kartu `Performa Kasir` dihapus dari tab sales (memo dibersihkan).
- Chart garis rapi (dot + round cap), sumbu kanan disembunyikan,
  outline klik tanggal dimatikan (pola Dashboard).
- Periode 1 hari (Hari ini/Kemarin) dipecah 4 slot jam — Pagi
  05.00–10.59, Siang 11.00–14.59, Sore 15.00–18.59, Malam 19.00–04.59
  (range saya yang tentukan). Jam dari `created_at` transaksi harian
  (endpoint existing; `t.date` laporan hanya tanggal). Hover tampil
  range jam. Periode lain tetap per tanggal.

### Verifikasi

- `npx tsc -b` + `npm run build` — lolos. Detector — bersih.
- Edge headless + CDP: KPI + komparasi ↑1% ↓67% ↑203% ↑20% (cocok
  hitung manual), chart + tooltip compact, donut center, tab Produk
  tak regresi.

---

## 16. Laporan — redesign tab Produk (prompt 3/5, cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Laporan.tsx` (blok tab products saja;
  penjualan/profit/stok/header/export tak disentuh).

### Keputusan Q&A sesi (mengikat)

1. Tren line Top produk DIBATALKAN — API tak kirim histori harian per
   produk. Diganti bar horizontal Top 5.
2. Donut Kategori LANJUT via join katalog (`apiListProducts` existing,
   1 request ekstra, hanya saat tab Produk).
3. KPI: Qty Terjual, Produk Unik, Pendapatan, Produk Aktif x-dari-y
   (Unit Terjual dibuang karena identik Qty).

### Isi perubahan

- KPI 4 + bar horizontal Top 5 + donut kategori (4 teratas + Lainnya,
  center total unit, legenda qty · %) + tabel Produk Terlaris
  (#|Produk|Kategori|Qty|Pendapatan, top 5 + expand Lihat semua) +
  Perlu Perhatian (5 terbawah + saran, tanpa merah berlebihan).
- Kategori "Tanpa kategori" bila produk tak berkategori.

### Verifikasi

- `npx tsc -b` + `npm run build` — lolos. Detector — bersih.
- Edge headless + CDP desktop + mobile: KPI (29/15/Rp 395rb/49 dari
  51), donut join benar (Tanpa 59% + Minuman 41%), tabel + expand,
  Perlu Perhatian. (Catatan: capture full-page headless sempat tak
  merender bar horizontal — geometri DOM benar, screenshot viewport
  normal. Artefak harness, bukan bug.)

---

## 17. Laporan — redesign tab Profit (prompt 4/5, cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Laporan.tsx` (blok tab profit saja).

### Isi perubahan

- KPI: Profit Kotor, Margin Profit, Pendapatan, HPP (label HPP sesuai
  data, bukan Total Biaya) + komparasi vs kemarin pola prompt 2
  (HPP invert: naik = merah).
- Tren Profit: Bar Pendapatan + Bar HPP + Line Profit (dual axis,
  legenda, tooltip Rp compact). Periode 1 tanggal = 1 grup bar
  (profit per jam tak tersedia: Trx tak bawa hpp/profit).
- Margin Profit: line chart % sederhana (1 titik bila 1 tanggal).
- Tabel Produk Paling Menguntungkan (#|Produk|Qty|Pendapatan|HPP|
  Profit|Margin, urut profit, scroll) — profit ikut rumus existing
  (`revenue - profit` = HPP produk).
- Insight valid saja: profit/transaksi + margin vs kemarin + share
  kategori + top produk (maks 3, absen bila tak terhitung).

### Verifikasi

- `npx tsc -b` + `npm run build` — lolos. Detector — bersih.
- Edge headless + CDP desktop + mobile: KPI + delta, tabel, insight.
  Temuan ronde 1: bar Pendapatan hitam (salah nama var
  `--color-pendapatan` vs key `revenue`) — diperbaiki + konfirmasi
  viewport (biru/abu/hijau benar).

---

## 18. Laporan Profit — revisi slot jam, insight+, % margin, panah HPP (cloud saja)

- **Status:** selesai, sudah push ke `main`.
- **File diubah:** `web/src/pages/Laporan.tsx` (blok profit + helper
  `tipLabel` paylaş tooltip).

### Isi perubahan

1. Slot jam Pagi–Malam untuk Tren + Margin pada Hari ini/Kemarin
   (HPP per slot = Σ `buy_price` × qty item — satu-satunya sumber HPP
   per jam yang ada; periode lain tetap per tanggal).
2. Insight 5 maks: + HPP share omzet + produk margin % tertinggi.
3. "pp" → "%" di komparasi margin + insight (membingungkan).
4. Metrik biaya (HPP): panah dibalik — naik = ↓ merah, turun = ↑ hijau
   (panah = arah kinerja, bukan arah angka). Berlaku umum via prop
   `invert` di `DeltaKpi`.

### Verifikasi

- `npx tsc -b` + `npm run build` — lolos. Detector — bersih.
- Edge headless + CDP: slot di kedua chart, HPP ↓30% merah, margin
  "naik 1%", 4 insight valid, chart + tooltip range benar.

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
| 12 | DatePicker kalender | — (paylaş `lib/ui.tsx`, tanpa porting) | Done |
| 13 | Header/filter/tab Laporan | `web/src/pages/offline/Laporan.tsx` (blok header saja) | Belum |
| 14 | Loading jujur pindah periode | `lib/cache.ts` paylaş + `offline/Laporan.tsx` (ikut rewrite) | Cache done |
| 15 | Redesign tab Penjualan (+`fmtInv`) | `web/src/pages/offline/Laporan.tsx` (blok sales + `fmtInv` paylaş) | Belum |
| 16 | Redesign tab Produk | `web/src/pages/offline/Laporan.tsx` (blok products) | Belum |
| 17 | Redesign tab Profit | `web/src/pages/offline/Laporan.tsx` (blok profit) | Belum |
| 18 | Revisi Profit (slot/insight/%/panah) | `web/src/pages/offline/Laporan.tsx` (bagian rewrite) | Belum |
