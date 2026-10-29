# Aquastock Pro — Agent Guide

Panduan ini adalah konteks bersama untuk AI coding agent. Gunakan sebagai peta project; jangan membaca seluruh repository atau seluruh dokumentasi untuk setiap tugas. Baca hanya file yang berkaitan dengan permintaan.

## Ringkasan project

- Aquastock Pro adalah aplikasi web inventaris dan Point of Sale untuk toko perlengkapan akuarium.
- Arsitektur: static Multi-Page Application (MPA), vanilla JavaScript ES modules, HTML, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, dan IndexedDB untuk dukungan offline POS yang terbatas.
- Aset dan halaman yang dipublikasikan berada di `public/`; source migrasi database berada di `supabase/`.
- Baca `README.md` hanya untuk ringkasan, struktur, setup, atau daftar perintah. Indeks dokumentasi teknis ada di `docs/README.md`.

## Peta file

- Halaman dan modul browser: `public/` (pilih subfolder halaman yang terkait).
- JavaScript bersama: `public/assets/js/`.
- Integrasi Supabase per domain: `public/assets/js/api/`; autentikasi: `public/assets/js/auth.js`.
- CSS sumber: `tailwind/input.css`; CSS modular dan hasil build: `public/assets/css/`.
- Migrasi, RLS, trigger, dan fungsi database: `supabase/migrations/`.
- Tes: `tests/`; konfigurasi Vitest: `vitest.config.mjs`.
- Build, QA, dan utilitas: `scripts/`; perintah project: `package.json`.
- Panduan arsitektur: `docs/architecture.md`.
- Kontrak API/Supabase: `docs/api-contract.md`.
- Setup dan migrasi database: `docs/setup-database.md`.
- Deployment: `docs/deployment.md`.

Pilih halaman/API/test berdasarkan fitur yang diminta. Telusuri pemanggil dan dependensi langsung bila perlu; jangan membuka semua file dalam satu modul tanpa alasan.

## Cara bekerja hemat konteks

1. Identifikasi hasil yang diminta dan area kode terkecil yang mungkin terdampak.
2. Periksa status/diff Git sebelum mengedit. Jangan menghapus atau menimpa perubahan pengguna yang sudah ada.
3. Cari simbol, teks UI, route, atau nama API yang tepat; baca file implementasi dan test terkait saja.
4. Baca dokumentasi teknis hanya jika tugas menyentuh area tersebut. Hindari menyalin dokumentasi panjang ke chat atau instruksi.
5. Buat perubahan terarah dan pertahankan pola yang sudah digunakan. Jangan melakukan refactor, format massal, atau perubahan versi yang tidak diminta.
6. Jalankan test paling relevan. Gunakan `npm test` bila perlu menjalankan seluruh suite; gunakan `npm run build` bila mengubah sumber Tailwind atau aset vendor.
7. Ringkas file yang berubah, alasan, dan hasil verifikasi. Sebutkan kegagalan validasi secara jelas; jangan mengklaim test lulus bila belum dijalankan.

Hindari membaca atau mengubah `node_modules/`, `coverage/`, `package-lock.json`, aset hasil kompilasi, bundle vendor, dan file minified kecuali tugas secara khusus membutuhkannya. Jangan memindai seluruh `public/` untuk tugas yang hanya menyentuh satu halaman.

## Aturan implementasi project

- Pertahankan arsitektur MPA dan vanilla JavaScript; jangan menambah framework, bundler, atau dependency tanpa kebutuhan yang jelas.
- Ikuti pola modul dan penamaan yang sudah ada. Perubahan JavaScript biasanya perlu ditinjau bersama halaman pemanggil dan test terkait.
- Perubahan data harus mempertahankan kontrak API serta validasi/error handling yang digunakan project.
- Supabase RLS dan fungsi database adalah bagian dari batas keamanan. Validasi frontend bukan pengganti otorisasi database. Jangan pernah mengekspos service-role key, token, kredensial, atau rahasia lain.
- Perubahan transaksi/stok harus mempertimbangkan integritas data, trigger database, dan antrean offline POS jika terkait.
- Perubahan autentikasi/role harus mempertimbangkan route guard, hak akses, dan UI untuk role yang relevan.
- Perubahan UI harus menjaga aksesibilitas, tampilan mobile, navigasi, dan pola komponen yang sudah ada.
- Jangan mengedit hasil build atau menaikkan versi kecuali diminta atau dibutuhkan oleh perubahan.

## Perintah yang tersedia

- `npm test` — seluruh test Vitest.
- `npm run build` — build CSS Tailwind dan sinkronisasi aset vendor.
- `npm run qa:a11y` — pemeriksaan aksesibilitas pada cakupan yang didefinisikan script.
- `npm run qa:load` — smoke test aset statis terbatas.
- `npm run dev` — server lokal pada port 8000.

Gunakan perintah yang sesuai dengan perubahan; tidak semua tugas memerlukan build atau seluruh test suite.
