-- Add optional, unique barcode support to the product catalog.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique_idx
  ON public.products (barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';
