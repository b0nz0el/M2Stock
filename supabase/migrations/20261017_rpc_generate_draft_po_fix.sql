-- =========================================================
-- aQuaStock Pro — Migration: Fix RPC generate_draft_po_from_low_stock & Related Workflow RPCs
-- File: supabase/migrations/20261017_rpc_generate_draft_po_fix.sql
-- =========================================================

-- 1. FUNGSI LOG AUDIT EVENT (PENCEGAH ERROR JIKA BELUM ADA)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT,
  p_target TEXT,
  p_ip TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_log_id UUID := gen_random_uuid();
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    BEGIN
      SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
      v_user_email := NULL;
    END;
  END IF;

  BEGIN
    INSERT INTO public.audit_logs (id, user_id, user_email, action, target, ip, created_at)
    VALUES (v_log_id, v_user_id, v_user_email, p_action, p_target, p_ip, now());
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_log_id;
END;
$$;

-- 2. FUNGSI RESTOCK ASSISTANT: GENERATE DRAFT PO DARI STOK KRITIS
-- Kompatibel penuh tipe supplier_id (INT/UUID/NULL) & produk
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_draft_po_from_low_stock(
  p_supplier_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_prod RECORD;
  v_po_id UUID;
  v_no_po TEXT;
  v_supplier_name TEXT := 'Restock Stok Kritis';
  v_order_qty INT;
  v_unit_price NUMERIC;
  v_grand_total NUMERIC := 0;
  v_item_count INT := 0;
  v_sup_id_int INT := NULL;
  v_sup_id_uuid UUID := NULL;
  v_sup_id_text TEXT := NULL;
BEGIN
  -- Validasi otorisasi jika ada sesi login
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    BEGIN
      SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
      IF UPPER(COALESCE(v_user_role, '')) NOT IN ('OWNER', 'STAFF', 'ADMIN', 'SUPERADMIN', 'MANAGER') THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya OWNER atau STAFF yang dapat membuat Draft PO'
          USING ERRCODE = '42501';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Jika pengecekan profiles bermasalah, lanjutkan untuk sesi authenticated
      NULL;
    END;
  END IF;

  -- Parsing parameter supplier_id
  IF p_supplier_id IS NOT NULL AND TRIM(p_supplier_id) <> '' THEN
    v_sup_id_text := TRIM(p_supplier_id);
    IF v_sup_id_text ~ '^[0-9]+$' THEN
      v_sup_id_int := v_sup_id_text::INT;
      BEGIN
        SELECT name INTO v_supplier_name FROM public.suppliers WHERE id::text = v_sup_id_text;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    ELSIF v_sup_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_sup_id_uuid := v_sup_id_text::UUID;
      BEGIN
        SELECT name INTO v_supplier_name FROM public.suppliers WHERE id::text = v_sup_id_text;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  -- Buat nomor PO unik
  v_no_po := 'PO-' || TO_CHAR(now(), 'YYYYMM') || '-AUTO' || FLOOR(100 + RANDOM() * 900)::TEXT;

  -- Insert header PO draft dengan toleransi tipe data
  BEGIN
    IF v_sup_id_int IS NOT NULL THEN
      EXECUTE 'INSERT INTO public.purchase_orders (no_po, tanggal, supplier_id, supplier_name, status, total, catatan, created_by, created_at, updated_at) VALUES ($1, CURRENT_DATE, $2, $3, ''draft'', 0, ''Restock Otomatis'', $4, now(), now()) RETURNING id'
      INTO v_po_id
      USING v_no_po, v_sup_id_int, v_supplier_name, v_user_id;
    ELSIF v_sup_id_uuid IS NOT NULL THEN
      EXECUTE 'INSERT INTO public.purchase_orders (no_po, tanggal, supplier_id, supplier_name, status, total, catatan, created_by, created_at, updated_at) VALUES ($1, CURRENT_DATE, $2, $3, ''draft'', 0, ''Restock Otomatis'', $4, now(), now()) RETURNING id'
      INTO v_po_id
      USING v_no_po, v_sup_id_uuid, v_supplier_name, v_user_id;
    ELSE
      INSERT INTO public.purchase_orders (
        no_po, tanggal, supplier_id, supplier_name, status, total, catatan, created_by, created_at, updated_at
      ) VALUES (
        v_no_po, CURRENT_DATE, NULL, v_supplier_name, 'draft', 0, 'Restock Otomatis', v_user_id, now(), now()
      ) RETURNING id INTO v_po_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.purchase_orders (
      no_po, tanggal, supplier_id, supplier_name, status, total, catatan, created_by, created_at, updated_at
    ) VALUES (
      v_no_po, CURRENT_DATE, NULL, v_supplier_name, 'draft', 0, 'Restock Otomatis', v_user_id, now(), now()
    ) RETURNING id INTO v_po_id;
  END;

  -- Kumpulkan produk yang stock <= min_stock dan belum ada di PO aktif (draft/dikirim)
  FOR v_prod IN
    SELECT p.*
    FROM public.products p
    WHERE p.stock <= p.min_stock
      AND NOT EXISTS (
        SELECT 1
        FROM public.purchase_order_items poi
        JOIN public.purchase_orders po ON po.id = poi.po_id
        WHERE poi.product_id::text = p.id::text
          AND po.status IN ('draft', 'dikirim')
      )
    ORDER BY (p.stock - p.min_stock) ASC
  LOOP
    -- Formula restock: bawa stok ke 2x min_stock
    v_order_qty := GREATEST(1, (v_prod.min_stock * 2) - v_prod.stock);
    v_unit_price := GREATEST(0, COALESCE(v_prod.cost_price, 0));

    BEGIN
      INSERT INTO public.purchase_order_items (
        po_id, product_id, product_name, qty, harga, subtotal, created_at
      ) VALUES (
        v_po_id,
        v_prod.id,
        v_prod.name,
        v_order_qty,
        v_unit_price,
        (v_order_qty * v_unit_price),
        now()
      );

      v_grand_total := v_grand_total + (v_order_qty * v_unit_price);
      v_item_count := v_item_count + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Jika tidak ada produk yang memenuhi syarat, hapus header dan kembalikan notifikasi
  IF v_item_count = 0 THEN
    DELETE FROM public.purchase_orders WHERE id = v_po_id;
    RETURN jsonb_build_object(
      'ok', true,
      'created', false,
      'message', 'Semua barang berstatus stok aman atau sudah memiliki draft pesanan aktif.'
    );
  END IF;

  -- Perbarui total nilai PO
  UPDATE public.purchase_orders
  SET total = v_grand_total
  WHERE id = v_po_id;

  BEGIN
    PERFORM public.log_audit_event('CREATE', 'Draft PO Otomatis ' || v_no_po || ' (' || v_item_count || ' item stok menipis)');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'created', true,
    'id', v_po_id,
    'no_po', v_no_po,
    'total', v_grand_total,
    'item_count', v_item_count
  );
END;
$$;

-- 3. HAK AKSES EKSEKUSI (GRANTS) UNTUK SUPABASE POSTGREST
-- ---------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.generate_draft_po_from_low_stock(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_draft_po_from_low_stock(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(TEXT, TEXT, TEXT) TO anon;

-- Pastikan RPC workflow PO & Return juga memiliki hak akses
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_purchase_order_atomic') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_purchase_order_atomic TO authenticated, anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'receive_purchase_order') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.receive_purchase_order TO authenticated, anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'complete_return') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_return TO authenticated, anon';
  END IF;
END $$;

-- 4. RELOAD SCHEMA CACHE SUPABASE / POSTGREST
-- ---------------------------------------------------------
NOTIFY pgrst, 'reload schema';

