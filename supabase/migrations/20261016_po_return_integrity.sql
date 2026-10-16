-- =========================================================
-- aQuaStock Pro — Migration: PO & Return Workflows, Stock Safety, and Low Stock Auto-PO
-- File: supabase/migrations/20261016_po_return_integrity.sql
-- =========================================================

-- 1. ENHANCE TABLES: FOREIGN KEYS & SNAPSHOT COLUMNS
-- ---------------------------------------------------------

-- 1.1 Tabel purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 1.2 Tabel purchase_order_items
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS product_name TEXT;

-- 1.3 Tabel returns: Snapshot & Kolom Harga
ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS harga_satuan NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS snapshot_product_name TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_entity_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 1.4 Dynamic Type Alignment & Foreign Keys
-- Menangani tipe integer/bigint vs uuid pada master products, suppliers, dan customers
DO $$
DECLARE
  v_sup_type TEXT;
  v_cust_type TEXT;
  v_prod_type TEXT;
BEGIN
  -- Dapatkan tipe data aktual kolom id dari master suppliers, customers, dan products
  SELECT data_type INTO v_sup_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'id';

  SELECT data_type INTO v_cust_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'id';

  SELECT data_type INTO v_prod_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'id';

  -- A. Sesuaikan kolom supplier_id pada purchase_orders
  IF v_sup_type IN ('integer', 'bigint', 'smallint') THEN
    ALTER TABLE public.purchase_orders ALTER COLUMN supplier_id DROP DEFAULT;
    EXECUTE 'ALTER TABLE public.purchase_orders ALTER COLUMN supplier_id TYPE ' || v_sup_type ||
            ' USING (CASE WHEN supplier_id::text ~ ''^[0-9]+$'' THEN (supplier_id::text)::' || v_sup_type || ' ELSE NULL END)';
  ELSIF v_sup_type = 'uuid' THEN
    EXECUTE 'ALTER TABLE public.purchase_orders ALTER COLUMN supplier_id TYPE uuid USING (CASE WHEN supplier_id::text ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'' THEN (supplier_id::text)::uuid ELSE NULL END)';
  END IF;

  -- Tambahkan Foreign Key fk_po_supplier
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_po_supplier'
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT fk_po_supplier
      FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id)
      ON DELETE SET NULL;
  END IF;

  -- B. Sesuaikan kolom product_id pada purchase_order_items
  IF v_prod_type IN ('integer', 'bigint', 'smallint') THEN
    ALTER TABLE public.purchase_order_items ALTER COLUMN product_id DROP DEFAULT;
    EXECUTE 'ALTER TABLE public.purchase_order_items ALTER COLUMN product_id TYPE ' || v_prod_type ||
            ' USING (CASE WHEN product_id::text ~ ''^[0-9]+$'' THEN (product_id::text)::' || v_prod_type || ' ELSE NULL END)';
  ELSIF v_prod_type = 'uuid' THEN
    EXECUTE 'ALTER TABLE public.purchase_order_items ALTER COLUMN product_id TYPE uuid USING (CASE WHEN product_id::text ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'' THEN (product_id::text)::uuid ELSE NULL END)';
  END IF;

  -- Tambahkan Foreign Key fk_poi_product
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_poi_product'
  ) THEN
    ALTER TABLE public.purchase_order_items
      ADD CONSTRAINT fk_poi_product
      FOREIGN KEY (product_id) REFERENCES public.products(id)
      ON DELETE RESTRICT;
  END IF;

  -- C. Kolom supplier_id & FK pada returns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'returns' AND column_name = 'supplier_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.returns ADD COLUMN supplier_id ' || COALESCE(v_sup_type, 'integer');
  ELSE
    IF v_sup_type IN ('integer', 'bigint', 'smallint') THEN
      ALTER TABLE public.returns ALTER COLUMN supplier_id DROP DEFAULT;
      EXECUTE 'ALTER TABLE public.returns ALTER COLUMN supplier_id TYPE ' || v_sup_type ||
              ' USING (CASE WHEN supplier_id::text ~ ''^[0-9]+$'' THEN (supplier_id::text)::' || v_sup_type || ' ELSE NULL END)';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_returns_supplier'
  ) THEN
    ALTER TABLE public.returns
      ADD CONSTRAINT fk_returns_supplier
      FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id)
      ON DELETE SET NULL;
  END IF;

  -- D. Kolom customer_id & FK pada returns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'returns' AND column_name = 'customer_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.returns ADD COLUMN customer_id ' || COALESCE(v_cust_type, 'integer');
  ELSE
    IF v_cust_type IN ('integer', 'bigint', 'smallint') THEN
      ALTER TABLE public.returns ALTER COLUMN customer_id DROP DEFAULT;
      EXECUTE 'ALTER TABLE public.returns ALTER COLUMN customer_id TYPE ' || v_cust_type ||
              ' USING (CASE WHEN customer_id::text ~ ''^[0-9]+$'' THEN (customer_id::text)::' || v_cust_type || ' ELSE NULL END)';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_returns_customer'
  ) THEN
    ALTER TABLE public.returns
      ADD CONSTRAINT fk_returns_customer
      FOREIGN KEY (customer_id) REFERENCES public.customers(id)
      ON DELETE SET NULL;
  END IF;

  -- E. Sesuaikan produk_id & FK pada returns (produk_id -> products.id)
  IF v_prod_type IN ('integer', 'bigint', 'smallint') THEN
    ALTER TABLE public.returns ALTER COLUMN produk_id DROP DEFAULT;
    EXECUTE 'ALTER TABLE public.returns ALTER COLUMN produk_id TYPE ' || v_prod_type ||
            ' USING (CASE WHEN produk_id::text ~ ''^[0-9]+$'' THEN (produk_id::text)::' || v_prod_type || ' ELSE NULL END)';
  ELSIF v_prod_type = 'uuid' THEN
    EXECUTE 'ALTER TABLE public.returns ALTER COLUMN produk_id TYPE uuid USING (CASE WHEN produk_id::text ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'' THEN (produk_id::text)::uuid ELSE NULL END)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_returns_product'
  ) THEN
    ALTER TABLE public.returns
      ADD CONSTRAINT fk_returns_product
      FOREIGN KEY (produk_id) REFERENCES public.products(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 1.5 Tabel transactions: Link ke PO & Return untuk Idempotensi
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS po_id UUID,
  ADD COLUMN IF NOT EXISTS return_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_transactions_po'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT fk_transactions_po
      FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_transactions_return'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT fk_transactions_return
      FOREIGN KEY (return_id) REFERENCES public.returns(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Idempotency Unique Partial Indexes: mencegah duplikasi mutasi stok jika request terulang
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_po_product
  ON public.transactions(po_id, product_id)
  WHERE po_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_return
  ON public.transactions(return_id)
  WHERE return_id IS NOT NULL;


-- 2. HARDEN AUDIT LOGS RLS
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR user_id IS NULL
  );

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
  v_log_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, action, target, ip, created_at)
  VALUES (v_user_id, v_user_email, p_action, p_target, p_ip, now())
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;


