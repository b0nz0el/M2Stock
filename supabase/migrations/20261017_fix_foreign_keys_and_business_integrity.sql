-- =========================================================
-- Aquastock Pro — Migration: Foreign Keys & Relational Integrity Fix
-- File: supabase/migrations/20261017_fix_foreign_keys_and_business_integrity.sql
-- =========================================================

-- 1. BACKFILL SNAPSHOT NAMA PRODUK SEBELUM MODIFIKASI CONSTRAINT
-- Menjamin semua data historis PO & Retur tetap memiliki nama barang permanen
-- ---------------------------------------------------------
UPDATE public.purchase_order_items poi
SET product_name = p.name
FROM public.products p
WHERE poi.product_id = p.id
  AND (poi.product_name IS NULL OR poi.product_name = '');

UPDATE public.returns r
SET snapshot_product_name = p.name
FROM public.products p
WHERE r.produk_id = p.id
  AND (r.snapshot_product_name IS NULL OR r.snapshot_product_name = '');

-- 2. PERBAIKI FOREIGN KEY PADA PURCHASE_ORDER_ITEMS (fk_poi_product)
-- Mengubah dari ON DELETE RESTRICT menjadi ON UPDATE CASCADE ON DELETE SET NULL
-- ---------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_poi_product'
  ) THEN
    ALTER TABLE public.purchase_order_items DROP CONSTRAINT fk_poi_product;
  END IF;

  ALTER TABLE public.purchase_order_items
    ADD CONSTRAINT fk_poi_product
    FOREIGN KEY (product_id) REFERENCES public.products(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
END $$;

-- 3. PERBAIKI FOREIGN KEY PADA RETURNS (fk_returns_product)
-- Mengubah dari ON DELETE RESTRICT menjadi ON UPDATE CASCADE ON DELETE SET NULL
-- ---------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_returns_product'
  ) THEN
    ALTER TABLE public.returns DROP CONSTRAINT fk_returns_product;
  END IF;

  ALTER TABLE public.returns
    ADD CONSTRAINT fk_returns_product
    FOREIGN KEY (produk_id) REFERENCES public.products(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
END $$;

-- 4. PERBAIKI FOREIGN KEY SUPPLIER & CUSTOMER AGAR CASCADE SAAT UPDATE & SET NULL SAAT DELETE
-- ---------------------------------------------------------
DO $$
BEGIN
  -- fk_po_supplier
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_po_supplier') THEN
    ALTER TABLE public.purchase_orders DROP CONSTRAINT fk_po_supplier;
  END IF;
  ALTER TABLE public.purchase_orders
    ADD CONSTRAINT fk_po_supplier
    FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

  -- fk_returns_supplier
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_returns_supplier') THEN
    ALTER TABLE public.returns DROP CONSTRAINT fk_returns_supplier;
  END IF;
  ALTER TABLE public.returns
    ADD CONSTRAINT fk_returns_supplier
    FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

  -- fk_returns_customer
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_returns_customer') THEN
    ALTER TABLE public.returns DROP CONSTRAINT fk_returns_customer;
  END IF;
  ALTER TABLE public.returns
    ADD CONSTRAINT fk_returns_customer
    FOREIGN KEY (customer_id) REFERENCES public.customers(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
END $$;

-- 5. PERBAIKI FOREIGN KEY TRANSACTIONS (PO, RETURN, PRODUCT)
-- ---------------------------------------------------------
DO $$
BEGIN
  -- fk_transactions_po
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transactions_po') THEN
    ALTER TABLE public.transactions DROP CONSTRAINT fk_transactions_po;
  END IF;
  ALTER TABLE public.transactions
    ADD CONSTRAINT fk_transactions_po
    FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

  -- fk_transactions_return
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transactions_return') THEN
    ALTER TABLE public.transactions DROP CONSTRAINT fk_transactions_return;
  END IF;
  ALTER TABLE public.transactions
    ADD CONSTRAINT fk_transactions_return
    FOREIGN KEY (return_id) REFERENCES public.returns(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

  -- fk_transactions_product (jika ada)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transactions_product') THEN
    ALTER TABLE public.transactions DROP CONSTRAINT fk_transactions_product;
    ALTER TABLE public.transactions
      ADD CONSTRAINT fk_transactions_product
      FOREIGN KEY (product_id) REFERENCES public.products(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- 6. REFRESH SCHEMA CACHE & PERMISSIONS
-- ---------------------------------------------------------
GRANT ALL ON public.purchase_order_items TO authenticated, anon;
GRANT ALL ON public.returns TO authenticated, anon;
GRANT ALL ON public.purchase_orders TO authenticated, anon;
GRANT ALL ON public.transactions TO authenticated, anon;
GRANT ALL ON public.products TO authenticated, anon;

NOTIFY pgrst, 'reload schema';

