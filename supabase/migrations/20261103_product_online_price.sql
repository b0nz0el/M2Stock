-- Aquastock Pro — Persist the marketplace selling price separately from offline price.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS online_sell_price NUMERIC(15, 2);

UPDATE public.products
SET online_sell_price = ROUND(GREATEST(COALESCE(cost_price, 0), 0) * 1.25)
WHERE online_sell_price IS NULL;

ALTER TABLE public.products
  ALTER COLUMN online_sell_price SET DEFAULT 0,
  ALTER COLUMN online_sell_price SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_online_sell_price_nonnegative'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_online_sell_price_nonnegative
      CHECK (online_sell_price >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.products.online_sell_price IS
  'Harga jual online terpisah dari harga jual offline; harga markup dihitung dari kolom ini dan cost_price.';

NOTIFY pgrst, 'reload schema';