-- 3. STORED PROCEDURES / RPC TRANSAKSI ATOMIK
-- ---------------------------------------------------------

-- 3.1 Pembuatan PO Atomik (Header + Rincian Item dalam 1 Transaksi)
CREATE OR REPLACE FUNCTION public.create_purchase_order_atomic(
  p_no_po TEXT,
  p_tanggal DATE,
  p_supplier_id TEXT,
  p_supplier_name TEXT,
  p_status TEXT,
  p_catatan TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_po_id UUID;
  v_sup_id INT;
  v_sup_name TEXT;
  v_grand_total NUMERIC := 0;
  v_item JSONB;
  v_prod_id INT;
  v_prod_name TEXT;
  v_qty INT;
  v_harga NUMERIC;
  v_subtotal NUMERIC;
  v_inserted_items INT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF UPPER(COALESCE(v_user_role, '')) NOT IN ('OWNER', 'STAFF') THEN
      RAISE EXCEPTION 'Akses ditolak: Hanya OWNER atau STAFF yang dapat membuat Purchase Order'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Purchase Order harus memiliki minimal 1 rincian item barang'
      USING ERRCODE = '23514';
  END IF;

  -- Konversi ID supplier jika berupa angka
  IF p_supplier_id IS NOT NULL AND TRIM(p_supplier_id) ~ '^[0-9]+$' THEN
    v_sup_id := TRIM(p_supplier_id)::INT;
  ELSE
    v_sup_id := NULL;
  END IF;

  -- Snapshot nama supplier jika belum diberikan
  v_sup_name := TRIM(COALESCE(p_supplier_name, ''));
  IF v_sup_name = '' AND v_sup_id IS NOT NULL THEN
    SELECT name INTO v_sup_name FROM public.suppliers WHERE id = v_sup_id;
  END IF;

  -- Hitung total dari seluruh item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, 1));
    v_harga := GREATEST(0, COALESCE((v_item->>'harga')::NUMERIC, 0));
    v_grand_total := v_grand_total + (v_qty * v_harga);
  END LOOP;

  -- Simpan header purchase_orders
  INSERT INTO public.purchase_orders (
    no_po, tanggal, supplier_id, supplier_name, status, total, catatan, created_by, created_at, updated_at
  ) VALUES (
    TRIM(p_no_po),
    COALESCE(p_tanggal, CURRENT_DATE),
    v_sup_id,
    v_sup_name,
    COALESCE(p_status, 'draft'),
    v_grand_total,
    TRIM(p_catatan),
    v_user_id,
    now(),
    now()
  )
  RETURNING id INTO v_po_id;

  -- Simpan setiap baris rincian purchase_order_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'product_id') IS NOT NULL AND TRIM(v_item->>'product_id') ~ '^[0-9]+$' THEN
      v_prod_id := TRIM(v_item->>'product_id')::INT;
    ELSE
      v_prod_id := NULL;
    END IF;

    v_prod_name := TRIM(COALESCE(v_item->>'product_name', v_item->>'product_nama', ''));
    IF v_prod_name = '' AND v_prod_id IS NOT NULL THEN
      SELECT name INTO v_prod_name FROM public.products WHERE id = v_prod_id;
    END IF;

    v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, 1));
    v_harga := GREATEST(0, COALESCE((v_item->>'harga')::NUMERIC, 0));
    v_subtotal := v_qty * v_harga;

    INSERT INTO public.purchase_order_items (
      po_id, product_id, product_name, qty, harga, subtotal, created_at
    ) VALUES (
      v_po_id, v_prod_id, v_prod_name, v_qty, v_harga, v_subtotal, now()
    );

    v_inserted_items := v_inserted_items + 1;
  END LOOP;

  PERFORM public.log_audit_event('CREATE', 'Purchase Order ' || p_no_po || ' (' || v_inserted_items || ' items)');

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_po_id,
    'no_po', p_no_po,
    'total', v_grand_total,
    'item_count', v_inserted_items
  );
