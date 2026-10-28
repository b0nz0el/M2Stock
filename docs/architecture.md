# Arsitektur Sistem — Aquastock Pro

Dokumen ini menjelaskan gambaran arsitektur teknis, diagram aliran data, modularisasi frontend, konfigurasi layanan backend Supabase, model keamanan berlapis, serta alokasi performa untuk **Aquastock Pro**.

---

## 1. Diagram Layer & Aliran Data

Aplikasi dibangun dengan pola **Static Client-Side Architecture** yang berkomunikasi secara langsung ke layanan managed Cloud Database tanpa perantara server monolitik kustom.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LAPISAN PERAMBAN (BROWSER)                       │
│                                                                        │
│ HTML5 (dashboard modular) │ Tailwind CSS (Statis)  │ Inter Variable │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Interaksi DOM & Event
┌───────────────────────────────────▼────────────────────────────────────┐
│                       MODUL JAVASCRIPT FRONTEND                         │
│                                                                        │
│  app.js ───► navigation.js ───► utils.js ───► image-utils.js (Canvas)  │
│                   │                                                    │
│                   ▼                                                    │
│      assets/js/api/*.js (modul data per domain)                        │
│                   │                                                    │
│                   ▼                                                    │
│      supabase-client.js (Inisialisasi SDK Klien Resmi)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST / HTTPS (Anon Key)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICES (SUPABASE)                       │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  Supabase Auth   │  │ Supabase Storage │  │ PostgREST / REST API │  │
│  │ (Session & JWT)  │  │ (product-images) │  │  (Data Queries)      │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│           │                     │                       │              │
│           ▼                     ▼                       ▼              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                DATABASE ENGINE (POSTGRESQL 15)                   │  │
│  │                                                                  │  │
│  │  • Schema relasional berkembang melalui bootstrap & migrations │  │
│  │  • Kebijakan Row Level Security (RLS) didefinisikan di migrasi   │  │
│  │  • Database Triggers (Penyesuaian Stok Otomatis Mutasi Transaksi)│  │
│  │  • Stored Procedures / RPC (get_auth_users, update_user_role)   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Struktur Modul Frontend

Seluruh kode frontend berada di direktori `public/assets/js/` dan diorganisasikan berdasarkan tanggung jawab fungsional tunggal:

1. **`supabase-client.js`**:
   - Titik awal inisialisasi koneksi SDK `@supabase/supabase-js` melalui ESM CDN.
   - Menyediakan instance singleton `supabase` dan mengeksposnya ke objek global peramban `window.supabase`.

2. **`api/` (modul akses data per domain)**:
   - Mengkapsulasi query basis data untuk produk, transaksi, supplier, pelanggan, pengguna, backup, dan domain lainnya di modul terpisah.
   - Menyediakan penanganan pembatalan request dinamis via `AbortController` (berguna untuk search debounce dan pergantian halaman cepat).
   - Memformat setiap hasil respons ke dalam struktur **Response Envelope** seragam (`{ ok, data, error, meta }`).

3. **`auth.js`**:
   - Mengelola status sesi pengguna (`supabase.auth.getSession()`).
   - Menyediakan fungsi login, pendaftaran akun baru, logout, dan guard pengalihan rute (redirect ke `/login/` jika belum terotentikasi).

4. **`utils.js`**:
   - Kumpulan fungsi utilitas umum:
     - `showToast(msg, type)`: Sistem notifikasi melayang dengan dot status berwarna dan ikon Lucide SVG.
     - `parseIndonesianNumber(str)`: Konversi format numerik lokal Indonesia.
     - `formatRupiah(num)`: Pemformatan nominal mata uang standar Indonesia.
     - `syncTableLabels(table)`: Mengisi atribut `data-label` responsif sel tabel secara otomatis untuk tampilan card mobile.
     - `exportToCSV(filename, rows)`: Utilitas ekspor data tabel langsung ke file format CSV.

5. **`navigation.js`**:
   - Mengatur navigasi halaman Multi-Page Application (MPA) berbasis clean URL (`/dashboard/<slug>/`).
   - Mengontrol interaksi buka/tutup mobile drawer sidebar, focus trap keyboard aksesibilitas, serta indikator aktif tab navigasi bawah (*bottom navigation*).

6. **`app.js`**:
   - Entry point orkestrasi DOM. Memasang listener shortcut global (⌘K / Ctrl+K untuk pencarian cepat), menginisialisasi pustaka ikon saat `DOMContentLoaded`, dan menyinkronkan status awal halaman.

7. **`components/app-sidebar.js`**:
   - Komponen Web Component kustom (`<app-sidebar>`) yang merender struktur navigasi sidebar identik di seluruh modul, menampilkan lencana role pengguna dan link menu aktif.

8. **`icons.js`**:
   - Subset mandiri 74 ikon Lucide SVG pilihan tanpa perlu memuat pustaka CDN 1.1 MB. Fungsi `refreshIcons()` menginjeksi SVG ke elemen `<i data-lucide="...">`.

9. **`image-utils.js`**:
   - Kompresi gambar pada sisi klien menggunakan HTML5 Canvas API. Foto produk otomatis diperkecil ke resolusi proporsional (maks. 1600px) dan dikonversi ke WebP terkompresi dengan target ukuran optimal 500 KB – 1 MB sebelum diunggah ke storage.

---

## 3. Komponen Backend (Supabase Managed Cloud)

1. **Otentikasi & Manajemen Pengguna**:
   - Memanfaatkan Supabase Auth berbasis JSON Web Token (JWT).
   - Registrasi dan login menggunakan email & kata sandi. Konfirmasi email dapat dinonaktifkan pada lingkungan development agar akun uji dapat langsung digunakan.

2. **Database PostgreSQL (Supabase)**:
   - Skema berkembang melalui bootstrap database dan migrasi berurutan di `supabase/migrations/`; jangan mengandalkan angka tabel tetap dari dokumen ini.
   - Domain yang tercakup antara lain profil/role, produk, kategori/satuan, transaksi/stok, supplier/pelanggan, PO/retur, kas/utang, notifikasi, audit, backup, dan penyesuaian stok.

3. **Storage Bucket (`product-images`)**:
   - Bucket publik untuk melayani aset gambar produk via URL publik.
   - Kebijakan penyimpanan: Publik dapat membaca (`public read`), hanya pengguna terotentikasi (`authenticated write`) yang diizinkan mengunggah dan menghapus file.

4. **Triggers & Stored Procedures**:
   - **Trigger `trg_transaction_stock_update`**: Setiap kali ada baris baru di `transactions`, trigger otomatis mengeksekusi function `handle_transaction_stock_update()` untuk menambah stok (saat barang masuk) atau mengurangi stok (saat barang keluar) secara atomik.
   - **RPC `get_auth_users`**: Menggabungkan data akun `auth.users` dengan tabel profil publik, dibatasi khusus untuk user ber-role Owner.
   - **RPC `update_user_role`**: Mengubah role user lain dengan validasi keamanan dan proteksi agar Owner tidak dapat men-demote akunnya sendiri jika tersisa satu.

---

## 4. Model Keamanan Berlapis (Security Model)

```
┌────────────────────────────────────────────────────────┐
│ Klien (Browser)                                        │
│  - Hanya memegang SUPABASE_ANON_KEY publik              │
│  - Tidak pernah menyimpan SERVICE_ROLE_KEY             │
│  - JWT disimpan secara aman di LocalStorage via SDK    │
└───────────────────────────┬────────────────────────────┘
                            │ Setiap request HTTP menyertakan JWT
                            ▼
┌────────────────────────────────────────────────────────┐
│ PostgreSQL Row Level Security (RLS)                    │
│  - Kebijakan RLS dan role memeriksa akses data         │
│  - Fungsi security definer is_owner() dipakai modul    │
│  - Hak mutasi bergantung pada grant/policy aktif       │
│  - Foreign Key Constraint mencegah hapus produk aktif │
└────────────────────────────────────────────────────────┘
```

1. **Prinsip Least Privilege**:
   - Frontend **hanya menggunakan Anon Key**. Kunci berkekuatan tinggi (`service_role key`) tidak pernah disertakan dalam kode klien atau file build publik.
2. **Row Level Security (RLS)**:
   - Repository memiliki migrasi yang mendefinisikan kebijakan RLS. Pemeriksaan kode tidak membuktikan bahwa seluruh tabel, grant, dan RPC pada proyek Supabase aktif memiliki konfigurasi yang sama; verifikasi instance staging/produksi secara terpisah sebelum mengklaim perlindungan runtime.
3. **Pembagian Peran (Role-Based Access Control)**:
   - `OWNER`: Hak penuh ke seluruh fitur, manajemen user, perubahan role, dan penghapusan transaksi / produk.
   - `STAFF`: Dapat melihat data, membuat produk baru, dan mencatat transaksi barang masuk & keluar kasir.
   - `VIEWER`: Akses baca (*read-only*) terhadap katalog dan laporan analitik.

---

## 5. Performance & Size Budget

Untuk menjamin kelancaran sistem pada perangkat kasir berspesifikasi rendah dan koneksi internet toko, alokasi anggaran ukuran aset diatur secara ketat:

| Metrik / Aset | Batas Anggaran (Budget) | Ukuran Riil Saat Ini | Status Evaluasi |
|---|---|---|---|
| **Total CSS Gzip** | Budget monitoring 60 KB | Diukur saat perintah dijalankan | `npm run size` |
| **Total JS Gzip** | Budget monitoring 120 KB | Diukur saat perintah dijalankan; budget dapat terlampaui | `npm run size` |
| **FCP / TTI** | Belum ada baseline terkontrol yang dapat diklaim | Ukur pada perangkat dan jaringan sasaran | Belum menjadi CI gate |

---

## 6. Arsitektur Deployment

Sistem saat ini menggunakan model **Serverless Jamstack**:
- **Frontend Hosting**: aset statis dipublikasikan di Cloudflare Pages; koneksi Git/auto-deploy dikonfigurasi di luar repository.
- **Backend & Database**: Dihosting sepenuhnya pada infrastruktur **Supabase Cloud**.
- Rincian panduan dan checklist deployment tersedia di [deployment.md](deployment.md).

Skema bootstrap, migrasi, pengujian, dan backup dapat berubah; periksa file aktual di repository dan jangan menganggap dokumentasi ini sebagai bukti kondisi konfigurasi proyek cloud.
