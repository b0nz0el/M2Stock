-- Persist POS receipt discount/tax/total in transaction notes for refresh/reprint compatibility.

CREATE OR REPLACE FUNCTION public.process_pos_checkout(
  p_items JSONB,
  p_common JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_prod_id TEXT;
  v_qty NUMERIC;
  v_price NUMERIC;
  v_cost_price NUMERIC;
  v_note TEXT;
  v_item_note TEXT;
  v_invoice_no TEXT;
  v_current_stock NUMERIC;
  v_prod_name TEXT;
  v_prod_sku TEXT;
  v_tx_id UUID;
  v_created_txs JSONB := '[]'::JSONB;
  v_total_amount NUMERIC := 0;
  v_channel TEXT;
  v_customer_id TEXT;
  v_payment_method TEXT;
  v_payment_status TEXT;
  v_created_by UUID;
  v_idempotency_key TEXT;
  v_discount_amount NUMERIC := 0;
  v_tax_amount NUMERIC := 0;
  v_checkout_total NUMERIC := 0;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Keranjang belanja kasir kosong' USING ERRCODE = '22023';
  END IF;

  v_invoice_no := COALESCE(p_common->>'invoice_no', 'INV-' || to_char(now(), 'YYMMDD') || '-' || floor(random() * 9000 + 1000)::TEXT);
  v_channel := COALESCE(p_common->>'channel', 'Offline');
  v_customer_id := p_common->>'customer_id';
  v_payment_method := COALESCE(p_common->>'payment_method', 'Cash');
  v_payment_status := COALESCE(p_common->>'payment_status', CASE WHEN v_payment_method = 'Tempo' THEN 'Belum Lunas' ELSE 'Lunas' END);
  v_created_by := NULLIF(p_common->>'created_by', '')::UUID;
  v_note := COALESCE(p_common->>'note', '');
  v_idempotency_key := NULLIF(p_common->>'idempotency_key', '');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := v_item->>'product_id';
    v_qty := COALESCE((v_item->>'qty')::NUMERIC, (v_item->>'quantity')::NUMERIC, 0);
    v_price := COALESCE((v_item->>'price')::NUMERIC, (v_item->>'unit_price')::NUMERIC, 0);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Jumlah item tidak valid (harus > 0)' USING ERRCODE = '22023';
    END IF;
    SELECT stock, name, sku, cost_price
    INTO v_current_stock, v_prod_name, v_prod_sku, v_cost_price
    FROM public.products WHERE id::TEXT = v_prod_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan di katalog.', v_prod_id USING ERRCODE = 'P0002';
    END IF;
    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk % (SKU: %). Tersedia: %, Diminta: %',
        v_prod_name, COALESCE(v_prod_sku, '-'), v_current_stock, v_qty USING ERRCODE = '23514';
    END IF;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'qty')::NUMERIC, (v_item->>'quantity')::NUMERIC, 0);
    v_price := COALESCE((v_item->>'price')::NUMERIC, (v_item->>'unit_price')::NUMERIC, 0);
    v_total_amount := v_total_amount + (v_qty * v_price);
  END LOOP;

  v_discount_amount := LEAST(v_total_amount, GREATEST(0, COALESCE((p_common->>'discount_amount')::NUMERIC, 0)));
  v_tax_amount := GREATEST(0, COALESCE((p_common->>'tax_amount')::NUMERIC, 0));
  v_checkout_total := GREATEST(0, v_total_amount - v_discount_amount + v_tax_amount);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := v_item->>'product_id';
    v_qty := COALESCE((v_item->>'qty')::NUMERIC, (v_item->>'quantity')::NUMERIC, 0);
    v_price := COALESCE((v_item->>'price')::NUMERIC, (v_item->>'unit_price')::NUMERIC, 0);
    SELECT cost_price INTO v_cost_price FROM public.products WHERE id::TEXT = v_prod_id;
    v_item_note := ('[' || v_invoice_no || '] ' || COALESCE(v_item->>'note', v_note))::TEXT;
    v_item_note := TRIM(v_item_note || ' |AQ_DISCOUNT=' || v_discount_amount::TEXT || '|AQ_TAX=' || v_tax_amount::TEXT || '|AQ_TOTAL=' || v_checkout_total::TEXT);

    INSERT INTO public.transactions (
      type, product_id, qty, price, cost_price, channel, customer_id,
      payment_method, payment_status, note, created_by, idempotency_key
    ) VALUES (
      'out',
      CASE WHEN v_prod_id ~ '^[0-9]+$' THEN v_prod_id::BIGINT ELSE NULL END,
      v_qty, v_price, COALESCE(v_cost_price, 0), v_channel,
      CASE WHEN v_customer_id ~ '^[0-9]+$' THEN v_customer_id::BIGINT ELSE NULL END,
      v_payment_method, v_payment_status, v_item_note, v_created_by,
      CASE WHEN v_idempotency_key IS NOT NULL THEN v_idempotency_key || '-' || v_prod_id ELSE NULL END
    ) RETURNING id INTO v_tx_id;

    v_created_txs := v_created_txs || jsonb_build_object(
      'id', v_tx_id, 'product_id', v_prod_id, 'qty', v_qty, 'price', v_price, 'cost_price', v_cost_price
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'invoice_no', v_invoice_no, 'total_amount', v_total_amount,
    'checkout_total', v_checkout_total, 'discount_amount', v_discount_amount,
    'tax_amount', v_tax_amount, 'items_count', jsonb_array_length(p_items),
    'transactions', v_created_txs
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
