# Warung Medan Finance — Offline Edition

Aplikasi pembukuan offline-first untuk Warung Medan CT Catering. Versi ini menggunakan React, TypeScript, Vite, Dexie, dan IndexedDB. Tidak ada database cloud atau server backend aktif.

## Fitur utama

- Dashboard dan laporan keuangan
- Transaksi, penjualan, akun, saldo awal, dan audit log
- Inventaris, mutasi stok, produk/menu, dan HPP
- Utang dan piutang
- Pengelolaan Palembang Center, Sungai Baung, dan Bazar dalam satu perangkat pusat
- Transfer uang dan stok antarunit
- Backup terenkripsi AES-GCM dengan kata sandi serta pemulihan backup JSON lama
- PWA app-shell cache untuk membuka kembali aplikasi tanpa internet setelah aset pertama kali berhasil dimuat

## Prasyarat

- Node.js 22 (direkomendasikan)
- npm

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka URL lokal yang ditampilkan Vite. Data disimpan di IndexedDB browser yang sedang digunakan. Gunakan perangkat/browser yang sama untuk pembukuan pusat.

## Pengujian dan build

```bash
npm test
npm run lint
npm run build
npm run preview
```

Build produksi tersedia di folder `dist/`.

## Deploy gratis ke GitHub Pages

1. Buat repository GitHub baru dan unggah seluruh isi folder proyek ini ke branch `main`.
2. Buka **Settings → Pages** pada repository.
3. Pada **Build and deployment**, pilih **GitHub Actions** sebagai source.
4. Push ke branch `main`, atau jalankan workflow **Build and deploy Warung Medan Finance** dari tab Actions.
5. Setelah workflow sukses, buka URL Pages yang diberikan GitHub.

Workflow menjalankan tes akuntansi, pemeriksaan TypeScript/build, lalu menerbitkan folder `dist`.

## Cara kerja offline

- GitHub Pages hanya meng-host file statis aplikasi; bukan database.
- Data transaksi disimpan pada IndexedDB lokal di browser/perangkat pusat.
- Service worker menyimpan app shell dan aset same-origin setelah pemuatan online pertama. Saat pertama kali diakses online, aplikasi dapat memuat ulang satu kali ketika service worker aktif. Setelah itu, buka ulang saat online untuk memastikan aset sudah tercache, lalu uji mode pesawat/offline pada perangkat sasaran.
- Membersihkan data situs/browser, mengganti profil browser, atau kerusakan perangkat dapat menghilangkan database lokal. Backup rutin tetap wajib.
- Tidak ada sinkronisasi otomatis antarperangkat. Tiga unit dikelola dari satu perangkat pusat.

## Backup dan pemulihan

Dari **Pengaturan → Cadangkan / Backup**:

1. Buat backup terenkripsi `.wmfbak` menggunakan kata sandi minimal 12 karakter.
2. Simpan kata sandi secara terpisah; tanpa kata sandi, file tidak bisa dipulihkan.
3. Salin file hasil unduhan ke media lokal terpisah, misalnya SSD/flashdisk khusus. Jangan menyimpan satu-satunya salinan di perangkat yang sama.
4. Pemulihan menerima backup terenkripsi `.wmfbak` dan backup JSON lama. JSON lama tidak terenkripsi dan akan meminta konfirmasi.
5. Lakukan uji restore berkala pada salinan/lingkungan uji sebelum mengandalkan backup untuk keadaan darurat.

## Migrasi dari versi cloud/lama

Sebelum beralih, ekspor backup dari versi lama. Jika ada data yang hanya berada di Firestore, ekspor data tersebut melalui versi lama terlebih dahulu. Versi offline ini tidak mengambil atau menggabungkan data cloud otomatis. Validasi saldo, transaksi, stok, dan laporan setelah restore.

## Batasan penting

- Ini aplikasi satu perangkat pusat. Browser lain/perangkat lain memiliki database terpisah.
- PIN aplikasi membantu membatasi penggunaan UI, tetapi bukan pengganti keamanan akun OS atau enkripsi seluruh disk.
- Backup terenkripsi memakai Web Crypto AES-GCM dan PBKDF2. Gunakan HTTPS (GitHub Pages) atau localhost.
- Sebelum pembukuan produksi, uji transaksi, konsolidasi, backup, dan restore dengan data contoh serta buat backup awal.


## Pengembangan fitur inventaris (Oktober 2026)

- Master bahan baku dapat diedit untuk memperbarui nama, kategori, harga satuan, batas minimum, supplier, dan area Bazar. Penghapusan menggunakan arsip (soft delete) agar riwayat tidak hilang; stok harus nol terlebih dahulu.
- Bahan baku dapat memakai satu satuan utama (contoh kg) dan satu satuan tambahan (contoh potong). Stok awal dan setiap pergerakan menyimpan kedua kuantitas secara terpisah; nilai persediaan/HPP tetap dihitung dari satuan utama.
- Bazar A dan B tersedia sebagai pilihan area pada master bahan, pergerakan stok, input penjualan/pengeluaran, dan filter daftar stok/transaksi.
- Tombol ajakan “Mulai Pembukuan Nyata” dihapus; indikator DATA DEMO tetap informatif dan tidak lagi menjadi tombol.

Catatan: perubahan ini menambahkan properti opsional ke record IndexedDB sehingga data lama tetap dapat dibaca tanpa menghapus database. Tetap lakukan backup sebelum deployment, lalu uji build, stok ganda, filter area Bazar, dan backup/restore pada perangkat target.
