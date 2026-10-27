-- Aquastock Pro — Migration: Support product images gallery / array
-- Menjamin table products mendukung galeri multi-foto secara terstruktur

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'images'
  ) THEN
    ALTER TABLE public.products ADD COLUMN images JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.products.images IS 'Galeri foto produk dalam format JSON array URL string';

-- Isi kolom images dari data image_url lama jika belum terisi
UPDATE public.products
SET images = jsonb_build_array(image_url)
WHERE image_url IS NOT NULL 
  AND image_url <> '' 
  AND (images IS NULL OR images = '[]'::jsonb)
  AND NOT (image_url LIKE '[%]');

-- Jika image_url sudah berupa JSON array string, masukkan langsung ke images
UPDATE public.products
SET images = image_url::jsonb
WHERE image_url IS NOT NULL 
  AND image_url LIKE '[%]'
  AND (images IS NULL OR images = '[]'::jsonb);
