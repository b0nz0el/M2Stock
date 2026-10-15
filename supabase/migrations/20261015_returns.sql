-- =========================================================
-- aQuaStock Pro — Migration: Returns (Retur Barang)
-- File: supabase/migrations/20261015_returns.sql
-- =========================================================

CREATE TABLE IF NOT EXISTS public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_retur TEXT UNIQUE NOT NULL,
  tanggal DATE DEFAULT CURRENT_DATE,
  tipe TEXT CHECK (tipe IN ('ke_supplier','dari_customer')) NOT NULL,
  produk_id UUID,
  qty INT NOT NULL CHECK (qty > 0),
  alasan TEXT NOT NULL,
  status TEXT CHECK (status IN ('diproses','selesai','ditolak')) DEFAULT 'diproses',
  keterangan TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks performa
CREATE INDEX IF NOT EXISTS idx_returns_no_retur ON public.returns(no_retur);
CREATE INDEX IF NOT EXISTS idx_returns_tanggal ON public.returns(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_returns_tipe ON public.returns(tipe);
CREATE INDEX IF NOT EXISTS idx_returns_status ON public.returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON public.returns(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- 1. Policy Read: Hanya OWNER dan STAFF
DROP POLICY IF EXISTS "Returns select policy for OWNER and STAFF" ON public.returns;
CREATE POLICY "Returns select policy for OWNER and STAFF"
ON public.returns
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
  )
);

-- 2. Policy Insert: Hanya OWNER dan STAFF
DROP POLICY IF EXISTS "Returns insert policy for OWNER and STAFF" ON public.returns;
CREATE POLICY "Returns insert policy for OWNER and STAFF"
ON public.returns
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
  )
);

-- 3. Policy Update: Hanya OWNER dan STAFF
DROP POLICY IF EXISTS "Returns update policy for OWNER and STAFF" ON public.returns;
CREATE POLICY "Returns update policy for OWNER and STAFF"
ON public.returns
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

-- 4. Policy Delete: Hanya OWNER dan STAFF
DROP POLICY IF EXISTS "Returns delete policy for OWNER and STAFF" ON public.returns;
CREATE POLICY "Returns delete policy for OWNER and STAFF"
ON public.returns
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
  )
);
