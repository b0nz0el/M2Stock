-- =========================================================
-- aQuaStock Pro — Migration: Automated Financial Sync
-- Integrasi Transaksi (Penjualan / Pembelian / PO / Retur) ke Buku Kas & Hutang-Piutang
-- File: supabase/migrations/20261017_financial_automation.sql
-- =========================================================

-- 1. ENHANCE TRANSACTIONS TABLE FOR PAYMENT & FINANCIAL LINKS
-- ---------------------------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Transfer', 'QRIS', 'Tempo')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Lunas' CHECK (payment_status IN ('Lunas', 'Belum Lunas')),
  ADD COLUMN IF NOT EXISTS cash_flow_id UUID REFERENCES public.cash_flow(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON public.transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON public.transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_cash_flow_id ON public.transactions(cash_flow_id);
CREATE INDEX IF NOT EXISTS idx_transactions_debt_id ON public.transactions(debt_id);


-- 2. TRIGGER SYNC: MUTASI TRANSAKSI KE CASH_FLOW & DEBTS
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_transaction_financial_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod_name TEXT;
  v_cust_name TEXT;
  v_sup_name TEXT;
  v_cf_id UUID;
  v_debt_id UUID;
  v_metode TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Ambil nama produk untuk deskripsi catatan keuangan
    SELECT name INTO v_prod_name FROM public.products WHERE id = NEW.product_id;

    -- 1. Transaksi Barang Keluar (Penjualan Toko biasa, bukan dari Retur/PO)
    IF NEW.type = 'out' AND NEW.po_id IS NULL AND NEW.return_id IS NULL AND NEW.total_price > 0 THEN
      v_metode := COALESCE(NEW.payment_method, 'Cash');

      -- Kasus A: Pembayaran Tunai, Transfer, atau QRIS -> Otomatis masuk ke cash_flow
      IF v_metode IN ('Cash', 'Transfer', 'QRIS') THEN
        INSERT INTO public.cash_flow (
          tanggal,
          keterangan,
          kategori,
          metode,
          pemasukan,
          pengeluaran,
          created_by,
          created_at
        ) VALUES (
          COALESCE(NEW.created_at::DATE, CURRENT_DATE),
          'Penjualan: ' || COALESCE(v_prod_name, 'Produk') || ' (' || NEW.quantity || ' unit)',
          'Penjualan',
          v_metode,
          NEW.total_price,
          0,
          NEW.user_id,
          COALESCE(NEW.created_at, now())
        )
        RETURNING id INTO v_cf_id;

        UPDATE public.transactions
        SET cash_flow_id = v_cf_id,
            payment_status = 'Lunas'
        WHERE id = NEW.id;

      -- Kasus B: Pembayaran Tempo -> Otomatis masuk ke debts (Piutang Customer)
      ELSIF v_metode = 'Tempo' THEN
        IF NEW.customer_id IS NOT NULL THEN
          SELECT name INTO v_cust_name FROM public.customers WHERE id = NEW.customer_id;
        END IF;

        INSERT INTO public.debts (
          tipe,
          pihak,
          nominal,
          jatuh_tempo,
          status,
          catatan,
          created_by,
          created_at
        ) VALUES (
          'piutang',
          COALESCE(v_cust_name, 'Customer Umum'),
          NEW.total_price,
          CURRENT_DATE + 14,
          'belum_bayar',
          'Penjualan Tempo: ' || COALESCE(v_prod_name, 'Produk') || ' (' || NEW.quantity || ' unit)',
          NEW.user_id,
          COALESCE(NEW.created_at, now())
        )
        RETURNING id INTO v_debt_id;

        UPDATE public.transactions
        SET debt_id = v_debt_id,
            payment_status = 'Belum Lunas'
        WHERE id = NEW.id;
      END IF;

    -- 2. Transaksi Barang Masuk Manual (Pembelian di luar PO resmi)
    ELSIF NEW.type = 'in' AND NEW.po_id IS NULL AND NEW.return_id IS NULL AND NEW.total_price > 0 THEN
      v_metode := COALESCE(NEW.payment_method, 'Cash');

      IF v_metode IN ('Cash', 'Transfer', 'QRIS') THEN
        INSERT INTO public.cash_flow (
          tanggal,
          keterangan,
          kategori,
          metode,
          pemasukan,
          pengeluaran,
          created_by,
          created_at
        ) VALUES (
          COALESCE(NEW.created_at::DATE, CURRENT_DATE),
          'Pembelian Langsung: ' || COALESCE(v_prod_name, 'Produk') || ' (' || NEW.quantity || ' unit)',
          'Pembelian',
          v_metode,
          0,
          NEW.total_price,
          NEW.user_id,
          COALESCE(NEW.created_at, now())
        )
        RETURNING id INTO v_cf_id;

        UPDATE public.transactions
        SET cash_flow_id = v_cf_id,
            payment_status = 'Lunas'
        WHERE id = NEW.id;

      ELSIF v_metode = 'Tempo' THEN
        IF NEW.supplier_id IS NOT NULL THEN
          SELECT name INTO v_sup_name FROM public.suppliers WHERE id = NEW.supplier_id;
        END IF;

        INSERT INTO public.debts (
          tipe,
          pihak,
          nominal,
          jatuh_tempo,
          status,
          catatan,
          created_by,
          created_at
        ) VALUES (
          'hutang',
          COALESCE(v_sup_name, 'Supplier Umum'),
          NEW.total_price,
          CURRENT_DATE + 30,
          'belum_bayar',
          'Pembelian Tempo: ' || COALESCE(v_prod_name, 'Produk') || ' (' || NEW.quantity || ' unit)',
          NEW.user_id,
          COALESCE(NEW.created_at, now())
        )
        RETURNING id INTO v_debt_id;

        UPDATE public.transactions
        SET debt_id = v_debt_id,
            payment_status = 'Belum Lunas'
        WHERE id = NEW.id;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- Jika transaksi dibatalkan/dihapus, bersihkan data catatan keuangan terkait
  IF TG_OP = 'DELETE' THEN
    IF OLD.cash_flow_id IS NOT NULL THEN
      DELETE FROM public.cash_flow WHERE id = OLD.cash_flow_id;
    END IF;
    IF OLD.debt_id IS NOT NULL THEN
      DELETE FROM public.debts WHERE id = OLD.debt_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_financial_sync ON public.transactions;
CREATE TRIGGER trg_transaction_financial_sync
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_transaction_financial_sync();


-- 3. PERBARUI RPC: PENERIMAAN PO DENGAN OPSI METODE PEMBAYARAN
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_po_id UUID,
  p_payment_method TEXT DEFAULT 'Cash'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_po RECORD;
  v_item RECORD;
  v_received_count INT := 0;
  v_pay_method TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF UPPER(COALESCE(v_user_role, '')) NOT IN ('OWNER', 'STAFF') THEN
      RAISE EXCEPTION 'Akses ditolak: Hanya OWNER atau STAFF yang dapat menerima Purchase Order'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = p_po_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase Order tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  IF v_po.status = 'diterima' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_received', true,
      'message', 'Purchase Order sudah berstatus diterima sebelumnya'
    );
  END IF;

  IF v_po.status = 'dibatalkan' THEN
    RAISE EXCEPTION 'Purchase Order yang sudah dibatalkan tidak dapat diterima' USING ERRCODE = '23514';
  END IF;

  v_pay_method := COALESCE(p_payment_method, 'Cash');
  IF v_pay_method NOT IN ('Cash', 'Transfer', 'QRIS', 'Tempo') THEN
    v_pay_method := 'Cash';
  END IF;

  -- Buat transaksi barang masuk untuk setiap item yang terikat product_id
  FOR v_item IN
    SELECT poi.*, p.name AS catalog_name
    FROM public.purchase_order_items poi
    LEFT JOIN public.products p ON p.id = poi.product_id
    WHERE poi.po_id = p_po_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      INSERT INTO public.transactions (
        product_id,
        supplier_id,
        type,
        quantity,
        unit_price,
        total_price,
        channel,
        notes,
        po_id,
        payment_method,
        payment_status,
        created_at
      ) VALUES (
        v_item.product_id,
        v_po.supplier_id,
        'in',
        v_item.qty,
        COALESCE(v_item.harga, 0),
        v_item.qty * COALESCE(v_item.harga, 0),
        'Supplier PO',
        'Penerimaan PO ' || v_po.no_po || COALESCE(' (' || v_po.supplier_name || ')', ''),
        p_po_id,
        v_pay_method,
        CASE WHEN v_pay_method = 'Tempo' THEN 'Belum Lunas' ELSE 'Lunas' END,
        now()
      )
      ON CONFLICT (po_id, product_id) DO NOTHING;

      v_received_count := v_received_count + 1;
    END IF;
  END LOOP;

  -- Catat Finansial Pembelian PO (Jika total nilai PO > 0)
  IF COALESCE(v_po.total, 0) > 0 THEN
    IF v_pay_method IN ('Cash', 'Transfer', 'QRIS') THEN
      INSERT INTO public.cash_flow (
        tanggal,
        keterangan,
        kategori,
        metode,
        pemasukan,
        pengeluaran,
        created_by,
        created_at
      ) VALUES (
        CURRENT_DATE,
        'Pembayaran PO: ' || v_po.no_po || COALESCE(' (' || v_po.supplier_name || ')', ''),
        'Pembelian',
        v_pay_method,
        0,
        v_po.total,
        v_user_id,
        now()
      );
    ELSIF v_pay_method = 'Tempo' THEN
      INSERT INTO public.debts (
        tipe,
        pihak,
        nominal,
        jatuh_tempo,
        status,
        catatan,
        created_by,
        created_at
      ) VALUES (
        'hutang',
        COALESCE(v_po.supplier_name, 'Supplier'),
        v_po.total,
        CURRENT_DATE + 30,
        'belum_bayar',
        'Hutang Pembelian PO: ' || v_po.no_po,
        v_user_id,
        now()
      );
    END IF;
  END IF;

  -- Update status PO menjadi 'diterima'
  UPDATE public.purchase_orders
  SET status = 'diterima',
      updated_at = now()
  WHERE id = p_po_id;

  PERFORM public.log_audit_event('UPDATE', 'Penerimaan PO ' || v_po.no_po || ' (' || v_received_count || ' item produk, Pembayaran: ' || v_pay_method || ')');

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_po_id,
    'no_po', v_po.no_po,
    'status', 'diterima',
    'payment_method', v_pay_method,
    'items_stocked', v_received_count
  );
