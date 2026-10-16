-- =========================================================
-- aQuaStock Pro — Migration: Transactions Schema Synchronization & Fix
-- Harmonize column naming (notes <-> note, quantity <-> qty, unit_price <-> price, user_id <-> created_by, total_price)
-- File: supabase/migrations/20261017_transactions_schema_fix.sql
-- =========================================================

-- 1. TAMBAHKAN KOLOM KOMPATIBILITAS JIKA BELUM ADA
-- ---------------------------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS total_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. BACKFILL DATA EKSIS AGAR KONSISTEN
-- ---------------------------------------------------------
UPDATE public.transactions
SET 
  total_price = COALESCE(total_price, COALESCE(qty, quantity, 0) * COALESCE(price, unit_price, 0)),
  quantity = COALESCE(quantity, qty),
  unit_price = COALESCE(unit_price, price),
  notes = COALESCE(notes, note),
  user_id = COALESCE(user_id, created_by)
WHERE total_price IS NULL 
   OR quantity IS NULL 
   OR unit_price IS NULL 
   OR notes IS NULL;

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
  NEW.total_price := COALESCE(NEW.total_price, COALESCE(NEW.qty, NEW.quantity, 0) * COALESCE(NEW.price, NEW.unit_price, 0), 0);

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

-- 5. UPDATE TRIGGER KEUANGAN AGAR KEBAL & LENGKAP (FALLBACK TOTAL_PRICE, QTY, USER)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_transaction_financial_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod_name TEXT;
  v_cust_name TEXT;
  v_sup_name TEXT;
  v_cf_id UUID;
  v_debt_id UUID;
  v_metode TEXT;
  v_qty NUMERIC;
  v_price NUMERIC;
  v_total NUMERIC;
  v_user UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT name INTO v_prod_name FROM public.products WHERE id = NEW.product_id;

    v_qty := COALESCE(NEW.quantity, NEW.qty, 0);
    v_price := COALESCE(NEW.unit_price, NEW.price, 0);
    v_total := COALESCE(NEW.total_price, v_qty * v_price, 0);
    v_user := COALESCE(NEW.user_id, NEW.created_by);

    -- 1. Transaksi Barang Keluar
    IF NEW.type = 'out' AND NEW.po_id IS NULL AND NEW.return_id IS NULL AND v_total > 0 THEN
      v_metode := COALESCE(NEW.payment_method, 'Cash');

      IF v_metode IN ('Cash', 'Transfer', 'QRIS') THEN
        INSERT INTO public.cash_flow (
          tanggal,
          keterangan,
          kategori,
          metode,
          pemasukan,
          pengeluaran,
          created_by,
          created_at
        ) VALUES (
          COALESCE(NEW.created_at::DATE, CURRENT_DATE),
          'Penjualan: ' || COALESCE(v_prod_name, 'Produk') || ' (' || v_qty || ' unit)',
          'Penjualan',
          v_metode,
          v_total,
          0,
          v_user,
          COALESCE(NEW.created_at, now())
        )
        RETURNING id INTO v_cf_id;

        UPDATE public.transactions
        SET cash_flow_id = v_cf_id,
            payment_status = 'Lunas'
        WHERE id = NEW.id;

      ELSIF v_metode = 'Tempo' THEN
        IF NEW.customer_id IS NOT NULL THEN
          SELECT name INTO v_cust_name FROM public.customers WHERE id = NEW.customer_id;
        END IF;

        INSERT INTO public.debts (
          tipe,
          pihak,
          nominal,
          jatuh_tempo,
          status,
          catatan,
          created_by,
          created_at
        ) VALUES (
          'piutang',
          COALESCE(v_cust_name, 'Customer Umum'),
          v_total,
          CURRENT_DATE + 14,
          'belum_bayar',
          'Penjualan Tempo: ' || COALESCE(v_prod_name, 'Produk') || ' (' || v_qty || ' unit)',
          v_user,
          COALESCE(NEW.created_at, now())
        )
        RETURNING id INTO v_debt_id;

        UPDATE public.transactions
        SET debt_id = v_debt_id,
            payment_status = 'Belum Lunas'
        WHERE id = NEW.id;
      END IF;

    -- 2. Transaksi Barang Masuk Manual
    ELSIF NEW.type = 'in' AND NEW.po_id IS NULL AND NEW.return_id IS NULL AND v_total > 0 THEN
      v_metode := COALESCE(NEW.payment_method, 'Cash');

      IF v_metode IN ('Cash', 'Transfer', 'QRIS') THEN
        INSERT INTO public.cash_flow (
          tanggal,
          keterangan,
          kategori,
          metode,
          pemasukan,
          pengeluaran,
          created_by,
          created_at
        ) VALUES (
          COALESCE(NEW.created_at::DATE, CURRENT_DATE),
          'Pembelian Langsung: ' || COALESCE(v_prod_name, 'Produk') || ' (' || v_qty || ' unit)',
          'Pembelian',
          v_metode,
          0,
          v_total,
          v_user,
          COALESCE(NEW.created_at, now())
        )
        RETURNING id INTO v_cf_id;

        UPDATE public.transactions
        SET cash_flow_id = v_cf_id,
            payment_status = 'Lunas'
        WHERE id = NEW.id;

      ELSIF v_metode = 'Tempo' THEN
        IF NEW.supplier_id IS NOT NULL THEN
          SELECT name INTO v_sup_name FROM public.suppliers WHERE id = NEW.supplier_id;
        END IF;

        INSERT INTO public.debts (
          tipe,
          pihak,
          nominal,
          jatuh_tempo,
          status,
          catatan,
          created_by,
          created_at
        ) VALUES (
          'hutang',
          COALESCE(v_sup_name, 'Supplier Umum'),
          v_total,
          CURRENT_DATE + 30,
          'belum_bayar',
          'Pembelian Tempo: ' || COALESCE(v_prod_name, 'Produk') || ' (' || v_qty || ' unit)',
          v_user,
          COALESCE(NEW.created_at, now())
        )
        RETURNING id INTO v_debt_id;

        UPDATE public.transactions
        SET debt_id = v_debt_id,
            payment_status = 'Belum Lunas'
        WHERE id = NEW.id;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.cash_flow_id IS NOT NULL THEN
      DELETE FROM public.cash_flow WHERE id = OLD.cash_flow_id;
    END IF;
    IF OLD.debt_id IS NOT NULL THEN
      DELETE FROM public.debts WHERE id = OLD.debt_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_financial_sync ON public.transactions;
CREATE TRIGGER trg_transaction_financial_sync
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_transaction_financial_sync();

-- 6. BACKFILL NAMA BARANG PADA PURCHASE_ORDER_ITEMS JIKA KOSONG
-- ---------------------------------------------------------
UPDATE public.purchase_order_items poi
SET product_name = p.name
FROM public.products p
WHERE poi.product_id = p.id
  AND (poi.product_name IS NULL OR poi.product_name = '');

-- 7. REFRESH SCHEMA CACHE & PERMISSIONS
-- ---------------------------------------------------------
GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO anon;
NOTIFY pgrst, 'reload schema';
