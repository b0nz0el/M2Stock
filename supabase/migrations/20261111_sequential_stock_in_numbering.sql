-- =========================================================================
-- MIGRASI: SISTEM NOMOR TRANSAKSI BARANG MASUK SEQUENTIAL 4 DIGIT KRONOLOGIS
-- Deskripsi: Menerapkan penomoran berurutan 4 digit kronologis untuk transaksi
--            Barang Masuk (type = 'in'): IN-YYMMDD-0001, 0002, dst.
-- =========================================================================

-- 1. BUAT SEQUENCE DATABASE UNTUK NOMOR URUT BARANG MASUK
-- -------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.stock_in_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- 2. SCRIPT RE-SEQUENCING: RAPIKAN NOMOR TRANSAKSI BARANG MASUK HISTORIS
-- -------------------------------------------------------------------------
DO $$
DECLARE
  v_rec RECORD;
  v_counter BIGINT := 0;
  v_grp_key TEXT;
  v_new_in_no TEXT;
  v_date_str TEXT;
BEGIN
  -- Dapatkan seluruh transaksi barang masuk lama secara unik terurut kronologis
  FOR v_rec IN (
    SELECT 
      grp_key,
      min_created_at
    FROM (
      SELECT 
        CASE 
          WHEN po_id IS NOT NULL THEN 'PO-' || po_id::TEXT
          ELSE COALESCE(
            NULLIF(trim(invoice_no), ''),
            (regexp_match(COALESCE(note, notes, ''), '\[((?:IN)-[^\]]+)\]'))[1],
            id::TEXT
          )
        END AS grp_key,
        MIN(created_at) AS min_created_at
      FROM public.transactions
      WHERE type = 'in'
      GROUP BY 1
    ) sub
    ORDER BY min_created_at ASC, grp_key ASC
  )
  LOOP
    v_counter := v_counter + 1;
    v_grp_key := v_rec.grp_key;
    v_date_str := to_char((v_rec.min_created_at AT TIME ZONE 'Asia/Jakarta')::DATE, 'YYMMDD');
    v_new_in_no := 'IN-' || v_date_str || '-' || lpad(v_counter::TEXT, 4, '0');

    UPDATE public.transactions
    SET 
      invoice_no = v_new_in_no,
      note = CASE 
        WHEN note IS NOT NULL AND note ~ '\[IN-[^\]]+\]' 
          THEN regexp_replace(note, '\[IN-[^\]]+\]', '[' || v_new_in_no || ']')
        WHEN note IS NOT NULL AND trim(note) <> '' 
          THEN '[' || v_new_in_no || '] ' || note
        ELSE '[' || v_new_in_no || ']'
      END,
      notes = CASE 
        WHEN notes IS NOT NULL AND notes ~ '\[IN-[^\]]+\]' 
          THEN regexp_replace(notes, '\[IN-[^\]]+\]', '[' || v_new_in_no || ']')
        WHEN notes IS NOT NULL AND trim(notes) <> '' 
          THEN '[' || v_new_in_no || '] ' || notes
        ELSE '[' || v_new_in_no || ']'
      END
    WHERE 
      type = 'in'
      AND (
        (v_grp_key LIKE 'PO-%' AND po_id::TEXT = substring(v_grp_key from 4))
        OR (invoice_no = v_grp_key)
        OR (note IS NOT NULL AND note LIKE '%[' || v_grp_key || ']%')
        OR (notes IS NOT NULL AND notes LIKE '%[' || v_grp_key || ']%')
        OR (v_grp_key = id::TEXT)
      );
  END LOOP;

  IF v_counter > 0 THEN
    PERFORM setval('public.stock_in_number_seq', v_counter, true);
  ELSE
    PERFORM setval('public.stock_in_number_seq', 1, false);
  END IF;

  RAISE NOTICE 'Selesai merapikan nomor transaksi Barang Masuk lama. Total: %, sequence diset ke: %', v_counter, GREATEST(v_counter, 1);
