-- Aquastock Pro — Migration: Support product sales channel and channel URL link
-- Menambahkan kolom channel (saluran penjualan) dan channel_link (URL produk di marketplace / etalase)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'channel'
  ) THEN
    ALTER TABLE public.products ADD COLUMN channel TEXT DEFAULT 'Offline';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'channel_link'
  ) THEN
    ALTER TABLE public.products ADD COLUMN channel_link TEXT DEFAULT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.products.channel IS 'Saluran penjualan utama produk (Offline, Shopee, Tokopedia, TikTok, Lazada, WhatsApp)';
COMMENT ON COLUMN public.products.channel_link IS 'URL tautan produk di channel / marketplace / etalase online';
