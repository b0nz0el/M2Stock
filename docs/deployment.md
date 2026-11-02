# Panduan Deployment — Aquastock Pro

Dokumen ini memuat panduan untuk mendeploy **Aquastock Pro** sebagai Jamstack statis dengan backend Supabase.

---

## 1. Ikhtisar Arsitektur Deployment

Aquastock Pro tidak memerlukan server backend khusus (seperti Node.js server, Python, atau PHP). Seluruh antarmuka terdiri dari file statis murni (HTML, CSS, JS, aset gambar/font) yang dapat dilayani oleh CDN statis global (*Edge Network*), sementara seluruh komputasi dinamis, database, otentikasi, dan penyimpanan file dikelola oleh Supabase Cloud.

```
                  ┌──────────────────────────────────────────────┐
                  │                 PENGGUNA                     │
                  │   (PC Kasir / Tablet / Smartphone Staff)     │
                  └───────────────┬──────────────────────────────┘
                                  │
                 HTTPS (Domain Toko / Custom Subdomain)
                                  │
       ┌──────────────────────────┴──────────────────────────┐
       │                                                     │
       ▼                                                     ▼
┌─────────────────────────────┐               ┌─────────────────────────────┐
│   STATIC HOSTING PROVIDER   │               │       SUPABASE CLOUD        │
│  (Cloudflare Pages)          │               │   (Database, Auth, Storage, │
│   Cloudflare Pages / dsb.)  │               │    PostgREST Edge APIs)     │
│                             │               │                             │
│  • public/index.html        │  REST / HTTPS │  • PostgreSQL 15 Database   │
│  • public/dashboard/        │◄─────────────►│  • Auth Service (JWT)       │
│  • public/assets/css/       │               │  • Storage Bucket           │
│  • public/assets/js/        │               │  • Realtime Engine          │
└─────────────────────────────┘               └─────────────────────────────┘
```

---

## 2. Platform Deployment Aktif (Cloudflare Pages)

Aplikasi **Aquastock Pro** saat ini telah aktif di-deploy ke lingkungan produksi menggunakan **Cloudflare Pages** pada domain:
**`https://aquastock-pro.pages.dev`**

### 2.1 Konfigurasi Cloudflare Pages
Pengaturan proyek di Cloudflare Pages Dashboard:
- **Project Name**: `aquastock-pro`
- **Framework Preset**: `None` / `Other`
- **Build Command**: `npm run build` (mengompilasi ke `public/assets/css/tailwind.static.css` dan menyalin vendor barcode lokal)
- **Build Output Directory**: `public`
- **Root Directory**: `/`
- **Node.js Compatibility**: v18+ atau v20+

### 2.2 Pilihan Hosting Alternatif
1. **Vercel / Netlify**:
   - Gunakan Output Directory `public` dan Build Command `npm run build`.
2. **GitHub Pages**:
   - Workflow deploy GitHub Pages tidak tersedia di branch saat ini; siapkan workflow terpisah sebelum memilih hosting tersebut.

---

## 3. Konfigurasi Lingkungan Produksi

Sebelum merilis ke kasir toko, pastikan konfigurasi berikut telah diterapkan:

### 3.1 Kredensial Supabase Produksi
Perbarui variabel di file `public/assets/js/supabase-client.js`:
```javascript
const SUPABASE_URL = 'https://<production-project-id>.supabase.co';
const SUPABASE_ANON_KEY = '<production-anon-key>';
```

> [!WARNING]
> **PENTING: Jangan Gunakan Service Role Key!**  
> Hanya gunakan `anon key` publik di frontend. Seluruh hak otorisasi dan isolasi data dikendalikan oleh Row Level Security (RLS) di PostgreSQL.

### 3.2 Pengaturan Supabase Produksi
1. **Authentication**:
   - Pada Supabase Dashboard → **Authentication → URL Configuration**, daftarkan URL domain produksi toko (misal: `https://aquastock.jaquris.com`) ke dalam daftar **Site URL** dan **Redirect URLs**.
2. **CORS Headers**:
   - Di menu **Settings → API**, batasi Allowed Origins hanya ke domain produksi aplikasi untuk mencegah penyalahgunaan API dari domain asing.
3. **Database Backup**:
   - Aktifkan fitur *Point-in-Time Recovery (PITR)* atau jadwalkan *Daily Automated Backup* pada proyek Supabase.

### 3.3 Sinkronisasi Link Marketplace ke Habitic
Function `POST /api/integrations/habitic` membaca SKU dan URL marketplace dengan sesi Supabase pengguna yang sedang login, lalu mengirim URL saja ke endpoint Habitic. Nilai sesi dan rahasia integrasi tidak dikirim ke browser tujuan.