END;
$$;


-- 3.2 Penerimaan Purchase Order (Status 'diterima' -> Mutasi Stok Aman via transactions)
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_po_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_po RECORD;
  v_item RECORD;
  v_received_count INT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF UPPER(COALESCE(v_user_role, '')) NOT IN ('OWNER', 'STAFF') THEN
      RAISE EXCEPTION 'Akses ditolak: Hanya OWNER atau STAFF yang dapat menerima Purchase Order'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = p_po_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase Order tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  IF v_po.status = 'diterima' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_received', true,
      'message', 'Purchase Order sudah berstatus diterima sebelumnya'
    );
  END IF;

  IF v_po.status = 'dibatalkan' THEN
    RAISE EXCEPTION 'Purchase Order yang sudah dibatalkan tidak dapat diterima' USING ERRCODE = '23514';
  END IF;

  -- Buat transaksi barang masuk untuk setiap item yang terikat product_id
  FOR v_item IN
    SELECT poi.*, p.name AS catalog_name
    FROM public.purchase_order_items poi
    LEFT JOIN public.products p ON p.id = poi.product_id
    WHERE poi.po_id = p_po_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      -- Insert ke transactions (memicu trigger trg_transaction_stock_update otomatis menambah stok)
      INSERT INTO public.transactions (
        product_id,
        supplier_id,
        type,
        quantity,
        unit_price,
        total_price,
        channel,
        notes,
        po_id,
        created_at
      ) VALUES (
        v_item.product_id,
        v_po.supplier_id,
        'in',
        v_item.qty,
        COALESCE(v_item.harga, 0),
        v_item.qty * COALESCE(v_item.harga, 0),
        'Supplier PO',
        'Penerimaan PO ' || v_po.no_po || COALESCE(' (' || v_po.supplier_name || ')', ''),
        p_po_id,
        now()
      )
      ON CONFLICT (po_id, product_id) DO NOTHING;

      v_received_count := v_received_count + 1;
    END IF;
  END LOOP;

  -- Update status PO menjadi 'diterima'
  UPDATE public.purchase_orders
  SET status = 'diterima',
      updated_at = now()
  WHERE id = p_po_id;

  PERFORM public.log_audit_event('UPDATE', 'Penerimaan PO ' || v_po.no_po || ' (' || v_received_count || ' item produk ditambahkan ke stok)');

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_po_id,
    'no_po', v_po.no_po,
    'status', 'diterima',
    'items_stocked', v_received_count
  );
