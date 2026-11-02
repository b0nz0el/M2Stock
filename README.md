# Aquastock Pro — Production Inventory & POS System
> **Versi aplikasi:** ikuti `package.json` dan `public/version.json`
> **Sistem:** Multi-Page Application (MPA) Inventory & Point of Sale  
> **Toko:** Habitic, Pondok Gede, Bekasi)
> **Live URL:** [https://aquastock-pro.pages.dev](https://aquastock-pro.pages.dev)  
> **Hosting:** Cloudflare Pages (`main`; auto-deploy bergantung pada integrasi Cloudflare di luar repository)

---

## 🌟 Ikhtisar Proyek

**Aquastock Pro** adalah sistem manajemen inventaris barang, kasir multi-item (Point of Sale / POS), manajemen pesanan pembelian (PO), pencatatan arus kas, dan pelacakan hutang/piutang yang dirancang khusus untuk toko perlengkapan dan aksesoris akuarium skala ritel dan grosir.

Dibangun sebagai **Progressive Web App (PWA)** dengan *Vanilla JavaScript (ES Modules)*, *Tailwind CSS* dan backend Supabase. POS mempunyai antrean offline terbatas; fungsi lain yang memerlukan data cloud membutuhkan koneksi internet.

---

## 🚀 Fitur Utama

### 1. 📱 Progressive Web App (PWA) & Offline POS
* **Web App Manifest (`/manifest.json`)**: Memungkinkan instalasi aplikasi (*Add to Home Screen*) dengan icon resolusi tinggi (`192x192` & `512x512` maskable), splash screen, dan mode tampilan *standalone*.
* **Multi-Page Application Service Worker (`/sw.js`)**: Menyimpan app shell dan aset lokal; halaman mencoba jaringan terlebih dahulu dengan cache sebagai fallback.
* **Offline POS Engine (`aquastock-offline-db` via IndexedDB)**:
  * Menyalin katalog master barang ke database lokal browser.
  * POS dapat mengantrekan transaksi penjualan saat perangkat offline dan mencoba sinkronisasi ke Supabase saat koneksi pulih. Cakupan offline ini tidak berarti semua modul dapat dipakai offline.

### 2. 🛒 Kasir POS Multi-Item Split-View (Point of Sale)
* **2-Column Split-View Layout**:
  * **Kolom Kiri**: Kolom pencarian & barcode scan, *Category Filter Chips* (*Semua, Pakan, Obat, Vitamin, Pompa, Filtrasi, Aksesoris*), *Tap-to-Cart Product Grid* untuk input instan tanpa mengetik, serta tabel keranjang belanja dengan kontrol jumlah item dinamis.
  * **Kolom Kanan**: Panel checkout sticky dengan pemilihan channel penjualan (Offline, Shopee, Tokopedia, TikTok, Lazada, WhatsApp), pemilihan pelanggan, catatan/no. resi, kalkulator diskon rupiah, dan toggle PPN 11%.
* **Kalkulator Uang Tunai & Kembalian**: Dilengkapi tombol bantuan uang pas dan pecahan cepat (`Uang Pas`, `+20rb`, `+50rb`, `+100rb`).
* **Cetak Struk Kasir Termal**: Format standar struk kasir 58mm & 80mm dengan nomor invoice unik terkelompok (`INV-YYMMDD-XXXX`).

### 3. 🔍 Barcode Scanner
* **Hardware Interceptor (USB / Bluetooth)**: Pendeteksi ketukan tombol super cepat global (< 50ms interval, >= 8 karakter diakhiri `Enter`) yang langsung mendeteksi pemindaian scanner fisik tanpa mengharuskan pengguna memfokuskan kursor ke input pencarian terlebih dahulu.
* **Kamera Mobile / Tablet Scanner**: Menggunakan native browser `BarcodeDetector` API dengan pustaka `html5-qrcode` yang di-host lokal dan disertakan dalam cache PWA.
* **Audio & Haptic Feedback**: Menghasilkan suara *beep* sintetis berfrekuensi 880Hz (100ms) via *Web Audio API* dan getaran haptik getar (`navigator.vibrate(100)`) saat barcode berhasil dipindai.

### 4. ⚡ Global Command Palette (`⌘K` / `Ctrl+K`)
* Akses cepat bergaya Linear / Spotlight di seluruh 15 modul dashboard.
* Navigasi instan antar modul, pencarian produk & barcode langsung ke database, serta jalan pintas aksi cepat (*Buka Kasir POS*, *Tambah Barang Baru*, *Catat Barang Masuk*, *Buat Draft PO*, *Catat Kas Masuk/Keluar*).

### 5. 🤖 Restock Assistant & Manajemen PO
* Pembuatan **Draft PO Otomatis** dari daftar barang dengan stok menipis (`stock <= min_stock`) yang dikelompokkan otomatis per supplier mitra.
* Formula restock pintar: `GREATEST(1, (min_stock * 2) - stock)`.
* Label Restock Assistant pada PO otomatis: **`Restock otomatis dari daftar stok menipis (Restock Assistant)`**.

### 6. 📊 Adaptif UI/UX Lintas Perangkat (Responsive Design)
* **Desktop (> 1024px)**: Sidebar navigasi tetap dengan badge indikator stok kritis dan notifikasi realtime.
* **Tablet (768px – 1024px)**: *Navigation Rail* ringkas selebar `72px` (icon-first) yang memaksimalkan area kerja horizontal.
* **Mobile (< 768px)**: *Fixed Bottom Navigation Bar* dengan tombol Floating Action Button (FAB) tengah yang menonjol untuk Kasir/Scan, serta transformasi tabel menjadi *Bento Cards* bersahabat sentuhan dengan atribut `data-label`.
* **Zero Native Dialogs**: Seluruh `alert()` dan `confirm()` bawaan browser yang memblokir layar digantikan oleh toast interaktif dan modal slide-up *Bottom Sheet* modern.

---

## 🛠️ Tech Stack & Arsitektur

| Komponen | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Arsitektur** | Multi-Page Application (MPA) | Clean URL routes tanpa reload framework berat |
| **Frontend Core** | Vanilla JavaScript (ES2022 Modules) | Ringan, cepat, tanpa overhead bundler rumit |
| **Styling** | Tailwind CSS v3 (Custom Build) | Desain terpusat di `tailwind/input.css` & `public/assets/css/` |
| **Typography** | InterVariable (`.woff2`) | Self-hosted, preloaded, angka monospaced `tabular-nums` |
| **Database & Auth** | Supabase PostgreSQL 15 | Row Level Security (RLS), JWT Auth, Storage Bucket |
| **Local Cache** | IndexedDB (`aquastock-offline-db`) | Offline storage untuk master produk dan antrean transaksi |
| **Service Worker** | Native PWA Cache API | Caching app shell dan offline fallback |
| **Ikon Sistem** | Lucide Icons (Self-Hosted SVG) | 74 ikon mandiri teroptimasi tanpa CDN eksternal |
| **Grafik & Chart** | Chart.js | Aset vendor lokal |
| **Pengujian** | Vitest + Playwright + axe-core | Tes unit/integrasi dan pemeriksaan UI lokal |
| **Hosting & CI/CD** | Cloudflare Pages + GitHub Actions | Deploy Pages bergantung pada integrasi Cloudflare; workflow di repo menaikkan versi |

---

## 📁 Struktur Direktori Proyek

```
aquastock-pro/
├── public/                               # Root direktori web statis (Cloudflare Pages deploy root)
│   ├── index.html                        # Entry point redirect autentikasi
│   ├── 404.html                          # Halaman 404 responsif
│   ├── manifest.json                     # PWA Web App Manifest
│   ├── sw.js                             # PWA Service Worker (Cache-First & Offline Fallback)
│   ├── login/                            # Halaman Login Multi-User
│   │   └── index.html
│   ├── dashboard/                        # 15 Modul Aplikasi Utama
│   │   ├── index.html                    # Dashboard Overview (KPI & Chart)
│   │   ├── dashboard.js                  # Controller Dashboard Overview
│   │   ├── items/                        # 1. Master Barang (Katalog, Barcode, Kategori, Satuan)
│   │   ├── in/                           # 2. Barang Masuk (Penerimaan Stok & Supplier)
│   │   ├── out/                          # 3. Barang Keluar & Kasir POS Multi-Item
│   │   ├── po/                           # 4. Purchase Order & Restock Otomatis
│   │   ├── return/                       # 5. Retur Penjualan & Pembelian
│   │   ├── suppliers/                    # 6. Master Data Supplier
│   │   ├── customers/                    # 7. Master Data Pelanggan
│   │   ├── cash/                         # 8. Buku Kas & Arus Keuangan
│   │   ├── debt/                         # 9. Buku Hutang & Piutang
│   │   ├── report/                       # 10. Laporan Laba/Rugi & Analitik
│   │   ├── users/                        # 11. Manajemen Pengguna & Role
│   │   ├── audit/                        # 12. Audit Log Aktivitas Sistem
│   │   ├── notif/                        # 13. Notifikasi Operasional
│   │   ├── backup/                       # 14. Cadangan & Pemulihan Data JSON/CSV
│   │   └── settings/                     # 15. Profil Toko & Pengaturan Sistem
│   └── assets/                           # Bundel Aset Produksi
│       ├── css/                          # CSS Modular (base, layout, components, responsive, tailwind)
│       ├── js/                           # Modul Logika JS
│       │   ├── app.js                    # Inisialisasi shell, PWA SW reg, shortcut ⌘K
│       │   ├── navigation.js             # Router navigasi & bottom navigation bar
│       │   ├── utils.js                  # Toast notification, currency formatter, konfirmasi
│       │   ├── supabase-client.js        # Supabase client connector
│       │   ├── api/                      # Service Layer CRUD Supabase
│       │   │   ├── items.js              # API produk, barcode, batch update
│       │   │   ├── transactions.js       # API mutasi stok & createBatchOut (POS)
│       │   │   ├── po.js                 # API purchase order & auto-restock generator
│       │   │   ├── cash.js               # API arus kas
│       │   │   ├── debt.js               # API hutang & piutang
│       │   │   └── ...                   # API report, users, audit, customers, dll.
│       │   ├── components/               # Web Components & UI Modules
│       │   │   ├── app-sidebar.js        # Web Component <app-sidebar>
│       │   │   ├── command-palette.js    # Spotlight Command Palette (⌘K)
│       │   │   ├── barcode-scanner.js    # Dual-mode scanner & hardware listener
│       │   │   └── csv-import.js         # CSV Import modal & mapper
│       │   └── utils/
│       │       ├── offline-sync.js       # IndexedDB offline POS queue & status pill
│       │       ├── rbac.js               # Role-based access control guard
│       │       └── rbac-ui.js            # UI read-only renderer untuk Viewer
│       ├── images/                       # Logo toko & ikon PWA
│       │   ├── logo.svg                  # Vektor logo Aquastock Pro
│       │   └── icons/                    # PWA App Icons (192x192 & 512x512)
│       └── fonts/                        # Font InterVariable (woff2)
├── supabase/                             # Skema & Migrasi Database
│   └── migrations/                       # Skrip SQL DDL, RLS, Triggers, & Stored Procedures
├── tests/                                # Vitest Unit & Integration Suites (19 Files / 129 Tests)
│   ├── api.test.js                       # Verifikasi client API
│   ├── app-sidebar.test.js               # Verifikasi komponen sidebar & navigasi
│   ├── csv-import.test.js                # Verifikasi pemrosesan & validasi CSV
│   ├── delete-api.test.js                # Verifikasi integritas penghapusan
│   ├── financial_automation.test.js      # Verifikasi auto-jurnal kas
│   ├── in-barcode.test.js                # Verifikasi scan barcode barang masuk
│   ├── inventory-sync.test.js            # Verifikasi sinkronisasi mutasi stok
│   ├── items-barcode.test.js             # Verifikasi pemetaan barcode produk
│   ├── items-bulk-meta.test.js           # Verifikasi bulk update satuan & supplier
│   ├── items-delete-integrity.test.js    # Verifikasi proteksi foreign key produk
│   ├── items-sort.test.js                # Verifikasi sorting default nama A-Z
│   ├── navigation.test.js                # Verifikasi 5 tab bottom nav mobile
│   ├── po_return_integrity.test.js       # Verifikasi draft PO & retur inventori
│   ├── pos-cart.test.js                  # Verifikasi kasir POS, diskon, & kembalian
│   ├── print_and_share.test.js           # Verifikasi format struk & share WA
│   ├── settings-catalog.test.js          # Verifikasi profil toko & master data
│   ├── table-labels.test.js              # Verifikasi konversi tabel ke Bento card
│   ├── transactions-schema.test.js       # Verifikasi validasi skema transaksi
│   └── utils.test.js                     # Verifikasi helper formatting & toast
├── scripts/                              # Otomasi & Utility Pengembang
│   ├── check-size.js                     # Pemantau size budget aset CSS/JS
│   ├── generate_icons.js                 # Generator ikon PNG PWA dari SVG
│   ├── link_pwa_manifest.js              # Injektor tag PWA ke seluruh HTML
│   └── verify_*.js                       # Skrip verifikasi headless Playwright
├── docs/                                 # Dokumentasi Teknis Lengkap
├── package.json                          # Dependensi & script eksekusi
└── tailwind.config.js                    # Konfigurasi Tailwind utility
```

---

## ⚡ Panduan Memulai Cepat (Quick Start)

### 1. Clone Repositori
```bash
git clone https://github.com/b0nz0el/aquastock-pro.git
cd "aquastock pro"
```

### 2. Instal Dependensi
```bash
npm install
```

### 3. Konfigurasi Supabase
Kredensial database publik terkonfigurasi di `public/assets/js/supabase-client.js`. Jika Anda menggunakan project Supabase pribadi:
1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor** di Supabase, lalu jalankan seluruh skrip migrasi yang terdapat di folder `supabase/migrations/` secara berurutan.
3. Aktifkan **Email Auth Provider** pada menu Authentication.
4. Buat Storage Bucket publik bernama `product-images` untuk foto katalog produk.
5. Perbarui `SUPABASE_URL` dan `SUPABASE_ANON_KEY` pada `public/assets/js/supabase-client.js`.

### 4. Jalankan Server Lokal
```bash
npm run dev
```
Buka browser di **`http://localhost:8000`** atau port default via `npm start` di **`http://localhost:3000`**.

---

## 📜 Perintah NPM (Scripts Reference)

| Perintah | Deskripsi & Kegunaan |
| :--- | :--- |
| **`npm run dev`** | Menjalankan local server di port `8000` |
| **`npm start`** | Menjalankan local server default di port `3000` |
| **`npm test`** | Menjalankan seluruh test suite Vitest (jumlah tes mengikuti repository) |
| **`npm run test:coverage`** | Menjalankan pengujian sekaligus menampilkan laporan cakupan kode V8 |
| **`npm run size`** | Mengukur ukuran aset JavaScript dan CSS (peringatan budget masih bersifat monitoring) |
| **`npm run build`** | Mengompilasi Tailwind CSS dan menyalin vendor barcode lokal ke folder publik |
| **`npm run qa:a11y`** | Memeriksa halaman login dengan axe dan keyboard pada viewport mobile, tablet, desktop |
| **`npm run qa:load`** | Smoke test HTTP statis terbatas; target remote hanya jika diizinkan secara eksplisit |

---

## 🔒 Matriks Hak Akses Pengguna (RBAC)

Aplikasi menerapkan sistem hak akses 3 tingkat (*Role-Based Access Control*) yang ditegakkan di layer antarmuka (UI) dan database (RLS):

| Modul / Fitur | OWNER | STAFF | VIEWER |
| :--- | :---: | :---: | :---: |
| **Dashboard & Ringkasan KPI** | Full | Full | Read-Only |
| **Master Barang, Barang Masuk/Keluar, POS** | Full | Buat/Baca/Ubah | ❌ Tidak Ada Akses |
| **Koreksi Stok Fisik / Stock Opname** | Full | ❌ Tidak Ada Akses | ❌ Tidak Ada Akses |
| **Purchase Order & Retur** | Full | Buat/Baca/Ubah | Read-Only |
| **Supplier, Customer, Kas, Hutang/Piutang** | Full | Buat/Baca/Ubah | ❌ Tidak Ada Akses |
| **Laporan & Analitik Keuangan** | Full | ❌ Tidak Ada Akses | ❌ Tidak Ada Akses |
| **Manajemen Pengguna, Audit Log, Backup, Settings** | Full | Read-Only | ❌ Tidak Ada Akses |

Koreksi stok fisik hanya tersedia bagi OWNER. Hak ini diberlakukan pada UI dan ditegakkan kembali oleh RLS, RPC `perform_stock_opname`, serta hak kolom database; STAFF/VIEWER tidak dapat membaca riwayat ledger atau mengubah kolom stok langsung melalui API.

---

## 🧪 Pengujian & Jaminan Mutu (Quality Assurance)

Proyek ini dilengkapi dengan suite pengujian otomatis yang ketat:
* **Vitest Unit & Integration Suites**: mencakup POS, inventaris, PO/retur, barcode, CSV, dan kontrak pemulihan backup. Jalankan `npm test` untuk jumlah dan hasil terkini.
* **Pemeriksaan UI**: `npm run qa:a11y` menggunakan axe pada halaman login dan tiga ukuran viewport. Ini bukan audit manual WCAG lengkap atau pengujian Safari/iOS.
* **Smoke test performa**: `npm run qa:load` mengirim 40 permintaan GET berkonkurensi rendah ke aset statis saja. Ini bukan load test database, transaksi, atau kapasitas produksi.
* **Ukuran aset**: gunakan `npm run size` untuk hasil terkini. Budget JavaScript 120 KB gzip masih berupa peringatan, bukan penghalang build.
* **Pemulihan nyata**: pengujian unit memakai mock Supabase; lakukan recovery drill di proyek Supabase staging terpisah sebelum mengandalkan backup untuk produksi.

Untuk menjalankan pengujian kapan saja:
```bash
npm test
```

---

## 🚀 Panduan Deployment ke Cloudflare Pages

Setiap push ke branch `main` menjalankan GitHub Actions untuk menaikkan versi patch
secara otomatis dan mengirim commit versi tersebut. Workflow ini **tidak melakukan deploy
Cloudflare Pages**. Deploy hanya otomatis jika integrasi Git Cloudflare Pages untuk branch
`main` aktif, atau jika workflow deploy Cloudflare dengan kredensial yang sesuai sudah
dikonfigurasi.

Untuk merilis perubahan:
1. Commit perubahan ke branch `main`.
2. Push ke remote repository:
   ```bash
   git push origin main
   ```
3. Tunggu workflow **Bump app version** selesai.
4. Verifikasi deployment dengan memastikan service worker di `/sw.js` menyajikan nama cache
   versi terbaru sebelum menganggap rilis sudah live:
   👉 **[https://aquastock-pro.pages.dev](https://aquastock-pro.pages.dev)**

---

## 📄 Lisensi & Hak Cipta

Didistribusikan di bawah lisensi resmi **MIT License**.  
Hak Cipta © 2026 **Mr David — JTMaquarium** (Jatimakmur Aquarium Aksesoris, Bekasi). Seluruh hak cipta dilindungi undang-undang.
