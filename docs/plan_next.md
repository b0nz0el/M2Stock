# Roadmap & Rencana Pengembangan Lanjutan (Next Plan) — Aquastock Pro

Dokumen ini memuat rencana kerja terstruktur untuk fase pengembangan berikutnya pada sistem **Aquastock Pro** (Toko "Jaquris — Jatimakmur Aquarium Aksesoris, Bekasi"). Rencana ini disusun berdasarkan kebutuhan operasional riil toko fisik dan online, menyambung fondasi inventaris, Purchase Order (PO), dan Retur yang telah di-hardening.

---

## 1. Ikhtisar Roadmap Strategis

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FONDASI INVENTARIS (SELESAI)                     │
│    • Master Data Terkonsolidasi (Products, Suppliers, Customers)       │
│    • PO & Retur Berjalan Atomik & Idempotent via PostgreSQL RPC        │
│    • Asisten Restock Otomatis (Draft PO dari Stok Kritis)              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               FASE A: INTEGRASI KEUANGAN & ARUS KAS OTOMATIS           │
│    • Penjualan (Out) ──> Otomatis Masuk Kas / Piutang (Debts)          │
│    • Pembelian PO (In) ──> Otomatis Beban Kas / Hutang Dagang          │
│    • Retur Selesai ──> Penyesuaian Kas Refund / Potong Hutang          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│           FASE B: CETAK NOTA KASIR THERMAL & SURAT PESANAN PO          │
│    • Struk Kasir Bluetooth/USB Thermal Printer (58mm / 80mm)           │
│    • Cetak PDF / Share Format WhatsApp Purchase Order ke Supplier      │
│    • Bukti Tanda Terima Retur Resmi Toko                               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             FASE C: KASIR CEPAT (POINT OF SALE / POS UPGRADE)          │
│    • Mode Multi-Item Keranjang Belanja & Barcode Scanner Cepat        │
│    • Kalkulator Nominal Tunai & Kembalian                              │
│    • Dukungan Diskon Promo (Nominal / Persentase)                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              FASE D: PWA (INSTALLABLE APP DI TABLET/HP KASIR)          │
│    • Web App Manifest & Ikon Resmi Aplikasi                            │
│    • Standalone Fullscreen (Tanpa browser address bar)                 │
│    • Service Worker Caching untuk Ketahanan Offline Dasar              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Rincian Teknis Per Fase

### Fase A: Integrasi Otomatis Transaksi ke Kas & Hutang/Piutang (Prioritas Utama)

**Latar Belakang & Masalah:**
Saat ini, transaksi mutasi barang masuk/keluar dan perubahan status PO/Retur sudah memutasikan stok barang secara otomatis. Namun, buku keuangan (`cash_flow`) dan buku hutang/piutang (`debts`) masih harus diinput terpisah secara manual.

**Solusi & Spesifikasi Teknis:**
1. **Otomasi Penjualan (Barang Keluar / `type = 'out'`)**:
   - Menambahkan opsi metode pembayaran pada form transaksi keluar: `Tunai (Cash)`, `Transfer Bank / QRIS`, atau `Tempo / Bon (Piutang)`.
   - Jika pembayaran **Tunai / Transfer**: Sistem secara atomik mencatat entri `cash_flow` tipe `'in'` (Kategori: *Penjualan Toko*).
   - Jika pembayaran **Tempo**: Sistem secara atomik mencatat entri baru di tabel `debts` tipe `'receivable'` (Piutang) terikat ke `customer_id` dengan batas jatuh tempo.
2. **Otomasi Penerimaan PO (Barang Masuk / `receive_purchase_order`)**:
   - Saat status PO diubah menjadi `diterima`, tambahkan modal opsi pembayaran: `Lunas (Kas Keluar)` atau `Tempo / Konsinyasi (Hutang Dagang)`.
   - Mengalokasikan otomatis ke `cash_flow` tipe `'out'` atau `debts` tipe `'payable'`.
3. **Otomasi Retur Selesai (`complete_return`)**:
   - Retur dari customer: Catat pengembalian dana kas (*refund*) atau potong piutang jika transaksi awal belum lunas.
   - Retur ke supplier: Catat penerimaan kembali dana atau potong saldo hutang ke supplier.
4. **Target File Perubahan**:
   - `supabase/migrations/20261017_financial_automation.sql` (Trigger/RPC atomik integrasi kas)
   - `public/assets/js/api/transactions.js`, `public/assets/js/api/cash.js`, `public/assets/js/api/debt.js`
   - `public/dashboard/out/out.js` & `public/dashboard/po/po.js`

---

### Fase B: Fitur Cetak Struk Kasir Thermal & Dokumen PO

**Latar Belakang & Masalah:**
Pelanggan toko Jaquris membutuhkan bukti transaksi fisik (struk kasir thermal), dan staff toko membutuhkan dokumen PO resmi yang rapi untuk dikirim via WhatsApp atau dicetak saat memesan barang ke distributor.

**Solusi & Spesifikasi Teknis:**
1. **Struk Kasir Thermal (58mm / 80mm)**:
   - Komponen generator cetak struk CSS print-media (monochrome, compact, font monospace/receipt).
   - Mencantumkan: Header toko "Jaquris", alamat & no telepon, tanggal & kasir, rincian barang, total, metode pembayaran, nominal tunai & kembalian, serta footer catatan garansi/terima kasih.
   - Tombol "Cetak Struk" langsung di modal sukses transaksi barang keluar atau dari riwayat transaksi.
