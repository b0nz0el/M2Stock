-- =========================================================
-- aQuaStock Pro — Migration: Notifications
-- File: supabase/migrations/20261015_notifications.sql
-- =========================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipe TEXT CHECK (tipe IN ('info','warning','success','error')) DEFAULT 'info',
  judul TEXT NOT NULL,
  pesan TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks performa
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: user read own (user_id = auth.uid())
DROP POLICY IF EXISTS "Notifications select own" ON public.notifications;
CREATE POLICY "Notifications select own"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- 2. UPDATE: user mark own read (user_id = auth.uid())
DROP POLICY IF EXISTS "Notifications update own" ON public.notifications;
CREATE POLICY "Notifications update own"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- 3. INSERT: authenticated users can insert notifications
DROP POLICY IF EXISTS "Notifications insert authenticated" ON public.notifications;
CREATE POLICY "Notifications insert authenticated"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- 4. DELETE: OWNER only
DROP POLICY IF EXISTS "Notifications delete owner only" ON public.notifications;
CREATE POLICY "Notifications delete owner only"
ON public.notifications
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'OWNER'
  )
);
