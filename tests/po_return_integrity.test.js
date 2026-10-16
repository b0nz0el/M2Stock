import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { po as poApi } from '../public/assets/js/api/po.js';
import { returnApi } from '../public/assets/js/api/return.js';

describe('PO and Return Integrity & Atomic Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Purchase Order (PO)', () => {
    it('membuat PO menggunakan atomic RPC create_purchase_order_atomic', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: {
          ok: true,
          id: 'po-123',
          no_po: 'PO-202610-101',
          total: 150000,
          item_count: 1
        },
        error: null
      });

      const res = await poApi.create({
        no_po: 'PO-202610-101',
        tanggal: '2026-10-16',
        supplier_id: 'sup-1',
        supplier_nama: 'Supplier Aquascaping',
        status: 'draft',
        catatan: 'Catatan order',
        items: [
          { product_id: 'prod-1', product_name: 'Filter Akuarium', qty: 2, harga: 75000 }
        ]
      });

      expect(supabase.rpc).toHaveBeenCalledWith('create_purchase_order_atomic', expect.objectContaining({
        p_no_po: 'PO-202610-101',
        p_supplier_id: 'sup-1',
        p_supplier_name: 'Supplier Aquascaping',
        p_status: 'draft'
      }));
      expect(res.ok).toBe(true);
      expect(res.data.id).toBe('po-123');
      expect(res.data.total).toBe(150000);
    });

    it('memperbarui status PO ke diterima menggunakan receive_purchase_order RPC', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: {
          ok: true,
          id: 'po-123',
          no_po: 'PO-202610-101',
          status: 'diterima',
          items_stocked: 2
        },
        error: null
      });

      const res = await poApi.updateStatus('po-123', 'diterima');

      expect(supabase.rpc).toHaveBeenCalledWith('receive_purchase_order', {
        p_po_id: 'po-123'
      });
      expect(res.ok).toBe(true);
      expect(res.data.status).toBe('diterima');
    });

    it('memanggil generate_draft_po_from_low_stock RPC saat Restock Assistant dijalankan', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: {
          ok: true,
          created: true,
          id: 'po-auto-1',
          no_po: 'PO-202610-AUTO123',
          total: 240000,
          item_count: 3
        },
        error: null
      });

      const res = await poApi.generateFromLowStock('sup-target');

      expect(supabase.rpc).toHaveBeenCalledWith('generate_draft_po_from_low_stock', {
        p_supplier_id: 'sup-target'
      });
      expect(res.ok).toBe(true);
      expect(res.data.created).toBe(true);
      expect(res.data.item_count).toBe(3);
    });
  });

  describe('Retur Barang (Returns)', () => {
    it('membuat retur baru dengan harga_satuan dan snapshot produk tersimpan', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'ret-123',
          no_retur: 'RET-SUP-202610-501',
          tipe: 'ke_supplier',
          produk_id: 'prod-99',
          qty: 2,
          harga_satuan: 45000,
          status: 'diproses'
        },
        error: null
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle, maybeSingle: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      supabase.from.mockImplementation((table) => {
        if (table === 'products') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { name: 'Pompa Celup' } })
              })
            })
          };
        }
        if (table === 'returns') {
          return { insert: mockInsert };
        }
        return {};
      });

      const res = await returnApi.create({
        no_retur: 'RET-SUP-202610-501',
        tipe: 'ke_supplier',
        produk_id: 'prod-99',
        qty: 2,
        harga_satuan: 45000,
        alasan: 'Motor terbakar',
        status: 'diproses'
      });

      expect(res.ok).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          produk_id: 'prod-99',
          qty: 2,
          harga_satuan: 45000,
          snapshot_product_name: 'Pompa Celup'
        })
      ]));
    });

    it('menyelesaikan retur menggunakan complete_return RPC untuk mutasi stok', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: {
          ok: true,
          id: 'ret-123',
          status: 'selesai',
          mutation_type: 'out',
          quantity: 2
        },
        error: null
      });

      const res = await returnApi.update('ret-123', { status: 'selesai' });

      expect(supabase.rpc).toHaveBeenCalledWith('complete_return', {
        p_return_id: 'ret-123'
      });
      expect(res.ok).toBe(true);
      expect(res.data.status).toBe('selesai');
    });

    it('gagal membuat retur jika produk_id kosong', async () => {
      const res = await returnApi.create({
        produk_id: null,
        qty: 1,
        alasan: 'Tanpa produk'
      });

      expect(res.ok).toBe(false);
      expect(res.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
