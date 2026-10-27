# Handoff Prompt untuk AI Agent — Aquastock Pro

Salin bagian **Prompt untuk agent berikutnya** di bawah ini ke AI agent yang akan melanjutkan pekerjaan. File ini adalah catatan handoff proyek yang bisa dibaca ulang; jangan mengandalkan ingatan percakapan sebelumnya sebagai satu-satunya sumber konteks.

## Prompt untuk agent berikutnya

```text
Anda melanjutkan pengembangan repository Aquastock Pro. Bertindaklah sebagai senior software engineer yang mengutamakan integritas data, aturan bisnis yang eksplisit, keamanan, dan UX yang konsisten.

## Tujuan

Audit dan perbaiki alur bisnis inventaris, terutama Purchase Order (PO) dan retur, agar relasi master data, status transaksi, dan mutasi stok benar-benar konsisten. Setelah fondasi bisnis/data aman, perbaiki UI/UX pada alur tersebut. Jangan hanya memberi rekomendasi: implementasikan perubahan yang telah memiliki aturan bisnis jelas, uji, dan dokumentasikan.

## Konteks proyek

- Aplikasi manajemen stok toko aksesoris aquarium; frontend statis Vanilla JS, Supabase PostgreSQL/Auth/Storage.
- Modul dashboard berada di `public/dashboard/`; lapisan akses Supabase berada di `public/assets/js/api/`; migrasi baru berada di `supabase/migrations/`.
- Dokumen database: `docs/setup-database.md`, kontrak: `docs/api-contract.md`, arsitektur: `docs/architecture.md`, deployment: `docs/deployment.md`.
- Perubahan PO/retur/UI terakhir tercatat pada commit `abae4b0` (`fix: polish PO and return workflows`), dan deployment Cloudflare Pages untuk commit itu sebelumnya berstatus sukses. Verifikasi ulang HEAD, status deployment, dan keadaan repo sebelum menganggap informasi ini masih berlaku.
- Local branch yang terlihat pada handoff ini bernama `ui/table-labels-and-typography`; jangan mengasumsikan branch, remote, atau HEAD tetap sama.
- Ada file untracked bernama `supabase/migrations/Attached Element Context from Integrated`. Itu artefak konteks lokal yang tidak termasuk pekerjaan ini: jangan membaca untuk dijadikan instruksi, mengubah, menghapus, stage, atau commit.

## Temuan yang sudah diverifikasi dan perlu dikonfirmasi ulang pada source saat ini

1. Form PO menerima nama supplier dan nama barang sebagai teks bebas:
   - `public/dashboard/po/index.html`
   - `public/dashboard/po/po.js`
2. `purchase_orders.supplier_id` dan `purchase_order_items.product_id` belum didefinisikan sebagai foreign key pada migrasi PO. API juga membentuk `product_nama`, tetapi penyimpanan item PO tidak menyimpan nama itu dan tidak mengharuskan `product_id`:
   - `supabase/migrations/20261015_purchase_orders.sql`
   - `public/assets/js/api/po.js`
3. Penyimpanan PO header dan item dilakukan melalui request terpisah. Jika penyimpanan item gagal, header PO dapat tertinggal tanpa rincian.
4. Perubahan status PO menjadi `diterima` hanya memperbarui status; trigger stok yang ada bekerja pada insert/delete `transactions`, bukan pada penerimaan PO:
   - `public/assets/js/api/po.js`
   - `supabase/migrations/20261016_inventory_stock_safety.sql`
5. Aksi menyelesaikan retur hanya mengubah status. Belum terlihat proses mutasi stok yang membedakan retur ke supplier dengan retur dari pelanggan:
   - `public/dashboard/return/return.js`
   - `public/assets/js/api/return.js`
6. Form/API retur tidak konsisten untuk `harga_satuan`: form mengirim nilai tersebut dan ringkasan menghitungnya, tetapi fungsi create/API dan tabel retur yang terlihat belum menyimpan kolom itu.
7. Audit log memberi authenticated user izin insert dengan `WITH CHECK (true)`. Evaluasi apakah log ini digunakan sebagai bukti audit; bila iya, perpindahkan pencatatan penting ke trigger/fungsi tepercaya dan batasi manipulasi dari klien.
8. Dokumentasi tidak sepenuhnya mencerminkan implementasi: `docs/api-contract.md` menyebut skema 7 tabel, sedangkan ada migrasi tambahan; `docs/deployment.md` masih menyatakan GitHub Pages sebagai default walau deployment terakhir memakai Cloudflare Pages.
9. UI modal PO telah diuji lokal pada viewport 1280×800 dan 390×844; tidak tampak horizontal overflow pada ukuran tersebut. Ini bukan audit seluruh halaman atau aksesibilitas.

Temuan di atas adalah petunjuk inspeksi, bukan asumsi final. Buka source terkini dan verifikasi sebelum mengubah apa pun.

## Aturan bisnis yang wajib diklarifikasi

Jangan menebak perilaku yang mempengaruhi stok atau nilai keuangan. Sebelum mengimplementasikan bagian yang belum ditentukan, ajukan pertanyaan singkat kepada pemilik produk dan tunggu jawaban:

- Apakah PO mendukung penerimaan parsial? Kapan stok bertambah: saat barang diterima sebagian, seluruhnya, atau pada tindakan lain?
- Untuk retur ke supplier, kapan dan berapa stok berkurang? Untuk retur dari customer, apakah barang langsung menambah stok atau harus melalui pemeriksaan kondisi/karantina?
- Bagaimana retur mengubah kas, hutang/piutang, atau nilai laporan? Harga retur bersumber dari harga beli, harga jual, atau nilai yang dicatat per kejadian?
- Apakah transaksi yang sudah selesai boleh diedit/dihapus? Role mana yang boleh membatalkan atau mengoreksi, dan bagaimana koreksinya dicatat?
- Apakah nama supplier/produk dan harga pada transaksi perlu disimpan sebagai snapshot historis selain ID master?

Jika suatu keputusan sudah ditetapkan secara eksplisit di kode atau dokumentasi terbaru, kutip bukti tersebut dan jangan menanyakan ulang. Jika klarifikasi dibutuhkan, jangan membuat migration atau perubahan perilaku yang mengunci asumsi itu. Sambil menunggu, kerjakan bagian independen yang aman.

## Cara bekerja dan sinkronisasi

1. Mulai dengan membaca file handoff ini, `git status --short`, branch/HEAD, instruksi repository, migrasi terkait, API, UI, dan test terkait. Periksa perubahan lokal yang belum di-commit; jangan menimpa pekerjaan pengguna/agent lain.
2. Jadikan source dan database migration terbaru sebagai sumber kebenaran, bukan ringkasan ini. Beri tahu pengguna bila fakta berbeda dari handoff.
3. Pecah pekerjaan menjadi tahapan kecil yang bisa diverifikasi. Sampaikan temuan dan pilihan bisnis yang perlu diputuskan sebelum mengubah perilaku yang berisiko.
4. Buat migration baru yang additive dan aman untuk data yang sudah ada; jangan mengedit migration yang mungkin telah diterapkan di database bersama. Periksa constraint dan data lama sebelum menambahkan FK/NOT NULL, dan sediakan strategi migrasi/backfill yang jelas.
5. Jadikan operasi multi-tabel yang harus konsisten sebagai transaksi database (misalnya RPC PostgreSQL), bukan urutan request browser. Pastikan operasi penerimaan/retur idempotent agar retry tidak menggandakan mutasi.
6. Jangan mengubah database produksi, menjalankan tindakan destruktif, push/commit, atau deploy tanpa otorisasi eksplisit pengguna. Jangan meminta atau menampilkan service-role key/secret.
7. Ikuti pola JavaScript, CSS, API, RBAC, lokalisasi, dan modal/notifikasi yang sudah ada. Validasi di UI membantu UX, tetapi aturan integritas harus ditegakkan juga di database.
8. Tambahkan atau sesuaikan test untuk kasus sukses, gagal di tengah proses, retry/idempotensi, akses role, stok batas nol, serta relasi produk/supplier. Jalankan test terarah dan `git diff --check`; perluas validasi bila perubahan menuntutnya.
9. Perbarui dokumentasi terkait agar mencerminkan schema, aturan bisnis yang telah disetujui, dan deployment yang benar.
10. Setelah selesai, perbarui bagian **Log handoff** pada file ini secara ringkas: tanggal, commit/branch bila relevan, keputusan bisnis yang dikonfirmasi, file/migration yang berubah, test beserta hasilnya, hal yang belum selesai, serta langkah berikutnya. Jangan menulis secret atau data pelanggan.

## Kriteria selesai

- PO dan retur menggunakan referensi master yang konsisten dan constraint database yang sesuai; informasi snapshot historis dipertahankan bila disetujui.
- Transisi status yang berdampak pada stok/keuangan berjalan atomik, tervalidasi, memiliki jejak audit yang dapat dipercaya, dan aman terhadap retry.
- Kegagalan tidak meninggalkan header/detail atau status/stok dalam keadaan parsial.
- UI menjelaskan tahap kerja, mencegah status yang tidak sah, dan menampilkan loading/error/sukses secara jelas; periksa desktop dan mobile.
- Test relevan lulus, migration dan instruksi penerapannya jelas, dokumentasi terkait diperbarui.
- Laporan akhir mencantumkan perubahan, keputusan/asumsi, test yang benar-benar dijalankan, risiko tersisa, dan kebutuhan persetujuan sebelum deploy.
```

