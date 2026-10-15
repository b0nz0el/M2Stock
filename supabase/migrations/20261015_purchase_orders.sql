-- =========================================================
-- aQuaStock Pro — Migration: Purchase Orders & Items
-- File: supabase/migrations/20261015_purchase_orders.sql
-- =========================================================

-- 1. Table purchase_orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_po TEXT UNIQUE NOT NULL,
  tanggal DATE DEFAULT CURRENT_DATE,
  supplier_id UUID,
  status TEXT CHECK (status IN ('draft','dikirim','diterima','dibatalkan')) DEFAULT 'draft',
  total NUMERIC DEFAULT 0,
  catatan TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks performa purchase_orders
CREATE INDEX IF NOT EXISTS idx_po_no_po ON public.purchase_orders(no_po);
CREATE INDEX IF NOT EXISTS idx_po_tanggal ON public.purchase_orders(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_created_at ON public.purchase_orders(created_at DESC);

-- 2. Table purchase_order_items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID,
  qty INT NOT NULL CHECK (qty > 0),
  harga NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks performa purchase_order_items
CREATE INDEX IF NOT EXISTS idx_poi_po_id ON public.purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_poi_product_id ON public.purchase_order_items(product_id);

-- Enable Row Level Security (RLS) pada KEDUA tabel
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════
-- POLICIES UNTUK purchase_orders (OWNER & STAFF CRUD)
-- ═══════════════════════════════════════════════════

DROP POLICY IF EXISTS "PO select policy for OWNER and STAFF" ON public.purchase_orders;
CREATE POLICY "PO select policy for OWNER and STAFF"
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
  )
);

DROP POLICY IF EXISTS "PO insert policy for OWNER and STAFF" ON public.purchase_orders;
CREATE POLICY "PO insert policy for OWNER and STAFF"
ON public.purchase_orders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
  )
);

DROP POLICY IF EXISTS "PO update policy for OWNER and STAFF" ON public.purchase_orders;
CREATE POLICY "PO update policy for OWNER and STAFF"
ON public.purchase_orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
  )
);

DROP POLICY IF EXISTS "PO delete policy for OWNER and STAFF" ON public.purchase_orders;
CREATE POLICY "PO delete policy for OWNER and STAFF"
ON public.purchase_orders
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
  )
);

-- ═══════════════════════════════════════════════════
-- POLICIES UNTUK purchase_order_items (OWNER & STAFF CRUD)
-- ═══════════════════════════════════════════════════

DROP POLICY IF EXISTS "POI select policy for OWNER and STAFF" ON public.purchase_order_items;
CREATE POLICY "POI select policy for OWNER and STAFF"
ON public.purchase_order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
  )
);

DROP POLICY IF EXISTS "POI insert policy for OWNER and STAFF" ON public.purchase_order_items;
CREATE POLICY "POI insert policy for OWNER and STAFF"
ON public.purchase_order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
  )
);

DROP POLICY IF EXISTS "POI update policy for OWNER and STAFF" ON public.purchase_order_items;
CREATE POLICY "POI update policy for OWNER and STAFF"
ON public.purchase_order_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
  )
);

DROP POLICY IF EXISTS "POI delete policy for OWNER and STAFF" ON public.purchase_order_items;
CREATE POLICY "POI delete policy for OWNER and STAFF"
ON public.purchase_order_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
  )
);
