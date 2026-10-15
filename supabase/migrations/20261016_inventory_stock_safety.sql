-- Add transaction channel support and prevent stock from becoming negative.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'Offline';

CREATE OR REPLACE FUNCTION public.handle_transaction_stock_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_rows INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'in' THEN
      UPDATE public.products
      SET stock = stock + NEW.quantity,
          updated_at = now()
      WHERE id = NEW.product_id;
    ELSE
      UPDATE public.products
      SET stock = stock - NEW.quantity,
          updated_at = now()
      WHERE id = NEW.product_id
        AND stock >= NEW.quantity;
      GET DIAGNOSTICS updated_rows = ROW_COUNT;
      IF updated_rows = 0 THEN
        RAISE EXCEPTION 'Stok tidak mencukupi untuk transaksi keluar'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.type = 'in' THEN
      UPDATE public.products
      SET stock = stock - OLD.quantity,
          updated_at = now()
      WHERE id = OLD.product_id
        AND stock >= OLD.quantity;
      GET DIAGNOSTICS updated_rows = ROW_COUNT;
      IF updated_rows = 0 THEN
        RAISE EXCEPTION 'Transaksi masuk tidak dapat dibatalkan karena stok sudah terpakai'
          USING ERRCODE = '23514';
      END IF;
    ELSE
      UPDATE public.products
      SET stock = stock + OLD.quantity,
          updated_at = now()
      WHERE id = OLD.product_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_stock_update ON public.transactions;
CREATE TRIGGER trg_transaction_stock_update
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_transaction_stock_update();

CREATE TABLE IF NOT EXISTS public.csv_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type TEXT NOT NULL CHECK (import_type IN ('in', 'out')),
  file_hash TEXT NOT NULL,
  imported_count INTEGER NOT NULL CHECK (imported_count > 0),
  created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_type, file_hash)
);

ALTER TABLE public.csv_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS csv_import_batches_select_own ON public.csv_import_batches;
CREATE POLICY csv_import_batches_select_own
  ON public.csv_import_batches FOR SELECT TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS csv_import_batches_insert_own ON public.csv_import_batches;
