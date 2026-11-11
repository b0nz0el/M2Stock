-- ═══════════════════════════════════════════════════════════════════════════════
-- M2Stock: Fix Staff Login, Identities & Password Management
-- File: 20261112_fix_staff_login_auth_identities.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- Pastikan ekstensi pgcrypto aktif untuk bcrypt password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TRIGGER: Auto-Confirm User Baru (Bypass Email Confirmation Lock)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_confirm_new_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_new_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TRIGGER: handle_new_user (Dukung role dari raw_user_meta_data)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  assigned_role TEXT;
  user_name TEXT;
  meta_role TEXT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;

  meta_role := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));

  IF user_count = 0 THEN
    assigned_role := 'OWNER';
  ELSIF meta_role IN ('OWNER', 'STAFF', 'VIEWER') THEN
    assigned_role := meta_role;
  ELSE
    assigned_role := 'STAFF';
  END IF;

  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, name, full_name, email, role)
  VALUES (NEW.id, user_name, user_name, NEW.email, assigned_role)
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      full_name = COALESCE(EXCLUDED.full_name, EXCLUDED.name),
      email = COALESCE(EXCLUDED.email, profiles.email),
      role = CASE 
               WHEN public.profiles.role IS NULL THEN EXCLUDED.role 
               ELSE public.profiles.role 
             END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: admin_create_user (Diperbaiki: provider_id, id, confirmed_at, metadata)
-- ─────────────────────────────────────────────────────────────────────────────
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
  -- A. Otorisasi: Pemanggil harus role OWNER
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

  -- D. Hash password dengan bcrypt
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
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    new_user_id,
    'authenticated',
    'authenticated',
    clean_email,
    encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', clean_name, 'name', clean_name, 'role', normalized_role),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- F. Insert identitas auth (Kritis: provider_id wajib new_user_id::text)
  DELETE FROM auth.identities WHERE user_id = new_user_id AND provider = 'email';
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
    new_user_id::text,
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: admin_reset_password (Memungkinkan OWNER mereset password staf)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reset_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
#variable_conflict use_column
DECLARE
  calling_role TEXT;
  encrypted_pw TEXT;
  target_email TEXT;
BEGIN
  -- A. Otorisasi: Pemanggil harus role OWNER
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna belum login.' USING ERRCODE = '42501';
  END IF;

  SELECT UPPER(profiles.role) INTO calling_role
  FROM public.profiles WHERE profiles.id = auth.uid();

  IF calling_role <> 'OWNER' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya OWNER yang berhak mereset password pengguna.' USING ERRCODE = '42501';
  END IF;

  -- B. Validasi password
  IF new_password IS NULL OR length(new_password) < 8 THEN
    RAISE EXCEPTION 'Password minimal 8 karakter.' USING ERRCODE = '23514';
  END IF;

  -- C. Cek user ada di auth.users
  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
  IF target_email IS NULL THEN
    RAISE EXCEPTION 'Pengguna dengan ID % tidak ditemukan.', target_user_id USING ERRCODE = 'P0002';
  END IF;

  -- D. Hash password baru dengan bcrypt
  encrypted_pw := crypt(new_password, gen_salt('bf'));

  -- E. Update password di auth.users & pastikan status email confirmed
  UPDATE auth.users
  SET encrypted_password = encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = target_user_id;

  -- F. Sinkronisasi identitas login di auth.identities
  DELETE FROM auth.identities WHERE user_id = target_user_id AND provider = 'email';
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
    target_user_id,
    jsonb_build_object('sub', target_user_id::text, 'email', lower(target_email)),
    'email',
    target_user_id::text,
    now(),
    now(),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'email', target_email,
    'message', 'Password berhasil direset'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_password(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AUTO-REPAIR DATA STAF & PENGGUNA LAMA (One-Click Repair)
-- ─────────────────────────────────────────────────────────────────────────────

-- 5.1 Konfirmasi semua akun yang tertahan email verification (hanya update email_confirmed_at)
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- 5.2 Perbaiki record auth.identities lama yang provider_id tidak sesuai
UPDATE auth.identities
SET provider_id = user_id::text,
    identity_data = jsonb_build_object('sub', user_id::text, 'email', lower(users.email)),
    updated_at = now()
FROM auth.users users
WHERE auth.identities.user_id = users.id
  AND auth.identities.provider = 'email'
  AND (auth.identities.provider_id IS NULL OR auth.identities.provider_id <> user_id::text);

-- 5.3 Buat record auth.identities bagi user yang belum memilikinya
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', lower(u.email)),
  'email',
  u.id::text,
  now(),
  now(),
  now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i
  WHERE i.user_id = u.id AND i.provider = 'email'
);

-- 5.4 Pastikan semua akun di auth.users memiliki record di public.profiles
INSERT INTO public.profiles (id, name, full_name, email, role, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.email,
  COALESCE(UPPER(u.raw_user_meta_data->>'role'), 'STAFF'),
  COALESCE(u.created_at, now()),
  now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);
