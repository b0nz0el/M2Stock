-- Restrict sensitive security-definer RPCs to authenticated callers.
DO $$
DECLARE
  v_function REGPROCEDURE;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_purchase_order_atomic',
        'receive_purchase_order',
        'complete_return',
        'generate_draft_po_from_low_stock',
        'log_audit_event'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', v_function);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_function);
  END LOOP;
END $$;

-- Keep the existing implementation but put a strict authorization boundary in front of it.
ALTER FUNCTION public.generate_draft_po_from_low_stock(TEXT)
  RENAME TO generate_draft_po_from_low_stock_unchecked;

REVOKE ALL ON FUNCTION public.generate_draft_po_from_low_stock_unchecked(TEXT)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.generate_draft_po_from_low_stock(p_supplier_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: pengguna harus terautentikasi'
      USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF UPPER(COALESCE(v_user_role, '')) NOT IN ('OWNER', 'STAFF') THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya OWNER atau STAFF yang dapat membuat Draft PO'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.generate_draft_po_from_low_stock_unchecked(p_supplier_id);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_draft_po_from_low_stock(TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_draft_po_from_low_stock(TEXT)
  TO authenticated;

-- A user may update a profile only when they are already an owner.
DROP POLICY IF EXISTS "profiles_update_self_or_owner" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_owner_only" ON public.profiles;
CREATE POLICY "profiles_update_owner_only" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Only the profile's database role is authoritative; user-editable JWT metadata is not.
DROP POLICY IF EXISTS "app_settings_insert_owner" ON public.app_settings;
CREATE POLICY "app_settings_insert_owner"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND UPPER(profiles.role) = 'OWNER'
  )
);

DROP POLICY IF EXISTS "app_settings_update_owner" ON public.app_settings;
CREATE POLICY "app_settings_update_owner"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND UPPER(profiles.role) = 'OWNER'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND UPPER(profiles.role) = 'OWNER'
  )
);

NOTIFY pgrst, 'reload schema';
