-- Migration: Debts & Receivables Management (Hutang & Piutang)
-- Table: debts
-- Created: 2026-10-15

CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipe TEXT NOT NULL CHECK (tipe IN ('hutang', 'piutang')),
  pihak TEXT NOT NULL,
  nominal NUMERIC NOT NULL,
  jatuh_tempo DATE,
  status TEXT NOT NULL CHECK (status IN ('belum_bayar', 'lunas', 'jatuh_tempo')) DEFAULT 'belum_bayar',
  catatan TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_debts_tipe ON debts(tipe);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_jatuh_tempo ON debts(jatuh_tempo);
CREATE INDEX IF NOT EXISTS idx_debts_created_by ON debts(created_by);

-- Enable Row Level Security (RLS)
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- Policy 1: Select allowed for OWNER and STAFF only (VIEWER has NO access)
DROP POLICY IF EXISTS "Owners and Staff can view debts" ON debts;
CREATE POLICY "Owners and Staff can view debts" ON debts
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
DROP POLICY IF EXISTS "Owners and Staff can insert debts" ON debts;
CREATE POLICY "Owners and Staff can insert debts" ON debts
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
DROP POLICY IF EXISTS "Owners and Staff can update debts" ON debts;
CREATE POLICY "Owners and Staff can update debts" ON debts
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
DROP POLICY IF EXISTS "Owners and Staff can delete debts" ON debts;
CREATE POLICY "Owners and Staff can delete debts" ON debts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('OWNER', 'STAFF')
    )
  );
