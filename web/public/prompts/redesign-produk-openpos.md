# Prompt Redesign — Halaman "Produk" (OpenPOS)

> Cara pakai: copy-paste seluruh isi di bawah "PROMPT" ke AI desain/coding kamu (Figma AI, v0, Lovable, Claude, ChatGPT, dsb). Prompt ini ditulis berdiri sendiri (tidak butuh gambar referensi), jadi semua elemen existing dijelaskan dulu sebelum instruksi redesign.

---

## PROMPT

Saya punya halaman **"Produk"** di dalam aplikasi kasir/POS berbasis web bernama **OpenPOS**. Saya ingin kamu **redesign total tampilan visualnya** (UI/UX), TANPA mengubah struktur data, fungsi, atau informasi yang ditampilkan. Fokus murni pada desain ulang: layout, tipografi, warna, spacing, hierarchy, komponen visual, dan micro-interaction. Jangan tambah atau hilangkan fitur/data.

Di bawah ini saya jelaskan **kondisi desain saat ini secara detail**, lalu **arahan redesign yang saya inginkan**.

---

### 1. KONTEKS APLIKASI

Aplikasi bernama **OpenPOS**, sebuah sistem Point of Sale (kasir) untuk toko retail kecil-menengah (contoh produk: air mineral, teh botol, kopi susu, mie instan, roti, snack, rokok). Bahasa antarmuka: **Bahasa Indonesia**. Mata uang: **Rupiah (Rp)**. Halaman ini adalah salah satu dari beberapa halaman dalam sebuah dashboard admin/kasir (ada halaman lain: Dashboard, POS Kasir, Produk, Stok, Transaksi, Laporan, User Management, Pengaturan), diakses lewat sidebar kiri yang sama di semua halaman.

### 2. LAYOUT SAAT INI (kondisi existing yang harus kamu pahami dulu)

