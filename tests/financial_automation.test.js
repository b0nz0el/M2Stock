import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../public/assets/js/api/_client.js', () => ({
  isSupabaseAvailable: vi.fn(() => true),
  formatResponse: (response) => ({
    ok: Boolean(response.ok),
    data: response.data ?? null,
    error: response.error ?? null,
    meta: response.meta ?? {}
  }),
  handleError: (error) => ({ ok: false, data: null, error }),
  apiRequest: vi.fn()
}));

vi.mock('../public/assets/js/supabase-client.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: '00000000-0000-0000-0000-000000000001' } } })
    },
    from: vi.fn(),
    rpc: vi.fn()
  }
}));

import { supabase } from '../public/assets/js/supabase-client.js';
import { transactions } from '../public/assets/js/api/transactions.js';
import { po } from '../public/assets/js/api/po.js';

describe('Financial Automation Integration (Fase A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete window.supabase;
  });

  describe('Transaksi Barang Keluar & Keuangan', () => {
    it('mencatat transaksi keluar dengan metode Cash dan payment_status Lunas', async () => {
      const insertedRow = {
        id: 'tx-cash-1',
        type: 'out',
        product_id: 10,
        quantity: 5,
        unit_price: 25000,
        total_price: 125000,
        payment_method: 'Cash',
        payment_status: 'Lunas',
        notes: 'Penjualan toko',
        user_id: '00000000-0000-0000-0000-000000000001'
      };

      const select = vi.fn().mockResolvedValue({ data: [insertedRow], error: null });
      const insert = vi.fn(() => ({ select }));
      window.supabase = { from: vi.fn(() => ({ insert })) };

      const res = await transactions.createOut({
        product_id: 10,
        qty: 5,
        price: 25000,
        payment_method: 'Cash',
        payment_status: 'Lunas',
        note: 'Penjualan toko',
        created_by: '00000000-0000-0000-0000-000000000001'
      });

      expect(insert).toHaveBeenCalledWith([expect.objectContaining({
        type: 'out',
        product_id: 10,
        quantity: 5,
        unit_price: 25000,
        payment_method: 'Cash',
        payment_status: 'Lunas'
      })]);
      expect(res.ok).toBe(true);
      expect(res.data.payment_method).toBe('Cash');
      expect(res.data.payment_status).toBe('Lunas');
    });

    it('mencatat transaksi keluar tempo dengan status Belum Lunas', async () => {
      const insertedRow = {
        id: 'tx-tempo-1',
        type: 'out',
        product_id: 10,
        quantity: 2,
        unit_price: 50000,
        total_price: 100000,
        payment_method: 'Tempo',
        payment_status: 'Belum Lunas',
        user_id: '00000000-0000-0000-0000-000000000001'
      };

      const select = vi.fn().mockResolvedValue({ data: [insertedRow], error: null });
      const insert = vi.fn(() => ({ select }));
      window.supabase = { from: vi.fn(() => ({ insert })) };

      const res = await transactions.createOut({
        product_id: 10,
        qty: 2,
        price: 50000,
        payment_method: 'Tempo',
        payment_status: 'Belum Lunas',
        created_by: '00000000-0000-0000-0000-000000000001'
      });

      expect(insert).toHaveBeenCalledWith([expect.objectContaining({
        payment_method: 'Tempo',
        payment_status: 'Belum Lunas'
      })]);
      expect(res.ok).toBe(true);
      expect(res.data.payment_method).toBe('Tempo');
    });
  });

  describe('Purchase Order Receiving & Alokasi Kas/Hutang', () => {
    it('mengirimkan parameter p_payment_method Cash saat PO diterima', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: {
          ok: true,
          id: 'po-cash-1',
          status: 'diterima',
          payment_method: 'Cash',
          cash_flow_created: true
        },
        error: null
      });

      const res = await po.updateStatus('po-cash-1', 'diterima', 'Cash');

      expect(supabase.rpc).toHaveBeenCalledWith('receive_purchase_order', {
        p_po_id: 'po-cash-1',
        p_payment_method: 'Cash'
      });
      expect(res.ok).toBe(true);
      expect(res.data.cash_flow_created).toBe(true);
    });

    it('mengirimkan parameter p_payment_method Tempo saat PO diterima secara tempo', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: {
          ok: true,
          id: 'po-tempo-1',
          status: 'diterima',
          payment_method: 'Tempo',
          debt_created: true
        },
        error: null
      });

      const res = await po.updateStatus('po-tempo-1', 'diterima', 'Tempo');

      expect(supabase.rpc).toHaveBeenCalledWith('receive_purchase_order', {
        p_po_id: 'po-tempo-1',
        p_payment_method: 'Tempo'
      });
      expect(res.ok).toBe(true);
      expect(res.data.debt_created).toBe(true);
    });
  });
});
