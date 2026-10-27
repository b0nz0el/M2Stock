-- ═══════════════════════════════════════════════════════════════════════════
-- Aquastock Pro — Migration: ERP/WMS Inventory Hardening & Atomic Ledger
-- File: supabase/migrations/20261028_erp_wms_inventory_hardening.sql
-- Standar: IAS 2 / PSAK Inventori, Strict-Ledger Control, ACID Database Transactions
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. ENHANCE TRANSACTIONS SCHEMA (HISTORICAL COSTING & AUDIT TRAIL)
-- -------------------------------------------------------------------------
-- cost_price: Snapshot HPP saat transaksi terjadi (IAS 2: Historical Costing)
-- idempotency_key: Mencegah transaksi tercatat ganda akibat retry / double click
-- reversal_of_id: Menunjuk ID transaksi asal jika transaksi ini adalah pembatalan/reversal
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS reversal_of_id TEXT;

-- Buat index unik kondisional untuk idempotency_key (hanya untuk yang tidak null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'transactions' AND indexname = 'idx_transactions_idempotency'
  ) THEN
    CREATE UNIQUE INDEX idx_transactions_idempotency 
    ON public.transactions (idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
  END IF;
END $$;

-- 2. ATOMIC POS CHECKOUT RPC (PENJUALAN KASIR MULTI-ITEM ATOMIK)
-- -------------------------------------------------------------------------
-- Menjalankan seluruh proses checkout kasir dalam satu transaksi database tunggal.
-- Jika stok salah satu barang kurang, atau terjadi error, seluruh transaksi BATAL total (ROLLBACK).
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

  -- Cek Idempotensi: Jika invoice_no / idempotency_key sudah pernah diposting
  IF v_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = v_idempotency_key) THEN
      RAISE EXCEPTION 'Transaksi dengan kunci idempoten ini sudah pernah diproses.' USING ERRCODE = '23505';
    END IF;
  END IF;

  -- STEP 1: VALIDASI KETERSEDIAAN STOK SEMUA BARANG DENGAN KUNCIAN FOR UPDATE
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := v_item->>'product_id';
    v_qty := COALESCE((v_item->>'qty')::NUMERIC, (v_item->>'quantity')::NUMERIC, 0);

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Jumlah item tidak valid (harus > 0)' USING ERRCODE = '22023';
    END IF;

    -- Kunci baris produk untuk mencegah race condition konkuren
    SELECT stock, name, sku, cost_price 
    INTO v_current_stock, v_prod_name, v_prod_sku, v_cost_price
    FROM public.products
    WHERE id::TEXT = v_prod_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan di katalog.', v_prod_id USING ERRCODE = 'P0002';
    END IF;

    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk % (SKU: %). Tersedia: %, Diminta: %',
        v_prod_name, COALESCE(v_prod_sku, '-'), v_current_stock, v_qty
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  -- STEP 2: POSTING SELURUH BARIS TRANSAKSI & SNAPSHOT HPP
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := v_item->>'product_id';
    v_qty := COALESCE((v_item->>'qty')::NUMERIC, (v_item->>'quantity')::NUMERIC, 0);
    v_price := COALESCE((v_item->>'price')::NUMERIC, (v_item->>'unit_price')::NUMERIC, 0);

    SELECT cost_price INTO v_cost_price
    FROM public.products
    WHERE id::TEXT = v_prod_id;

    v_item_note := ('[' || v_invoice_no || '] ' || COALESCE(v_item->>'note', v_note))::TEXT;
    v_total_amount := v_total_amount + (v_qty * v_price);

    -- Simpan entri transaksi (trigger trg_transaction_stock_update akan otomatis memotong produk)
    INSERT INTO public.transactions (
      type,
      product_id,
      qty,
      price,
      cost_price,
      channel,
      customer_id,
      payment_method,
      payment_status,
      note,
      created_by,
      idempotency_key
    ) VALUES (
      'out',
      CASE WHEN v_prod_id ~ '^[0-9]+$' THEN v_prod_id::BIGINT ELSE NULL END, -- Dukung schema lama jika integer
      v_qty,
      v_price,
      COALESCE(v_cost_price, 0),
      v_channel,
      CASE WHEN v_customer_id ~ '^[0-9]+$' THEN v_customer_id::BIGINT ELSE NULL END,
      v_payment_method,
      v_payment_status,
      TRIM(v_item_note),
      v_created_by,
      CASE WHEN v_idempotency_key IS NOT NULL THEN v_idempotency_key || '-' || v_prod_id ELSE NULL END
    ) RETURNING id INTO v_tx_id;

    v_created_txs := v_created_txs || jsonb_build_object(
      'id', v_tx_id,
      'product_id', v_prod_id,
      'qty', v_qty,
      'price', v_price,
      'cost_price', v_cost_price
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'invoice_no', v_invoice_no,
    'total_amount', v_total_amount,
    'items_count', jsonb_array_length(p_items),
    'transactions', v_created_txs
  );
END;
$$;

