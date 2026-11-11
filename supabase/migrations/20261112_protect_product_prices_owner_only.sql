-- ═══════════════════════════════════════════════════════════════════════════════
-- M2Stock: Security Hardening — Kunci Perubahan Harga Produk Khusus OWNER
-- File: 20261112_protect_product_prices_owner_only.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- Trigger Function: Mencegah non-OWNER (Staf/penyusup) mengubah harga jual produk
CREATE OR REPLACE FUNCTION public.check_product_price_update_permission()
RETURNS TRIGGER AS $$
BEGIN
  -- Deteksi apakah kolom harga jual (offline, online, atau harga min) mengalami perubahan
  IF (OLD.sell_price IS DISTINCT FROM NEW.sell_price)
     OR (OLD.online_sell_price IS DISTINCT FROM NEW.online_sell_price)
     OR (OLD.min_sell_price IS DISTINCT FROM NEW.min_sell_price) THEN
    
    -- Pemanggil harus login dan memiliki role OWNER terverifikasi di server
    IF NOT public.is_owner() THEN
      RAISE EXCEPTION 'Akses ditolak: Hanya role OWNER yang berhak mengubah harga produk.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang trigger BEFORE UPDATE pada tabel products
DROP TRIGGER IF EXISTS trg_protect_product_prices ON public.products;
CREATE TRIGGER trg_protect_product_prices
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.check_product_price_update_permission();
