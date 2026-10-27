-- ==============================================================================
-- Aquastock Pro — Migration: Module 1 Report (Laporan)
-- File: supabase/migrations/20261015_report.sql
-- Description: Performance indexes and aggregation views/policies for Report module
-- ==============================================================================

-- 1. Indexes for high-performance report queries on transactions & products
CREATE INDEX IF NOT EXISTS idx_transactions_type_created_at 
ON public.transactions (type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_product_id 
ON public.transactions (product_id);

CREATE INDEX IF NOT EXISTS idx_transactions_customer_id 
ON public.transactions (customer_id);

CREATE INDEX IF NOT EXISTS idx_transactions_supplier_id 
ON public.transactions (supplier_id);

CREATE INDEX IF NOT EXISTS idx_transactions_channel 
ON public.transactions (channel);

CREATE INDEX IF NOT EXISTS idx_transactions_created_by 
ON public.transactions (created_by);

CREATE INDEX IF NOT EXISTS idx_products_category_id 
ON public.products (category_id);

-- 2. Ensure RLS is active on underlying tables
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;

-- 3. Policy Verification for Report Access (OWNER & STAFF read access)
DO $$
BEGIN
    -- Transactions read policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'transactions' AND policyname = 'Allow authenticated read transactions'
    ) THEN
        CREATE POLICY "Allow authenticated read transactions"
        ON public.transactions
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;

    -- Products read policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'products' AND policyname = 'Allow authenticated read products'
    ) THEN
        CREATE POLICY "Allow authenticated read products"
        ON public.products
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;