-- 3. ATOMIC STOCK OPNAME RPC (STRICT LEDGER KOREKSI STOK)
-- -------------------------------------------------------------------------
-- Memastikan tidak ada perubahan saldo stok tanpa mutasi transaksi ledger.
CREATE OR REPLACE FUNCTION public.perform_stock_opname(
  p_product_id TEXT,
  p_actual_stock NUMERIC,
  p_reason TEXT DEFAULT 'Stock Opname Fisik',
  p_notes TEXT DEFAULT '',
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod RECORD;
  v_diff NUMERIC;
  v_note_text TEXT;
  v_tx_type TEXT;
  v_tx_id UUID;
BEGIN
  IF p_actual_stock < 0 THEN
    RAISE EXCEPTION 'Stok fisik tidak boleh bernilai negatif.' USING ERRCODE = '22023';
  END IF;

  -- Kunci baris produk
  SELECT id, name, sku, stock, cost_price 
  INTO v_prod
  FROM public.products
  WHERE id::TEXT = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produk tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;

  v_diff := p_actual_stock - COALESCE(v_prod.stock, 0);

  IF v_diff = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'message', 'Stok sudah sesuai, tidak ada penyesuaian yang diperlukan.',
      'product', row_to_json(v_prod)
    );
  END IF;

  v_note_text := '[STOCK OPNAME] ' || COALESCE(p_reason, 'Koreksi Stok') ||
                 CASE WHEN p_notes IS NOT NULL AND p_notes <> '' THEN ' - ' || p_notes ELSE '' END ||
                 ' (Selisih ' || CASE WHEN v_diff > 0 THEN '+' ELSE '' END || v_diff::TEXT || ')';

  v_tx_type := CASE WHEN v_diff > 0 THEN 'in' ELSE 'out' END;

  -- Rekam transaksi mutasi koreksi di buku besar (ledger)
  INSERT INTO public.transactions (
    type,
    product_id,
    qty,
    price,
    cost_price,
    channel,
    note,
    created_by
  ) VALUES (
    v_tx_type,
    CASE WHEN p_product_id ~ '^[0-9]+$' THEN p_product_id::BIGINT ELSE NULL END,
    ABS(v_diff),
    COALESCE(v_prod.cost_price, 0),
    COALESCE(v_prod.cost_price, 0),
    'Offline',
    v_note_text,
    p_user_id
  ) RETURNING id INTO v_tx_id;

  -- Update stock produk
  UPDATE public.products
  SET stock = p_actual_stock,
      updated_at = now()
  WHERE id::TEXT = p_product_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Stok berhasil disesuaikan secara akuntabel.',
    'diff', v_diff,
    'transaction_id', v_tx_id,
    'final_stock', p_actual_stock
  );
END;
$$;

-- 4. ATOMIC NEW PRODUCT + INITIAL RECEIPT RPC
-- -------------------------------------------------------------------------
-- Mendaftarkan produk baru dan langsung menerbitkan transaksi penerimaan awal
-- secara atomik. Jika salah satu gagal, seluruh operasi dibatalkan.
CREATE OR REPLACE FUNCTION public.create_product_with_initial_in(
  p_product JSONB,
  p_initial_in JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod_id TEXT;
  v_initial_qty NUMERIC;
  v_unit_price NUMERIC;
  v_cost_price NUMERIC;
  v_created_prod RECORD;
  v_tx_id UUID;
BEGIN
  v_initial_qty := COALESCE((p_initial_in->>'qty')::NUMERIC, 0);
  v_unit_price := COALESCE((p_initial_in->>'price')::NUMERIC, (p_product->>'cost_price')::NUMERIC, 0);

  -- 1. Buat produk dengan stock = 0
  INSERT INTO public.products (
    sku,
    barcode,
    name,
    brand,
    category_id,
    unit_id,
    cost_price,
    sell_price,
    stock,
    min_stock,
    image_url,
    images
  ) VALUES (
    NULLIF(p_product->>'sku', ''),
    NULLIF(p_product->>'barcode', ''),
    p_product->>'name',
    COALESCE(NULLIF(p_product->>'brand', ''), '-'),
    (p_product->>'category_id')::BIGINT,
    COALESCE((p_product->>'unit_id')::BIGINT, 1),
    v_unit_price,
    COALESCE((p_product->>'sell_price')::NUMERIC, 0),
    0, -- Selalu 0 di awal sebelum transaksi posting
    COALESCE((p_product->>'min_stock')::INTEGER, 3),
    NULLIF(p_product->>'image_url', ''),
    p_product->'images'
  ) RETURNING * INTO v_created_prod;

  v_prod_id := v_created_prod.id::TEXT;

  -- 2. Jika ada kuantitas masuk awal, posting transaksi penerimaan
  IF v_initial_qty > 0 THEN
    INSERT INTO public.transactions (
      type,
      product_id,
      supplier_id,
      qty,
      price,
      cost_price,
      channel,
      note,
      created_by
    ) VALUES (
      'in',
      CASE WHEN v_prod_id ~ '^[0-9]+$' THEN v_prod_id::BIGINT ELSE NULL END,
      (p_initial_in->>'supplier_id')::BIGINT,
      v_initial_qty,
      v_unit_price,
      v_unit_price,
      'Offline',
      COALESCE(p_initial_in->>'note', 'Penerimaan Awal Produk Baru'),
      NULLIF(p_initial_in->>'created_by', '')::UUID
    ) RETURNING id INTO v_tx_id;

    -- Update stock produk (jika trigger belum aktif)
    UPDATE public.products
    SET stock = v_initial_qty, updated_at = now()
    WHERE id = v_created_prod.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'product', row_to_json(v_created_prod),
    'transaction_id', v_tx_id,
    'stock', v_initial_qty
  );
END;
$$;
