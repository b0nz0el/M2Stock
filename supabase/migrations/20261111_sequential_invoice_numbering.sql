-- =========================================================================
-- MIGRASI: SISTEM NOMOR TRANSAKSI / INVOICE SEQUENTIAL 4 DIGIT KRONOLOGIS
-- Deskripsi: Mengganti nomor acak dengan nomor urut (sequential) 4 digit
--            berkesinambungan secara kronologis: INV-YYMMDD-0001, 0002, dst.
-- =========================================================================

-- 1. BUAT SEQUENCE DATABASE UNTUK NOMOR URUT INVOICE
-- -------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- 2. SCRIPT RE-SEQUENCING: RAPAIKAN NOMOR TRANSAKSI LAMA SECARA KRONOLOGIS
-- -------------------------------------------------------------------------
DO $$
DECLARE
  v_rec RECORD;
  v_counter BIGINT := 0;
  v_old_inv TEXT;
  v_new_inv TEXT;
  v_date_str TEXT;
BEGIN
  -- Dapatkan seluruh invoice POS lama (INV-) secara unik dan terurut dari terlama ke terbaru
  FOR v_rec IN (
    SELECT 
      grp_key,
      min_created_at
    FROM (
      SELECT 
        COALESCE(
          NULLIF(trim(invoice_no), ''),
          (regexp_match(COALESCE(note, notes, ''), '\[((?:INV)-[^\]]+)\]'))[1],
          id::TEXT
        ) AS grp_key,
        MIN(created_at) AS min_created_at
      FROM public.transactions
      WHERE 
        type = 'out'
        AND (
          invoice_no ILIKE 'INV-%'
          OR note ~* '\[INV-[^\]]+\]'
          OR notes ~* '\[INV-[^\]]+\]'
        )
      GROUP BY 1
    ) sub
    ORDER BY min_created_at ASC, grp_key ASC
  )
  LOOP
    v_counter := v_counter + 1;
    v_old_inv := v_rec.grp_key;
    v_date_str := to_char((v_rec.min_created_at AT TIME ZONE 'Asia/Jakarta')::DATE, 'YYMMDD');
    v_new_inv := 'INV-' || v_date_str || '-' || lpad(v_counter::TEXT, 4, '0');

    -- Update seluruh baris transaksi (multi-item dalam 1 invoice) ke nomor urut baru
    UPDATE public.transactions
    SET 
      invoice_no = v_new_inv,
      note = CASE 
        WHEN note IS NOT NULL AND v_old_inv <> id::TEXT AND note LIKE '%' || v_old_inv || '%' 
          THEN replace(note, v_old_inv, v_new_inv)
        WHEN note IS NOT NULL AND note ~ '\[INV-[^\]]+\]' 
          THEN regexp_replace(note, '\[INV-[^\]]+\]', '[' || v_new_inv || ']')
        WHEN note IS NOT NULL AND trim(note) <> '' 
          THEN '[' || v_new_inv || '] ' || note
        ELSE '[' || v_new_inv || ']'
      END,
      notes = CASE 
        WHEN notes IS NOT NULL AND v_old_inv <> id::TEXT AND notes LIKE '%' || v_old_inv || '%' 
          THEN replace(notes, v_old_inv, v_new_inv)
        WHEN notes IS NOT NULL AND notes ~ '\[INV-[^\]]+\]' 
          THEN regexp_replace(notes, '\[INV-[^\]]+\]', '[' || v_new_inv || ']')
        WHEN notes IS NOT NULL AND trim(notes) <> '' 
          THEN '[' || v_new_inv || '] ' || notes
        ELSE '[' || v_new_inv || ']'
      END
    WHERE 
      type = 'out'
      AND (
        invoice_no = v_old_inv
        OR (note IS NOT NULL AND note LIKE '%[' || v_old_inv || ']%')
        OR (notes IS NOT NULL AND notes LIKE '%[' || v_old_inv || ']%')
        OR (v_old_inv = id::TEXT AND id::TEXT = v_rec.grp_key)
      );
  END LOOP;

  -- Sinkronkan sequence PostgreSQL dengan nomor terakhir data historis
  IF v_counter > 0 THEN
    PERFORM setval('public.invoice_number_seq', v_counter, true);
  ELSE
    PERFORM setval('public.invoice_number_seq', 1, false);
  END IF;

  RAISE NOTICE 'Selesai merapikan nomor invoice kasir historis. Total invoice: %, sequence diset ke: %', v_counter, GREATEST(v_counter, 1);