END;
$$;


-- 4. PERBARUI RPC: PENYELESAIAN RETUR DENGAN REFUND KAS OTOMATIS
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_return(
  p_return_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_ret RECORD;
  v_current_stock INT;
  v_tx_type TEXT;
  v_note TEXT;
  v_total_refund NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF UPPER(COALESCE(v_user_role, '')) NOT IN ('OWNER', 'STAFF') THEN
      RAISE EXCEPTION 'Akses ditolak: Hanya OWNER atau STAFF yang dapat memproses retur'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_ret
  FROM public.returns
  WHERE id = p_return_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data retur tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  IF v_ret.status = 'selesai' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_completed', true,
      'message', 'Retur sudah berstatus selesai sebelumnya'
    );
  END IF;

  IF v_ret.status = 'ditolak' THEN
    RAISE EXCEPTION 'Retur berstatus ditolak tidak dapat diselesaikan' USING ERRCODE = '23514';
  END IF;

  IF v_ret.produk_id IS NULL THEN
    RAISE EXCEPTION 'Produk pada catatan retur ini tidak valid atau tidak terhubung ke master barang'
      USING ERRCODE = '23514';
  END IF;

  v_total_refund := COALESCE(v_ret.harga_satuan, 0) * v_ret.qty;

  -- 1. Retur Ke Supplier: Stok fisik toko berkurang & terima pengembalian dana
  IF v_ret.tipe = 'ke_supplier' THEN
    SELECT stock INTO v_current_stock FROM public.products WHERE id = v_ret.produk_id FOR UPDATE;
    IF v_current_stock < v_ret.qty THEN
      RAISE EXCEPTION 'Stok produk tidak mencukupi untuk retur ke supplier (Stok saat ini: %, Dibutuhkan: %)',
        v_current_stock, v_ret.qty USING ERRCODE = '23514';
    END IF;

    v_tx_type := 'out';
    v_note := 'Retur ke Supplier: ' || v_ret.no_retur || ' - Alasan: ' || v_ret.alasan;

    INSERT INTO public.transactions (
      product_id, supplier_id, type, quantity, unit_price, total_price, channel, notes, return_id, payment_method, payment_status, created_at
    ) VALUES (
      v_ret.produk_id,
      v_ret.supplier_id,
      v_tx_type,
      v_ret.qty,
      COALESCE(v_ret.harga_satuan, 0),
      v_total_refund,
      'Retur',
      v_note,
      p_return_id,
      'Cash',
      'Lunas',
      now()
    )
    ON CONFLICT (return_id) DO NOTHING;

    -- Catat pemasukan kas dari refund supplier jika ada nilai nominal
    IF v_total_refund > 0 THEN
      INSERT INTO public.cash_flow (
        tanggal, keterangan, kategori, metode, pemasukan, pengeluaran, created_by, created_at
      ) VALUES (
        CURRENT_DATE,
        'Refund Retur ke Supplier: ' || v_ret.no_retur,
        'Lainnya',
        'Cash',
        v_total_refund,
        0,
        v_user_id,
        now()
      );
    END IF;

  -- 2. Retur Dari Customer: Barang kembali ke stok toko & kembalikan dana kas ke customer
  ELSIF v_ret.tipe = 'dari_customer' THEN
    v_tx_type := 'in';
    v_note := 'Retur dari Pelanggan: ' || v_ret.no_retur || ' - Alasan: ' || v_ret.alasan;

    INSERT INTO public.transactions (
      product_id, customer_id, type, quantity, unit_price, total_price, channel, notes, return_id, payment_method, payment_status, created_at
    ) VALUES (
      v_ret.produk_id,
      v_ret.customer_id,
      v_tx_type,
      v_ret.qty,
      COALESCE(v_ret.harga_satuan, 0),
      v_total_refund,
      'Retur',
      v_note,
      p_return_id,
      'Cash',
      'Lunas',
      now()
    )
    ON CONFLICT (return_id) DO NOTHING;

    -- Catat pengeluaran kas refund ke customer jika ada nilai nominal
    IF v_total_refund > 0 THEN
      INSERT INTO public.cash_flow (
        tanggal, keterangan, kategori, metode, pemasukan, pengeluaran, created_by, created_at
      ) VALUES (
        CURRENT_DATE,
        'Pengembalian Dana Retur Pelanggan: ' || v_ret.no_retur,
        'Lainnya',
        'Cash',
        0,
        v_total_refund,
        v_user_id,
        now()
      );
    END IF;
  END IF;

  -- Update status retur menjadi 'selesai'
  UPDATE public.returns
  SET status = 'selesai',
      updated_at = now()
  WHERE id = p_return_id;

  PERFORM public.log_audit_event('UPDATE', 'Retur Selesai: ' || v_ret.no_retur || ' (' || v_ret.qty || ' unit ' || v_tx_type || ', Refund: Rp ' || v_total_refund || ')');

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_return_id,
    'no_retur', v_ret.no_retur,
    'status', 'selesai',
    'mutation_type', v_tx_type,
    'quantity', v_ret.qty,
    'refund_amount', v_total_refund
  );
END;
$$;
