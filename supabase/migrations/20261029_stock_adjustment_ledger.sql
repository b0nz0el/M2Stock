-- Keep physical stock corrections separate from receipts and sales.
DO $$
DECLARE
  product_id_type TEXT;
BEGIN
  SELECT format_type(attribute.atttypid, attribute.atttypmod)
  INTO product_id_type
  FROM pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.products'::regclass
    AND attribute.attname = 'id'
    AND NOT attribute.attisdropped;

  IF product_id_type IS NULL THEN
    RAISE EXCEPTION 'Kolom public.products.id tidak ditemukan.';
  END IF;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.stock_adjustments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id %s NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
      previous_stock NUMERIC NOT NULL CHECK (previous_stock >= 0),
      actual_stock NUMERIC NOT NULL CHECK (actual_stock >= 0),
      difference NUMERIC GENERATED ALWAYS AS (actual_stock - previous_stock) STORED,
      reason TEXT NOT NULL CHECK (char_length(btrim(reason)) > 0),
      notes TEXT NOT NULL DEFAULT '''',
      created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )',
    product_id_type
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product_created
  ON public.stock_adjustments (product_id, created_at DESC);

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and staff can view stock adjustments"
  ON public.stock_adjustments;
CREATE POLICY "Owners and staff can view stock adjustments"
  ON public.stock_adjustments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('OWNER', 'STAFF')
    )
  );

REVOKE ALL ON TABLE public.stock_adjustments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.stock_adjustments TO authenticated;

DROP FUNCTION IF EXISTS public.perform_stock_opname(TEXT, NUMERIC, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.perform_stock_opname(TEXT, NUMERIC, TEXT, TEXT);

CREATE FUNCTION public.perform_stock_opname(
  p_product_id TEXT,
  p_actual_stock NUMERIC,
  p_reason TEXT,
  p_notes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_product RECORD;
  v_difference NUMERIC;
  v_adjustment_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Login diperlukan untuk melakukan penyesuaian stok.'
      USING ERRCODE = '42501';
  END IF;

  SELECT role
  INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF UPPER(COALESCE(v_user_role, '')) NOT IN ('OWNER', 'STAFF') THEN
    RAISE EXCEPTION 'Akses ditolak: hanya OWNER atau STAFF yang dapat menyesuaikan stok.'
      USING ERRCODE = '42501';
  END IF;

  IF p_actual_stock IS NULL
     OR p_actual_stock < 0
     OR p_actual_stock::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Stok fisik harus berupa angka nol atau lebih.'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(BTRIM(p_product_id), '') IS NULL THEN
    RAISE EXCEPTION 'Produk wajib dipilih.'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Alasan penyesuaian wajib diisi.'
      USING ERRCODE = '22023';
  END IF;

  SELECT id, stock
  INTO v_product
  FROM public.products
  WHERE id::TEXT = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produk tidak ditemukan.'
      USING ERRCODE = 'P0002';
  END IF;

  v_difference := p_actual_stock - COALESCE(v_product.stock, 0);

  IF v_difference = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'message', 'Stok sudah sesuai, tidak ada penyesuaian yang diperlukan.',
      'previous_stock', COALESCE(v_product.stock, 0),
      'actual_stock', p_actual_stock,
      'difference', 0
    );
  END IF;

  INSERT INTO public.stock_adjustments (
    product_id,
    previous_stock,
    actual_stock,
    reason,
    notes,
    created_by
  ) VALUES (
    v_product.id,
    COALESCE(v_product.stock, 0),
    p_actual_stock,
    BTRIM(p_reason),
    COALESCE(p_notes, ''),
    v_user_id
  )
  RETURNING id INTO v_adjustment_id;

  UPDATE public.products
  SET stock = p_actual_stock,
      updated_at = now()
  WHERE id = v_product.id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Stok berhasil disesuaikan dan dicatat pada ledger opname.',
    'adjustment_id', v_adjustment_id,
    'previous_stock', COALESCE(v_product.stock, 0),
    'actual_stock', p_actual_stock,
    'difference', v_difference
  );
END;
$$;

REVOKE ALL ON FUNCTION public.perform_stock_opname(TEXT, NUMERIC, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perform_stock_opname(TEXT, NUMERIC, TEXT, TEXT)
  TO authenticated;