END;
$$;


-- 3.3 Penyelesaian Retur Barang (Status 'selesai' -> Mutasi Stok Aman via transactions)
CREATE OR REPLACE FUNCTION public.complete_return(
  p_return_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_ret RECORD;
  v_current_stock INT;
  v_tx_type TEXT;
  v_note TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF UPPER(COALESCE(v_user_role, '')) NOT IN ('OWNER', 'STAFF') THEN
      RAISE EXCEPTION 'Akses ditolak: Hanya OWNER atau STAFF yang dapat memproses retur'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_ret
  FROM public.returns
  WHERE id = p_return_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data retur tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  IF v_ret.status = 'selesai' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_completed', true,
      'message', 'Retur sudah berstatus selesai sebelumnya'
    );
  END IF;

  IF v_ret.status = 'ditolak' THEN
    RAISE EXCEPTION 'Retur berstatus ditolak tidak dapat diselesaikan' USING ERRCODE = '23514';
  END IF;

  IF v_ret.produk_id IS NULL THEN
    RAISE EXCEPTION 'Produk pada catatan retur ini tidak valid atau tidak terhubung ke master barang'
      USING ERRCODE = '23514';
  END IF;

  -- 1. Retur Ke Supplier: Stok fisik toko berkurang
  IF v_ret.tipe = 'ke_supplier' THEN
    SELECT stock INTO v_current_stock FROM public.products WHERE id = v_ret.produk_id FOR UPDATE;
    IF v_current_stock < v_ret.qty THEN
      RAISE EXCEPTION 'Stok produk tidak mencukupi untuk retur ke supplier (Stok saat ini: %, Dibutuhkan: %)',
        v_current_stock, v_ret.qty USING ERRCODE = '23514';
    END IF;

    v_tx_type := 'out';
    v_note := 'Retur ke Supplier: ' || v_ret.no_retur || ' - Alasan: ' || v_ret.alasan;

    INSERT INTO public.transactions (
      product_id, supplier_id, type, quantity, unit_price, total_price, channel, notes, return_id, created_at
    ) VALUES (
      v_ret.produk_id,
      v_ret.supplier_id,
      v_tx_type,
      v_ret.qty,
      COALESCE(v_ret.harga_satuan, 0),
      v_ret.qty * COALESCE(v_ret.harga_satuan, 0),
      'Retur',
      v_note,
      p_return_id,
      now()
    )
    ON CONFLICT (return_id) DO NOTHING;

  -- 2. Retur Dari Customer: Barang kembali ke stok toko
  ELSIF v_ret.tipe = 'dari_customer' THEN
    v_tx_type := 'in';
    v_note := 'Retur dari Pelanggan: ' || v_ret.no_retur || ' - Alasan: ' || v_ret.alasan;

    INSERT INTO public.transactions (
      product_id, customer_id, type, quantity, unit_price, total_price, channel, notes, return_id, created_at
    ) VALUES (
      v_ret.produk_id,
      v_ret.customer_id,
      v_tx_type,
      v_ret.qty,
      COALESCE(v_ret.harga_satuan, 0),
      v_ret.qty * COALESCE(v_ret.harga_satuan, 0),
      'Retur',
      v_note,
      p_return_id,
      now()
    )
    ON CONFLICT (return_id) DO NOTHING;
  END IF;

  -- Update status retur menjadi 'selesai'
  UPDATE public.returns
  SET status = 'selesai',
      updated_at = now()
  WHERE id = p_return_id;

  PERFORM public.log_audit_event('UPDATE', 'Retur Selesai: ' || v_ret.no_retur || ' (' || v_ret.qty || ' unit ' || v_tx_type || ')');

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_return_id,
    'no_retur', v_ret.no_retur,
    'status', 'selesai',
    'mutation_type', v_tx_type,
    'quantity', v_ret.qty
  );
