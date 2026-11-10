-- ════════════════════════════════════════════════════════════════════════════
-- M2Stock Migration: Add full_name and email to profiles table
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Tambahkan kolom full_name dan email ke tabel profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Sinkronkan data profil yang sudah ada
UPDATE public.profiles
SET full_name = COALESCE(full_name, name, 'Pengguna')
WHERE full_name IS NULL;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 3. Sinkronisasi dua arah otomatis antara name dan full_name
CREATE OR REPLACE FUNCTION public.sync_profiles_name_and_fullname()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.full_name IS NOT NULL AND (NEW.name IS NULL OR NEW.name = 'Pengguna') THEN
    NEW.name := NEW.full_name;
  ELSIF NEW.name IS NOT NULL AND NEW.full_name IS NULL THEN
    NEW.full_name := NEW.name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profiles_name ON public.profiles;
CREATE TRIGGER trg_sync_profiles_name
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profiles_name_and_fullname();

-- 4. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';

