-- =========================================================
-- aQuaStock Pro — Migration: Transactions Schema Synchronization & Fix
-- Harmonize column naming (notes <-> note, quantity <-> qty, unit_price <-> price, user_id <-> created_by)
-- File: supabase/migrations/20261017_transactions_schema_fix.sql
-- =========================================================

-- 1. TAMBAHKAN KOLOM KOMPATIBILITAS JIKA BELUM ADA
-- ---------------------------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC,
  ADD COLUMN IF NOT EXISTS total_price NUMERIC,
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. BACKFILL DATA EKSIS AGAR KONSISTEN
-- ---------------------------------------------------------
UPDATE public.transactions
SET 
  notes = COALESCE(notes, note),
  quantity = COALESCE(quantity, qty),
  unit_price = COALESCE(unit_price, price),
  total_price = COALESCE(total_price, COALESCE(qty, quantity, 0) * COALESCE(price, unit_price, 0)),
  user_id = COALESCE(user_id, created_by)
WHERE notes IS NULL 
   OR quantity IS NULL 
   OR unit_price IS NULL 
   OR total_price IS NULL;

-- 3. TRIGGER BI-DIRECTIONAL COLUMN SYNC
-- Menjamin setiap INSERT/UPDATE selalu mengisi kedua pasang kolom (note/notes, qty/quantity, price/unit_price, created_by/user_id, total_price)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_transaction_columns()
RETURNS trigger AS $$
BEGIN
  -- Sync quantity & qty
  IF NEW.quantity IS NOT NULL AND NEW.qty IS NULL THEN
    NEW.qty := NEW.quantity;
  ELSIF NEW.qty IS NOT NULL AND NEW.quantity IS NULL THEN
    NEW.quantity := NEW.qty;
  END IF;

  -- Sync unit_price & price
  IF NEW.unit_price IS NOT NULL AND NEW.price IS NULL THEN
    NEW.price := NEW.unit_price;
  ELSIF NEW.price IS NOT NULL AND NEW.unit_price IS NULL THEN
    NEW.unit_price := NEW.price;
  END IF;

  -- Calculate total_price if missing
  IF NEW.total_price IS NULL THEN
    NEW.total_price := COALESCE(NEW.qty, NEW.quantity, 0) * COALESCE(NEW.price, NEW.unit_price, 0);
  END IF;

  -- Sync notes & note
  IF NEW.notes IS NOT NULL AND NEW.note IS NULL THEN
    NEW.note := NEW.notes;
  ELSIF NEW.note IS NOT NULL AND NEW.notes IS NULL THEN
    NEW.notes := NEW.note;
  END IF;

  -- Sync user_id & created_by
  IF NEW.user_id IS NOT NULL AND NEW.created_by IS NULL THEN
    NEW.created_by := NEW.user_id;
  ELSIF NEW.created_by IS NOT NULL AND NEW.user_id IS NULL THEN
    NEW.user_id := NEW.created_by;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_transaction_columns ON public.transactions;
CREATE TRIGGER trg_sync_transaction_columns
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_transaction_columns();

-- 4. UPDATE TRIGGER MUTASI STOK AGAR LEBIH KEBAL (FALLBACK QTY / QUANTITY)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_transaction_stock_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_rows INTEGER;
  v_qty NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_qty := COALESCE(NEW.quantity, NEW.qty, 0);
    IF NEW.type = 'in' THEN
      UPDATE public.products
      SET stock = stock + v_qty,
          updated_at = now()
      WHERE id = NEW.product_id;
    ELSE
      UPDATE public.products
      SET stock = stock - v_qty,
          updated_at = now()
      WHERE id = NEW.product_id
        AND stock >= v_qty;
      GET DIAGNOSTICS updated_rows = ROW_COUNT;
      IF updated_rows = 0 THEN
        RAISE EXCEPTION 'Stok tidak mencukupi untuk transaksi keluar'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_qty := COALESCE(OLD.quantity, OLD.qty, 0);
    IF OLD.type = 'in' THEN
      UPDATE public.products
      SET stock = stock - v_qty,
          updated_at = now()
      WHERE id = OLD.product_id
        AND stock >= v_qty;
      GET DIAGNOSTICS updated_rows = ROW_COUNT;
      IF updated_rows = 0 THEN
        RAISE EXCEPTION 'Tidak dapat menghapus transaksi masuk karena stok akhir akan menjadi negatif'
          USING ERRCODE = '23514';
      END IF;
    ELSE
      UPDATE public.products
      SET stock = stock + v_qty,
          updated_at = now()
      WHERE id = OLD.product_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 5. REFRESH SCHEMA CACHE & PERMISSIONS
-- ---------------------------------------------------------
GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO anon;
NOTIFY pgrst, 'reload schema';

-- 6. BACKFILL NAMA BARANG PADA PURCHASE_ORDER_ITEMS JIKA KOSONG
-- ---------------------------------------------------------
UPDATE public.purchase_order_items poi
SET product_name = p.name
FROM public.products p
WHERE poi.product_id = p.id
  AND (poi.product_name IS NULL OR poi.product_name = '');


