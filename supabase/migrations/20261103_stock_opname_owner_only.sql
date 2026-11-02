DROP POLICY IF EXISTS "Owners and staff can view stock adjustments"
  ON public.stock_adjustments;
DROP POLICY IF EXISTS "Owners can view stock adjustments"
  ON public.stock_adjustments;

CREATE POLICY "Owners can view stock adjustments"
  ON public.stock_adjustments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(BTRIM(profiles.role)) = 'OWNER'
    )
  );

DO $$
DECLARE
  v_all_columns TEXT;
  v_non_stock_columns TEXT;
BEGIN
  SELECT string_agg(format('%I', attribute.attname), ', ' ORDER BY attribute.attnum)
  INTO v_all_columns
  FROM pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.products'::regclass
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped
    AND attribute.attgenerated = '';

  SELECT string_agg(format('%I', attribute.attname), ', ' ORDER BY attribute.attnum)
  INTO v_non_stock_columns
  FROM pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.products'::regclass
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped
    AND attribute.attgenerated = ''
    AND attribute.attname NOT IN ('id', 'stock');

  IF v_all_columns IS NULL OR v_non_stock_columns IS NULL THEN
    RAISE EXCEPTION 'Kolom public.products tidak tersedia untuk pengaturan hak akses stok.';
  END IF;

  EXECUTE format(
    'REVOKE INSERT (%1$s) ON TABLE public.products FROM PUBLIC, anon, authenticated',
    v_all_columns
  );
  EXECUTE format(
    'REVOKE UPDATE (%1$s) ON TABLE public.products FROM PUBLIC, anon, authenticated',
    v_all_columns
  );

  REVOKE INSERT, UPDATE ON TABLE public.products FROM PUBLIC, anon, authenticated;

  EXECUTE format(
    'GRANT INSERT (%1$s) ON TABLE public.products TO authenticated',
    v_non_stock_columns
  );
  EXECUTE format(
    'GRANT UPDATE (%1$s) ON TABLE public.products TO authenticated',
    v_non_stock_columns
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.perform_stock_opname(
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

  IF UPPER(BTRIM(COALESCE(v_user_role, ''))) <> 'OWNER' THEN
    RAISE EXCEPTION 'Akses ditolak: koreksi stok fisik hanya dapat dilakukan oleh OWNER.'
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