**A. Sidebar kiri (fixed, lebar ±240px, background off-white/krem muda #F7F5F0-ish)**
- Header sidebar: logo kotak hitam kecil dengan ikon kasir putih + teks "OpenPOS" tebal.
- Menu navigasi vertikal dengan ikon di kiri + label teks, urutan:
  1. Dashboard (ikon rumah)
  2. POS Kasir (ikon kasir/register)
  3. **Produk (ikon kotak/box) — dalam state AKTIF, ditandai background abu muda pill/rounded di belakang item ini**
  4. Stok (ikon kotak stok)
  5. Transaksi (ikon dokumen/invoice)
  6. Laporan (ikon grafik/chart)
  7. User Management (ikon dua orang)
  8. Pengaturan (ikon gear)
- Bagian bawah sidebar: avatar bulat hitam berinisial "AP", nama "Andika Putra", sub-label kecil "Kasir" di bawahnya, dan ikon panah/chevron kecil di ujung kanan (indikasi bisa diklik untuk profile/logout).

**B. Header halaman (top bar dalam area konten, bukan sidebar)**
- Kiri: judul halaman **"Produk"** (font besar, bold, hitam) dengan subjudul kecil abu-abu di bawahnya: **"Kelola data produk toko"**.
- Kanan: ikon lonceng notifikasi, teks tanggal **"Sel, 9 Sep 2025"**, dan ikon kalender kecil.

**C. Baris toolbar/aksi (di bawah header, satu baris horizontal)**
- Search bar panjang di kiri dengan ikon kaca pembesar + placeholder **"Cari produk, SKU, atau kategori..."** (rounded, border tipis, background putih).
- Dropdown filter **"Semua Kategori"** dengan chevron ke bawah (border tipis, rounded, background putih).
- Tombol **"Import"** (outline/border, ikon upload/panah ke atas, background putih, teks hitam).
- Tombol **"Export"** (outline/border, ikon serupa, background putih, teks hitam).
- Tombol **"+ Tambah Produk"** (paling kanan, background HITAM solid, teks putih, ikon plus, ini adalah primary action/CTA utama halaman).

**D. Konten utama — dua kolom (sidebar filter kategori kiri + tabel produk kanan)**

*Kolom kiri (panel "Kategori", card putih rounded, lebar ±280px):*
- Judul "Kategori" bold.
- List kategori vertikal, masing-masing punya: ikon kecil bulat, nama kategori, dan angka jumlah produk di ujung kanan (rata kanan, abu-abu). Item pertama **"Semua Kategori" (42)** dalam state aktif (background abu muda pill). Lalu: "Minuman (12)", "Makanan (10)", "Snack (8)", "Rokok (6)", "Lainnya (6)".

*Kolom kanan (card putih rounded, tabel produk, mengambil sisa lebar):*
- Header tabel dengan kolom: checkbox (select all), **Produk**, **SKU**, **Kategori**, **HPP**, **Harga Jual**, **Stok**, **Status**, **Aksi**.
- Setiap baris (8 baris terlihat dari total 42 produk):
  - Checkbox kecil di kiri.
  - Thumbnail foto produk kotak rounded kecil (ilustrasi produk, misal botol air mineral, kaleng teh, gelas kopi, dsb — warna-warni sesuai jenis produk) + nama produk di sampingnya (contoh: "Air Mineral 600ml", "Teh Botol", "Kopi Susu Dingin", "Es Teh Manis", "Mie Instan", "Roti Cokelat", "Snack Kentang", "Rokok Surya").
  - Kolom SKU: kode seperti "AM-001", "TB-002", dst — teks abu-abu monospace-ish.
  - Kolom Kategori: teks biasa (Minuman/Makanan/Snack/Rokok).
  - Kolom HPP (harga pokok): "Rp 3.000", dst — teks abu-abu.
  - Kolom Harga Jual: "Rp 5.000", dst — teks hitam agak tebal.
  - Kolom Stok: angka polos (48, 32, 28, dst).
  - Kolom Status: badge pill hijau muda dengan teks hijau tua **"Aktif"** untuk semua baris.
  - Kolom Aksi: ikon titik tiga vertikal (menu more/kebab) di ujung kanan.
- Baris tabel dipisahkan garis horizontal tipis abu-abu terang, tanpa zebra-stripe (semua baris background putih polos).
- Footer tabel: teks kecil abu-abu **"Menampilkan 1-8 dari 42 produk"** di kiri, dan pagination angka **1 2 3 4 5** dengan tombol panah kiri/kanan di kanan (angka 1 dalam state aktif background hitam teks putih, sisanya outline/abu-abu).

### 3. GAYA VISUAL SAAT INI (yang perlu diganti)

- Palet warna: nyaris monokrom — putih, hitam, abu-abu, dengan aksen hijau muda hanya di badge "Aktif". Terasa flat, datar, generic, seperti template admin dashboard umum tanpa karakter/identitas brand.
- Tipografi: sans-serif standar (terlihat seperti Inter/Helvetica default), tanpa variasi ukuran/weight yang dramatis — semua terasa "aman" dan medium.
- Card & border: rounded-lg standar (~8-12px), border tipis abu-abu (#E5E5E5-ish), shadow nyaris tidak terlihat/flat.
- Tombol: sangat basic — solid hitam atau outline putih-hitam, tanpa gradient, tanpa depth, tanpa hover state yang terlihat jelas.
- Ikon: line icon minimalis generic (kemungkinan Lucide/Feather icons default), monokrom abu-abu/hitam.
- Spacing: cukup rapat, padding antar elemen terasa efisien tapi kurang "bernapas".
- Tidak ada dark mode.
- Tidak ada elemen dekoratif, ilustrasi, atau aksen visual yang membuat brand terasa unik.

### 4. ARAHAN REDESIGN (apa yang saya inginkan)

Redesign halaman Produk ini menjadi jauh lebih modern, premium, dan punya karakter visual yang kuat, dengan detail sebagai berikut:

**a. Konsep & mood**
- Buat mood board mental: modern SaaS dashboard yang clean tapi tidak generic — kombinasikan gaya "neo-minimalist" dengan aksen warna berani sebagai brand identity (bukan lagi monokrom penuh).
- Pilih satu warna aksen utama (accent color) yang konsisten dipakai di seluruh elemen interaktif (contoh arah: indigo/violet tua, emerald, atau amber-orange — pilih salah satu yang paling cocok untuk brand POS/retail, jelaskan alasan pemilihan singkat).
- Pertimbangkan dukungan **dark mode** sebagai varian (opsional tapi nilai plus), dengan warna latar dark charcoal/near-black bukan pure black.

**b. Sidebar**
- Redesign sidebar dengan hierarchy yang lebih jelas: beri jarak (padding) lebih lega antar item menu.
- State aktif menu "Produk" jangan hanya background pill abu-abu — gunakan accent color (background soft-tint dari accent color, atau left-border indicator tebal berwarna accent, teks & ikon berubah warna ke accent/putih tergantung kontras).
- Tambahkan micro-interaction visual untuk hover state (dijelaskan dalam bentuk deskripsi visual, misal: sedikit indent, background soft muncul, ikon sedikit scale-up).
- Ikon diganti menjadi gaya yang lebih konsisten dan solid/duotone (bukan sekadar outline tipis generic), agar terasa lebih premium.
- Bagian profil user di bawah sidebar: beri card kecil dengan background sedikit berbeda dari sidebar utama (elevated), avatar dengan ring/border accent color tipis.

**c. Header halaman**
- Judul "Produk" — pertimbangkan menambahkan ikon kecil di depan judul atau breadcrumb tipis di atasnya untuk konteks navigasi.
- Notifikasi bell: beri badge merah kecil dengan angka jika ada notifikasi (dot indicator), beri efek elevated (subtle shadow) supaya terasa clickable/floating.
- Tanggal & kalender: kelompokkan dalam satu pill/chip elegan dengan background soft, bukan teks polos mengambang.

**d. Toolbar aksi (search, filter, import, export, tambah produk)**
- Search bar: perbesar sedikit target area klik, beri efek focus state yang jelas (ring accent color saat difokuskan), ikon search lebih tebal/jelas.
- Dropdown "Semua Kategori": desain ulang jadi custom dropdown dengan shadow elevation saat terbuka, radius lebih besar.
- Tombol Import & Export: beri sedikit perbedaan visual dari tombol biasa — gunakan style "ghost button" dengan border tipis accent-tinted saat hover, ikon lebih ekspresif.
- Tombol utama "+ Tambah Produk": jadikan ini benar-benar menonjol — gunakan accent color solid (bukan hitam polos), tambahkan subtle shadow/glow, rounded lebih besar (pill shape atau rounded-xl), pastikan ini adalah focal point pertama yang dilihat mata di toolbar tersebut.
- Susun ulang urutan/grouping toolbar agar lebih logis secara visual: search di kiri paling lebar, grup filter di tengah, grup aksi (import/export/tambah) mengelompok rapi di kanan dengan sedikit divider visual.

**e. Panel Kategori (kolom kiri konten)**
- Ubah dari list flat menjadi list dengan card/pill masing-masing kategori yang punya sedikit depth (subtle shadow atau border-left accent saat aktif).
- Icon kategori: beri background bulat kecil berwarna soft-tint berbeda per kategori (misal Minuman = biru soft, Makanan = orange soft, Snack = kuning soft, Rokok = abu gelap soft) supaya scannable secara visual, bukan monokrom semua.
- Angka jumlah produk per kategori: bungkus dalam badge/pill kecil, bukan teks polos.
- Kategori aktif ("Semua Kategori"): highlight jelas dengan accent color, bukan abu-abu netral.
- Pertimbangkan menambahkan progress bar tipis di bawah tiap kategori yang menunjukkan proporsi stok kategori tersebut terhadap total (elemen visual tambahan yang informatif, opsional).

**f. Tabel Produk (kolom kanan, elemen paling penting)**
- Ini adalah fokus utama redesign. Buat tabel terasa lebih "hidup":
  - Header kolom: beri background sedikit berbeda (soft grey/tinted), teks uppercase kecil dengan letter-spacing, bukan sekadar bold biasa.
  - Baris tabel: tambahkan hover state yang jelas (background berubah halus saat kursor di atas baris) dan pertimbangkan subtle zebra-striping SANGAT tipis atau border radius pada row saat hover untuk membedakan dari flat table generic.
  - Thumbnail produk: perbesar sedikit, beri rounded-xl dan border/shadow tipis supaya foto produk terasa "premium" bukan cuma ikon kecil polos.
  - Kolom Harga Jual: buat lebih menonjol secara visual (font-weight lebih tebal, atau warna sedikit berbeda/accent) karena ini data paling penting bagi pengguna.
  - Kolom Stok: ubah representasi — bukan cuma angka polos, tapi tambahkan indikator visual kecil (misal dot warna hijau/kuning/merah di sebelah angka berdasarkan level stok, atau mini bar horizontal tipis) supaya user bisa langsung scanning kondisi stok tanpa membaca angka satu-satu.
  - Badge Status "Aktif": redesign badge ini — gunakan bentuk pill dengan dot kecil di kiri teks (bukan cuma background hijau muda polos), variasikan warna untuk status lain yang mungkin ada (misal "Nonaktif" = abu-abu, "Stok Habis" = merah) walau di data ini semua "Aktif".
  - Kolom Aksi (kebab menu): beri hover state berupa lingkaran background soft saat di-hover supaya terlihat jelas clickable, dan saat diklik dropdown menu-nya harus terlihat elevated dengan shadow jelas dan rounded-lg (jelaskan isinya idealnya: Edit, Duplikat, Hapus — dengan ikon masing-masing, opsi Hapus dalam warna merah).
- Checkbox: redesign jadi custom checkbox dengan rounded-sm, border accent color saat checked, animasi check yang smooth (deskripsikan saja secara visual).
- Footer tabel/pagination: redesign pagination jadi lebih modern — tombol angka berbentuk rounded-full/circle, state aktif pakai accent color solid dengan sedikit shadow, tombol panah kiri-kanan dengan background soft ghost bukan outline polos.

**g. Tipografi**
- Ganti ke font pairing yang lebih punya karakter: judul/heading pakai font dengan sedikit personality (misal geometric sans seperti "Plus Jakarta Sans", "Cabinet Grotesk", atau "Space Grotesk" untuk heading), body text tetap sans-serif readable (Inter/Manrope) untuk data tabel supaya tetap scannable.
- Perjelas hierarchy ukuran: judul halaman jauh lebih besar dan bold dibanding sebelumnya, label-label kecil (SKU, subtitle) dibuat lebih kecil lagi dengan warna abu-abu lebih soft supaya kontras hierarchy makin tajam.

**h. Spacing, radius, shadow (design tokens)**
- Naikkan border-radius secara keseluruhan menjadi lebih besar & konsisten (misal 16-20px untuk card besar, 10-12px untuk elemen kecil seperti badge/button) untuk kesan lebih modern/soft.
- Tambahkan whitespace/padding lebih lega di dalam card-card (card breathing room), jangan terlalu padat seperti versi lama.
- Gunakan elevation/shadow yang lebih halus tapi terasa (soft, diffused shadow — bukan shadow keras/gelap) untuk memberi depth antara card, dropdown, dan modal.

**i. Ikonografi & ilustrasi**
- Ganti seluruh ikon dengan satu set ikon konsisten bergaya modern (line-rounded atau duotone), hindari mixing style ikon.
- Thumbnail produk boleh diberi treatment ilustrasi flat-design berwarna cerah yang konsisten satu gaya (bukan foto realistis maupun ikon terlalu simpel), supaya tabel produk terasa lebih menarik secara visual sekaligus tetap profesional.

**j. Responsiveness (sebutkan sebagai pertimbangan)**
- Jelaskan bagaimana layout ini beradaptasi di tablet/mobile: panel Kategori bisa collapse jadi horizontal scroll chip filter di atas tabel pada layar sempit, tabel bisa jadi card-list per produk di mobile (bukan tabel horizontal yang di-scroll).

---

### 5. YANG TIDAK BOLEH DIUBAH

- Jangan mengubah bahasa (tetap Bahasa Indonesia).
- Jangan mengubah/menghilangkan data atau kolom yang sudah ada (Produk, SKU, Kategori, HPP, Harga Jual, Stok, Status, Aksi).
- Jangan mengubah struktur navigasi sidebar (menu yang sama, urutan boleh dipertahankan).
- Jangan mengubah logika fungsional (search, filter kategori, import, export, tambah produk, pagination) — hanya tampilannya.

### 6. OUTPUT YANG SAYA HARAPKAN DARI KAMU

1. Penjelasan singkat konsep desain baru (color palette dengan kode hex, font pairing, radius/spacing token) sebelum masuk ke detail per elemen.
2. Breakdown detail redesign per section sesuai struktur di atas (Sidebar, Header, Toolbar, Panel Kategori, Tabel Produk, Footer/Pagination).
3. Jika kamu bisa menghasilkan kode (HTML/CSS/React/Tailwind), tolong implementasikan langsung redesign ini menjadi kode yang bisa saya jalankan/preview, dengan data dummy yang sama seperti disebutkan di atas (8 produk contoh: Air Mineral 600ml, Teh Botol, Kopi Susu Dingin, Es Teh Manis, Mie Instan, Roti Cokelat, Snack Kentang, Rokok Surya).
4. Jika kamu hanya bisa menghasilkan deskripsi/desain teks (bukan kode), buat sedetail mungkin seolah-olah kamu sedang menulis design spec untuk diserahkan ke seorang UI designer/developer yang belum pernah melihat halaman ini sama sekali.

---

*Catatan: Prompt ini khusus untuk halaman **Produk**. Halaman lain (Dashboard, POS Kasir, Stok, Transaksi, Laporan) akan dibuatkan prompt terpisah dengan pendekatan yang sama, agar konsistensi desain (color palette, font, radius token) tetap terjaga di seluruh aplikasi — pastikan saat mengerjakan halaman ini kamu catat/tetapkan design token final (warna hex pasti, nama font pasti) yang akan saya pakai ulang sebagai acuan di prompt halaman-halaman berikutnya.*