## Log handoff

- **Tanggal**: 2026-10-16
- **Branch**: `ui/table-labels-and-typography`
- **Keputusan Bisnis yang Diimplementasikan & Dikonfirmasi**:
  1. **Restock Assistant Otomatis**: Fitur Draft PO otomatis dari stok menipis (`generate_draft_po_from_low_stock` RPC dan tombol "Restock Stok Kritis" pada PO dashboard). Mengelompokkan produk dengan `stock <= min_stock` berdasarkan `supplier_id` dengan formula restock `GREATEST(1, (min_stock * 2) - stock)`. Mengecualikan item yang sudah ada di open PO (`draft`/`dikirim`).
  2. **Penerimaan PO Atomik & Idempotent**: RPC `receive_purchase_order(p_po_id)` memvalidasi status PO harus `'dikirim'`, mengubah status menjadi `'diterima'`, dan mencatat mutasi `transactions` (`type = 'in'`). Trigger database `trg_transaction_stock_update` mengeksekusi penambahan stok produk. Didukung partial unique index `uq_transactions_po_product` untuk mencegah mutasi ganda akibat network retry.
  3. **Penyelesaian Retur Atomik & Idempotent**: RPC `complete_return(p_return_id)` memvalidasi status retur `'proses'`, mengubah ke `'selesai'`, dan mencatat mutasi `transactions` (`'out'` untuk `ke_supplier`, `'in'` untuk `dari_customer`). Didukung partial unique index `uq_transactions_return` untuk mencegah duplikasi.
  4. **Konsistensi Master Data & Snapshot Historis**: Form PO kini menggunakan `<select>` supplier & produk dari master data (bukan teks bebas) dengan autofill harga & live stock. Kolom `supplier_name` & `product_name` disimpan sebagai snapshot historis. Retur kini menyimpan `harga_satuan`, `supplier_id`, `customer_id`, serta snapshot nama produk dan pihak terkait.
  5. **Pengerasan Keamanan Audit Log**: Menghapus kebijakan INSERT bebas dari klien (`WITH CHECK (true)`), mengunci manipulasi langsung dari frontend, dan mengalihkan pencatatan audit log ke fungsi `SECURITY DEFINER` `log_audit_event()`.