CREATE POLICY csv_import_batches_insert_own
  ON public.csv_import_batches FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.import_products_csv(p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  imported_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Login diperlukan untuk mengimpor produk'
      USING ERRCODE = '42501';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Data produk harus berupa array'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) = 0 OR jsonb_array_length(p_rows) > 2000 THEN
    RAISE EXCEPTION 'File harus berisi 1 sampai 2000 baris produk'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_rows) AS entries(row_data)
    WHERE coalesce(btrim(row_data->>'sku'), '') = ''
       OR coalesce(btrim(row_data->>'name'), '') = ''
       OR coalesce(row_data->>'initial_stock', '') !~ '^[0-9]+$'
       OR coalesce(row_data->>'min_stock', '') !~ '^[0-9]+$'
       OR coalesce(row_data->>'cost_price', '') !~ '^[0-9]+([.][0-9]+)?$'
       OR coalesce(row_data->>'sell_price', '') !~ '^[0-9]+([.][0-9]+)?$'
  ) THEN
    RAISE EXCEPTION 'SKU, nama, stok, minimum stok, dan harga pada setiap baris harus valid'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_rows) AS entries(row_data)
    GROUP BY lower(btrim(row_data->>'sku'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'File berisi SKU duplikat'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_rows) AS entries(row_data)
    WHERE nullif(btrim(row_data->>'barcode'), '') IS NOT NULL
    GROUP BY btrim(row_data->>'barcode')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'File berisi barcode duplikat'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_rows) AS entries(row_data)
    LEFT JOIN public.categories AS c
      ON lower(c.name) = lower(nullif(btrim(row_data->>'category'), ''))
    WHERE nullif(btrim(row_data->>'category'), '') IS NOT NULL
      AND c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Kategori pada file tidak ditemukan. Gunakan nama kategori yang sudah terdaftar.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.products (
    sku, barcode, name, brand, category_id, stock, min_stock, cost_price, sell_price
  )
  SELECT
    btrim(row_data->>'sku'),
    nullif(btrim(row_data->>'barcode'), ''),
    btrim(row_data->>'name'),
    coalesce(nullif(btrim(row_data->>'brand'), ''), '-'),
    c.id,
    0,
    coalesce(nullif(row_data->>'min_stock', '')::INTEGER, 3),
    coalesce(nullif(row_data->>'cost_price', '')::NUMERIC, 0),
    coalesce(nullif(row_data->>'sell_price', '')::NUMERIC, 0)
  FROM jsonb_array_elements(p_rows) AS entries(row_data)
  LEFT JOIN public.categories AS c
    ON lower(c.name) = lower(nullif(btrim(row_data->>'category'), ''));

  INSERT INTO public.transactions (
    type, product_id, quantity, unit_price, total_price, channel, notes, user_id
  )
  SELECT
    'in',
    p.id,
    (row_data->>'initial_stock')::INTEGER,
    coalesce(nullif(row_data->>'cost_price', '')::NUMERIC, 0),
    (row_data->>'initial_stock')::INTEGER * coalesce(nullif(row_data->>'cost_price', '')::NUMERIC, 0),
    'Offline',
    'Stok awal dari import produk',
    auth.uid()
  FROM jsonb_array_elements(p_rows) AS entries(row_data)
  JOIN public.products AS p
    ON p.sku = btrim(row_data->>'sku')
  WHERE coalesce(nullif(row_data->>'initial_stock', '')::INTEGER, 0) > 0;

  GET DIAGNOSTICS imported_count = ROW_COUNT;
  RETURN jsonb_build_object(
    'imported_count', jsonb_array_length(p_rows),
    'opening_stock_transactions', imported_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.import_inventory_transactions(
  p_type TEXT,
  p_rows JSONB,
  p_file_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  row_record RECORD;
  row_data JSONB;
  line_number INTEGER;
  match_count INTEGER;
  product_uuid UUID;
  supplier_uuid UUID;
  customer_uuid UUID;
  quantity_value INTEGER;
  price_value NUMERIC;
  transaction_date TIMESTAMPTZ;
  inserted_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Login diperlukan untuk mengimpor transaksi'
      USING ERRCODE = '42501';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Jenis transaksi import tidak valid'
      USING ERRCODE = '22023';
  END IF;
  IF p_file_hash IS NULL OR p_file_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Fingerprint file tidak valid'
      USING ERRCODE = '22023';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Data transaksi harus berupa array'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) = 0 OR jsonb_array_length(p_rows) > 2000 THEN
    RAISE EXCEPTION 'File harus berisi 1 sampai 2000 baris transaksi'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.csv_import_batches (import_type, file_hash, imported_count)
  VALUES (p_type, p_file_hash, jsonb_array_length(p_rows))
  ON CONFLICT (import_type, file_hash) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 0 THEN
    RAISE EXCEPTION 'File ini sudah pernah berhasil diimpor untuk transaksi %', p_type
      USING ERRCODE = '23505';
  END IF;

  FOR row_record IN
    SELECT value, ordinality
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS entries(value, ordinality)
  LOOP
    row_data := row_record.value;
    line_number := row_record.ordinality + 1;

    IF coalesce(btrim(row_data->>'sku'), '') = ''
      AND coalesce(btrim(row_data->>'barcode'), '') = '' THEN
      RAISE EXCEPTION 'Baris %: SKU atau barcode wajib diisi', line_number
        USING ERRCODE = '22023';
    END IF;

    SELECT count(*), min(p.id::TEXT)::UUID
    INTO match_count, product_uuid
    FROM public.products AS p
    WHERE (nullif(btrim(row_data->>'sku'), '') IS NOT NULL AND p.sku = btrim(row_data->>'sku'))
       OR (nullif(btrim(row_data->>'barcode'), '') IS NOT NULL AND p.barcode = btrim(row_data->>'barcode'));
    IF match_count <> 1 THEN
      RAISE EXCEPTION 'Baris %: produk tidak ditemukan atau SKU dan barcode menunjuk ke produk berbeda', line_number
        USING ERRCODE = '22023';
    END IF;

    IF coalesce(row_data->>'quantity', '') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Baris %: jumlah harus bilangan bulat positif', line_number
        USING ERRCODE = '22023';
    END IF;
    quantity_value := (row_data->>'quantity')::INTEGER;
    IF quantity_value <= 0 THEN
      RAISE EXCEPTION 'Baris %: jumlah harus lebih besar dari nol', line_number
        USING ERRCODE = '22023';
    END IF;

    IF coalesce(row_data->>'unit_price', '') !~ '^[0-9]+([.][0-9]+)?$' THEN
      RAISE EXCEPTION 'Baris %: harga satuan harus berupa angka nol atau lebih', line_number
        USING ERRCODE = '22023';
    END IF;
    price_value := (row_data->>'unit_price')::NUMERIC;

    supplier_uuid := NULL;
    customer_uuid := NULL;
    IF p_type = 'in' AND nullif(btrim(row_data->>'supplier'), '') IS NOT NULL THEN
      SELECT id INTO supplier_uuid
      FROM public.suppliers
      WHERE lower(name) = lower(btrim(row_data->>'supplier'));
      IF supplier_uuid IS NULL THEN
        RAISE EXCEPTION 'Baris %: supplier tidak ditemukan', line_number
          USING ERRCODE = '22023';
      END IF;
    ELSIF p_type = 'out' AND nullif(btrim(row_data->>'customer'), '') IS NOT NULL THEN
      SELECT id INTO customer_uuid
      FROM public.customers
      WHERE lower(name) = lower(btrim(row_data->>'customer'));
      IF customer_uuid IS NULL THEN
        RAISE EXCEPTION 'Baris %: customer tidak ditemukan', line_number
          USING ERRCODE = '22023';
      END IF;
    END IF;

    transaction_date := now();
    IF nullif(btrim(row_data->>'date'), '') IS NOT NULL THEN
      IF btrim(row_data->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
        RAISE EXCEPTION 'Baris %: tanggal harus berformat YYYY-MM-DD', line_number
          USING ERRCODE = '22023';
      END IF;
      transaction_date := (btrim(row_data->>'date')::DATE::TIMESTAMP AT TIME ZONE 'UTC');
    END IF;

    INSERT INTO public.transactions (
      type, product_id, quantity, unit_price, total_price, supplier_id,
      customer_id, channel, notes, user_id, created_at
    ) VALUES (
      p_type,
      product_uuid,
      quantity_value,
      price_value,
      quantity_value * price_value,
      supplier_uuid,
      customer_uuid,
      coalesce(nullif(btrim(row_data->>'channel'), ''), 'Offline'),
      nullif(btrim(row_data->>'notes'), ''),
      auth.uid(),
      transaction_date
    );
    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN jsonb_build_object('imported_count', inserted_count);
END;
$$;

REVOKE ALL ON FUNCTION public.import_products_csv(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_inventory_transactions(TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_products_csv(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_inventory_transactions(TEXT, JSONB, TEXT) TO authenticated;
