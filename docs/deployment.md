# Panduan Deployment — aQuaStock Pro

Dokumen ini memuat panduan komprehensif untuk mendeploy sistem **aQuaStock Pro** ke lingkungan produksi berbasis arsitektur **Jamstack Statis** dan backend cloud Supabase (disiapkan untuk realisasi **Fase 5: Production Deployment & CI/CD**).

---

## 1. Ikhtisar Arsitektur Deployment

aQuaStock Pro tidak memerlukan server backend khusus (seperti Node.js server, Python, atau PHP). Seluruh antarmuka terdiri dari file statis murni (HTML, CSS, JS, aset gambar/font) yang dapat dilayani oleh CDN statis global (*Edge Network*), sementara seluruh komputasi dinamis, database, otentikasi, dan penyimpanan file dikelola oleh Supabase Cloud.

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
│  (GitHub Pages / Vercel /   │               │   (Database, Auth, Storage, │
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

Aplikasi **aQuaStock Pro** saat ini telah aktif di-deploy ke lingkungan produksi menggunakan **Cloudflare Pages** pada domain:
**`https://aquastock-pro.pages.dev`**

### 2.1 Konfigurasi Cloudflare Pages
Pengaturan proyek di Cloudflare Pages Dashboard:
- **Project Name**: `aquastock-pro`
- **Framework Preset**: `None` / `Other`
- **Build Command**: `npm run build:css` (Mengompilasi styling Tailwind CSS ke `public/assets/css/style.css`)
- **Build Output Directory**: `public`
- **Root Directory**: `/`
- **Node.js Compatibility**: v18+ atau v20+

### 2.2 Pilihan Hosting Alternatif
1. **GitHub Pages**:
   - File konfigurasi workflow `.github/workflows/deploy.yml` dapat mem-publish folder `public/` saat ada perintah `git push` ke branch `main`.
2. **Vercel / Netlify**:
   - Gunakan Output Directory `public` dan Build Command `npm run build:css`.

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

---

## 4. Checklist Pra-Deployment (Pre-Flight Verification)

Jalankan seluruh langkah verifikasi ini di terminal lokal sebelum melakukan commit & push rilis produksi:

```bash
# 1. Jalankan unit test dan integrasi contract test (wajib 50 passed)
npm test

# 2. Periksa cakupan pengujian
npm run test:coverage

# 3. Kompilasi ulang static Tailwind CSS untuk memastikan tidak ada class baru yang hilang
npm run build:css

# 4. Verifikasi kepatuhan size budget aset (CSS < 60 KB gzip, JS < 120 KB gzip)
npm run size

# 5. Uji serve lokal pada port produksi
npm start
```

---

## 5. Rencana & Roadmap Fase 5

Fase 5 difokuskan pada otomasi dan stabilitas jangka panjang:

1. **Automated CI/CD Quality Gates**:
   - Menjalankan `npm test` dan `npm run size` secara otomatis pada setiap Pull Request.
   - Menggagalkan build jika ukuran aset melampaui batas size budget atau ada unit test yang gagal.
2. **Pembersihan Kode Usang (*Code Cleanup*)**:
   - Menghapus folder rintisan awal yang kosong (`server/`, `database/`).
   - Merapikan skrip utility yang sudah digantikan oleh npm scripts terpadu.
3. **Optimasi Cache & Service Worker PWA (Opsional)**:
   - Menambahkan Web App Manifest (`manifest.json`) agar aplikasi dapat diinstal sebagai Progressive Web App (PWA) di tablet kasir.
   - Cache lokal untuk offline resilience dasar saat koneksi toko terputus sementara.