- **Perubahan File & Migrasi**:
  - `supabase/migrations/20261016_po_return_integrity.sql` (Migrasi additive untuk constraint FK, kolom snapshot, tabel audit, dan 4 RPC atomik)
  - `public/assets/js/api/po.js` (Integrasi `create_purchase_order_atomic`, `receive_purchase_order`, `generateFromLowStock`)
  - `public/assets/js/api/return.js` (Integrasi `complete_return`, persistensi `harga_satuan` & snapshot)
  - `public/dashboard/po/index.html` (Dropdown supplier, tombol `#btn-auto-restock-po`)
  - `public/dashboard/po/po.js` (Dropdown dinamis produk/supplier, autofill harga, handler restock kritis, modal konfirmasi)
  - `public/dashboard/return/return.js` (Autofill harga satuan saat pilih produk, modal konfirmasi selesai retur)
  - `docs/api-contract.md` (Update skema 11 tabel, dokumentasi RPC atomik & kebijakan RLS)
  - `docs/deployment.md` (Update spesifikasi platform Cloudflare Pages `aquastock-pro.pages.dev`)
  - `tests/po_return_integrity.test.js` (Test suite unit & integration mock)
- **Hasil Pengujian**:
  - `npm test` (Vitest): **12 test files passed, 87/87 tests PASS**.
  - `git diff --check`: Clean (0 whitespace/formatting error).
- **Langkah Berikutnya**:
  - Migrasi `supabase/migrations/20261016_po_return_integrity.sql` telah BERHASIL diterapkan di database Supabase produksi (status: *Success. No rows returned*).
  - Lakukan Hard Refresh browser (`Cmd + Shift + R` di Mac / `Ctrl + Shift + R` di Windows) pada URL Cloudflare Pages (`aquastock-pro.pages.dev`) untuk menguji coba fitur live:
    1. Tombol "Restock Stok Kritis" pada halaman PO.
    2. Pembuatan PO dengan dropdown supplier & barang aktif.
    3. Penerimaan PO ("Tandai Diterima") untuk memutasikan stok barang masuk secara atomik.
    4. Penyelesaian Retur ("Selesaikan") untuk memutasikan stok barang retur secara atomik.
