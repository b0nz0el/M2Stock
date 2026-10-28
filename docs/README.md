# Dokumentasi Arsitektur Modul & Keputusan Teknis — Aquastock Pro

Direktori ini memuat dokumentasi teknis dan referensi arsitektur mendalam untuk proyek **Aquastock Pro** (Toko "Jaquris — Jatimakmur Aquarium Aksesoris, Bekasi").

---

## Indeks Dokumentasi

| Dokumen | Deskripsi |
|---|---|
| [../README.md](../README.md) | Ikhtisar proyek, quick start, daftar npm scripts, dan pohon struktur |
| [architecture.md](architecture.md) | Diagram layer, arsitektur modul frontend & backend Supabase, model keamanan, dan alokasi performa |
| [api-contract.md](api-contract.md) | Spesifikasi kontrak API REST, format response envelope, Supabase RPC, Storage, dan aturan RLS |
| [setup-database.md](setup-database.md) | Bootstrap database, urutan migrasi, trigger stok, RPC, RLS, dan panduan pemulihan |
| [deployment.md](deployment.md) | Panduan deployment static hosting (GitHub Pages, Vercel, Netlify) dan checklist pra-produksi |

---

## Peta CSS (Updated)

Seluruh style frontend disusun secara terpisah untuk menjaga modularitas, kepatuhan aksesibilitas, dan isolasi breakpoint responsif.

| File | Tanggung Jawab & Cakupan |
|---|---|
| `public/assets/css/tailwind.static.css` | Utilitas Tailwind hasil kompilasi statis melalui `npm run build`. |
| `public/assets/css/base.css` | CSS reset, token warna, typography, focus-visible, dan kelas helper aksesibilitas. |
| `public/assets/css/main.css` | **Shell orchestrator**. Menggunakan `@import './base.css';` untuk memastikan fondasi dasar ter-load pertama kali, mendefinisikan layout `app-sidebar`, layout desktop shell, dan typography judul modul (`.section-title`). |
| `public/assets/css/components.css` | Styling komponen UI reusable: `.card`, `.badge`, `.btn`, `.toast`, `.skeleton`, floating `#bulk-bar`, grid seragam `.report-tabs`, dialog modal, dan animasi interaksi. |
| `public/assets/css/layout.css` | Transisi pergantian halaman halus (`@keyframes pageEnter` 0.4s cubic-bezier dengan filter blur), struktur fixed `.bottom-nav` mobile, dan sticky scrolling sidebar desktop. |
| `public/assets/css/pages.css` | Penyesuaian khusus halaman tertentu (seperti dimensi visual `.chart-container` pada Chart.js). |
| `public/assets/css/responsive.css` | Sentralisasi aturan breakpoint, fallback viewport iOS `@supports`, dan adaptasi bagi pengguna yang mengaktifkan `@media (prefers-reduced-motion)`. |
| `public/assets/css/login.css` | Styling khusus antarmuka halaman login (latar gelap, form card terpusat, splash screen, efek ambient glow, dan indikator status). |

> [!NOTE]
Ukuran aset dapat berubah; gunakan `npm run size` untuk pengukuran aktual, bukan angka statis dalam dokumentasi.

---

## Peta JavaScript (Updated)

Semua script klien dimuat dengan atribut `defer` agar perenderan awal DOM tidak terblokir.

