# Import CSV

Fitur import tersedia pada menu **Barang**, **Barang Masuk**, dan **Barang Keluar**. Gunakan tombol **Unduh template CSV** di pratinjau import agar nama kolom dan format sesuai. File maksimal 5 MB dan 2.000 baris; seluruh kolom CSV harus dipisahkan dengan koma.

## Barang

Kolom template:

`SKU, Barcode, Nama Barang, Brand, Kategori, Stok Awal, Min Stok, Harga Beli (Rp), Harga Jual (Rp)`

SKU, nama, stok awal, minimum stok, dan harga wajib diisi. Barcode dan brand boleh kosong. Kategori, jika diisi, harus sudah terdaftar. SKU atau barcode duplikat—di file maupun katalog—membatalkan seluruh import. Barang baru dibuat dengan stok nol; jika stok awal lebih dari nol, sistem membuat transaksi Barang Masuk bertanda **Stok awal dari import produk** agar perubahan stok tetap memiliki riwayat.
Produk yang diimpor memakai satuan default **pcs**; satuan dapat dipilih saat menambah atau mengedit produk dari menu Barang.

## Barang Masuk

Kolom template:

`SKU, Barcode, Jumlah, Harga Satuan (Rp), Supplier, Tanggal (YYYY-MM-DD), Catatan`

SKU atau barcode wajib cocok dengan satu barang yang sudah terdaftar. Supplier opsional, tetapi jika diisi namanya harus cocok dengan supplier yang tersedia. Tanggal opsional; jika kosong, waktu import digunakan.

## Barang Keluar

Kolom template:

`SKU, Barcode, Jumlah, Harga Satuan (Rp), Customer, Channel, Tanggal (YYYY-MM-DD), Catatan`

SKU atau barcode wajib cocok dengan satu barang yang sudah terdaftar. Customer opsional, tetapi jika diisi namanya harus cocok dengan customer yang tersedia. Stok diperiksa untuk seluruh baris, termasuk pengulangan barang yang sama. Tanggal opsional; jika kosong, waktu import digunakan.

## Validasi dan penyimpanan

Pratinjau menampilkan contoh baris dan kesalahan yang ditemukan. Jika ada kesalahan, seluruh file ditolak dan tidak ada baris yang disimpan. Barang Masuk/Keluar disimpan dalam satu transaksi database; jika salah satu baris gagal, seluruh import dan perubahan stok dibatalkan. File transaksi yang sama (checksum SHA-256) tidak dapat diimpor ulang untuk jenis transaksi yang sama.

Gunakan tanggal ISO `YYYY-MM-DD`; tanggal yang dimasukkan disimpan pada tengah malam UTC. Import memerlukan login, koneksi HTTPS, serta kedua migrasi berikut dalam urutan ini:

1. `supabase/migrations/20261016_product_barcodes.sql`
2. `supabase/migrations/20261016_inventory_stock_safety.sql`