END $$;

-- 3. HELPER FUNCTION: PREVIEW / AMBIL NOMOR INVOICE BERIKUTNYA
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_next_invoice_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq BIGINT;
BEGIN
  v_seq := nextval('public.invoice_number_seq');
  RETURN 'INV-' || to_char((now() AT TIME ZONE 'Asia/Jakarta')::DATE, 'YYMMDD') || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

-- 4. PERBARUI RPC: process_pos_checkout MENGGUNAKAN SEQUENCE OTOMATIS
-- -------------------------------------------------------------------------
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
  v_seq BIGINT;
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

  -- Alokasi nomor invoice: jika tidak dikirim dari klien, ambil dari sequence secara atomik
  v_invoice_no := NULLIF(trim(p_common->>'invoice_no'), '');
  IF v_invoice_no IS NULL THEN
    v_seq := nextval('public.invoice_number_seq');
    v_invoice_no := 'INV-' || to_char((now() AT TIME ZONE 'Asia/Jakarta')::DATE, 'YYMMDD') || '-' || lpad(v_seq::TEXT, 4, '0');
  END IF;

  v_channel := COALESCE(p_common->>'channel', 'Offline');
  v_customer_id := p_common->>'customer_id';
  v_payment_method := COALESCE(p_common->>'payment_method', 'Cash');
  v_payment_status := COALESCE(p_common->>'payment_status', CASE WHEN v_payment_method = 'Tempo' THEN 'Belum Lunas' ELSE 'Lunas' END);
  v_created_by := NULLIF(p_common->>'created_by', '')::UUID;
  v_note := COALESCE(p_common->>'note', '');
  v_idempotency_key := NULLIF(p_common->>'idempotency_key', '');

  -- Cek Idempotensi
  IF v_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = v_idempotency_key) THEN
      RAISE EXCEPTION 'Transaksi dengan kunci idempoten ini sudah pernah diproses.' USING ERRCODE = '23505';
    END IF;
  END IF;

  -- Kunci baris produk & validasi stok
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

  -- Hitung subtotal kotor
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'qty')::NUMERIC, (v_item->>'quantity')::NUMERIC, 0);
    v_price := COALESCE((v_item->>'price')::NUMERIC, (v_item->>'unit_price')::NUMERIC, 0);
    v_total_amount := v_total_amount + (v_qty * v_price);
  END LOOP;

  v_discount_amount := LEAST(v_total_amount, GREATEST(0, COALESCE((p_common->>'discount_amount')::NUMERIC, 0)));
  v_tax_amount := GREATEST(0, COALESCE((p_common->>'tax_amount')::NUMERIC, 0));
  v_checkout_total := GREATEST(0, v_total_amount - v_discount_amount + v_tax_amount);

  -- Insert masing-masing item transaksi kasir dengan kolom native terstruktur
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
      payment_method, payment_status, note, created_by, idempotency_key,
      invoice_no, discount_amount, tax_amount, subtotal_amount, final_total
    ) VALUES (
      'out',
      CASE 
        WHEN v_prod_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN v_prod_id::UUID 
        ELSE (SELECT id FROM public.products WHERE id::TEXT = v_prod_id LIMIT 1) 
      END,
      v_qty, v_price, COALESCE(v_cost_price, 0), v_channel,
      CASE 
        WHEN v_customer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN v_customer_id::UUID 
        ELSE NULL 
      END,
      v_payment_method, v_payment_status, v_item_note, v_created_by,
      CASE WHEN v_idempotency_key IS NOT NULL THEN v_idempotency_key || '-' || v_prod_id ELSE NULL END,
      v_invoice_no, v_discount_amount, v_tax_amount, v_total_amount, v_checkout_total
    ) RETURNING id INTO v_tx_id;

    v_created_txs := v_created_txs || jsonb_build_object(
      'id', v_tx_id,
      'product_id', v_prod_id,
      'qty', v_qty,
      'price', v_price,
      'cost_price', v_cost_price,
      'invoice_no', v_invoice_no,
      'discount_amount', v_discount_amount,
      'tax_amount', v_tax_amount,
      'final_total', v_checkout_total
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'invoice_no', v_invoice_no,
    'total_amount', v_checkout_total,
    'subtotal_amount', v_total_amount,
    'discount_amount', v_discount_amount,
    'tax_amount', v_tax_amount,
    'items_count', jsonb_array_length(p_items),
    'transactions', v_created_txs
  );
