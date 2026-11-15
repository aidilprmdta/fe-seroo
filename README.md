# Seroo Mobile

Aplikasi mobile Sistem Informasi Manajemen Operasional Teh Tarik Seroo.

Aplikasi mobile ini dikembangkan untuk mendukung kegiatan operasional Teh Tarik Seroo melalui perangkat mobile atau tablet. Sistem dirancang untuk menyediakan antarmuka bagi pengguna berdasarkan hak akses masing-masing, yaitu Crew, Manager, Owner Mitra, dan Owner Pusat.

## Teknologi yang Digunakan

| Komponen | Teknologi |
|---|---|
| Framework | React Native |
| Development Platform | Expo |
| Bahasa Pemrograman | JavaScript |
| Navigasi | Expo Router |
| Styling | React Native StyleSheet |
| Backend API | Hono |
| Database | PostgreSQL |
| ORM Backend | Prisma ORM |

## Persyaratan Sistem

Sebelum menjalankan aplikasi, pastikan perangkat pengembangan telah memiliki:

- Node.js versi LTS yang kompatibel.
- Package manager yang digunakan oleh proyek.
- Expo CLI atau dukungan Expo melalui dependensi proyek.
- Android Studio atau perangkat Android untuk menjalankan aplikasi.
- Koneksi ke backend API yang telah dikonfigurasi.

## Instalasi dan Konfigurasi

1. Unduh atau salin repository proyek ke perangkat.
2. Masuk ke direktori aplikasi mobile.
3. Instal seluruh dependensi berdasarkan konfigurasi `package.json`.
4. Siapkan konfigurasi alamat backend API sesuai lingkungan pengembangan.
5. Pastikan backend dan database telah dikonfigurasi dengan benar.
6. Jalankan aplikasi menggunakan script yang tersedia pada `package.json`.

## Menjalankan Aplikasi

Aplikasi dikembangkan menggunakan Expo sehingga dapat dijalankan pada lingkungan pengembangan yang mendukung Expo.

Perintah untuk menjalankan aplikasi harus mengikuti script yang tersedia pada `package.json`. Aplikasi dapat diuji melalui emulator Android maupun perangkat Android yang kompatibel.

## Fitur dan Hak Akses Pengguna

Aplikasi dirancang dengan pembagian hak akses berdasarkan peran pengguna:

- **Crew:** Mendukung aktivitas operasional harian, seperti pencatatan pesanan dan transaksi penjualan.
- **Manager:** Mendukung pengelolaan operasional outlet, termasuk persediaan, waste, pengeluaran, dan closing.
- **Owner Mitra:** Mendukung pemantauan aktivitas serta laporan operasional outlet yang dikelola.
- **Owner Pusat:** Mendukung pemantauan dan pengelolaan operasional secara keseluruhan.

Ketersediaan setiap fitur mengikuti tahap implementasi dan hasil pengembangan aplikasi.

## Arsitektur dan Integrasi Sistem

Aplikasi mobile menggunakan pendekatan client-server. Aplikasi berkomunikasi dengan backend melalui HTTP API untuk mengirim dan menerima data.

Backend dikembangkan secara terpisah menggunakan Node.js dan Hono, sedangkan pengelolaan data dilakukan menggunakan PostgreSQL dengan Prisma ORM.

## Keamanan Aplikasi

Pengembangan aplikasi memperhatikan beberapa aspek keamanan, antara lain:

- Autentikasi pengguna sebelum mengakses fitur yang memerlukan login.
- Pembatasan akses berdasarkan peran pengguna (Role-Based Access Control).
- Pembatasan data berdasarkan outlet sesuai hak akses pengguna.
- Perlindungan token autentikasi dan informasi sensitif.
- Validasi data sebelum dikirimkan ke backend API.

## Catatan Pengembangan

Aplikasi mobile dikembangkan menggunakan React Native, Expo, dan JavaScript. Antarmuka dirancang dengan pendekatan tablet-first agar mendukung kebutuhan operasional outlet.

Implementasi fitur dilakukan secara bertahap dan disesuaikan dengan kebutuhan sistem, rancangan antarmuka, serta kontrak komunikasi dengan backend.
