-- Align page roles with the approved OWNER / STAFF / VIEWER access matrix.

-- Normalize helpers because older role-management paths stored lowercase roles.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT UPPER(role)
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE SQL
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

UPDATE public.profiles
SET role = UPPER(role)
WHERE role <> UPPER(role);

-- Remove legacy self-update policies that could override the owner-only policy.
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self_or_owner" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_owner_only" ON public.profiles;
CREATE POLICY "profiles_update_owner_only" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- VIEWER may read Purchase Orders and Returns, but cannot mutate either.
DROP POLICY IF EXISTS "PO select" ON public.purchase_orders;
DROP POLICY IF EXISTS "PO select policy for OWNER and STAFF" ON public.purchase_orders;
CREATE POLICY "PO select" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF', 'VIEWER')
    )
  );

DROP POLICY IF EXISTS "PO insert" ON public.purchase_orders;
DROP POLICY IF EXISTS "PO insert policy for OWNER and STAFF" ON public.purchase_orders;
CREATE POLICY "PO insert" ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  );

DROP POLICY IF EXISTS "PO update" ON public.purchase_orders;
DROP POLICY IF EXISTS "PO update policy for OWNER and STAFF" ON public.purchase_orders;
CREATE POLICY "PO update" ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  );

DROP POLICY IF EXISTS "POI select" ON public.purchase_order_items;
DROP POLICY IF EXISTS "POI select policy for OWNER and STAFF" ON public.purchase_order_items;
CREATE POLICY "POI select" ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF', 'VIEWER')
    )
  );

DROP POLICY IF EXISTS "POI insert" ON public.purchase_order_items;
DROP POLICY IF EXISTS "POI insert policy for OWNER and STAFF" ON public.purchase_order_items;
CREATE POLICY "POI insert" ON public.purchase_order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  );

DROP POLICY IF EXISTS "POI update" ON public.purchase_order_items;
DROP POLICY IF EXISTS "POI update policy for OWNER and STAFF" ON public.purchase_order_items;
CREATE POLICY "POI update" ON public.purchase_order_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  );

DROP POLICY IF EXISTS "Returns select policy for OWNER and STAFF" ON public.returns;
CREATE POLICY "Returns select policy for OWNER and STAFF" ON public.returns
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF', 'VIEWER')
    )
  );

DROP POLICY IF EXISTS "Returns insert policy for OWNER and STAFF" ON public.returns;
CREATE POLICY "Returns insert policy for OWNER and STAFF" ON public.returns
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  );

DROP POLICY IF EXISTS "Returns update policy for OWNER and STAFF" ON public.returns;
CREATE POLICY "Returns update policy for OWNER and STAFF" ON public.returns
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  );

-- STAFF may create/read/update these records; deletion remains OWNER-only.
DROP POLICY IF EXISTS "PO delete" ON public.purchase_orders;
DROP POLICY IF EXISTS "PO delete policy for OWNER and STAFF" ON public.purchase_orders;
CREATE POLICY "PO delete" ON public.purchase_orders
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) = 'OWNER'
    )
  );

DROP POLICY IF EXISTS "POI delete" ON public.purchase_order_items;
DROP POLICY IF EXISTS "POI delete policy for OWNER and STAFF" ON public.purchase_order_items;
CREATE POLICY "POI delete" ON public.purchase_order_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) = 'OWNER'
    )
  );

DROP POLICY IF EXISTS "Returns delete policy for OWNER and STAFF" ON public.returns;
CREATE POLICY "Returns delete policy for OWNER and STAFF" ON public.returns
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) = 'OWNER'
    )
  );

DROP POLICY IF EXISTS "Owners and Staff can insert cash flow" ON public.cash_flow;
CREATE POLICY "Owners and Staff can insert cash flow" ON public.cash_flow
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  );

DROP POLICY IF EXISTS "Owners and Staff can update cash flow" ON public.cash_flow;
CREATE POLICY "Owners and Staff can update cash flow" ON public.cash_flow
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  );

DROP POLICY IF EXISTS "Owners and Staff can delete cash flow" ON public.cash_flow;
CREATE POLICY "Owners and Staff can delete cash flow" ON public.cash_flow
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) = 'OWNER'
    )
  );

DROP POLICY IF EXISTS "Owners and Staff can delete debts" ON public.debts;
DROP POLICY IF EXISTS "Owners and Staff can insert debts" ON public.debts;
CREATE POLICY "Owners and Staff can insert debts" ON public.debts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  );

DROP POLICY IF EXISTS "Owners and Staff can update debts" ON public.debts;
CREATE POLICY "Owners and Staff can update debts" ON public.debts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  );

DROP POLICY IF EXISTS "Owners and Staff can delete debts" ON public.debts;
CREATE POLICY "Owners and Staff can delete debts" ON public.debts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) = 'OWNER'
    )
  );

-- STAFF can view audit and backup logs but cannot alter them.
DROP POLICY IF EXISTS "Owners can view audit logs" ON public.audit_logs;
CREATE POLICY "Owners can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  );

DROP POLICY IF EXISTS "backup_logs_select_owner" ON public.backup_logs;
DROP POLICY IF EXISTS "Owners can view backup logs" ON public.backup_logs;
CREATE POLICY "backup_logs_select_owner" ON public.backup_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
    )
  );

-- Expose the user directory to STAFF as read-only; role changes stay OWNER-only.
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
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND UPPER(profiles.role) IN ('OWNER', 'STAFF')
  ) THEN
    RAISE EXCEPTION 'Akses ditolak: hanya OWNER atau STAFF yang dapat melihat daftar pengguna.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    users.id,
    users.email::TEXT,
    COALESCE(
      to_jsonb(profiles)->>'full_name',
      to_jsonb(profiles)->>'name',
      split_part(users.email, '@', 1)
    )::TEXT,
    COALESCE(to_jsonb(profiles)->>'role', 'VIEWER')::TEXT,
    users.last_sign_in_at,
    users.created_at
  FROM auth.users AS users
  LEFT JOIN public.profiles AS profiles ON profiles.id = users.id
  ORDER BY users.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_users() TO authenticated;

-- Normalize future role changes and keep this write RPC OWNER-only.
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_role TEXT := UPPER(TRIM(new_role));
  current_target_role TEXT;
  owner_count INTEGER;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya OWNER yang dapat mengubah role pengguna.'
      USING ERRCODE = '42501';
  END IF;

  IF normalized_role IS NULL OR normalized_role NOT IN ('OWNER', 'STAFF', 'VIEWER') THEN
    RAISE EXCEPTION 'Role tidak valid.'
      USING ERRCODE = '23514';
  END IF;

  SELECT UPPER(role) INTO current_target_role
  FROM public.profiles
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil pengguna tidak ditemukan.'
      USING ERRCODE = 'P0002';
  END IF;

  IF current_target_role = 'OWNER' AND normalized_role <> 'OWNER' THEN
    SELECT count(*) INTO owner_count
    FROM public.profiles
    WHERE UPPER(role) = 'OWNER';

    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Sistem harus memiliki minimal satu OWNER.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.profiles
  SET role = normalized_role,
      updated_at = now()
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_role(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
