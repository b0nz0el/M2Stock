-- ═══════════════════════════════════════════════════════════════════════════════
-- M2Stock: RPC admin_create_user, admin_delete_user & sync profiles
-- Memungkinkan OWNER membuat & menghapus akun pengguna langsung dari M2Stock
-- Serta memastikan pengguna yang dihapus dari public.profiles langsung hilang dari UI
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Perbaiki fungsi get_auth_users:
-- Mengambil DARI public.profiles agar user yang dihapus dari tabel profiles tidak muncul lagi sebagai ghost user!
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
#variable_conflict use_column
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
    profiles.id,
    COALESCE(users.email, profiles.email, '')::TEXT,
    COALESCE(
      profiles.full_name,
      profiles.name,
      split_part(COALESCE(users.email, profiles.email, ''), '@', 1)
    )::TEXT,
    COALESCE(UPPER(profiles.role), 'VIEWER')::TEXT,
    users.last_sign_in_at,
    COALESCE(profiles.created_at, users.created_at)
  FROM public.profiles AS profiles
  LEFT JOIN auth.users AS users ON users.id = profiles.id
  ORDER BY COALESCE(profiles.created_at, users.created_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_users() TO authenticated;

-- 2. Buat fungsi admin_create_user (Hanya OWNER yang dapat mengeksekusi)
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
  -- A. Otorisasi: Pemanggil harus user terautentikasi dengan role OWNER
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna belum login.' USING ERRCODE = '42501';
  END IF;

  SELECT UPPER(profiles.role) INTO calling_role
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF calling_role <> 'OWNER' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya role OWNER yang berhak membuat user baru.' USING ERRCODE = '42501';
  END IF;

  -- B. Validasi input
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

  -- C. Cek duplikasi email
  IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = clean_email) THEN
    RAISE EXCEPTION 'Email "%" sudah terdaftar di sistem.', clean_email USING ERRCODE = '23505';
  END IF;

  -- D. Hash password dengan bcrypt (ekstensi pgcrypto bawaan Supabase)
  encrypted_pw := crypt(new_password, gen_salt('bf'));

  -- E. Insert akun ke auth.users (langsung terkonfirmasi)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    new_user_id,
    'authenticated',
    'authenticated',
    clean_email,
    encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', clean_name, 'name', clean_name),
    now(),
    now(),
    '',
    ''
  );

  -- F. Insert identitas auth (id bertipe UUID)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', clean_email),
    'email',
    clean_email,
    now(),
    now(),
    now()
  );

  -- G. Sinkronisasi profil ke public.profiles
  INSERT INTO public.profiles (id, name, full_name, email, role, created_at, updated_at)
  VALUES (new_user_id, clean_name, clean_name, clean_email, normalized_role, now(), now())
  ON CONFLICT (id) DO UPDATE
  SET role = normalized_role,
      name = clean_name,
      full_name = clean_name,
      email = clean_email,
      updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', clean_email,
    'role', normalized_role,
    'full_name', clean_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 3. Buat fungsi admin_delete_user (Hanya OWNER yang dapat menghapus user)
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

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Anda tidak dapat menghapus akun Anda sendiri.' USING ERRCODE = '23514';
  END IF;

  DELETE FROM auth.identities WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', target_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- 4. Trigger pembersih otomatis jika profile dihapus langsung dari Supabase Table Editor
CREATE OR REPLACE FUNCTION public.handle_profile_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.identities WHERE user_id = OLD.id;
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_deleted ON public.profiles;
CREATE TRIGGER trg_profile_deleted
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_deleted();

NOTIFY pgrst, 'reload schema';
