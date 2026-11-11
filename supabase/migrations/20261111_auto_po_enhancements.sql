-- =========================================================================
-- M2Stock — Migration: Auto-PO Cerdas (Gap-Filling, Demand Velocity
-- 7/30/90 Hari dari Penjualan Bersih, Per-Supplier Grouping, Anti-Duplikat)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.generate_draft_po_from_low_stock_unchecked(
  p_supplier_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_key TEXT := TO_CHAR(CURRENT_DATE, 'YYYYMM');
  v_sup_col_type TEXT;
  v_sup_filter TEXT := NULLIF(TRIM(COALESCE(p_supplier_id, '')), '');
  v_coverage_days INT := 18;
  v_sup_group RECORD;
  v_prod RECORD;
  v_po_id UUID;
  v_no_po TEXT;
  v_seq INT;
  v_sup_name TEXT;
  v_effective_stock NUMERIC;
  v_min_stock NUMERIC;
  v_target_stock NUMERIC;
  v_sold_7d NUMERIC;
  v_sold_30d NUMERIC;
  v_sold_90d NUMERIC;
  v_ads_7d NUMERIC;
  v_ads_30d NUMERIC;
  v_ads_90d NUMERIC;
  v_ads_7d_capped NUMERIC;
  v_weighted_ads NUMERIC;
  v_demand_target INT;
  v_conservative_target INT;
  v_mode TEXT;
  v_reason TEXT;
  v_qty INT;
  v_harga NUMERIC;
  v_subtotal NUMERIC;
  v_group_total NUMERIC;
  v_group_count INT;
  v_total_items INT := 0;
  v_total_value NUMERIC := 0;
  v_created_count INT := 0;
  v_updated_count INT := 0;
  v_pos JSONB := '[]'::JSONB;
  v_group_reasons JSONB := '[]'::JSONB;
  v_all_reasons JSONB := '[]'::JSONB;
  v_no_po_list TEXT[] := ARRAY[]::TEXT[];
  v_first_id UUID := NULL;
  v_first_no_po TEXT := NULL;
BEGIN
  -- Serialize Auto-PO generation for the current month so concurrent calls do not collide on gap numbers
  PERFORM pg_advisory_xact_lock(hashtext('aquastock_auto_po_' || v_month_key));

  -- Read optional coverage days config from app_settings.stock_config (default 18 days = 14d + 4d buffer)
  BEGIN
    SELECT LEAST(90, GREATEST(1, COALESCE(
      NULLIF(value->>'auto_po_coverage_days', '')::INT,
      NULLIF(value->>'target_coverage_days', '')::INT,
      18
    )))
    INTO v_coverage_days
    FROM public.app_settings
    WHERE key = 'stock_config'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_coverage_days := 18;
  END;
  v_coverage_days := COALESCE(v_coverage_days, 18);

  SELECT data_type
  INTO v_sup_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'purchase_orders'
    AND column_name = 'supplier_id'
  LIMIT 1;

  -- Check if any eligible low-stock product needs ordering (excluding active draft/dikirim POs)
  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE COALESCE(p.is_active, TRUE) = TRUE
      AND COALESCE(p.stock, 0) <= GREATEST(0, COALESCE(p.min_stock, 0))
      AND (v_sup_filter IS NULL OR p.supplier_id::TEXT = v_sup_filter)
      AND NOT EXISTS (
        SELECT 1
        FROM public.purchase_order_items poi
        JOIN public.purchase_orders po ON po.id = poi.po_id
        WHERE po.status IN ('draft', 'dikirim')
          AND poi.product_id = p.id
      )
  ) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'created', false,
      'po_count', 0,
      'created_count', 0,
      'updated_count', 0,
      'coverage_days', v_coverage_days,
      'item_reasons', '[]'::JSONB,
      'message', 'Semua barang berstatus stok aman atau sudah memiliki PO aktif (Draft/Ordered).'
    );
  END IF;

  -- Process each supplier group independently
  FOR v_sup_group IN
    SELECT
      COALESCE(p.supplier_id::TEXT, '__NONE__') AS sup_key,
      NULLIF(p.supplier_id::TEXT, '') AS raw_sup_id,
      COALESCE(MAX(s.name), CASE WHEN p.supplier_id IS NULL THEN 'Tanpa Supplier' ELSE 'Supplier' END) AS sup_name
    FROM public.products p
    LEFT JOIN public.suppliers s ON s.id::TEXT = p.supplier_id::TEXT
    WHERE COALESCE(p.is_active, TRUE) = TRUE
      AND COALESCE(p.stock, 0) <= GREATEST(0, COALESCE(p.min_stock, 0))
      AND (v_sup_filter IS NULL OR p.supplier_id::TEXT = v_sup_filter)
      AND NOT EXISTS (
        SELECT 1
        FROM public.purchase_order_items poi
        JOIN public.purchase_orders po ON po.id = poi.po_id
        WHERE po.status IN ('draft', 'dikirim')
          AND poi.product_id = p.id
      )
    GROUP BY COALESCE(p.supplier_id::TEXT, '__NONE__'), NULLIF(p.supplier_id::TEXT, '')
    ORDER BY sup_name ASC
  LOOP
    v_po_id := NULL;
    v_no_po := NULL;
    v_sup_name := v_sup_group.sup_name;

    -- Reuse existing open DRAFT PO for this supplier if available (preferring current month AUTO POs)
    SELECT po.id, po.no_po, COALESCE(po.supplier_name, v_sup_name)
    INTO v_po_id, v_no_po, v_sup_name
    FROM public.purchase_orders po
    WHERE po.status = 'draft'
      AND COALESCE(po.supplier_id::TEXT, '__NONE__') = v_sup_group.sup_key
    ORDER BY
      CASE WHEN po.no_po ~* ('^PO-' || v_month_key || '-AUTO[0-9]+$') THEN 0 ELSE 1 END ASC,
      po.created_at ASC
    LIMIT 1;

    IF v_po_id IS NULL THEN
      -- Gap-filling sequence starting from 001 for current YYYYMM
      v_seq := 1;
      LOOP
        v_no_po := 'PO-' || v_month_key || '-AUTO' || LPAD(v_seq::TEXT, 3, '0');
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.purchase_orders WHERE no_po = v_no_po
        );
        v_seq := v_seq + 1;
      END LOOP;

      IF v_sup_group.raw_sup_id IS NULL THEN
        INSERT INTO public.purchase_orders (
          no_po, tanggal, supplier_id, supplier_name, status, total, catatan, created_by, created_at, updated_at
        )
        VALUES (
          v_no_po, CURRENT_DATE, NULL, v_sup_name, 'draft', 0, 'Restock Otomatis', auth.uid(), now(), now()
        )
        RETURNING id INTO v_po_id;
      ELSIF v_sup_col_type IN ('integer', 'bigint', 'smallint') THEN
        EXECUTE 'INSERT INTO public.purchase_orders (no_po, tanggal, supplier_id, supplier_name, status, total, catatan, created_by, created_at, updated_at) VALUES ($1, CURRENT_DATE, $2::INT, $3, ''draft'', 0, ''Restock Otomatis'', $4, now(), now()) RETURNING id'
        INTO v_po_id
        USING v_no_po, v_sup_group.raw_sup_id, v_sup_name, auth.uid();
      ELSE
        INSERT INTO public.purchase_orders (
          no_po, tanggal, supplier_id, supplier_name, status, total, catatan, created_by, created_at, updated_at
        )
        VALUES (
          v_no_po, CURRENT_DATE, v_sup_group.raw_sup_id::UUID, v_sup_name, 'draft', 0, 'Restock Otomatis', auth.uid(), now(), now()
        )
        RETURNING id INTO v_po_id;
      END IF;

      v_created_count := v_created_count + 1;
    ELSE
      v_updated_count := v_updated_count + 1;
    END IF;

    v_group_total := 0;
    v_group_count := 0;
    v_group_reasons := '[]'::JSONB;

    FOR v_prod IN
      SELECT p.*
      FROM public.products p
      WHERE COALESCE(p.is_active, TRUE) = TRUE
        AND COALESCE(p.stock, 0) <= GREATEST(0, COALESCE(p.min_stock, 0))
        AND COALESCE(p.supplier_id::TEXT, '__NONE__') = v_sup_group.sup_key
        AND NOT EXISTS (
          SELECT 1
          FROM public.purchase_order_items poi
          JOIN public.purchase_orders po ON po.id = poi.po_id
          WHERE po.status IN ('draft', 'dikirim')
            AND poi.product_id = p.id
        )
      ORDER BY p.name ASC
    LOOP
      v_effective_stock := GREATEST(0, COALESCE(v_prod.stock, 0));
      v_min_stock := GREATEST(0, COALESCE(v_prod.min_stock, 0));
      v_target_stock := GREATEST(
        0,
        COALESCE(
          NULLIF(to_jsonb(v_prod)->>'target_stock', '')::NUMERIC,
          NULLIF(to_jsonb(v_prod)->>'max_stock', '')::NUMERIC,
          0
        )
      );

      -- Aggregate clean customer sales (7d / 30d / 90d), excluding Stock Opname, Retur, & reversals
      SELECT
        COALESCE(SUM(CASE WHEN t.created_at >= (now() - INTERVAL '7 days') THEN COALESCE(NULLIF(to_jsonb(t)->>'quantity', '')::NUMERIC, NULLIF(to_jsonb(t)->>'qty', '')::NUMERIC, 0) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.created_at >= (now() - INTERVAL '30 days') THEN COALESCE(NULLIF(to_jsonb(t)->>'quantity', '')::NUMERIC, NULLIF(to_jsonb(t)->>'qty', '')::NUMERIC, 0) ELSE 0 END), 0),
        COALESCE(SUM(COALESCE(NULLIF(to_jsonb(t)->>'quantity', '')::NUMERIC, NULLIF(to_jsonb(t)->>'qty', '')::NUMERIC, 0)), 0)
      INTO v_sold_7d, v_sold_30d, v_sold_90d
      FROM public.transactions t
      WHERE t.product_id = v_prod.id
        AND t.type = 'out'
        AND t.created_at >= (now() - INTERVAL '90 days')
        AND COALESCE(to_jsonb(t)->>'channel', 'Offline') <> 'Retur'
        AND NULLIF(COALESCE(to_jsonb(t)->>'return_id', ''), '') IS NULL
        AND NULLIF(COALESCE(to_jsonb(t)->>'reversal_of_id', ''), '') IS NULL
        AND COALESCE(NULLIF(to_jsonb(t)->>'note', ''), NULLIF(to_jsonb(t)->>'notes', ''), '') NOT ILIKE '%[STOCK OPNAME]%'
        AND NOT EXISTS (
          SELECT 1
          FROM public.transactions rev
          WHERE NULLIF(COALESCE(to_jsonb(rev)->>'reversal_of_id', ''), '') = t.id::TEXT
        );

      v_sold_30d := GREATEST(v_sold_30d, v_sold_7d);
      v_sold_90d := GREATEST(v_sold_90d, v_sold_30d);

      IF v_target_stock > 0 THEN
        v_qty := GREATEST(1, CEIL(v_target_stock - v_effective_stock)::INT);
        v_weighted_ads := 0;
        v_mode := 'explicit_target';
        v_reason := 'Stok: ' || COALESCE(v_prod.stock, 0)::TEXT || ' • Target manual: ' || ROUND(v_target_stock)::TEXT;
      ELSE
        v_ads_7d := v_sold_7d / 7.0;
        v_ads_30d := v_sold_30d / 30.0;
        v_ads_90d := v_sold_90d / 90.0;

        IF v_sold_30d > 0 THEN
          v_ads_7d_capped := LEAST(v_ads_7d, v_ads_30d * 2.5);
          v_weighted_ads := (0.45 * v_ads_7d_capped) + (0.40 * v_ads_30d) + (0.15 * v_ads_90d);
        ELSIF v_sold_90d > 0 THEN
          v_weighted_ads := v_ads_90d * 0.75;
        ELSE
          v_weighted_ads := 0;
        END IF;

        IF v_weighted_ads > 0 THEN
          v_demand_target := GREATEST(1, CEIL(v_weighted_ads * v_coverage_days)::INT);
          v_qty := GREATEST(1, v_demand_target - CEIL(v_effective_stock)::INT);
          v_mode := 'demand_velocity';
          IF v_sold_30d > 0 THEN
            v_reason := 'Stok: ' || COALESCE(v_prod.stock, 0)::TEXT || ' • Terjual 30h: ' || ROUND(v_sold_30d)::TEXT || ' • Saran ' || v_coverage_days::TEXT || 'h';
          ELSE
            v_reason := 'Stok: ' || COALESCE(v_prod.stock, 0)::TEXT || ' • Terjual 90h: ' || ROUND(v_sold_90d)::TEXT || ' • Saran ' || v_coverage_days::TEXT || 'h';
          END IF;
        ELSE
          v_conservative_target := LEAST(GREATEST(1, CEIL(v_min_stock)::INT), 5);
          v_qty := GREATEST(1, v_conservative_target - CEIL(v_effective_stock)::INT);
          v_mode := 'zero_velocity_cap';
          v_reason := 'Stok: ' || COALESCE(v_prod.stock, 0)::TEXT || ' • Belum ada penjualan 90h';
        END IF;
      END IF;

      v_harga := GREATEST(
        0,
        COALESCE(
          NULLIF(to_jsonb(v_prod)->>'cost_price', '')::NUMERIC,
          NULLIF(to_jsonb(v_prod)->>'buy_price', '')::NUMERIC,
          v_prod.price,
          0
        )
      );
      v_subtotal := v_qty * v_harga;

      INSERT INTO public.purchase_order_items (
        po_id, product_id, product_name, qty, harga, subtotal
      )
      VALUES (
        v_po_id, v_prod.id, v_prod.name, v_qty, v_harga, v_subtotal
      );

      v_group_reasons := v_group_reasons || jsonb_build_object(
        'product_id', v_prod.id,
        'product_name', v_prod.name,
        'qty', v_qty,
        'stock', COALESCE(v_prod.stock, 0),
        'sold_7d', v_sold_7d,
        'sold_30d', v_sold_30d,
        'sold_90d', v_sold_90d,
        'weighted_ads', ROUND(v_weighted_ads, 4),
        'coverage_days', v_coverage_days,
        'mode', v_mode,
        'reason', v_reason
      );

      v_group_total := v_group_total + v_subtotal;
      v_group_count := v_group_count + 1;
    END LOOP;

    -- Recalculate accurate PO total from persisted items
    UPDATE public.purchase_orders
    SET total = COALESCE((
          SELECT SUM(subtotal) FROM public.purchase_order_items WHERE po_id = v_po_id
        ), 0),
        updated_at = now()
    WHERE id = v_po_id
    RETURNING total INTO v_group_total;

    IF v_first_id IS NULL THEN
      v_first_id := v_po_id;
      v_first_no_po := v_no_po;
    END IF;

    v_total_items := v_total_items + v_group_count;
    v_total_value := v_total_value + COALESCE(v_group_total, 0);
    v_no_po_list := array_append(v_no_po_list, v_no_po);
    v_all_reasons := v_all_reasons || v_group_reasons;
    v_pos := v_pos || jsonb_build_object(
      'id', v_po_id,
      'no_po', v_no_po,
      'supplier_id', v_sup_group.raw_sup_id,
      'supplier_name', v_sup_name,
      'item_count', v_group_count,
      'total', COALESCE(v_group_total, 0),
      'item_reasons', v_group_reasons
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'created', (v_created_count + v_updated_count) > 0,
    'id', v_first_id,
    'no_po', v_first_no_po,
    'total', v_total_value,
    'item_count', v_total_items,
    'po_count', jsonb_array_length(v_pos),
    'created_count', v_created_count,
    'updated_count', v_updated_count,
    'coverage_days', v_coverage_days,
    'no_po_list', v_no_po_list,
    'item_reasons', v_all_reasons,
    'pos', v_pos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_draft_po_from_low_stock_unchecked(TEXT) FROM PUBLIC, anon, authenticated;

-- Versioned wrapper invoked by the upgraded client after migration is applied
CREATE OR REPLACE FUNCTION public.generate_draft_po_from_low_stock_v2(
  p_supplier_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN public.generate_draft_po_from_low_stock(p_supplier_id);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_draft_po_from_low_stock_v2(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_draft_po_from_low_stock_v2(TEXT) TO authenticated;