END;
$$;

-- 5. PERBARUI TRIGGER SYNC COLUMNS AGAR MENJAGA KONSISTENSI INVOICE_NO
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_transaction_columns()
RETURNS trigger AS $$
BEGIN
  -- Sync quantity & qty
  IF NEW.quantity IS NOT NULL AND NEW.qty IS NULL THEN
    NEW.qty := NEW.quantity;
  ELSIF NEW.qty IS NOT NULL AND NEW.quantity IS NULL THEN
    NEW.quantity := NEW.qty;
  END IF;

  -- Sync unit_price & price
  IF NEW.unit_price IS NOT NULL AND NEW.price IS NULL THEN
    NEW.price := NEW.unit_price;
  ELSIF NEW.price IS NOT NULL AND NEW.unit_price IS NULL THEN
    NEW.unit_price := NEW.price;
  END IF;

  -- Calculate total_price if missing
  NEW.total_price := COALESCE(NEW.total_price, COALESCE(NEW.qty, NEW.quantity, 0) * COALESCE(NEW.price, NEW.unit_price, 0), 0);

  -- Sync subtotal_amount
  NEW.subtotal_amount := COALESCE(NEW.subtotal_amount, NEW.total_price);

  -- Sync notes & note
  IF NEW.notes IS NOT NULL AND NEW.note IS NULL THEN
    NEW.note := NEW.notes;
  ELSIF NEW.note IS NOT NULL AND NEW.notes IS NULL THEN
    NEW.notes := NEW.note;
  END IF;

  -- Sync user_id & created_by
  IF NEW.user_id IS NOT NULL AND NEW.created_by IS NULL THEN
    NEW.created_by := NEW.user_id;
  ELSIF NEW.created_by IS NOT NULL AND NEW.user_id IS NULL THEN
    NEW.user_id := NEW.created_by;
  END IF;

  -- Auto extract invoice_no from notes if missing
  IF NEW.invoice_no IS NULL THEN
    NEW.invoice_no := (regexp_match(COALESCE(NEW.note, NEW.notes, ''), '\[((?:INV|SPX|TKP)-[^\]]+)\]'))[1];
  END IF;

  -- Auto extract discount_amount and tax_amount from note tags if missing
  IF (NEW.discount_amount IS NULL OR NEW.discount_amount = 0) AND COALESCE(NEW.note, NEW.notes, '') LIKE '%|AQ_DISCOUNT=%' THEN
    NEW.discount_amount := COALESCE(NULLIF((regexp_match(COALESCE(NEW.note, NEW.notes, ''), '\|AQ_DISCOUNT=([0-9.]+)'))[1], '')::NUMERIC, 0);
  END IF;

  IF (NEW.tax_amount IS NULL OR NEW.tax_amount = 0) AND COALESCE(NEW.note, NEW.notes, '') LIKE '%|AQ_TAX=%' THEN
    NEW.tax_amount := COALESCE(NULLIF((regexp_match(COALESCE(NEW.note, NEW.notes, ''), '\|AQ_TAX=([0-9.]+)'))[1], '')::NUMERIC, 0);
  END IF;

  IF (NEW.final_total IS NULL OR NEW.final_total = 0) THEN
    IF COALESCE(NEW.note, NEW.notes, '') LIKE '%|AQ_TOTAL=%' THEN
      NEW.final_total := COALESCE(NULLIF((regexp_match(COALESCE(NEW.note, NEW.notes, ''), '\|AQ_TOTAL=([0-9.]+)'))[1], '')::NUMERIC, NEW.total_price);
    ELSE
      NEW.final_total := COALESCE(NEW.total_price, 0);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. RELOAD SCHEMA CACHE
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