Atur satu nilai rahasia acak yang sama di **Cloudflare Pages → Settings → Variables and Secrets → Production**:

| Project | Secret |
|---|---|
| `aquastock-pro` | `HABITIC_SYNC_SECRET` |
| `habitic` | `AQUASTOCK_SYNC_SECRET` |

Jangan masukkan nilai secret ke kode, file `.env` yang di-commit, atau JavaScript publik. Setelah kedua project memiliki secret yang sama, gunakan tombol **Sinkron Link Habitic** di halaman Master Barang. Sinkronisasi dibatasi 250 produk per proses dan hanya mengubah link marketplace pada produk Habitic yang memiliki SKU unik yang cocok.

Untuk mengisi link channel Aquastock dari file CSV, gunakan tombol **Impor Link Channel** di **Dashboard → Master Barang**. File harus memiliki kolom `SKU`, `Shopee URL`, `Tokopedia URL`, `Lazada URL`, `TikTok URL`, dan/atau `WhatsApp URL`; kolom `Nama Produk` hanya untuk referensi. Impor mencocokkan SKU unik dan menampilkan pratinjau sebelum menyimpan. SKU yang tidak ditemukan akan dilewati dan ditampilkan pada pratinjau; SKU ganda/ambigu atau URL dengan domain yang tidak sesuai membatalkan impor. URL channel yang kosong mempertahankan link saat ini. Impor ini hanya memperbarui channel dan link, bukan harga, stok, atau detail barang lain.

---

## 4. Checklist Pra-Deployment (Pre-Flight Verification)

Jalankan seluruh langkah verifikasi ini di terminal lokal sebelum melakukan commit & push rilis produksi:

```bash
# 1. Jalankan seluruh unit dan contract tests
npm test

# 2. Coverage gate (dapat gagal jika threshold tidak terpenuhi)
npm run test:coverage

# 3. Build aset yang dipakai hosting statis
npm run build

# 4. Lihat ukuran aset; ambang JS saat ini masih warning
npm run size

# 5. Jalankan QA aksesibilitas (perlu app lokal dan Chromium)
npm run dev
# Terminal lain:
QA_BASE_URL=http://127.0.0.1:8000 npm run qa:a11y

# 6. Smoke load HTTP statis lokal: 40 GET, maksimum 4 serentak
QA_BASE_URL=http://127.0.0.1:8000 npm run qa:load
```

`qa:load` bukan load test database atau kapasitas penuh. Target remote ditolak secara default. Gunakan hanya staging yang Anda kuasai dengan `QA_ALLOW_REMOTE=1`; produksi memerlukan `QA_ALLOW_PRODUCTION_LOAD=1` dan persetujuan eksplisit. Jangan jalankan pengujian beban agresif pada toko aktif.

### Recovery drill backup yang aman

Export/import pada menu Backup adalah upsert subset tabel aplikasi, bukan salinan lengkap database/akun Supabase dan bukan transaksi restore atomik. Uji pemulihan hanya di proyek Supabase staging terpisah:

1. Pastikan skema staging telah menjalankan bootstrap dan semua migrasi yang sama dengan produksi.
2. Buat snapshot/backup staging sebelum uji; jangan gunakan project produksi sebagai target restore.
3. Export JSON dari staging, simpan file dengan akses terbatas, dan catat nama file serta jumlah rekaman.
4. Restore ke staging dan pastikan UI melaporkan semua tabel sukses; bila ada kegagalan parsial, periksa tabel yang ditampilkan dan jangan menganggap proses selesai.
5. Verifikasi beberapa ID rekaman yang dipilih pada database staging, lalu export ulang dan bandingkan subset data yang diuji.
6. Catat waktu, versi, hasil, dan siapa yang menjalankan drill. Hapus data uji sesuai kebijakan setelah bukti disimpan.

Belum ada hasil recovery drill terhadap backup Supabase nyata yang dapat diklaim oleh audit repository ini. Jadwalkan drill tersebut sebelum mengandalkan prosedur pemulihan produksi.

---

## 5. Rencana & Roadmap Fase 5

Fokus lanjutan untuk otomasi dan stabilitas:

1. **Automated CI/CD Quality Gates**:
   - Menjalankan `npm test` dan `npm run size` secara otomatis pada setiap Pull Request.
   - Menggagalkan build jika ukuran aset melampaui batas size budget atau ada unit test yang gagal.
2. **Pembersihan Kode Usang (*Code Cleanup*)**:
   - Mengukur performa dengan perangkat/koneksi sasaran; jangan menganggap static HTTP smoke test sebagai load test backend.
3. Jalankan recovery drill staging berkala dan catat hasilnya.
