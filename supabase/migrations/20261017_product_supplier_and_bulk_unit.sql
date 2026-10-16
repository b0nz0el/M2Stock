-- =========================================================
-- aQuaStock Pro — Migration: Add supplier_id to products
-- File: supabase/migrations/20261017_product_supplier_and_bulk_unit.sql
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN supplier_id INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_supplier'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT fk_products_supplier
      FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products(supplier_id);

GRANT ALL ON public.products TO authenticated, anon;
NOTIFY pgrst, 'reload schema';