END;
$$;


-- 3.4 Restock Assistant: Buat Draft PO Otomatis dari Barang dengan Stok Kritis (stock <= min_stock)
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
  v_sup_id INT;
  v_supplier_name TEXT := 'Supplier Restock';
  v_order_qty INT;
  v_unit_price NUMERIC;
  v_grand_total NUMERIC := 0;
  v_item_count INT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF UPPER(COALESCE(v_user_role, '')) NOT IN ('OWNER', 'STAFF') THEN
      RAISE EXCEPTION 'Akses ditolak: Hanya OWNER atau STAFF yang dapat membuat Draft PO'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_supplier_id IS NOT NULL AND TRIM(p_supplier_id) ~ '^[0-9]+$' THEN
    v_sup_id := TRIM(p_supplier_id)::INT;
    SELECT name INTO v_supplier_name FROM public.suppliers WHERE id = v_sup_id;
  END IF;

  -- Buat nomor PO otomatis
  v_no_po := 'PO-' || TO_CHAR(now(), 'YYYYMM') || '-AUTO' || FLOOR(100 + RANDOM() * 900)::TEXT;

  -- Buat header PO draft
  INSERT INTO public.purchase_orders (
    no_po, tanggal, supplier_id, supplier_name, status, total, catatan, created_by, created_at, updated_at
  ) VALUES (
    v_no_po,
    CURRENT_DATE,
    v_sup_id,
    v_supplier_name,
    'draft',
    0,
    'Restock otomatis dari daftar stok menipis (Restock Assistant)',
    v_user_id,
    now(),
    now()
  )
  RETURNING id INTO v_po_id;

  -- Ambil produk yang stoknya <= min_stock dan belum ada di PO terbuka (draft/dikirim)
  FOR v_prod IN
    SELECT p.*
    FROM public.products p
    WHERE p.stock <= p.min_stock
      AND NOT EXISTS (
        SELECT 1
        FROM public.purchase_order_items poi
        JOIN public.purchase_orders po ON po.id = poi.po_id
        WHERE poi.product_id = p.id
          AND po.status IN ('draft', 'dikirim')
      )
    ORDER BY (p.stock - p.min_stock) ASC
  LOOP
    -- Rumus jumlah pemesanan kembali: aman hingga 2x min_stock
    v_order_qty := GREATEST(1, (v_prod.min_stock * 2) - v_prod.stock);
    v_unit_price := GREATEST(0, COALESCE(v_prod.cost_price, 0));

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
  END LOOP;

  -- Jika tidak ada produk yang memenuhi syarat, hapus header dan beri tahu pengguna
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

  PERFORM public.log_audit_event('CREATE', 'Draft PO Otomatis ' || v_no_po || ' (' || v_item_count || ' item stok menipis)');

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