| File | Tanggung Jawab & Integrasi |
|---|---|
| `public/assets/js/supabase-client.js` | Menginisialisasi klien resmi Supabase SDK (`@supabase/supabase-js@2` via ESM) menggunakan kredensial anon key publik dan menempelkannya ke `window.supabase`. |
| `public/assets/js/api/*.js` | Modul akses Supabase yang dipisah menurut domain, termasuk produk, transaksi, supplier, customer, PO, retur, backup, dan lainnya. |
| `public/assets/js/auth.js` | Wrapper otentikasi Supabase Auth: login email/password, registrasi akun baru, sign out, pengecekan sesi aktif, proteksi rute halaman dashboard, serta auto-redirect jika belum login. |
| `public/assets/js/image-utils.js` | Utilitas kompresi foto produk berbasis HTML5 Canvas API pada sisi klien. Mengonversi gambar apapun menjadi format WebP berdimensi maksimum 1600px dengan batas ukuran optimal 500 KB – 1 MB sebelum diunggah ke Supabase Storage. |
| `public/assets/js/icons.js` | Subset mandiri berisikan 74 SVG ikon Lucide aktif. Menyediakan fungsi global `window.refreshIcons(container)` untuk merender ikon tanpa dependensi CDN runtime berukuran besar. |
| `public/assets/js/components/app-sidebar.js` | Web component sidebar navigasi aplikasi yang konsisten di semua halaman dashboard, menangani status tautan aktif dan informasi profil login. |
| `public/assets/js/utils.js` | Helper global aplikasi: `showToast()` dengan dot status & ikon Lucide, `parseIndonesianNumber()`, `formatRupiah()`, `syncTableLabels()`, dan ekspor data ke file CSV (`exportToCSV()`). |
| `public/assets/js/navigation.js` | Routing antarmuka multi-halaman (MPA dengan clean URL), kontrol buka/tutup mobile drawer sidebar, interaksi tab bottom navigation, dan focus trap accessibility. |
| `public/assets/js/charts.js` | Modul pembungkus konfigurasi Chart.js untuk diagram penjualan harian dan proporsi channel penjualan di dashboard serta modul laporan. |
| `public/assets/js/animations.js` | Animasi peningkatan interaksi bertahap (counter statistik berputar dan transisi elemen) yang otomatis dinonaktifkan bila pengguna memilih reduced motion. |
| `public/assets/js/app.js` | Orkestrator inisialisasi aplikasi saat `DOMContentLoaded`: registrasi event shortcut global (⌘K / Ctrl+K), inisialisasi ikon awal, dan sinkronisasi label tabel responsif. |
| `public/assets/js/login.js` | Logika interaksi form halaman login: validasi kredensial, feedback visual proses loading, penanganan pesan error autentikasi, dan pengalihan ke dashboard. |
| `public/assets/js/vendor/chart.min.js` | Bundle Chart.js lokal. |
| `public/assets/js/vendor/html5-qrcode.min.js` | Fallback pemindai barcode lokal; disertakan pada cache PWA agar tidak membutuhkan CDN eksternal saat pemindaian. |

---

## Rekam Jejak Keputusan Refactor & Arsitektur

### 1. Multi-Page Application (MPA) dengan Clean URL
- Dipilih pendekatan multi-page statis menggunakan slug folder (`/dashboard/items/`, `/dashboard/in/`, dst.) tanpa ekstensi `.html`.
- Menyediakan performa awal instan tanpa overhead runtime JavaScript framework besar, tetap ramah SEO, dan memungkinkan tautan langsung di-bookmark oleh staff kasir.

### 2. Fase 3: Eliminasi Ketergantungan CDN Eksternal
- **Tailwind Static Build:** Runtime JIT `cdn.tailwindcss.com` dihapus; stylesheet dikompilasi ke `tailwind.static.css`.
- **Lucide Local Subset:** Paket CDN Lucide utuh (1.1 MB) digantikan oleh 74 SVG terpilih di `icons.js` (~5.0 KB gzip), menghemat 96% konsumsi transfer data.
- **Barcode Scanner Lokal:** fallback `html5-qrcode` tidak lagi bergantung pada unpkg; ukuran total vendor ikut tercermin pada `npm run size`.

### 3. Fase 4.x: Integrasi Layanan Supabase
- **Otentikasi Pengguna:** Menggunakan Supabase Auth (Email Provider) dengan pembagian role bertingkat: `OWNER`, `STAFF`, dan `VIEWER`.
- **Modul API per domain (`api/*.js`):** Akses data Supabase dipisah menurut domain; periksa implementasi modul untuk perilaku error tiap operasi.
- **Kompresi Gambar Klien (`image-utils.js`):** Mengurangi beban kuota bandwidth dan storage Supabase dengan memproses foto produk sebelum transfer; resolusi dibatasi maksimum 1600px dan dikonversi ke format WebP terkompresi (500 KB – 1 MB).
- **Auto-Update Stok Transaksi:** Pembaruan saldo stok produk saat barang masuk atau keluar ditangani di level database via PostgreSQL Trigger Function (`handle_transaction_stock_update()`), mencegah race condition transaksi kasir simultan.

### 4. RLS (Row Level Security) Policies
- Keamanan aplikasi tidak semata-mata bergantung pada validasi frontend, melainkan dilindungi langsung oleh RLS pada setiap tabel:
  - Seluruh pengguna terotentikasi (`authenticated`) memiliki akses baca terhadap master data katalog.
  - Modifikasi data sensitif (role pengguna, pengaturan toko, penghapusan produk dengan riwayat transaksi) dibatasi ketat melalui fungsi keamanan `is_owner()`.
  - Service Role Key **tidak pernah** dipaparkan di sisi frontend; seluruh interaksi klien hanya menggunakan Anon Key publik.

### 5. Verifikasi yang belum dibuktikan otomatis
- `npm run qa:a11y` memeriksa halaman login dengan axe/keyboard pada tiga ukuran viewport; pengujian manual Safari/iOS dan seluruh dashboard tetap diperlukan.
- `npm run qa:load` menguji aset HTTP statis secara terbatas, bukan beban transaksi/database.
- Restore backup perlu recovery drill pada Supabase staging; tes unit lokal hanya memakai mock API.
