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

      expect(supabase.rpc).toHaveBeenCalledWith('receive_purchase_order', expect.objectContaining({
        p_po_id: 'po-123'
      }));
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

    it('melakukan fallback client-side aman jika RPC generate_draft_po_from_low_stock belum ada di schema cache', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST202',
          message: 'Could not find the function public.generate_draft_po_from_low_stock(p_supplier_id) in the schema cache'
        }
      });

      // Mock products
      supabase.from.mockImplementation((table) => {
        if (table === 'products') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { id: 10, name: 'Filter Sponge', stock: 2, min_stock: 5, cost_price: 15000 },
                { id: 11, name: 'Bio Ring', stock: 10, min_stock: 5, cost_price: 25000 }
              ],
              error: null
            })
          };
        }
        if (table === 'purchase_orders') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'po-fallback-1', no_po: 'PO-202610-AUTO999', total: 120000 },
                  error: null
                }),
                single: vi.fn().mockResolvedValue({
                  data: { id: 'po-fallback-1', no_po: 'PO-202610-AUTO999', total: 120000 },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'purchase_order_items') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null })
            }),
            insert: vi.fn().mockResolvedValue({ data: [], error: null })
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      });

      const res = await poApi.generateFromLowStock();
      expect(res.ok).toBe(true);
      expect(res.data.created).toBe(true);
      expect(res.data.item_count).toBe(1);
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

  describe('PO UI/UX & Print Resilience (Bug Fixes v3.4.31)', () => {
    it('memastikan po.js memiliki eventsSetup guard dan isGeneratingAutoPo lock', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const poJs = fs.readFileSync(path.resolve(process.cwd(), 'public/dashboard/po.js'), 'utf-8');

      expect(poJs).toContain('let eventsSetup = false;');
      expect(poJs).toContain('if (eventsSetup) return;');
      expect(poJs).toContain('eventsSetup = true;');
      expect(poJs).toContain('let isGeneratingAutoPo = false;');
      expect(poJs).toContain('if (isGeneratingAutoPo) return;');
      expect(poJs).toContain('deleteInProgress || !pendingDeleteId');
    });

    it('memastikan renderTable memanggil window.syncTableLabels untuk simetri kartu mobile', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const poJs = fs.readFileSync(path.resolve(process.cwd(), 'public/dashboard/po.js'), 'utf-8');

      expect(poJs).toContain("if (typeof window.syncTableLabels === 'function')");
      expect(poJs).toContain('window.syncTableLabels();');
    });

    it('menampilkan label deskriptif Restock Assistant sebagai pemasok virtual di semua tampilan PO', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const poJs = fs.readFileSync(path.resolve(process.cwd(), 'public/dashboard/po.js'), 'utf-8');
      const label = 'Restock otomatis dari daftar stok menipis (Restock Assistant)';

      expect(poJs).toContain(`const RESTOCK_ASSISTANT_LABEL = '${label}';`);
      expect(poJs).toContain('function resolvePoSupplierName(item)');
      expect(poJs).toContain("const supplierName = resolvePoSupplierName(item);");
      expect(poJs).toContain('const supplierName = resolvePoSupplierName(p) || \'-\';');
      expect(poJs).toContain('resolvePoSupplierName(p) || p.catatan');
      expect(poJs).toContain("'Restock otomatis dari daftar stok menipis'");
      expect(poJs).toContain("docSupplierSubtitle.textContent = '(Restock Assistant)'");

      const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'public/dashboard/index.html'), 'utf-8');
      expect(indexHtml).toContain('id="doc-po-supplier-subtitle"');
    });

    it('memastikan template index.html menggunakan po-signatures-grid flex row untuk 3 tanda tangan di A4', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'public/dashboard/index.html'), 'utf-8');

      expect(indexHtml).toContain('class="po-signatures-grid flex items-start justify-between gap-4 pt-3 text-center text-[10px] text-gray-700 w-full"');
      expect(indexHtml).toContain('Dibuat Oleh (Admin):');
      expect(indexHtml).toContain('Disetujui Oleh (Owner):');
      expect(indexHtml).toContain('Diterima Oleh (Supplier):');
      expect(indexHtml).toContain('po-kpi-grid grid grid-cols-2 lg:grid-cols-4');
    });

    it('memastikan responsive.css dan layout.css memiliki styling mobile pill dan A4 single-page print', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const responsiveCss = fs.readFileSync(path.resolve(process.cwd(), 'public/assets/css/responsive.css'), 'utf-8');
      const layoutCss = fs.readFileSync(path.resolve(process.cwd(), 'public/assets/css/layout.css'), 'utf-8');
      const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'public/dashboard/index.html'), 'utf-8');

      // Mobile tabs & KPI grid
      expect(responsiveCss).toContain('#page-po .po-status-tabs');
      expect(responsiveCss).toContain('overflow-x: auto !important;');
      expect(responsiveCss).toContain('#page-po .po-kpi-grid');
      expect(indexHtml).toContain('class="modal-po-content');
      expect(indexHtml).toContain('class="modal-po-preview');
      expect(indexHtml).toContain('class="modal-po-actions');
      expect(responsiveCss).toContain('#modal-print-po > .modal-po-content');
      expect(responsiveCss).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;');
      expect(responsiveCss).toContain('#po-document-paper .po-document-header');
      expect(responsiveCss).toContain('table-layout: fixed !important;');

      // Print styles
      expect(layoutCss).toContain('size: A4 portrait;');
      expect(layoutCss).toContain('min-height: 0 !important;');
      expect(layoutCss).toContain('height: auto !important;');
      expect(layoutCss).toContain('.po-signatures-grid');
      expect(layoutCss).toContain('page-break-inside: avoid !important;');
      expect(layoutCss).toContain('#modal-print-po:not(.hidden)');
    });
  });
});
