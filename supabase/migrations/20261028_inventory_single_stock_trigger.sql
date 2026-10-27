-- Recreate one canonical stock trigger and remove legacy triggers that apply
-- the same transaction movement a second time.
DO $$
DECLARE
  existing_trigger RECORD;
BEGIN
  FOR existing_trigger IN
    SELECT t.tgname
    FROM pg_trigger AS t
    WHERE t.tgrelid = 'public.transactions'::regclass
      AND NOT t.tgisinternal
      AND (
        t.tgname IN (
          'trg_transaction_stock_update',
          'trg_transactions_auto_stock'
        )
        OR t.tgfoid IN (
          to_regprocedure('public.handle_transaction_stock_update()'),
          to_regprocedure('public.trg_update_stock_on_transaction()')
        )
      )
  LOOP
    EXECUTE format(
      'DROP TRIGGER %I ON public.transactions',
      existing_trigger.tgname
    );
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_stock_update ON public.transactions;
CREATE TRIGGER trg_transaction_stock_update
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_transaction_stock_update();
