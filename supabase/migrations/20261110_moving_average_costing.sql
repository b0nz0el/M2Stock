-- ═══════════════════════════════════════════════════════════════════════════
-- Aquastock Pro — Migration: Moving Weighted Average Costing (IAS 2 / PSAK 14)
-- File: supabase/migrations/20261110_moving_average_costing.sql
-- Standar: Kalkulasi HPP Rata-Rata Tertimbang Otomatis Saat Barang Masuk / PO
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_transaction_stock_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_rows INTEGER;
  v_qty NUMERIC;
  v_cur_stock NUMERIC;
  v_cur_cost NUMERIC;
  v_incoming_cost NUMERIC;
  v_new_avg_cost NUMERIC;
  v_is_opname BOOLEAN;
  v_is_return BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_qty := COALESCE(NEW.quantity, NEW.qty, 0);

    IF NEW.type = 'in' THEN
      -- Kunci baris produk saat ini untuk menghindari race condition konkuren
      SELECT stock, COALESCE(cost_price, 0)
      INTO v_cur_stock, v_cur_cost
      FROM public.products
      WHERE id = NEW.product_id
      FOR UPDATE;

      -- Ambil harga modal barang masuk
      v_incoming_cost := COALESCE(NEW.cost_price, NEW.unit_price, NEW.price, 0);

      -- Deteksi apakah transaksi ini adalah penyesuaian opname atau retur barang
      v_is_opname := (COALESCE(NEW.note, NEW.notes, '') LIKE '[STOCK OPNAME]%' OR v_incoming_cost <= 0);
      v_is_return := (COALESCE(NEW.channel, '') = 'Retur' OR NEW.return_id IS NOT NULL OR COALESCE(NEW.note, NEW.notes, '') LIKE 'Retur dari Pelanggan%');

      -- Hitung Moving Weighted Average hanya untuk pembelian / restock / PO normal
      IF NOT v_is_opname AND NOT v_is_return AND v_incoming_cost > 0 AND v_qty > 0 THEN
        IF v_cur_stock IS NULL OR v_cur_stock <= 0 OR v_cur_cost <= 0 THEN
          -- Jika sebelumnya stok kosong atau HPP belum diisi, gunakan harga modal baru secara langsung
          v_new_avg_cost := v_incoming_cost;
        ELSE
          -- Rumus Moving Weighted Average Cost (IAS 2 / PSAK 14):
          -- ((Stok Lama * Modal Lama) + (Qty Masuk * Modal Baru)) / (Stok Lama + Qty Masuk)
          v_new_avg_cost := ROUND(
            ((v_cur_stock * v_cur_cost) + (v_qty * v_incoming_cost)) / (v_cur_stock + v_qty),
            2
          );
        END IF;

        UPDATE public.products
        SET stock = stock + v_qty,
            cost_price = v_new_avg_cost,
            updated_at = now()
        WHERE id = NEW.product_id;
      ELSE
        -- Koreksi opname atau retur: hanya perbarui saldo stok fisik tanpa mengubah HPP produk
        UPDATE public.products
        SET stock = stock + v_qty,
            updated_at = now()
        WHERE id = NEW.product_id;
      END IF;

    ELSE
      -- Transaksi keluar (Penjualan Kasir / POS / Retur ke Supplier):
      -- Potong stok dengan proteksi anti-minus
      UPDATE public.products
      SET stock = stock - v_qty,
          updated_at = now()
      WHERE id = NEW.product_id
        AND stock >= v_qty;
      GET DIAGNOSTICS updated_rows = ROW_COUNT;
      IF updated_rows = 0 THEN
        RAISE EXCEPTION 'Stok tidak mencukupi untuk transaksi keluar'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_qty := COALESCE(OLD.quantity, OLD.qty, 0);
    IF OLD.type = 'in' THEN
      UPDATE public.products
      SET stock = stock - v_qty,
          updated_at = now()
      WHERE id = OLD.product_id;
    ELSE
      UPDATE public.products
      SET stock = stock + v_qty,
          updated_at = now()
      WHERE id = OLD.product_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Pastikan trigger terpasang aktif di tabel transactions
DROP TRIGGER IF EXISTS trg_transaction_stock_update ON public.transactions;
CREATE TRIGGER trg_transaction_stock_update
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_transaction_stock_update();

NOTIFY pgrst, 'reload schema';

