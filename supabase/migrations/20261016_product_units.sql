-- Add a managed unit catalog and link each product to its stock unit.
CREATE TABLE IF NOT EXISTS public.units (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS units_name_case_insensitive_unique_idx
  ON public.units (lower(name));

INSERT INTO public.units (name)
VALUES ('pcs')
ON CONFLICT DO NOTHING;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit_id INTEGER;

UPDATE public.products
SET unit_id = (SELECT id FROM public.units WHERE lower(name) = 'pcs' LIMIT 1)
WHERE unit_id IS NULL;

ALTER TABLE public.products
  ALTER COLUMN unit_id SET NOT NULL;

DO $$
DECLARE
  default_unit_id INTEGER;
BEGIN
  SELECT id INTO default_unit_id
  FROM public.units
  WHERE lower(name) = 'pcs'
  LIMIT 1;

  EXECUTE format(
    'ALTER TABLE public.products ALTER COLUMN unit_id SET DEFAULT %s',
    default_unit_id
  );
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_unit_id_fkey'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS units_select_authenticated ON public.units;
CREATE POLICY units_select_authenticated
  ON public.units FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS units_manage_owner ON public.units;
CREATE POLICY units_manage_owner
  ON public.units FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());