END $$;

-- 3. HELPER FUNCTION: PREVIEW / AMBIL NOMOR BARANG MASUK BERIKUTNYA
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_next_stock_in_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq BIGINT;
BEGIN
  v_seq := nextval('public.stock_in_number_seq');
  RETURN 'IN-' || to_char((now() AT TIME ZONE 'Asia/Jakarta')::DATE, 'YYMMDD') || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

-- 4. PERBARUI TRIGGER SYNC COLUMNS AGAR MENGISI NOMOR URUT BARANG MASUK
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
  IF NEW.invoice_no IS NULL OR trim(NEW.invoice_no) = '' THEN
    NEW.invoice_no := (regexp_match(COALESCE(NEW.note, NEW.notes, ''), '\[((?:INV|IN|SPX|TKP)-[^\]]+)\]'))[1];
  END IF;

  -- Auto assign sequential number for 'in' transactions if still missing
  IF NEW.type = 'in' AND (NEW.invoice_no IS NULL OR trim(NEW.invoice_no) = '') THEN
    NEW.invoice_no := 'IN-' || to_char((COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta')::DATE, 'YYMMDD') || '-' || lpad(nextval('public.stock_in_number_seq')::TEXT, 4, '0');
    IF NEW.note IS NULL OR trim(NEW.note) = '' THEN
      NEW.note := '[' || NEW.invoice_no || ']';
    ELSIF NEW.note NOT LIKE '%[' || NEW.invoice_no || ']%' THEN
      NEW.note := '[' || NEW.invoice_no || '] ' || NEW.note;
    END IF;
    NEW.notes := NEW.note;
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

-- 5. PERBARUI RPC: receive_purchase_order MENGALOKASIKAN NOMOR IN- DARI SEQUENCE
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_po_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_po RECORD;
  v_item RECORD;
  v_in_seq BIGINT;
  v_in_no TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna harus login' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
  IF UPPER(COALESCE(v_user_role, '')) NOT IN ('OWNER', 'STAFF') THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya OWNER atau STAFF yang berhak menerima PO' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id::UUID FOR UPDATE;
  IF v_po.id IS NULL THEN
    RAISE EXCEPTION 'Purchase Order tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  IF v_po.status = 'diterima' THEN
    RAISE EXCEPTION 'PO % sudah pernah diterima sebelumnya', v_po.no_po;
  END IF;

  -- Alokasikan satu nomor transaksi IN- untuk seluruh item dalam PO ini
  v_in_seq := nextval('public.stock_in_number_seq');
  v_in_no := 'IN-' || to_char((now() AT TIME ZONE 'Asia/Jakarta')::DATE, 'YYMMDD') || '-' || lpad(v_in_seq::TEXT, 4, '0');

  FOR v_item IN SELECT * FROM public.purchase_order_items WHERE po_id = v_po.id
  LOOP
    INSERT INTO public.transactions (
      product_id, type, quantity, qty, unit_price, price, total_price, cost_price,
      supplier_id, channel, reference_no, po_id, invoice_no, notes, note, user_id, created_by
    ) VALUES (
      v_item.product_id, 'in', v_item.qty, v_item.qty, v_item.harga, v_item.harga, v_item.subtotal, v_item.harga,
      v_po.supplier_id, 'PO', v_po.no_po, v_po.id, v_in_no,
      '[' || v_in_no || '] Penerimaan PO ' || v_po.no_po, '[' || v_in_no || '] Penerimaan PO ' || v_po.no_po, v_user_id, v_user_id
    );
  END LOOP;

  UPDATE public.purchase_orders SET status = 'diterima', updated_at = now() WHERE id = v_po.id;

  RETURN jsonb_build_object('success', true, 'po_id', v_po.id, 'status', 'diterima', 'invoice_no', v_in_no);
END;
$$;

-- 6. RELOAD SCHEMA CACHE
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
