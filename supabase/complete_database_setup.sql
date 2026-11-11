-- ============================================================================
-- AQUASTOCK PRO / M2STOCK — CLEAN CANONICAL DATABASE SCHEMA
-- Target Database: PostgreSQL 15+ (Supabase)
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ════════════════════════════════════════════════════════════════════════════
-- 2. MASTER & INDEPENDENT TABLES
-- ════════════════════════════════════════════════════════════════════════════

-- 2.1 Profiles (Terikat ke auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Pengguna',
  full_name TEXT,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'STAFF', 'VIEWER')) DEFAULT 'VIEWER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 Kategori Produk
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.3 Satuan Produk (Units)
CREATE TABLE IF NOT EXISTS public.units (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS units_name_case_insensitive_unique_idx
  ON public.units (lower(name));

INSERT INTO public.units (name) VALUES ('pcs'), ('box'), ('pack'), ('kg'), ('liter')
ON CONFLICT (name) DO NOTHING;

-- 2.4 Master Data Supplier
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.5 Master Data Customer
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. PRODUCT & INVENTORY TABLES
-- ════════════════════════════════════════════════════════════════════════════

-- 3.1 Master Produk (Katalog Inventaris)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT,
  name TEXT NOT NULL,
  brand TEXT DEFAULT '-',
  category_id INTEGER REFERENCES public.categories(id) ON DELETE SET NULL,
  unit_id INTEGER NOT NULL DEFAULT 1 REFERENCES public.units(id) ON DELETE RESTRICT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 5,
  cost_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  online_sell_price NUMERIC(15, 2),
  marketplace_fee_percent NUMERIC(5, 2) DEFAULT 0,
  channel TEXT DEFAULT 'Offline',
  channel_link TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist if table was partially created previously
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit_id INTEGER DEFAULT 1 REFERENCES public.units(id) ON DELETE RESTRICT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS online_sell_price NUMERIC(15, 2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS marketplace_fee_percent NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'Offline';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS channel_link TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique_idx
  ON public.products (barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_unit_id ON public.products(unit_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products(supplier_id);

-- 3.2 Galeri Foto Produk Tambahan
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.3 Purchase Orders (PO Pembelian)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_po TEXT UNIQUE NOT NULL,
  tanggal DATE DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  status TEXT CHECK (status IN ('draft', 'dikirim', 'diterima', 'dibatalkan')) DEFAULT 'draft',
  total NUMERIC DEFAULT 0,
  catatan TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_po_no_po ON public.purchase_orders(no_po);
CREATE INDEX IF NOT EXISTS idx_po_tanggal ON public.purchase_orders(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_created_at ON public.purchase_orders(created_at DESC);

-- 3.4 Purchase Order Items (Item PO)
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  qty INT NOT NULL CHECK (qty > 0),
  harga NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS product_name TEXT;

CREATE INDEX IF NOT EXISTS idx_poi_po_id ON public.purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_poi_product_id ON public.purchase_order_items(product_id);

-- 3.5 Returns (Retur Barang)
CREATE TABLE IF NOT EXISTS public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_retur TEXT UNIQUE NOT NULL,
  tanggal DATE DEFAULT CURRENT_DATE,
  tipe TEXT CHECK (tipe IN ('ke_supplier', 'dari_customer')) NOT NULL,
  produk_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  qty INT NOT NULL CHECK (qty > 0),
  harga_satuan NUMERIC(15, 2) DEFAULT 0,
  snapshot_product_name TEXT,
  snapshot_entity_name TEXT,
  alasan TEXT NOT NULL,
  status TEXT CHECK (status IN ('diproses', 'selesai', 'ditolak')) DEFAULT 'diproses',
  keterangan TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS harga_satuan NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS snapshot_product_name TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS snapshot_entity_name TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_returns_no_retur ON public.returns(no_retur);
CREATE INDEX IF NOT EXISTS idx_returns_tanggal ON public.returns(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_returns_tipe ON public.returns(tipe);
CREATE INDEX IF NOT EXISTS idx_returns_status ON public.returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON public.returns(created_at DESC);

-- 3.6 Buku Besar Penyesuaian Stok (Stock Opname Ledger)
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  previous_stock NUMERIC NOT NULL,
  actual_stock NUMERIC NOT NULL,
  difference NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product_id ON public.stock_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created_at ON public.stock_adjustments(created_at DESC);

-- 3.7 Batch Riwayat CSV Import
CREATE TABLE IF NOT EXISTS public.csv_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. KEUANGAN & TRANSAKSI POS
-- ════════════════════════════════════════════════════════════════════════════

-- 4.1 Arus Kas (Cash Flow)
CREATE TABLE IF NOT EXISTS public.cash_flow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  keterangan TEXT NOT NULL,
  kategori TEXT NOT NULL CHECK (kategori IN ('Penjualan', 'Pembelian', 'Gaji', 'Operasional', 'Lainnya')),
  metode TEXT NOT NULL CHECK (metode IN ('Cash', 'Transfer', 'QRIS')),
  pemasukan NUMERIC NOT NULL DEFAULT 0,
  pengeluaran NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_flow_tanggal ON public.cash_flow(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_cash_flow_kategori ON public.cash_flow(kategori);
CREATE INDEX IF NOT EXISTS idx_cash_flow_metode ON public.cash_flow(metode);
CREATE INDEX IF NOT EXISTS idx_cash_flow_created_by ON public.cash_flow(created_by);

-- 4.2 Hutang & Piutang (Debts)
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipe TEXT NOT NULL CHECK (tipe IN ('hutang', 'piutang')),
  pihak TEXT NOT NULL,
  nominal NUMERIC NOT NULL,
  jatuh_tempo DATE,
  status TEXT NOT NULL CHECK (status IN ('belum_bayar', 'lunas', 'jatuh_tempo')) DEFAULT 'belum_bayar',
  catatan TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debts_tipe ON public.debts(tipe);
CREATE INDEX IF NOT EXISTS idx_debts_status ON public.debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_jatuh_tempo ON public.debts(jatuh_tempo);
CREATE INDEX IF NOT EXISTS idx_debts_created_by ON public.debts(created_by);

-- 4.3 Transaksi Barang Masuk & Keluar (POS & Inventory Movements)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  qty INTEGER,
  unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  price NUMERIC(15, 2),
  total_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(15, 2),
  reference_no TEXT,
  invoice_no TEXT,
  discount_amount NUMERIC(15, 2) DEFAULT 0,
  tax_amount NUMERIC(15, 2) DEFAULT 0,
  subtotal_amount NUMERIC(15, 2) DEFAULT 0,
  final_total NUMERIC(15, 2) DEFAULT 0,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'Offline',
  notes TEXT,
  note TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  return_id UUID REFERENCES public.returns(id) ON DELETE SET NULL,
  payment_method TEXT DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Transfer', 'QRIS', 'Tempo')),
  payment_status TEXT DEFAULT 'Lunas' CHECK (payment_status IN ('Lunas', 'Belum Lunas')),
  cash_flow_id UUID REFERENCES public.cash_flow(id) ON DELETE SET NULL,
  debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defensive backfill columns in case transactions table existed before
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS qty INTEGER;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS price NUMERIC(15, 2);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS invoice_no TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS final_total NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS return_id UUID REFERENCES public.returns(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Cash';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Lunas';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cash_flow_id UUID REFERENCES public.cash_flow(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cost_price NUMERIC(15, 2);

CREATE INDEX IF NOT EXISTS idx_transactions_type_created_at ON public.transactions (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_product_id ON public.transactions (product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON public.transactions (customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_supplier_id ON public.transactions (supplier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_channel ON public.transactions (channel);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON public.transactions (created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_no ON public.transactions(invoice_no) WHERE invoice_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON public.transactions (payment_method);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON public.transactions (payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_cash_flow_id ON public.transactions (cash_flow_id);
CREATE INDEX IF NOT EXISTS idx_transactions_debt_id ON public.transactions (debt_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency ON public.transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. PENGATURAN, AUDIT, BACKUP & NOTIFIKASI SISTEM
-- ════════════════════════════════════════════════════════════════════════════

-- 5.1 Pengaturan Aplikasi (App Settings)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON public.app_settings(updated_at DESC);

INSERT INTO public.app_settings (key, value)
VALUES
  ('store_info', '{"name": "Aquastock Pro", "address": "Jl. Raya Bekasi", "phone": "0812-9662-8052", "email": "info@aquastock.pro", "slogan": "Solusi Lengkap Perlengkapan Akuarium"}'::jsonb),
  ('pos_config', '{"tax_rate": 0, "service_rate": 0, "receipt_footer": "Terima kasih telah berbelanja!", "default_payment": "Cash"}'::jsonb),
  ('stock_config', '{"min_stock_alert": 5, "auto_po_enabled": false}'::jsonb),
  ('appearance', '{"theme": "dark", "primary_color": "#0088CC", "compact_mode": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5.2 Audit Trail Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN')),
  target TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

-- 5.3 Backup & Restore Logs
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('export', 'import')),
  scope TEXT NOT NULL,
  file_name TEXT,
  records_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_logs_action ON public.backup_logs(action);
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at ON public.backup_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_user_id ON public.backup_logs(user_id);

-- 5.4 Notifikasi Pengguna (Notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipe TEXT CHECK (tipe IN ('info', 'warning', 'success', 'error')) DEFAULT 'info',
  judul TEXT NOT NULL,
  pesan TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns in case notifications existed with old schema
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS tipe TEXT DEFAULT 'info';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS judul TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS pesan TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. STORAGE BUCKET UNTUK GAMBAR PRODUK
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_public_read_product_images" ON storage.objects;
CREATE POLICY "storage_public_read_product_images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "storage_auth_insert_product_images" ON storage.objects;
CREATE POLICY "storage_auth_insert_product_images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "storage_auth_update_product_images" ON storage.objects;
CREATE POLICY "storage_auth_update_product_images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "storage_auth_delete_product_images" ON storage.objects;
CREATE POLICY "storage_auth_delete_product_images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images');

-- ════════════════════════════════════════════════════════════════════════════
-- 7. FUNCTIONS, STORED PROCEDURES & TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════

-- 7.1 Helper: Cek Apakah User Aktif adalah Owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND UPPER(role) = 'OWNER'
  );
$$;

-- 7.2 Helper: Ambil Role Pengguna Aktif
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT UPPER(role)
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- 7.3 Trigger: Pembuat Profil Otomatis saat Akun Didaftarkan di Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  assigned_role TEXT;
  user_name TEXT;
  meta_role TEXT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;

  meta_role := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));

  IF user_count = 0 THEN
    assigned_role := 'OWNER';
  ELSIF meta_role IN ('OWNER', 'STAFF', 'VIEWER') THEN
    assigned_role := meta_role;
  ELSE
    assigned_role := 'STAFF';
  END IF;

  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, name, full_name, email, role)
  VALUES (NEW.id, user_name, user_name, NEW.email, assigned_role)
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      full_name = COALESCE(EXCLUDED.full_name, EXCLUDED.name),
      email = COALESCE(EXCLUDED.email, profiles.email),
      role = CASE 
               WHEN public.profiles.role IS NULL THEN EXCLUDED.role 
               ELSE public.profiles.role 
             END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Auto-Confirm User Baru (Bypass Email Confirmation Lock)
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_confirm_new_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_new_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_new_user();

-- 7.3.1 Trigger: Proteksi Harga Produk (Hanya OWNER yang boleh mengubah harga jual produk)
CREATE OR REPLACE FUNCTION public.check_product_price_update_permission()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.sell_price IS DISTINCT FROM NEW.sell_price)
     OR (OLD.online_sell_price IS DISTINCT FROM NEW.online_sell_price)
     OR (OLD.min_sell_price IS DISTINCT FROM NEW.min_sell_price) THEN
    
    IF NOT public.is_owner() THEN
      RAISE EXCEPTION 'Akses ditolak: Hanya role OWNER yang berhak mengubah harga produk.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_product_prices ON public.products;
CREATE TRIGGER trg_protect_product_prices
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.check_product_price_update_permission();

-- 7.4 Trigger: Sinkronisasi Kolom Transaksi Bi-Directional (qty/quantity, price/unit_price, note/notes)
CREATE OR REPLACE FUNCTION public.sync_transaction_columns()
RETURNS trigger AS $$
BEGIN
  -- Sync qty & quantity
  IF NEW.quantity IS NOT NULL AND NEW.qty IS NULL THEN
    NEW.qty := NEW.quantity::INTEGER;
  ELSIF NEW.qty IS NOT NULL AND NEW.quantity IS NULL THEN
    NEW.quantity := NEW.qty;
  END IF;

  -- Sync unit_price & price
  IF NEW.unit_price IS NOT NULL AND NEW.price IS NULL THEN
    NEW.price := NEW.unit_price;
  ELSIF NEW.price IS NOT NULL AND NEW.unit_price IS NULL THEN
    NEW.unit_price := NEW.price;
  END IF;

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

  -- Hitung total_price otomatis jika belum diisi
  IF NEW.total_price IS NULL OR NEW.total_price = 0 THEN
    NEW.total_price := COALESCE(NEW.quantity, NEW.qty, 0) * COALESCE(NEW.unit_price, NEW.price, 0);
  END IF;

  IF NEW.final_total IS NULL OR NEW.final_total = 0 THEN
    NEW.final_total := NEW.total_price;
  END IF;

  IF NEW.subtotal_amount IS NULL OR NEW.subtotal_amount = 0 THEN
    NEW.subtotal_amount := NEW.total_price;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_transaction_columns ON public.transactions;
CREATE TRIGGER trg_sync_transaction_columns
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_transaction_columns();

-- 7.5 Trigger: Moving Weighted Average Costing (IAS 2 / PSAK 14) & Pembaruan Stok Otomatis
CREATE OR REPLACE FUNCTION public.handle_transaction_stock_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_rows INTEGER;
  v_qty NUMERIC;
  v_cur_stock NUMERIC;
  v_cur_cost NUMERIC;
  v_incoming_cost NUMERIC;
  v_new_avg_cost NUMERIC;
  v_is_opname BOOLEAN;
  v_is_return BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_qty := COALESCE(NEW.quantity, NEW.qty, 0);

    IF NEW.type = 'in' THEN
      SELECT stock, COALESCE(cost_price, 0)
      INTO v_cur_stock, v_cur_cost
      FROM public.products
      WHERE id = NEW.product_id
      FOR UPDATE;

      v_incoming_cost := COALESCE(NEW.cost_price, NEW.unit_price, NEW.price, 0);
      v_is_opname := (COALESCE(NEW.note, NEW.notes, '') LIKE '[STOCK OPNAME]%' OR v_incoming_cost <= 0);
      v_is_return := (COALESCE(NEW.channel, '') = 'Retur' OR NEW.return_id IS NOT NULL OR COALESCE(NEW.note, NEW.notes, '') LIKE 'Retur dari Pelanggan%');

      IF NOT v_is_opname AND NOT v_is_return AND v_incoming_cost > 0 AND v_qty > 0 THEN
        IF v_cur_stock IS NULL OR v_cur_stock <= 0 OR v_cur_cost <= 0 THEN
          v_new_avg_cost := v_incoming_cost;
        ELSE
          v_new_avg_cost := ROUND(
            ((v_cur_stock * v_cur_cost) + (v_qty * v_incoming_cost)) / (v_cur_stock + v_qty),
            2
          );
        END IF;

        UPDATE public.products
        SET stock = stock + v_qty,
            cost_price = v_new_avg_cost,
            updated_at = now()
        WHERE id = NEW.product_id;
      ELSE
        UPDATE public.products
        SET stock = stock + v_qty,
            updated_at = now()
        WHERE id = NEW.product_id;
      END IF;

    ELSE
      -- Transaksi keluar (Penjualan Kasir / POS)
      UPDATE public.products
      SET stock = stock - v_qty,
          updated_at = now()
      WHERE id = NEW.product_id
        AND stock >= v_qty;
      GET DIAGNOSTICS updated_rows = ROW_COUNT;
      IF updated_rows = 0 THEN
        RAISE EXCEPTION 'Stok tidak mencukupi untuk transaksi keluar'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_qty := COALESCE(OLD.quantity, OLD.qty, 0);
    IF OLD.type = 'in' THEN
      UPDATE public.products
      SET stock = stock - v_qty,
          updated_at = now()
      WHERE id = OLD.product_id;
    ELSE
      UPDATE public.products
      SET stock = stock + v_qty,
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_transaction_stock_update();

-- 7.6 Sequences & RPC: invoice_number_seq & stock_in_number_seq
CREATE SEQUENCE IF NOT EXISTS public.stock_in_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

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

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

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
  v_idempotency_key := NULLIF(p_common->>'idempotency_key', '');
  v_discount_amount := COALESCE((p_common->>'discount_amount')::NUMERIC, 0);
  v_tax_amount := COALESCE((p_common->>'tax_amount')::NUMERIC, 0);
  v_checkout_total := COALESCE((p_common->>'checkout_total')::NUMERIC, (p_common->>'total_amount')::NUMERIC, 0);

  IF v_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = v_idempotency_key) THEN
      RETURN jsonb_build_object(
        'success', true,
        'ok', true,
        'idempotent_replay', true,
        'invoice_no', v_invoice_no,
        'message', 'Transaksi sudah diproses sebelumnya (Idempotent Replay)'
      );
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := v_item->>'product_id';
    v_qty := (v_item->>'qty')::NUMERIC;
    v_price := (v_item->>'price')::NUMERIC;
    v_item_note := v_item->>'notes';

    SELECT stock, name, sku, cost_price
    INTO v_current_stock, v_prod_name, v_prod_sku, v_cost_price
    FROM public.products
    WHERE id = v_prod_id::UUID
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Produk ID % tidak ditemukan', v_prod_id USING ERRCODE = 'P0002';
    END IF;

    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Stok produk % (%) tidak mencukupi. Sisa: %, diminta: %', 
        v_prod_name, v_prod_sku, v_current_stock, v_qty USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.transactions (
      product_id, type, quantity, qty, unit_price, price, total_price,
      channel, customer_id, payment_method, payment_status, note, notes, created_by,
      idempotency_key, invoice_no, discount_amount, tax_amount, subtotal_amount, final_total, cost_price
    ) VALUES (
      v_prod_id::UUID, 'out', v_qty::INTEGER, v_qty::INTEGER, v_price, v_price, (v_qty * v_price),
      v_channel, NULLIF(v_customer_id, '')::UUID, v_payment_method, v_payment_status,
      v_item_note, v_item_note, v_created_by,
      CASE WHEN v_idempotency_key IS NOT NULL THEN v_idempotency_key || '-' || v_prod_id ELSE NULL END,
      v_invoice_no, v_discount_amount, v_tax_amount, (v_qty * v_price),
      CASE WHEN v_checkout_total > 0 THEN v_checkout_total ELSE (v_qty * v_price) END,
      v_cost_price
    ) RETURNING id INTO v_tx_id;

    v_total_amount := v_total_amount + (v_qty * v_price);
    v_created_txs := v_created_txs || jsonb_build_object(
      'transaction_id', v_tx_id,
      'product_id', v_prod_id,
      'qty', v_qty,
      'price', v_price
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'ok', true,
    'invoice_no', v_invoice_no,
    'total_amount', v_total_amount,
    'items_count', jsonb_array_length(p_items),
    'transactions', v_created_txs
  );
END;
$$;

-- 7.7 RPC: perform_stock_opname (Koreksi Fisik Stok Atomik khusus OWNER)
CREATE OR REPLACE FUNCTION public.perform_stock_opname(
  p_product_id TEXT,
  p_actual_stock NUMERIC,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_prod_uuid UUID;
  v_cur_stock NUMERIC;
  v_cur_cost NUMERIC;
  v_diff NUMERIC;
  v_adj_id UUID;
  v_tx_id UUID;
  v_tx_type TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: pengguna harus terautentikasi' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
  IF UPPER(BTRIM(COALESCE(v_user_role, ''))) <> 'OWNER' THEN
    RAISE EXCEPTION 'Akses ditolak: koreksi stok fisik hanya dapat dilakukan oleh OWNER' USING ERRCODE = '42501';
  END IF;

  v_prod_uuid := p_product_id::UUID;

  SELECT stock, cost_price INTO v_cur_stock, v_cur_cost
  FROM public.products WHERE id = v_prod_uuid FOR UPDATE;

  IF v_cur_stock IS NULL THEN
    RAISE EXCEPTION 'Produk tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  v_diff := p_actual_stock - v_cur_stock;

  IF v_diff = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Stok fisik sesuai dengan sistem (selisih 0)', 'actual_stock', p_actual_stock);
  END IF;

  INSERT INTO public.stock_adjustments (product_id, previous_stock, actual_stock, difference, reason, notes, created_by)
  VALUES (v_prod_uuid, v_cur_stock, p_actual_stock, v_diff, p_reason, p_notes, v_user_id)
  RETURNING id INTO v_adj_id;

  IF v_diff > 0 THEN
    v_tx_type := 'in';
  ELSE
    v_tx_type := 'out';
  END IF;

  INSERT INTO public.transactions (
    product_id, type, quantity, qty, unit_price, price, total_price, channel, notes, note, user_id, created_by
  ) VALUES (
    v_prod_uuid, v_tx_type, ABS(v_diff)::INTEGER, ABS(v_diff)::INTEGER, 0, 0, 0, 'Opname',
    '[STOCK OPNAME] ' || p_reason || COALESCE(' - ' || p_notes, ''),
    '[STOCK OPNAME] ' || p_reason || COALESCE(' - ' || p_notes, ''),
    v_user_id, v_user_id
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'adjustment_id', v_adj_id,
    'transaction_id', v_tx_id,
    'previous_stock', v_cur_stock,
    'actual_stock', p_actual_stock,
    'difference', v_diff
  );
END;
$$;

-- 7.8 RPC: get_auth_users (Daftar Pengguna Sistem untuk OWNER & STAFF)
CREATE OR REPLACE FUNCTION public.get_auth_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND UPPER(role) IN ('OWNER', 'STAFF')
  ) THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Owner atau Staff yang berhak melihat daftar pengguna.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(to_jsonb(p)->>'full_name', to_jsonb(p)->>'name', split_part(u.email, '@', 1))::TEXT AS full_name,
    COALESCE(p.role, 'VIEWER')::TEXT AS role,
    u.last_sign_in_at,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- 7.9 RPC: update_user_role (Ubah Role Pengguna khusus OWNER)
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_count INTEGER;
  normalized_role TEXT := UPPER(TRIM(new_role));
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Owner yang berhak memperbarui role pengguna.';
  END IF;

  IF normalized_role IS NULL OR normalized_role NOT IN ('OWNER', 'STAFF', 'VIEWER') THEN
    RAISE EXCEPTION 'Nilai role tidak valid. Pilihan: OWNER, STAFF, VIEWER.';
  END IF;

  IF auth.uid() = target_user_id AND normalized_role <> 'OWNER' THEN
    SELECT COUNT(*) INTO owner_count FROM public.profiles WHERE UPPER(role) = 'OWNER';
    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Tidak dapat menurunkan role: Sistem harus memiliki minimal satu Owner aktif.';
    END IF;
  END IF;

  UPDATE public.profiles
  SET role = normalized_role,
      updated_at = now()
  WHERE id = target_user_id;
END;
$$;

-- 7.9.1 RPC: admin_create_user (Buat Pengguna Baru oleh OWNER)
CREATE OR REPLACE FUNCTION public.admin_create_user(
  new_email TEXT,
  new_password TEXT,
  new_role TEXT,
  new_full_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
#variable_conflict use_column
DECLARE
  calling_role TEXT;
  new_user_id UUID := gen_random_uuid();
  encrypted_pw TEXT;
  normalized_role TEXT := UPPER(TRIM(COALESCE(new_role, 'STAFF')));
  clean_email TEXT := LOWER(TRIM(new_email));
  clean_name TEXT := TRIM(COALESCE(new_full_name, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna belum login.' USING ERRCODE = '42501';
  END IF;

  SELECT UPPER(profiles.role) INTO calling_role
  FROM public.profiles WHERE profiles.id = auth.uid();

  IF calling_role <> 'OWNER' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya role OWNER yang berhak membuat user baru.' USING ERRCODE = '42501';
  END IF;

  IF clean_email IS NULL OR clean_email = '' OR clean_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'Format email tidak valid.' USING ERRCODE = '23514';
  END IF;

  IF new_password IS NULL OR length(new_password) < 8 THEN
    RAISE EXCEPTION 'Password minimal 8 karakter.' USING ERRCODE = '23514';
  END IF;

  IF normalized_role NOT IN ('OWNER', 'STAFF', 'VIEWER') THEN
    normalized_role := 'STAFF';
  END IF;

  IF clean_name = '' THEN
    clean_name := split_part(clean_email, '@', 1);
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = clean_email) THEN
    RAISE EXCEPTION 'Email "%" sudah terdaftar di sistem.', clean_email USING ERRCODE = '23505';
  END IF;

  encrypted_pw := crypt(new_password, gen_salt('bf', 10));

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, new_user_id, 'authenticated', 'authenticated',
    clean_email, encrypted_pw, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', clean_name, 'name', clean_name, 'role', normalized_role),
    now(), now(), '', '', '', ''
  );

  DELETE FROM auth.identities WHERE user_id = new_user_id AND provider = 'email';
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', clean_email),
    'email', new_user_id::text, now(), now(), now()
  );

  INSERT INTO public.profiles (id, name, full_name, email, role, created_at, updated_at)
  VALUES (new_user_id, clean_name, clean_name, clean_email, normalized_role, now(), now())
  ON CONFLICT (id) DO UPDATE
  SET role = normalized_role, name = clean_name, full_name = clean_name, email = clean_email, updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', clean_email,
    'role', normalized_role,
    'full_name', clean_name
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 7.9.2 RPC: admin_reset_password (Reset Password Pengguna khusus OWNER)
CREATE OR REPLACE FUNCTION public.admin_reset_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
#variable_conflict use_column
DECLARE
  calling_role TEXT;
  encrypted_pw TEXT;
  target_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna belum login.' USING ERRCODE = '42501';
  END IF;

  SELECT UPPER(profiles.role) INTO calling_role
  FROM public.profiles WHERE profiles.id = auth.uid();

  IF calling_role <> 'OWNER' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya OWNER yang berhak mereset password pengguna.' USING ERRCODE = '42501';
  END IF;

  IF new_password IS NULL OR length(new_password) < 8 THEN
    RAISE EXCEPTION 'Password minimal 8 karakter.' USING ERRCODE = '23514';
  END IF;

  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
  IF target_email IS NULL THEN
    RAISE EXCEPTION 'Pengguna dengan ID % tidak ditemukan.', target_user_id USING ERRCODE = 'P0002';
  END IF;

  encrypted_pw := crypt(new_password, gen_salt('bf', 10));

  UPDATE auth.users
  SET encrypted_password = encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = target_user_id;

  DELETE FROM auth.identities WHERE user_id = target_user_id AND provider = 'email';
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), target_user_id,
    jsonb_build_object('sub', target_user_id::text, 'email', lower(target_email)),
    'email', target_user_id::text, now(), now(), now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'email', target_email,
    'message', 'Password berhasil direset'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT) TO authenticated;

-- 7.9.3 RPC: admin_delete_user (Hapus Pengguna khusus OWNER)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
DECLARE
  calling_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna belum login.' USING ERRCODE = '42501';
  END IF;

  SELECT UPPER(profiles.role) INTO calling_role
  FROM public.profiles WHERE profiles.id = auth.uid();

  IF calling_role <> 'OWNER' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya OWNER yang berhak menghapus user.' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() = target_user_id THEN
    RAISE EXCEPTION 'Tidak dapat menghapus akun sendiri.' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.identities WHERE user_id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', target_user_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- 7.10 RPC: create_purchase_order_atomic (Buat PO Beserta Item-nya Secara Atomik)
CREATE OR REPLACE FUNCTION public.create_purchase_order_atomic(
  p_supplier_id TEXT,
  p_catatan TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_po_id UUID;
  v_no_po TEXT;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_sup_name TEXT;
  v_prod_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna harus login' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
  IF UPPER(COALESCE(v_user_role, '')) NOT IN ('OWNER', 'STAFF') THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya OWNER atau STAFF yang berhak membuat PO' USING ERRCODE = '42501';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Item Purchase Order tidak boleh kosong' USING ERRCODE = '22023';
  END IF;

  SELECT name INTO v_sup_name FROM public.suppliers WHERE id = p_supplier_id::UUID;
  v_no_po := 'PO-' || to_char(now(), 'YYMMDD') || '-' || floor(random() * 9000 + 1000)::TEXT;

  INSERT INTO public.purchase_orders (
    no_po, supplier_id, supplier_name, catatan, status, total, created_by
  ) VALUES (
    v_no_po, NULLIF(p_supplier_id, '')::UUID, v_sup_name, p_catatan, 'draft', 0, v_user_id
  ) RETURNING id INTO v_po_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT name INTO v_prod_name FROM public.products WHERE id = (v_item->>'product_id')::UUID;

    INSERT INTO public.purchase_order_items (
      po_id, product_id, product_name, qty, harga, subtotal
    ) VALUES (
      v_po_id,
      (v_item->>'product_id')::UUID,
      COALESCE(v_item->>'product_name', v_prod_name),
      (v_item->>'qty')::INTEGER,
      (v_item->>'harga')::NUMERIC,
      ((v_item->>'qty')::NUMERIC * (v_item->>'harga')::NUMERIC)
    );

    v_total := v_total + ((v_item->>'qty')::NUMERIC * (v_item->>'harga')::NUMERIC);
  END LOOP;

  UPDATE public.purchase_orders SET total = v_total WHERE id = v_po_id;

  RETURN jsonb_build_object('success', true, 'po_id', v_po_id, 'no_po', v_no_po, 'total', v_total);
END;
$$;

-- 7.11 RPC: receive_purchase_order (Penerimaan Barang PO -> Otomatis Buat Transaksi Masuk)
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

-- 7.12 RPC: complete_return (Penyelesaian Retur Barang Atomik)
CREATE OR REPLACE FUNCTION public.complete_return(p_return_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_ret RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna harus login' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
  IF UPPER(COALESCE(v_user_role, '')) NOT IN ('OWNER', 'STAFF') THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya OWNER atau STAFF yang berhak memproses retur' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ret FROM public.returns WHERE id = p_return_id::UUID FOR UPDATE;
  IF v_ret.id IS NULL THEN
    RAISE EXCEPTION 'Data Retur tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  IF v_ret.status = 'selesai' THEN
    RAISE EXCEPTION 'Retur % sudah selesai sebelumnya', v_ret.no_retur;
  END IF;

  IF v_ret.tipe = 'dari_customer' THEN
    -- Barang masuk kembali ke toko
    INSERT INTO public.transactions (
      product_id, type, quantity, qty, unit_price, price, total_price,
      customer_id, channel, reference_no, return_id, notes, note, user_id, created_by
    ) VALUES (
      v_ret.produk_id, 'in', v_ret.qty, v_ret.qty, v_ret.harga_satuan, v_ret.harga_satuan, (v_ret.qty * v_ret.harga_satuan),
      v_ret.customer_id, 'Retur', v_ret.no_retur, v_ret.id,
      'Retur dari Pelanggan: ' || v_ret.alasan, 'Retur dari Pelanggan: ' || v_ret.alasan, v_user_id, v_user_id
    );
  ELSE
    -- Barang keluar dikembalikan ke supplier
    INSERT INTO public.transactions (
      product_id, type, quantity, qty, unit_price, price, total_price,
      supplier_id, channel, reference_no, return_id, notes, note, user_id, created_by
    ) VALUES (
      v_ret.produk_id, 'out', v_ret.qty, v_ret.qty, v_ret.harga_satuan, v_ret.harga_satuan, (v_ret.qty * v_ret.harga_satuan),
      v_ret.supplier_id, 'Retur', v_ret.no_retur, v_ret.id,
      'Retur ke Supplier: ' || v_ret.alasan, 'Retur ke Supplier: ' || v_ret.alasan, v_user_id, v_user_id
    );
  END IF;

  UPDATE public.returns SET status = 'selesai', updated_at = now() WHERE id = v_ret.id;

  RETURN jsonb_build_object('success', true, 'return_id', v_ret.id, 'status', 'selesai');
END;
$$;

-- 7.13 RPC: generate_draft_po_from_low_stock (Auto-Draft PO dari Stok Minimum)
CREATE OR REPLACE FUNCTION public.generate_draft_po_from_low_stock(p_supplier_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_po_id UUID;
  v_no_po TEXT;
  v_prod RECORD;
  v_total NUMERIC := 0;
  v_items_count INT := 0;
  v_supplier_name TEXT := 'Supplier Otomatis';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna harus login' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
  IF UPPER(COALESCE(v_user_role, '')) NOT IN ('OWNER', 'STAFF') THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya OWNER atau STAFF yang berhak membuat draft PO' USING ERRCODE = '42501';
  END IF;

  v_no_po := 'PO-AUTO-' || to_char(now(), 'YYMMDD') || '-' || floor(random() * 9000 + 1000)::TEXT;

  INSERT INTO public.purchase_orders (
    no_po, supplier_id, supplier_name, status, total, catatan, created_by
  ) VALUES (
    v_no_po, NULLIF(p_supplier_id, '')::UUID, v_supplier_name, 'draft', 0, 'Auto-generated PO dari batas stok minimum', v_user_id
  ) RETURNING id INTO v_po_id;

  FOR v_prod IN 
    SELECT id, name, cost_price, stock, min_stock 
    FROM public.products
    WHERE stock <= min_stock
      AND (p_supplier_id IS NULL OR supplier_id = p_supplier_id::UUID)
  LOOP
    INSERT INTO public.purchase_order_items (
      po_id, product_id, product_name, qty, harga, subtotal
    ) VALUES (
      v_po_id, v_prod.id, v_prod.name, (v_prod.min_stock * 2)::INTEGER, v_prod.cost_price,
      ((v_prod.min_stock * 2) * v_prod.cost_price)
    );
    v_total := v_total + ((v_prod.min_stock * 2) * v_prod.cost_price);
    v_items_count := v_items_count + 1;
  END LOOP;

  UPDATE public.purchase_orders SET total = v_total WHERE id = v_po_id;

  RETURN jsonb_build_object('success', true, 'po_id', v_po_id, 'no_po', v_no_po, 'items_count', v_items_count, 'total', v_total);
END;
$$;

-- 7.14 Log Audit Trail Event
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
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_log_id UUID;
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, action, target, ip, created_at)
  VALUES (v_user_id, v_user_email, p_action, p_target, p_ip, now())
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_import_batches ENABLE ROW LEVEL SECURITY;

-- 8.1 Profiles
DROP POLICY IF EXISTS "profiles_select_auth" ON public.profiles;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_owner_only" ON public.profiles;
CREATE POLICY "profiles_update_owner_only" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_owner() OR auth.uid() = id)
  WITH CHECK (public.is_owner() OR (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())));

-- 8.2 Categories & Units
DROP POLICY IF EXISTS "categories_select_auth" ON public.categories;
CREATE POLICY "categories_select_auth" ON public.categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "categories_modify_auth" ON public.categories;
CREATE POLICY "categories_modify_auth" ON public.categories FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "units_select_auth" ON public.units;
CREATE POLICY "units_select_auth" ON public.units FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "units_modify_auth" ON public.units;
CREATE POLICY "units_modify_auth" ON public.units FOR ALL TO authenticated USING (true);

-- 8.3 Suppliers & Customers
DROP POLICY IF EXISTS "suppliers_all_auth" ON public.suppliers;
CREATE POLICY "suppliers_all_auth" ON public.suppliers FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "customers_all_auth" ON public.customers;
CREATE POLICY "customers_all_auth" ON public.customers FOR ALL TO authenticated USING (true);

-- 8.4 Products & Product Images
DROP POLICY IF EXISTS "products_select_auth" ON public.products;
CREATE POLICY "products_select_auth" ON public.products FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "products_insert_auth" ON public.products;
CREATE POLICY "products_insert_auth" ON public.products FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "products_update_auth" ON public.products;
CREATE POLICY "products_update_auth" ON public.products FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "products_delete_owner" ON public.products;
CREATE POLICY "products_delete_owner" ON public.products FOR DELETE TO authenticated USING (public.is_owner());

DROP POLICY IF EXISTS "product_images_all_auth" ON public.product_images;
CREATE POLICY "product_images_all_auth" ON public.product_images FOR ALL TO authenticated USING (true);

-- 8.5 Transactions
DROP POLICY IF EXISTS "transactions_select_auth" ON public.transactions;
CREATE POLICY "transactions_select_auth" ON public.transactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "transactions_insert_auth" ON public.transactions;
CREATE POLICY "transactions_insert_auth" ON public.transactions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "transactions_delete_owner" ON public.transactions;
CREATE POLICY "transactions_delete_owner" ON public.transactions FOR DELETE TO authenticated USING (public.is_owner());

-- 8.6 Purchase Orders & Items
DROP POLICY IF EXISTS "po_select_auth" ON public.purchase_orders;
CREATE POLICY "po_select_auth" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "po_all_auth" ON public.purchase_orders;
CREATE POLICY "po_all_auth" ON public.purchase_orders FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "poi_select_auth" ON public.purchase_order_items;
CREATE POLICY "poi_select_auth" ON public.purchase_order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "poi_all_auth" ON public.purchase_order_items;
CREATE POLICY "poi_all_auth" ON public.purchase_order_items FOR ALL TO authenticated USING (true);

-- 8.7 Returns
DROP POLICY IF EXISTS "returns_select_auth" ON public.returns;
CREATE POLICY "returns_select_auth" ON public.returns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "returns_all_auth" ON public.returns;
CREATE POLICY "returns_all_auth" ON public.returns FOR ALL TO authenticated USING (true);

-- 8.8 Cash Flow & Debts
DROP POLICY IF EXISTS "cash_flow_all_auth" ON public.cash_flow;
CREATE POLICY "cash_flow_all_auth" ON public.cash_flow FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "debts_all_auth" ON public.debts;
CREATE POLICY "debts_all_auth" ON public.debts FOR ALL TO authenticated USING (true);

-- 8.9 App Settings
DROP POLICY IF EXISTS "app_settings_select_auth" ON public.app_settings;
CREATE POLICY "app_settings_select_auth" ON public.app_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "app_settings_update_owner" ON public.app_settings;
CREATE POLICY "app_settings_update_owner" ON public.app_settings FOR ALL TO authenticated USING (public.is_owner());

-- 8.10 Audit & Backup Logs
DROP POLICY IF EXISTS "audit_logs_select_owner" ON public.audit_logs;
CREATE POLICY "audit_logs_select_owner" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_owner());
DROP POLICY IF EXISTS "audit_logs_insert_auth" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_auth" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "backup_logs_owner" ON public.backup_logs;
CREATE POLICY "backup_logs_owner" ON public.backup_logs FOR ALL TO authenticated USING (public.is_owner());

-- 8.11 Notifications
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_insert_auth" ON public.notifications;
CREATE POLICY "notifications_insert_auth" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 8.12 Stock Adjustments
DROP POLICY IF EXISTS "stock_adjustments_select_owner" ON public.stock_adjustments;
CREATE POLICY "stock_adjustments_select_owner" ON public.stock_adjustments FOR SELECT TO authenticated USING (public.is_owner());
DROP POLICY IF EXISTS "stock_adjustments_insert_owner" ON public.stock_adjustments;
CREATE POLICY "stock_adjustments_insert_owner" ON public.stock_adjustments FOR INSERT TO authenticated WITH CHECK (public.is_owner());

-- 8.13 CSV Import Batches
DROP POLICY IF EXISTS "csv_import_batches_all_auth" ON public.csv_import_batches;
CREATE POLICY "csv_import_batches_all_auth" ON public.csv_import_batches FOR ALL TO authenticated USING (true);

-- ════════════════════════════════════════════════════════════════════════════
-- 9. PERMISSIONS (GRANTS) UNTUK SUPABASE API / POSTGREST
-- ════════════════════════════════════════════════════════════════════════════

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, anon;

-- Reload Supabase Schema Cache
NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════════════
-- 10. CONTOH SEED DATA AWAL (KATALOG DASAR TOKO)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.categories (id, name) VALUES
  (1, 'Filter'),
  (2, 'Lampu LED'),
  (3, 'Aerator'),
  (4, 'Substrat & Pasir'),
  (5, 'Hardscape (Batu & Kayu)'),
  (6, 'Pakan Ikan'),
  (7, 'Obat & Vitamin'),
  (8, 'Aksesoris & Selang')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.suppliers (name, contact_name, phone, email, address, is_active) VALUES
  ('CV Aquazonic Indonesia', 'Bpk. Hendra', '0812-3456-7890', 'hendra@aquazonic.id', 'Komp. Pergudangan Daan Mogot, Jakarta Barat', true),
  ('PT Sinar Bahari Bekasi', 'Ibu Ratna', '0813-9876-5432', 'sales@sinarbahari.co.id', 'Jl. Sultan Agung No. 45, Medan Satria, Bekasi', true),
  ('Toko Substrat Alam Sentosa', 'Bpk. Budi', '0857-1122-3344', 'budi@substrat.id', 'Jl. Raya Bogor KM 28, Cimanggis, Depok', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.customers (name, phone, email, address, notes) VALUES
  ('Toko Ikan Hias Pondok Gede', '0812-9988-7766', 'pondokgede@ikan.local', 'Jl. Raya Jatiwaringin No. 12, Bekasi', 'Pelanggan reseller rutin'),
  ('Aquascape Bekasi Timur', '0856-4433-2211', 'timur.aqua@gmail.com', 'Ruko Blue Oasis No. 8, Bekasi Timur', 'Pembayaran termin 14 hari'),
  ('Bpk. Andi Wijaya (Retail)', '0878-1234-5678', 'andi.w@gmail.com', 'Perum Jatimakmur Indah Blok B3, Bekasi', 'Konsumen langsung')
ON CONFLICT DO NOTHING;

INSERT INTO public.products (sku, name, brand, category_id, stock, min_stock, cost_price, sell_price) VALUES
  ('FLTR-501', 'Filter Hang-on 501 Slim', 'Aquazonic', 1, 18, 5, 65000, 85000),
  ('LAMP-60W', 'Lampu LED Aquascape Pro 60cm WRGB', 'Chihiros Replica', 2, 12, 4, 320000, 450000),
  ('AER-ACDC', 'Pompa Udara Baterai AC/DC 2 Lubang', 'Recent', 3, 9, 3, 95000, 135000),
  ('SUB-SIL1', 'Pasir Silika Hitam Halus 1kg', 'Local', 4, 54, 10, 7500, 12000),
  ('SEI-RYU1', 'Batu Seiryu Stone Pilihan per Kg', 'Import', 5, 25, 5, 22000, 35000),
  ('PAKN-FLK', 'Pakan Ikan Tropis Flake Premium 100g', 'Tetra', 6, 30, 8, 38000, 52000),
  ('OBAT-BLU', 'Obat Biru / Methylene Blue 100ml', 'Rid-All', 7, 24, 6, 8500, 15000)
ON CONFLICT (sku) DO NOTHING;
