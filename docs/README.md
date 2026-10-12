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
| `public/assets/css/tailwind.static.css` | Kompilasi static utility Tailwind (minified, ~20 KB raw / ~4.6 KB gzip) |
| `public/assets/css/base.css` | Reset universal, `:root`, typography InterVariable, scrollbar, form focus, aksesibilitas |
| `public/assets/css/main.css` | Shell dashboard khusus (`app-sidebar`, `.section-title`, meng-import `base.css`) |
| `public/assets/css/components.css` | `.card`, `.badge`, `.btn`, `.toast`, `.skeleton`, `.menu-item`, `.bottom-nav-item`, tabel & animasi komponen |
| `public/assets/css/layout.css` | `.page` (transisi), struktur `.bottom-nav` |
| `public/assets/css/pages.css` | Style spesifik halaman (mis. `.chart-container`) |
| `public/assets/css/responsive.css` | **Semua** `@media (max-width:1024px)`, fallback `@supports`, `@media (prefers-reduced-motion)` |
| `public/assets/css/login.css` | Style khusus halaman login (splash, glow, tombol, toast) |

## Peta JS

| File | Tanggung jawab |
|---|---|
| `public/assets/js/icons.js` | Subset SVG ikon lokal (74 ikon, ~17.2 KB raw / ~4.8 KB gzip), fungsi `refreshIcons()` |
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
7. **Accessibility Pass (Fase 1.2):**
   - Toast notification dilengkapi dengan `role="status"` dan `aria-live="polite"`.
   - Bottom navigation memiliki `aria-label` eksplisit di setiap tab dan `aria-current="page"` pada tab aktif.
   - Sidebar drawer dilengkapi atribut `aria-expanded` pada toggle dan `aria-hidden` dinamis pada `aside`.
   - Implementasi focus trap pada drawer mobile (siklus Tab / Shift+Tab di dalam menu, Escape untuk keluar) dan pengembalian fokus otomatis ke elemen pemicu saat drawer ditutup.
   - Otomatis memindahkan fokus screen reader ke heading halaman (`h2`/`h1`) ber-`tabindex="-1"` setelah navigasi halaman terbuka.

8. **Tailwind Static CSS (Fase 3.1):**
   - Runtime CDN `https://cdn.tailwindcss.com` (~100 KB - 300 KB JIT) telah sepenuhnya dihapus dari seluruh 19 file HTML.
   - Digantikan oleh file statis yang di-compile: `public/assets/css/tailwind.static.css` (~20 KB raw / ~4.6 KB gzip).
   - **Workflow Development:**
     Jika developer menambahkan class Tailwind baru di HTML atau JS, jalankan:
     ```bash
     npm run build:css
     ```
     File `tailwind.static.css` di-commit langsung ke repositori sehingga lingkungan CI/CD atau static file server tidak memerlukan dependensi build runtime.

9. **Lucide Local Subset (Fase 3.2):**
   - CDN runtime `https://unpkg.com/lucide@latest/dist/umd/lucide.js` (~1.1 MB raw / ~120 KB gzip) telah dihapus dari seluruh 19 file HTML.
   - Digantikan oleh subset statis lokal `public/assets/js/icons.js` yang memuat 74 SVG ikon aktif project.
   - Ukuran: ~17.2 KB raw / ~4.8 KB gzip (menghemat transfer bandwidth ~96%).
   - Fungsi global `window.refreshIcons(root)` menggantikan `lucide.createIcons()` dengan auto-initialization saat `DOMContentLoaded`.

10. **Chart.js Lazy Load (Fase 3.3):**
    - CDN runtime `https://cdn.jsdelivr.net/npm/chart.js` (~200 KB raw / ~70 KB gzip) telah dihapus dari seluruh 19 file HTML.
    - Script `public/assets/js/vendor/chart.min.js` hanya di-load secara bersyarat (lazy) di 2 halaman yang membutuhkan:
      - `/dashboard/` (sales bar & channel doughnut chart)
      - `/dashboard/report/` (report line chart)
    - 17 halaman lainnya tidak memuat Chart.js sama sekali, menghemat ~70 KB bandwidth gzip per page visit.
    - Script `charts.js` dilengkapi guard `if (typeof Chart === 'undefined') return;` sehingga aman tanpa melempar runtime error di halaman tanpa chart.