2. **Dokumen Surat Pesanan PO (PDF & WhatsApp Share)**:
   - Tombol **"Cetak PO"**: Menghasilkan tampilan print/PDF resmi Surat Pesanan Barang dengan kop surat toko, nomor PO, daftar barang + qty + harga, dan kolom tanda tangan penerima/pemesan.
   - Tombol **"Kirim via WhatsApp"**: Menghasilkan format pesan teks rapi siap kirim:
     ```text
     *PESANAN BARANG (PO) — JAQURIS AQUARIUM*
     No. PO: PO-202610-001
     Kepada: Supplier Aquascaping
     Tanggal: 16 Okt 2026

     Rincian Pesanan:
     1. Filter Hang-on 501 (x10 pcs) - Rp 65.000
     2. Lampu LED RGB 30cm (x5 pcs) - Rp 85.000
     Total Estimasi: Rp 1.075.000

     Mohon konfirmasi kesediaan stok dan jadwal pengiriman. Terima kasih.
     ```
3. **Target File Perubahan**:
   - `public/assets/js/utils/receipt-printer.js` (Helper format cetak struk & text generator)
   - `public/assets/css/receipt-print.css`
   - `public/dashboard/out/out.js` & `public/dashboard/po/po.js`

---

### Fase C: Kasir Cepat (Point of Sale / POS Upgrade)

**Latar Belakang & Masalah:**
Pencatatan barang keluar saat ini masih satu-per-satu per form. Ketika ada pelanggan membeli 5 macam barang sekaligus, kasir membutuhkan alur keranjang belanja cepat.

**Solusi & Spesifikasi Teknis:**
1. **Multi-Item Cart di Barang Keluar (`/dashboard/out/`)**:
   - Keranjang belanja interaktif: scan/pilih barang -> masuk daftar keranjang -> ubah qty -> ringkasan total otomatis.
   - Tombol *shortcut* cepat keyboard (misal: `F2` untuk cari barang, `Enter` untuk checkout).
2. **Kalkulator Kasir**:
   - Input uang diterima (misal: Rp 100.000) -> hitung kembalian instan (Rp 15.000) dengan tombol pecahan uang cepat (Rp 20rb, Rp 50rb, Rp 100rb, Uang Pas).
3. **Penyimpanan Transaksi Multi-Item**:
   - Integrasi ke database mencatat multi transaksi dalam 1 nomor referensi/struk yang sama (`reference_no`).

---

### Fase D: Progressive Web App (PWA) untuk Kasir Tablet/Mobile

**Latar Belakang & Masalah:**
Staff kasir di toko Jaquris sering menggunakan tablet Android/iPad atau smartphone untuk mengecek stok di rak toko atau input penjualan.

**Solusi & Spesifikasi Teknis:**
1. **Web App Manifest (`public/manifest.json`)**:
   - Definisi nama aplikasi "Aquastock Pro", display `standalone`, background theme color `#0B0F17`, dan ikon berbagai resolusi (192px, 512px).
2. **Service Worker (`public/sw.js`)**:
   - Caching untuk aset statis (CSS, JS, Font, Logo) sehingga aplikasi memuat instan (< 1 detik).
   - Penanganan offline banner yang ramah saat koneksi Wi-Fi toko terputus sesaat.

---

## 3. Jadwal Eksekusi & Tahapan Pengerjaan

| Tahap | Modul / Fokus | Estimasi Waktu | Output Utama |
|---|---|---|---|
| **Fase A.1** | Schema Kas & Piutang Otomatis (Penjualan) | 1 Sesi | Transaksi keluar otomatis menambah kas / mencatat piutang |
| **Fase A.2** | Integrasi Kas & Hutang Dagang (PO & Retur) | 1 Sesi | Penerimaan PO mencatat pengeluaran kas / hutang supplier |
| **Fase B.1** | Struk Thermal Kasir 58/80mm | 1 Sesi | Print preview & direct print struk penjualan toko |
| **Fase B.2** | Cetak Dokumen PO & Ekspor WhatsApp | 1 Sesi | Dokumen cetak PO & tombol share WA ke supplier |
| **Fase C** | Multi-Item POS & Kalkulator Kembalian | 2 Sesi | Alur kasir cepat dengan keranjang multi-item |
| **Fase D** | PWA Manifest & App Installation | 1 Sesi | Aplikasi dapat di-install di tablet/smartphone kasir |

---

## 4. Metrik Kualitas & Kriteria Selesai

- **Integritas Finansial**: Total kas di `cash_flow` selalu sinkron dengan riwayat transaksi penjualan/pembelian tunai.
- **Uji Otomatis (Automated Tests)**: Seluruh test baru ditambahkan ke Vitest suite (`npm test`), target kelulusan 100% tanpa regresi.
- **Responsivitas & Print Layout**: Hasil cetak struk pas pada lebar 58mm/80mm tanpa terpotong.
- **Zero Mock / Anti-Mock**: Semua perubahan terikat langsung ke database PostgreSQL Supabase dan rilis otomatis ke Cloudflare Pages.
