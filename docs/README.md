# Dokumentasi aQuaStock Pro

Folder ini menampung dokumentasi tambahan. Saat ini berisi catatan struktur
dan keputusan pemisahan (refactor) dari file monolith ke struktur modular.

## File utama

| File | Isi |
|---|---|
| `../README.md` | Deskripsi project, cara run, cara deploy |
| `README.md` | Catatan dokumentasi & keputusan refactor (file ini) |

## Peta CSS

| File | Tanggung jawab |
|---|---|
| `public/assets/css/main.css` | Reset, `:root`, `html/body`, typography, scrollbar, form focus, aksesibilitas, `skip-link` |
| `public/assets/css/components.css` | `.card`, `.badge`, `.btn`, `.toast`, `.skeleton`, `.menu-item`, `.bottom-nav-item`, tabel & animasi komponen |
| `public/assets/css/layout.css` | `.page` (transisi), struktur `.bottom-nav` |
| `public/assets/css/pages.css` | Style spesifik halaman (mis. `.chart-container`) |
| `public/assets/css/responsive.css` | **Semua** `@media (max-width:1024px)`, fallback `@supports`, `@media (prefers-reduced-motion)` |
| `public/assets/css/login.css` | Style khusus halaman login (splash, glow, tombol, toast) |

## Peta JS

| File | Tanggung jawab |
|---|---|
| `public/assets/js/utils.js` | `showToast`, `parseIndonesianNumber`, `detectMultiplier`, `animateNumber` |
| `public/assets/js/navigation.js` | `showPage`, `bottomNavTap`, `openMenuDrawer`, `toggleSidebar`, `closeSidebar`, sinkronisasi tab aktif |
| `public/assets/js/charts.js` | Konfigurasi Chart.js (sales, channel, report) |
| `public/assets/js/animations.js` | `animateActivePage`, `prefersReducedMotion` |
| `public/assets/js/app.js` | Init Lucide, konversi tabel→card, bulk selection, shortcut ⌘K, welcome toast |
| `public/assets/js/api.js` | Wrapper `fetch` (placeholder untuk backend) |
| `public/assets/js/login.js` | Logika halaman login |

Semua script dimuat dengan `defer` agar DOM siap lebih dulu.

## Keputusan refactor (yang perlu diketahui)

1. **Multi-page (Opsi A) dengan clean URL.** `showPage()` mengarahkan ke
   `/dashboard/<slug>/` (tanpa `.html`) melalui `pageUrl()`. Peta id→slug ada di
   `PAGE_SLUGS`. `dashboardBase()` mencari basis path `/dashboard/` supaya URL
   tetap benar baik di root domain maupun di sub-path (GitHub Pages).
2. **Shell diduplikasi.** Setiap halaman dashboard memuat sidebar/header/
   bottom-nav/bulk-bar/toast yang identik. Status aktif diset saat load oleh
   `syncActiveState()` di `navigation.js` (berdasarkan nama file).
3. **Blok CSS `ANIMATIONS`** (`.stat-number`, `.animate-in`, `.stagger-*`,
   `.card-hover`, `tbody tr`, `#breadcrumb`) diletakkan di `components.css`
   karena mengubah komponen; bukan murni "base" maupun spesifik halaman.
4. **Blok `TABLE`** (`.card table`, `.card-table-wrap`, `.table-row`) masuk
   `components.css` karena terikat ke `.card`.
5. **`@supports` fallback iOS** ditempatkan di `responsive.css` bersama semua
   `@media` (karena ia fallback untuk layout mobile).
6. **`login/index.html` memuat `main.css` + `components.css` + `login.css`** sesuai
   instruksi. Ini menambahkan `:focus-visible` (hanya tampil saat navigasi
   keyboard) — tidak mengubah tampilan saat klik mouse.
