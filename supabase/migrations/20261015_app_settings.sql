-- Migration: Create app_settings table with RLS and default seed
-- Date: 2026-10-15
-- Author: Aquastock Pro Engineering Team

CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Seed default settings keys
INSERT INTO public.app_settings (key, value)
VALUES
    ('store_info', '{"name": "Aquarium David", "address": "Jl. Merdeka No. 123, Jakarta", "phone": "0812-3456-7890", "email": "info@aquastock.pro", "slogan": "Solusi Lengkap Kebutuhan Akuarium & Ikan Hias"}'::jsonb),
    ('pos_config', '{"tax_rate": 11, "service_rate": 0, "receipt_footer": "Terima kasih telah berbelanja di Aquarium David!", "default_payment": "Cash"}'::jsonb),
    ('stock_config', '{"min_stock_alert": 5, "auto_po_enabled": false}'::jsonb),
    ('appearance', '{"theme": "dark", "primary_color": "#0088CC", "compact_mode": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON public.app_settings(updated_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Helper check: User is OWNER either via profiles table or JWT metadata (case-insensitive)
-- Policy 1: SELECT - Semua authenticated user bisa membaca pengaturan aplikasi
DROP POLICY IF EXISTS "app_settings_select_authenticated" ON public.app_settings;
CREATE POLICY "app_settings_select_authenticated"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: INSERT - Hanya OWNER yang dapat menambah key pengaturan baru
DROP POLICY IF EXISTS "app_settings_insert_owner" ON public.app_settings;
CREATE POLICY "app_settings_insert_owner"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND UPPER(profiles.role) = 'OWNER'
    )
    OR UPPER(COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '')) = 'OWNER'
    OR UPPER(COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'OWNER'
);

-- Policy 3: UPDATE - Hanya OWNER yang dapat mengubah nilai pengaturan
DROP POLICY IF EXISTS "app_settings_update_owner" ON public.app_settings;
CREATE POLICY "app_settings_update_owner"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND UPPER(profiles.role) = 'OWNER'
    )
    OR UPPER(COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '')) = 'OWNER'
    OR UPPER(COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'OWNER'
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND UPPER(profiles.role) = 'OWNER'
    )
    OR UPPER(COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '')) = 'OWNER'
    OR UPPER(COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'OWNER'
);
