-- Keep exactly one transaction trigger responsible for inventory mutations.
DO $$
DECLARE
  existing_trigger RECORD;
BEGIN
  FOR existing_trigger IN
    SELECT t.tgname
    FROM pg_trigger AS t
    WHERE t.tgrelid = 'public.transactions'::regclass
      AND NOT t.tgisinternal
      AND t.tgfoid = 'public.handle_transaction_stock_update()'::regprocedure
  LOOP
    EXECUTE format(
      'DROP TRIGGER %I ON public.transactions',
      existing_trigger.tgname
    );
  END LOOP;
END;
$$;

CREATE TRIGGER trg_transaction_stock_update
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_transaction_stock_update();
