-- ==============================================================================
-- Aquastock Pro — Migration: Allow Negative Previous Stock on Stock Opname Ledger
-- ==============================================================================
-- Masalah:
-- Ketika sebuah produk memiliki saldo stok negatif (misalnya -1 karena penjualan
-- kasir mendahului pencatatan barang masuk atau koreksi transaksi), proses Stock
-- Opname fisik (misalnya mengubah stok menjadi 0) gagal dengan error:
-- "new row for relation stock_adjustments violates check constraint stock_adjustments_previous_stock_check".
--
-- Solusi:
-- Hapus check constraint previous_stock >= 0 pada tabel public.stock_adjustments.
-- Nilai previous_stock adalah snapshot saldo sebelum penyesuaian untuk keperluan
-- audit log, sehingga harus dapat menyimpan saldo negatif agar audit akurat.
-- (Nilai actual_stock tetap dibatasi >= 0 karena stok fisik di rak tidak boleh negatif).

ALTER TABLE public.stock_adjustments
  DROP CONSTRAINT IF EXISTS stock_adjustments_previous_stock_check;
