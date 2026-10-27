# Changelog — Aquastock Pro

## [2.0.0] - 2026-10-17
### Major Release: Local-First PWA & International Adaptive UI/UX Overhaul

Rilis ini meningkatkan arsitektur **Aquastock Pro** menjadi **Local-First Progressive Web App (PWA)** berstandar internasional (terinspirasi dari Linear & Material Design 3) yang mendukung operasional kasir dan manajemen stok secara *offline* maupun *online* di Desktop, Tablet, dan Mobile.

---

### ✨ Fitur Baru & Peningkatan Utama

#### 1. Adaptive UI/UX Architecture (Desktop, Tablet, Mobile)
- **Global Command Palette (`⌘K` / `Ctrl+K`):** Akses cepat lintas 15 modul dashboard, pencarian produk/barcode *real-time*, serta pintasan aksi cepat (*Buka Kasir POS, Tambah Barang, Catat Barang Masuk, Buat PO, Catat Kas*) melalui komponen `public/assets/js/components/command-palette.js`.
- **Tablet Navigation Rail (`768px – 1024px`):** Transformasi otomatis sidebar menjadi *compact icon-first rail* (`72px`) untuk memaksimalkan ruang kerja horizontal pada modul padat data seperti `/dashboard/out/` dan `/dashboard/items/`.
- **Mobile Bottom Navigation & Central FAB (`< 768px`):** Navigasi bawah dengan `backdrop-filter: blur(20px)`, dukungan `env(safe-area-inset-bottom)`, tombol tengah *Floating Action Button (FAB)* untuk akses instan ke Kasir/Scan, serta *Menu Drawer* untuk modul pendukung.
- **Responsive Bento Card Tables:** Transformasi otomatis tabel multi-kolom menjadi *Bento Card* di layar ponsel dengan tetap mempertahankan integritas atribut `data-label`.

#### 2. Point of Sale (POS) Split-View & Fitur Kasir (`/dashboard/out/`)
- **Tap-to-Cart Product Grid:** Katalog visual interaktif dengan *filter chips* kategori (*Semua, Pakan, Obat, Vitamin, Pompa, Filtrasi, Aksesoris*), SKU, harga jual, dan lencana stok.
- **Kalkulator Diskon & Pajak Real-Time:** Dukungan input diskon nominal (`Rp`) dan *toggle* **PPN 11%** dengan perhitungan otomatis subtotal, total akhir, dan kembalian tunai.
- **Bento Bottom Sheet Mobile:** Transformasi dialog checkout menjadi *slide-up bottom sheet* dengan *drag-handle touch gesture* pada layar seluler.

#### 3. Dual-Mode Barcode Scanner
- **Hardware Scanner Interceptor (USB / Bluetooth):** *Global keydown listener* yang mendeteksi input *scanner* fisik (`> 8` karakter dengan interval `< 50ms` diakhiri `Enter`) tanpa perlu memfokuskan kursor ke kolom pencarian.
- **Mobile Camera Scanner & Haptic/Audio Feedback:** Integrasi native `BarcodeDetector` API dengan *fallback* `html5-qrcode` (`public/assets/js/components/barcode-scanner.js`), dilengkapi *beep* sintetis Web Audio API (`880Hz`, `100ms`) dan getaran haptik `navigator.vibrate(100)`.

#### 4. Local-First PWA & Multi-Page Offline Engine
- **Web App Manifest (`/manifest.json`):** Konfigurasi `standalone` dengan `theme_color: #0088CC`, `background_color: #000000`, serta set ikon `192x192` dan `512x512` (*maskable*) yang diinjeksikan otomatis ke seluruh 19 halaman HTML melalui `scripts/link_pwa_manifest.js`.
- **MPA Service Worker (`/sw.js`):** Strategi *Cache-First* untuk aset statis (CSS, JS, Font `InterVariable.woff2`, ikon) dan *Network-First with Cache Fallback* untuk seluruh rute HTML dashboard.
- **IndexedDB Offline POS Engine (`aquastock-offline-db`):** Penyimpanan lokal katalog barang dan antrean transaksi kasir *offline* melalui `public/assets/js/utils/offline-sync.js` dengan sinkronisasi otomatis ke Supabase saat koneksi pulih, dilengkapi lencana status di header (*Cloud Terhubung / Mode Kasir Offline / Menyinkronkan...*).

---

### 🛡️ Kualitas Kode, Pengujian & Performa
- **UI Notifications:** Penghapusan seluruh *native browser* `alert()` dan penggantian dengan *non-blocking toast notification*.
- **Unit Testing:** **19 Test Suites (129 unit tests)** di Vitest lulus **100%** tanpa regresi.
- **Bundle Size Budget:** Ukuran CSS terkompresi tercatat **19.56 KB (gzip)**, jauh di bawah batas maksimal anggaran **60 KB**.