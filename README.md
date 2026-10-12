# aQuaStock Pro

Sistem manajemen stok untuk toko aksesoris aquarium (Jaquris — Jatimakmur Aquarium Aksesoris, Bekasi).

## Features
- **Multi-user auth** (Owner, Staff, Viewer) dengan Supabase Auth
- **CRUD produk + upload foto** (kompresi Canvas WebP < 500 KB)
- **Transaksi barang masuk & keluar** dengan auto-stock update trigger
- **Dashboard real-time** dengan grafik Chart.js (penjualan & distribusi channel)
- **Search, filter, pagination, bulk actions** (bulk delete dengan proteksi FK, bulk edit harga via nominal / persentase)
- **Export CSV** & cetak **packing list / label pengiriman**
- **RLS (Row Level Security)** keamanan terisolasi di seluruh tabel PostgreSQL

## Tech Stack
- **Frontend**: Vanilla JS (ES Modules) + Tailwind CSS (static build teroptimasi)
- **Backend**: Supabase (PostgreSQL 15 + Auth + Storage)
- **Icons**: Lucide (subset 74 SVG ikon mandiri, self-hosted tanpa CDN)
- **Font**: Inter (self-hosted variable font)
- **Charts**: Chart.js v4 (lazy loaded khusus di halaman dashboard & laporan)
- **Tests**: Vitest + happy-dom + Playwright
- **Size Budget**: CSS ~12 KB gzip (budget 60 KB), JS ~102 KB gzip (budget 120 KB)

## Prerequisites
- Node.js 20+ (LTS)
- npm 10+
- Akun [Supabase](https://supabase.com) (free tier atau self-hosted)
- Web Browser modern (Chrome, Edge, Firefox, Safari)

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/b0nz0el/aquastock-pro.git
cd aquastock-pro
npm install
```

### 2. Setup Environment
Kredensial Supabase sudah terkonfigurasi di `public/assets/js/supabase-client.js`.  
Jika ingin menghubungkan ke instance Supabase milik Anda sendiri, perbarui konstanta `SUPABASE_URL` dan `SUPABASE_ANON_KEY` di file tersebut.

### 3. Setup Supabase
1. Buat project baru di [supabase.com](https://supabase.com).
2. Jalankan skrip SQL lengkap yang disediakan di [docs/setup-database.md](docs/setup-database.md) melalui Supabase SQL Editor.
3. Pastikan **Auth Email provider** dalam kondisi aktif (konfirmasi email dapat dimatikan untuk kemudahan development).
4. Buat Storage Bucket publik bernama `product-images` dan terapkan storage policy untuk upload authenticated.

### 4. Run Development
```bash
npm start
```
Buka peramban di `http://localhost:3000`.

---

## Scripts

| Script | Fungsi |
|---|---|
| `npm start` | Menjalankan web server lokal untuk folder `public/` di port 3000 |
| `npm run dev` | Menjalankan web server lokal alternatif di port 8000 |
| `npm test` | Menjalankan seluruh test suite unit & integrasi menggunakan Vitest |
| `npm run test:coverage` | Menjalankan unit test dengan laporan cakupan kode (V8 coverage) |
| `npm run size` | Memeriksa ukuran aset CSS dan JS terhadap alokasi size budget |
| `npm run build:css` | Mengompilasi ulang static utility CSS Tailwind ke `public/assets/css/tailwind.static.css` |

---

## Project Structure

```
aquastock-pro/
├── public/                       # Root direktori web statis
│   ├── index.html                # Entry point redirect
│   ├── 404.html                  # Halaman not found responsif
│   ├── login/                    # Modul otentikasi login
│   │   └── index.html
│   ├── dashboard/                # 16 modul aplikasi berbasis clean URL
│   │   ├── index.html            # Ringkasan KPI & grafik
│   │   ├── items/                # Manajemen inventaris produk
│   │   ├── in/                   # Penerimaan barang masuk
│   │   ├── out/                  # Transaksi barang keluar & kasir
│   │   ├── po/                   # Purchase order
│   │   ├── return/               # Retur & komplain
│   │   ├── suppliers/            # Master data supplier
│   │   ├── customers/            # Master data customer
│   │   ├── cash/                 # Arus kas & keuangan
│   │   ├── debt/                 # Hutang & piutang
│   │   ├── report/               # Laporan & analitik
│   │   ├── users/                # Manajemen pengguna & role
│   │   ├── audit/                # Audit log aktivitas
│   │   ├── notif/                # Notifikasi operasional
│   │   ├── backup/               # Cadangan data
│   │   └── settings/             # Pengaturan profil toko
│   └── assets/                   # Aset terkompilasi
│       ├── css/                  # Arsitektur CSS modular
│       ├── js/                   # Logika klien & integrasi Supabase
│       ├── images/               # Favicon & logo SVG
│       └── fonts/                # InterVariable font
├── docs/                         # Dokumentasi teknis & arsitektur
│   ├── README.md                 # Peta arsitektur CSS/JS & keputusan teknis
│   ├── api-contract.md           # Spesifikasi kontrak REST, RPC, & envelope
│   ├── architecture.md           # Diagram layer, model keamanan, & modul
│   ├── setup-database.md         # Skrip DDL PostgreSQL, RLS, & triggers
│   └── deployment.md             # Panduan deployment fase produksi
├── tests/                        # Vitest unit test suite
│   ├── api.test.js
│   ├── app-sidebar.test.js
│   ├── mock-actions.test.js
│   ├── navigation.test.js
│   └── utils.test.js
├── scripts/                      # Tooling & otomasi developer
│   ├── check-size.js
│   ├── backup.sh
│   └── deploy.sh
├── src/                          # File sumber input Tailwind
│   └── input.css
├── package.json                  # Konfigurasi dependensi project
├── tailwind.config.js            # Konfigurasi utility Tailwind
└── README.md                     # Dokumentasi utama proyek
```

---

## Documentation Links

- 📐 [Arsitektur Sistem & Diagram Layer](docs/architecture.md)
- 🔌 [Kontrak API, Envelope & RLS Policies](docs/api-contract.md)
- 🗄️ [Setup Database PostgreSQL & Skema SQL](docs/setup-database.md)
- 🚀 [Panduan Deployment Produksi](docs/deployment.md)
- 📑 [Peta Modul Internal & Rekam Jejak Refactor](docs/README.md)

---

## Deployment
Detail panduan hosting statis dan checklist pra-produksi tersedia di [docs/deployment.md](docs/deployment.md).

## License
Didistribusikan di bawah lisensi [MIT](LICENSE). Hak Cipta © 2026 Mr David — Jaquris (Jatimakmur Aquarium Aksesoris, Bekasi).
