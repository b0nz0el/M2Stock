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

    it('memanggil generate_draft_po_from_low_stock_v2 RPC saat Restock Assistant dijalankan', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: {
          ok: true,
          created: true,
          id: 'po-auto-1',
          no_po: 'PO-202611-AUTO001',
          total: 240000,
          item_count: 3
        },
        error: null
      });

      const res = await poApi.generateFromLowStock('sup-target');

      expect(supabase.rpc).toHaveBeenCalledWith('generate_draft_po_from_low_stock_v2', {
        p_supplier_id: 'sup-target'
      });
      expect(res.ok).toBe(true);
      expect(res.data.created).toBe(true);
      expect(res.data.item_count).toBe(3);
    });

    it('melakukan fallback client-side aman jika RPC generate_draft_po_from_low_stock_v2 belum ada di schema cache', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST202',
          message: 'Could not find the function public.generate_draft_po_from_low_stock_v2(p_supplier_id) in the schema cache'
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

    it('generateNoPO memulai urutan dari 001 saat belum ada PO, melanjutkan PO tersimpan, dan kembali ke 001 saat dihapus', () => {
      // Belum ada PO tersimpan -> mulai dari 001
      expect(poApi.generateNoPO([], '2026-11-11')).toBe('PO-202611-001');

      // Berkelanjutan mengikuti PO yang sudah tersimpan
      expect(
        poApi.generateNoPO(
          [{ no_po: 'PO-202611-001' }, { no_po: 'PO-202611-002' }],
          '2026-11-11'
        )
      ).toBe('PO-202611-003');

      // Mengabaikan PO bulan lain, PO Restock (-AUTO), serta nomor acak lama yang lebih besar jika 001 belum terpakai
      expect(
        poApi.generateNoPO(
          [
            { no_po: 'PO-202610-001' },
            { no_po: 'PO-202611-AUTO456' },
            { no_po: 'PO-202611-378' }
          ],
          '2026-11-11'
        )
      ).toBe('PO-202611-001');

      // Jika PO 001 dihapus namun 002 masih tersimpan -> isi kembali 001 dulu lalu lanjut lewati 002
      expect(poApi.generateNoPO([{ no_po: 'PO-202611-002' }], '2026-11-11')).toBe('PO-202611-001');
      expect(
        poApi.generateNoPO(
          [{ no_po: 'PO-202611-001' }, { no_po: 'PO-202611-002' }],
          '2026-11-11'
        )
      ).toBe('PO-202611-003');
    });

    it('getNextNoPO membaca daftar no_po dari purchase_orders dan fallback aman saat query gagal', async () => {
      const limitMock = vi.fn().mockResolvedValue({
        data: [{ no_po: 'PO-202611-001' }, { no_po: 'PO-202611-002' }],
        error: null
      });
      const ilikeMock = vi.fn().mockReturnValue({ limit: limitMock });
      const selectMock = vi.fn().mockReturnValue({ ilike: ilikeMock });
      supabase.from.mockReturnValueOnce({ select: selectMock });

      const nextSequential = await poApi.getNextNoPO('2026-11-11');
      expect(supabase.from).toHaveBeenCalledWith('purchase_orders');
      expect(selectMock).toHaveBeenCalledWith('no_po');
      expect(ilikeMock).toHaveBeenCalledWith('no_po', 'PO-202611-%');
      expect(nextSequential).toBe('PO-202611-003');

      // Simulasi setelah seluruh PO dihapus -> database kosong -> kembali 001
      const emptyLimitMock = vi.fn().mockResolvedValue({ data: [], error: null });
      supabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({ limit: emptyLimitMock })
        })
      });
      expect(await poApi.getNextNoPO('2026-11-11')).toBe('PO-202611-001');

      // Fallback saat query error
      const errLimitMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'network error' } });
      supabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({ limit: errLimitMock })
        })
      });
      expect(await poApi.getNextNoPO('2026-11-11', [{ no_po: 'PO-202611-001' }])).toBe('PO-202611-002');
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

    it('mencetak PO dari dokumen mandiri dengan ukuran kertas A4', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const poJs = fs.readFileSync(path.resolve(process.cwd(), 'public/dashboard/po.js'), 'utf-8');

      expect(poJs).toContain("const printWindow = window.open('', '_blank');");
      expect(poJs).toContain('@page { size: A4 portrait; margin: 10mm; }');
      expect(poJs).toContain('const itemCount = paper.querySelectorAll(\'tbody tr\').length;');
      expect(poJs).toContain('po-print-dense');
      expect(poJs).toContain('.po-document-table .po-document-total-row td:last-child { text-align: right; }');
      expect(poJs).toContain('<body><main class="po-print-sheet ${printDensity}" data-item-count="${itemCount}">${paper.outerHTML}</main></body>');
      expect(poJs).toContain('printDocument.images');
      expect(poJs).toContain('printWindow.print();');
      expect(poJs).toContain("showToast('Izinkan pop-up untuk mencetak atau menyimpan PDF PO', 'error');");
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
      const poJs = fs.readFileSync(path.resolve(process.cwd(), 'public/dashboard/po.js'), 'utf-8');
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
      expect(poJs).toContain('@page { size: A4 portrait; margin: 10mm; }');
      expect(poJs).toContain('.po-signatures-grid');
      expect(poJs).toContain('.po-document-table tbody tr, .po-document-table thead { break-inside: avoid;');
    });

    it('generateAutoNoPO melakukan gap-filling mulai dari AUTO001 dan reset setiap ganti bulan', () => {
      expect(poApi.generateAutoNoPO([], '2026-11-11')).toBe('PO-202611-AUTO001');
      expect(poApi.generateAutoNoPO([
        { no_po: 'PO-202611-001' },
        { no_po: 'PO-202611-AUTO001' },
        { no_po: 'PO-202611-AUTO003' }
      ], '2026-11-11')).toBe('PO-202611-AUTO002');
      expect(poApi.generateAutoNoPO([
        { no_po: 'PO-202611-AUTO002' },
        { no_po: 'PO-202611-AUTO003' }
      ], '2026-11-11')).toBe('PO-202611-AUTO001');
      expect(poApi.generateAutoNoPO([
        { no_po: 'PO-202611-AUTO001' },
        { no_po: 'PO-202611-AUTO002' }
      ], '2026-12-01')).toBe('PO-202612-AUTO001');
    });

    it('calculateAutoOrderQty memprioritaskan target_stock/max_stock, demand velocity 18h, atau zero-velocity cap <= 5 serta clamp stok minus ke 0', () => {
      // Tanpa penjualan 90 hari (zero velocity) -> maksimal min_stock atau 5 unit (hemat modal, cegah ledakan qty)
      expect(poApi.calculateAutoOrderQty({ stock: -15, min_stock: 10 })).toBe(5);
      expect(poApi.calculateAutoOrderQty({ stock: -5, min_stock: 0 })).toBe(1);
      expect(poApi.calculateAutoOrderQty({ stock: 3, min_stock: 40 })).toBe(2);
      // Fast-moving via Demand Velocity 18 hari (30/30 hari = 1/hari -> target 18 - 1 = 17)
      expect(poApi.calculateAutoOrderQty(
        { stock: 1, min_stock: 3 },
        { sold_7d: 7, sold_30d: 30, sold_90d: 90 }
      )).toBe(17);
      // Target eksplisit tetap dihormati
      expect(poApi.calculateAutoOrderQty({ stock: 3, min_stock: 5, target_stock: 25 })).toBe(22);
      expect(poApi.calculateAutoOrderQty({ stock: -4, min_stock: 5, max_stock: 18 })).toBe(18);
      expect(poApi.calculateAutoOrderQty({ stock: 25, min_stock: 5, max_stock: 20 })).toBe(1);
      expect(poApi.calculateAutoOrderQty({ stock: 0, min_stock: 0 })).toBe(1);
    });

    it('Auto-PO memisahkan PO per supplier, skip produk di PO draft/dikirim, update Draft PO existing, dan mengisi celah AUTO001/AUTO002', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));

      try {
        supabase.rpc.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST202', message: 'schema cache missing v2' }
        });

        const insertedPoiCalls = [];
        const updatedHeaderCalls = [];
        const createdRpcCalls = [];

        supabase.rpc.mockImplementation((rpcName, params) => {
          if (rpcName === 'create_purchase_order_atomic') {
            createdRpcCalls.push(params);
            return Promise.resolve({
              data: { ok: true, id: `new-po-${createdRpcCalls.length}`, no_po: params.p_no_po },
              error: null
            });
          }
          return Promise.resolve({ data: null, error: null });
        });

        supabase.from.mockImplementation((table) => {
          if (table === 'products') {
            return {
              select: vi.fn().mockResolvedValue({
                data: [
                  // Sudah ada di PO dikirim -> harus di-skip!
                  { id: 'p-already-ordered', name: 'Filter Ordered', stock: 1, min_stock: 10, cost_price: 50000, supplier_id: 'sup-a', is_active: true },
                  // Supplier A punya existing draft PO -> masuk update draft existing (stok minus -5, min 10 -> qty 20)
                  { id: 'p-sup-a-new', name: 'Aerator Negatif', stock: -5, min_stock: 10, cost_price: 25000, supplier_id: 'sup-a', is_active: true },
                  // Supplier B belum punya draft -> buat PO baru AUTO002 (karena AUTO001 & AUTO003 sudah terpakai)
                  { id: 'p-sup-b-1', name: 'Heater Target', stock: 4, min_stock: 5, target_stock: 20, cost_price: 40000, supplier_id: 'sup-b', is_active: true }
                ],
                error: null
              })
            };
          }
          if (table === 'purchase_orders') {
            return {
              select: vi.fn((cols) => {
                if (cols === 'no_po') {
                  const resRows = Promise.resolve({
                    data: [
                      { no_po: 'PO-202611-AUTO001' },
                      { no_po: 'PO-202611-AUTO003' }
                    ],
                    error: null
                  });
                  return {
                    ilike: vi.fn(() => ({
                      limit: vi.fn(() => resRows),
                      then: resRows.then.bind(resRows)
                    }))
                  };
                }
                return {
                  in: vi.fn().mockResolvedValue({
                    data: [
                      { id: 'po-draft-a', no_po: 'PO-202611-AUTO001', status: 'draft', supplier_id: 'sup-a', supplier_name: 'Supplier Alpha', total: 100000 },
                      { id: 'po-ord-1', no_po: 'PO-202611-009', status: 'dikirim', supplier_id: 'sup-a', supplier_name: 'Supplier Alpha', total: 50000 }
                    ],
                    error: null
                  })
                };
              }),
              update: vi.fn((payload) => {
                updatedHeaderCalls.push(payload);
                return {
                  eq: vi.fn().mockResolvedValue({ error: null })
                };
              })
            };
          }
          if (table === 'purchase_order_items') {
            return {
              select: vi.fn(() => ({
                in: vi.fn().mockResolvedValue({
                  data: [
                    { po_id: 'po-ord-1', product_id: 'p-already-ordered', qty: 2, harga: 25000, subtotal: 50000 }
                  ],
                  error: null
                })
              })),
              insert: vi.fn((rows) => {
                insertedPoiCalls.push(rows);
                return Promise.resolve({ error: null });
              })
            };
          }
          if (table === 'suppliers') {
            return {
              select: vi.fn().mockResolvedValue({
                data: [
                  { id: 'sup-a', name: 'Supplier Alpha' },
                  { id: 'sup-b', name: 'Supplier Beta' }
                ],
                error: null
              })
            };
          }
          return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
        });

        const res = await poApi.generateFromLowStock();
        expect(res.ok).toBe(true);
        expect(res.data.created).toBe(true);
        expect(res.data.po_count).toBe(2);
        expect(res.data.updated_count).toBe(1);
        expect(res.data.created_count).toBe(1);

        // Supplier A memperbarui draft po-draft-a (zero-velocity cap <= 5 dengan effective_stock=0 -> qty = 5, bukan 25!)
        expect(insertedPoiCalls.length).toBe(1);
        expect(insertedPoiCalls[0]).toEqual([
          expect.objectContaining({
            po_id: 'po-draft-a',
            product_id: 'p-sup-a-new',
            qty: 5,
            subtotal: 125000
          })
        ]);
        expect(updatedHeaderCalls[0].total).toBe(225000);

        // Supplier B membuat 1 draft PO baru memakai gap AUTO002 dengan qty target_stock - stock = 16
        expect(createdRpcCalls.length).toBe(1);
        expect(createdRpcCalls[0]).toMatchObject({
          p_no_po: 'PO-202611-AUTO002',
          p_supplier_id: 'sup-b',
          p_supplier_name: 'Supplier Beta',
          p_status: 'draft'
        });
        expect(createdRpcCalls[0].p_items).toEqual([
          expect.objectContaining({
            product_id: 'p-sup-b-1',
            qty: 16,
            harga: 40000,
            subtotal: 640000
          })
        ]);
        // Produk p-already-ordered tidak boleh masuk PO manapun
        const allCreatedIds = createdRpcCalls[0].p_items.map(i => i.product_id);
        expect(allCreatedIds).not.toContain('p-already-ordered');
      } finally {
        vi.useRealTimers();
      }
    });

    it('updateDraftPO menyimpan item yang diedit, menghitung total akurat, dan menolak PO non-draft', async () => {
      const deletedPoIds = [];
      const insertedRows = [];
      const headerUpdates = [];

      supabase.from.mockImplementation((table) => {
        if (table === 'purchase_orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'po-draft-1', status: 'draft' },
                  error: null
                })
              }))
            })),
            update: vi.fn((patch) => {
              headerUpdates.push(patch);
              return {
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'po-draft-1', ...patch },
                      error: null
                    })
                  }))
                }))
              };
            })
          };
        }
        if (table === 'purchase_order_items') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [{ po_id: 'po-draft-1', product_id: 'p1', product_name: 'Item 1', qty: 2, harga: 10000, subtotal: 20000 }],
                error: null
              })
            })),
            delete: vi.fn(() => ({
              eq: vi.fn((col, val) => {
                deletedPoIds.push(val);
                return Promise.resolve({ error: null });
              })
            })),
            insert: vi.fn((rows) => {
              insertedRows.push(rows);
              return {
                select: vi.fn().mockResolvedValue({ data: rows, error: null })
              };
            })
          };
        }
        return { select: vi.fn() };
      });

      const res = await poApi.updateDraftPO('po-draft-1', [
        { product_id: 'p1', product_name: 'Item 1', qty: 7, harga: 15000 }
      ], { status: 'dikirim' });

      expect(res.ok).toBe(true);
      expect(deletedPoIds).toEqual(['po-draft-1']);
      expect(insertedRows[0]).toEqual([
        expect.objectContaining({ po_id: 'po-draft-1', qty: 7, harga: 15000, subtotal: 105000 })
      ]);
      expect(headerUpdates[0]).toMatchObject({ total: 105000, status: 'dikirim' });

      // Tolak edit jika status bukan draft
      supabase.from.mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'po-locked', status: 'dikirim' }, error: null })
          }))
        }))
      }));
      const lockedRes = await poApi.updateDraftPO('po-locked', [{ product_id: 'p1', product_name: 'Item 1', qty: 2, harga: 1000 }]);
      expect(lockedRes.ok).toBe(false);
      expect(lockedRes.error.code).toBe('PO_LOCKED');
    });
  });
});
