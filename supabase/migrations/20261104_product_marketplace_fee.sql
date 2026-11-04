-- Aquastock Pro — Persist the marketplace fee used for online profit calculations.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS marketplace_fee_percent NUMERIC(8, 6);

UPDATE public.products
SET marketplace_fee_percent = 0.395
WHERE marketplace_fee_percent IS NULL;

ALTER TABLE public.products
  ALTER COLUMN marketplace_fee_percent SET DEFAULT 0.395,
  ALTER COLUMN marketplace_fee_percent SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_marketplace_fee_percent_range'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_marketplace_fee_percent_range
      CHECK (marketplace_fee_percent >= 0 AND marketplace_fee_percent <= 1);
  END IF;
END $$;

COMMENT ON COLUMN public.products.marketplace_fee_percent IS
  'Proporsi fee marketplace, misalnya 0.395 untuk 39.5 persen.';

NOTIFY pgrst, 'reload schema';
