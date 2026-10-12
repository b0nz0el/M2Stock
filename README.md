# aQuaStock Pro 🐠

**aQuaStock Pro** adalah sistem manajemen stok (inventory) untuk peralatan
aquarium. Aplikasi mencakup pencatatan barang, transaksi barang masuk & keluar,
purchase order, retur, data supplier & customer, kas & keuangan, hutang/piutang,
laporan, kelola user, audit log, notifikasi, backup, dan pengaturan.

Versi **3.0.0** — frontend statis (HTML + CSS + Vanilla JS) yang siap
dihubungkan ke backend.

## 🔗 Repository & Demo

| | |
|---|---|
| 🌐 **Live (GitHub Pages)** | https://b0nz0el.github.io/aquastock-pro/ |
| 📦 **Repository** | https://github.com/b0nz0el/aquastock-pro |
| 👤 **Author** | [b0nz0el](https://github.com/b0nz0el) — Mr David |
| 📄 **License** | MIT © 2026 Mr David |

Deploy otomatis ke GitHub Pages setiap `push` ke branch `main`
(`.github/workflows/deploy.yml`, publish dari folder `public/`).

## ✨ Fitur

- 🔐 Login + splash screen, dengan toast notifikasi
- 📊 Dashboard: kartu statistik (angka beranimasi) + grafik Chart.js
- 📦 16 modul: Barang, Barang Masuk, Barang Keluar, Purchase Order, Retur,
  Supplier, Customer, Kas & Keuangan, Hutang & Piutang, Laporan, Kelola User,
  Audit Log, Notifikasi, Backup, Settings
- 🔎 Pencarian global + shortcut ⌘K / Ctrl+K
- ☑️ Bulk selection (pilih banyak baris → bar aksi massal)
- 📱 Responsive penuh (mobile 390px → tablet 1024px → desktop 1440px),
  bottom navigation di mobile
- ♿ Aksesibilitas: `skip-link`, `aria-label`, `role`, `:focus-visible`
- 🎞️ Animasi yang menghormati `prefers-reduced-motion`

## 📁 Struktur Folder

```
aquastock/
├── public/                     # Root web (di-serve ke browser)
│   ├── index.html              # Redirect ke login
│   ├── login/index.html        # Halaman login    → /login/
│   ├── 404.html                # Halaman error
│   │
│   ├── dashboard/              # 16 halaman aplikasi (clean URL)
│   │   ├── index.html          # Dashboard         → /dashboard/
│   │   ├── items/index.html    # Barang            → /dashboard/items/
│   │   ├── in/index.html       # Barang Masuk      → /dashboard/in/
│   │   ├── out/index.html      # Barang Keluar     → /dashboard/out/
│   │   ├── po/index.html       # Purchase Order    → /dashboard/po/
│   │   ├── return/index.html   # Retur             → /dashboard/return/
│   │   ├── suppliers/index.html # Supplier         → /dashboard/suppliers/
│   │   ├── customers/index.html # Customer         → /dashboard/customers/
│   │   ├── cash/index.html      # Kas & Keuangan   → /dashboard/cash/
│   │   ├── debt/index.html      # Hutang & Piutang → /dashboard/debt/
│   │   ├── report/index.html    # Laporan          → /dashboard/report/
│   │   ├── users/index.html     # Kelola User      → /dashboard/users/
│   │   ├── audit/index.html     # Audit Log        → /dashboard/audit/
│   │   ├── notif/index.html     # Notifikasi       → /dashboard/notif/
│   │   ├── backup/index.html    # Backup           → /dashboard/backup/
│   │   └── settings/index.html  # Settings         → /dashboard/settings/
│   │
│   └── assets/
│       ├── css/
│       │   ├── main.css        # Reset, :root, typography, scrollbar, aksesibilitas
│       │   ├── components.css  # Card, badge, button, toast, skeleton, menu-item
│       │   ├── layout.css      # Page transition, aside, bottom-nav
│       │   ├── pages.css       # Style spesifik halaman (chart-container)
│       │   ├── responsive.css  # Semua @media + prefers-reduced-motion
│       │   └── login.css       # Style khusus halaman login
│       ├── js/
│       │   ├── utils.js        # showToast, parse/animate angka
│       │   ├── navigation.js   # showPage, sidebar, sinkronisasi tab aktif
│       │   ├── charts.js       # Konfigurasi Chart.js
│       │   ├── animations.js   # animateActivePage, prefersReducedMotion
│       │   ├── app.js          # Init, tabel→card, bulk selection, ⌘K
│       │   ├── api.js          # Wrapper fetch (placeholder backend)
│       │   └── login.js        # Logika halaman login
│       ├── images/
│       │   ├── logo.svg
│       │   └── favicon.ico
│       └── fonts/              # (kosong, untuk font kustom)
│
├── server/                     # (kosong — backend nanti)
├── database/                   # (kosong — skema/migrasi nanti)
├── tests/                      # (kosong — testing nanti)
├── docs/
│   └── README.md               # Catatan dokumentasi & keputusan refactor
├── scripts/
│   ├── backup.sh               # Backup aplikasi ke tar.gz
│   └── deploy.sh               # Deploy placeholder (netlify/vercel/rsync)
│
├── .env.example
├── .gitignore
├── package.json
├── tailwind.config.js          # Opsional (Tailwind saat ini via CDN)
└── README.md
```

## ▶️ Cara Menjalankan

Aplikasi ini statis — cukup serve folder `public/`. Pilih salah satu:

**Python (paling simpel, tanpa install apa pun):**
```bash
python3 -m http.server 8000 --directory public
# lalu buka http://localhost:8000
```

**Node.js (via `serve`):**
```bash
npx serve public
# atau dengan port eksplisit:
npx serve public --listen 8000
```

**Lewat `package.json`:**
```bash
npm start        # sama dengan: npx serve public
npm run dev      # sama dengan: npx serve public --listen 8000
```

**PHP (alternatif):**
```bash
php -S localhost:8000 -t public
```

> ⚠️ Jangan buka file HTML langsung lewat `file://` — aset relatif & CDN bisa
> diblokir browser. Selalu jalankan lewat server lokal di atas.

**Alur:** `public/index.html` → redirect ke `login/` → setelah login →
`dashboard/`. Perpindahan antar modul memakai **clean URL** (multi-page):
`showPage('items')` mengarahkan ke `/dashboard/items/` — tanpa ekstensi `.html`.

## 🧰 Tech Stack

| Teknologi | Keterangan |
|---|---|
| **HTML5** | Struktur halaman (16 dashboard + login + 404) |
| **CSS3** | Dipecah per-tanggungjawab (main, components, layout, pages, responsive, login) |
| **Vanilla JavaScript (ES6+)** | Tanpa framework / bundler |
| **Tailwind CSS (CDN)** | Utility classes via `cdn.tailwindcss.com` |
| **Chart.js (CDN)** | Grafik penjualan, channel, & laporan |
| **Lucide (CDN)** | Ikon SVG |
| **Python / Node `serve` / PHP** | Untuk menjalankan server lokal |

## 📄 License

Proyek ini didistribusikan di bawah **MIT License**.

## 👤 Author

**Mr David**


