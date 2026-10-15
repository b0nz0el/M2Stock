-- Migration: Backup Logs
-- Table: backup_logs
-- Created: 2026-10-15

CREATE TABLE IF NOT EXISTS backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('export', 'import')),
  scope TEXT NOT NULL,
  file_name TEXT,
  records_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_backup_logs_action ON backup_logs(action);
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at ON backup_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_user_id ON backup_logs(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

-- Policy 1: Only OWNER can view (SELECT) backup logs
DROP POLICY IF EXISTS "Owners can view backup logs" ON backup_logs;
CREATE POLICY "Owners can view backup logs" ON backup_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'OWNER'
    )
  );

-- Policy 2: Only OWNER can insert backup logs
DROP POLICY IF EXISTS "Owners can insert backup logs" ON backup_logs;
CREATE POLICY "Owners can insert backup logs" ON backup_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'OWNER'
    )
  );
