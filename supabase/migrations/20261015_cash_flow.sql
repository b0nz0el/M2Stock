-- Migration: Cash Flow & Finance Management
-- Table: cash_flow
-- Created: 2026-10-15

CREATE TABLE IF NOT EXISTS cash_flow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  keterangan TEXT NOT NULL,
  kategori TEXT NOT NULL CHECK (kategori IN ('Penjualan', 'Pembelian', 'Gaji', 'Operasional', 'Lainnya')),
  metode TEXT NOT NULL CHECK (metode IN ('Cash', 'Transfer', 'QRIS')),
  pemasukan NUMERIC NOT NULL DEFAULT 0,
  pengeluaran NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cash_flow_tanggal ON cash_flow(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_cash_flow_kategori ON cash_flow(kategori);
CREATE INDEX IF NOT EXISTS idx_cash_flow_metode ON cash_flow(metode);
CREATE INDEX IF NOT EXISTS idx_cash_flow_created_by ON cash_flow(created_by);

-- Enable Row Level Security (RLS)
ALTER TABLE cash_flow ENABLE ROW LEVEL SECURITY;

-- Policy 1: Select allowed for OWNER and STAFF only (VIEWER has NO access)
DROP POLICY IF EXISTS "Owners and Staff can view cash flow" ON cash_flow;
CREATE POLICY "Owners and Staff can view cash flow" ON cash_flow
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
    )
  );

-- Policy 2: Insert allowed for OWNER and STAFF only
DROP POLICY IF EXISTS "Owners and Staff can insert cash flow" ON cash_flow;
CREATE POLICY "Owners and Staff can insert cash flow" ON cash_flow
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
    )
  );

-- Policy 3: Update allowed for OWNER and STAFF only
DROP POLICY IF EXISTS "Owners and Staff can update cash flow" ON cash_flow;
CREATE POLICY "Owners and Staff can update cash flow" ON cash_flow
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
    )
  );

-- Policy 4: Delete allowed for OWNER and STAFF only
DROP POLICY IF EXISTS "Owners and Staff can delete cash flow" ON cash_flow;
CREATE POLICY "Owners and Staff can delete cash flow" ON cash_flow
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
    )
  );
