import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../public/assets/js/supabase-client.js', () => ({ supabase: {} }));
vi.mock('../public/assets/js/api/_client.js', () => ({
  isSupabaseAvailable: vi.fn(() => true),
  formatResponse: (response) => ({
    ok: Boolean(response.ok),
    data: response.data ?? null,
    error: response.error ?? null,
    meta: response.meta ?? {}
  }),
  handleError: (error) => ({ ok: false, data: null, error }),
  apiRequest: vi.fn(),
  logAudit: vi.fn()
}));

import { transactions } from '../public/assets/js/api/transactions.js';
import { items } from '../public/assets/js/api/items.js';
import { report } from '../public/assets/js/api/report.js';

describe('Audit Kepatuhan Kontrol Inventori ERP/WMS & IAS 2', () => {
  afterEach(() => {
    delete window.supabase;
    vi.clearAllMocks();
  });

  // 1. ATOMICITY POS CHECKOUT & ROLLBACK COMPENSATION
  describe('Pilar 1: Atomisitas Penjualan Multi-Item (POS Batch Out)', () => {
    it('menggunakan database RPC process_pos_checkout untuk transaksi atomik jika tersedia', async () => {
      const rpcSpy = vi.fn().mockResolvedValue({
        data: {
          ok: true,
          invoice_no: 'INV-261028-1234',
          total_amount: 150000,
          transactions: [{ id: 'tx-1' }, { id: 'tx-2' }]
        },
        error: null
      });

      window.supabase = {
        rpc: rpcSpy
      };

      const cartItems = [
        { product_id: 'prod-uuid-1', qty: 2, price: 50000, name: 'Filter Sponge' },
        { product_id: 'prod-uuid-2', qty: 1, price: 50000, name: 'Pompa Celup' }
      ];

      const res = await transactions.createBatchOut(cartItems, { channel: 'Offline' });

      expect(res.ok).toBe(true);
      expect(rpcSpy).toHaveBeenCalledWith('process_pos_checkout', expect.objectContaining({
        p_items: expect.arrayContaining([
          expect.objectContaining({ product_id: 'prod-uuid-1', qty: 2 }),
          expect.objectContaining({ product_id: 'prod-uuid-2', qty: 1 })
        ])
      }));
    });

    it('melakukan rollback kompensasi atomik pada fallback jika salah satu item gagal di tengah proses', async () => {
      // Mock: Item 1 berhasil disimpan, tapi Item 2 gagal (misal stok habis)
      const deletedTxIds = [];
      let insertCount = 0;

      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === 'products') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'p1', stock: 10, cost_price: 30000 },
                    error: null
                  })
                }))
              })),
              update: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null })
              }))
            };
          }
          if (table === 'transactions') {
            return {
              insert: vi.fn(() => {
                insertCount++;
                if (insertCount === 1) {
                  return {
                    select: vi.fn().mockResolvedValue({
                      data: [{ id: 'tx-item-1', product_id: 'p1', qty: 1, price: 50000 }],
                      error: null
                    })
                  };
                } else {
                  return {
                    select: vi.fn().mockResolvedValue({
                      data: null,
                      error: { code: '23514', message: 'Stok tidak mencukupi' }
                    })
                  };
                }
              }),
              delete: vi.fn(() => ({
                eq: vi.fn((col, val) => {
                  deletedTxIds.push(val);
                  return Promise.resolve({ error: null });
                })
              }))
            };
          }
        })
      };

      window.supabase = mockSupabase;

      const cartItems = [
        { product_id: 'p1', qty: 1, price: 50000, name: 'Item 1' },
        { product_id: 'p2', qty: 99, price: 50000, name: 'Item 2 (Stok Kurang)' }
      ];

      const res = await transactions.createBatchOut(cartItems, { invoice_no: 'INV-TEST-001' });

      // Verifikasi: Seluruh proses harus gagal
      expect(res.ok).toBe(false);
      expect(res.error).toBeDefined();
      // Verifikasi: Item 1 yang sempat tersimpan harus di-rollback/didelete agar tidak ada transaksi yatim
      expect(deletedTxIds).toContain('tx-item-1');
    });
  });

  // 2. STOCK OPNAME STRICT-LEDGER & UUID RESILIENCE
  describe('Pilar 2: Stock Opname Strict-Ledger & Dukungan UUID', () => {
    it('mendukung ID produk UUID string tanpa menghasilkan NaN', async () => {
      const uuidProdId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      let insertedPayload = null;

      const mockSupabase = {
        rpc: vi.fn().mockRejectedValue(new Error('RPC belum terpasang')),
        from: vi.fn((table) => {
          if (table === 'products') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: uuidProdId, name: 'Produk UUID', sku: 'SKU-UUID', stock: 5, cost_price: 15000 },
                    error: null
                  })
                }))
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn().mockResolvedValue({
                    data: [{ id: uuidProdId, stock: 7 }],
                    error: null
                  })
                }))
              }))
            };
          }
          if (table === 'transactions') {
            return {
              insert: vi.fn((rows) => {
                insertedPayload = rows[0];
                return Promise.resolve({ error: null });
              })
            };
          }
        })
      };

      window.supabase = mockSupabase;

      const res = await items.adjustStock(uuidProdId, 7, 'Opname Fisik', 'Penyesuaian rutin');

      expect(res.ok).toBe(true);
      // Memastikan product_id di transaksi tidak menjadi NaN, melainkan string UUID asli
      expect(insertedPayload.product_id).toBe(uuidProdId);
      expect(insertedPayload.qty).toBe(2);
      expect(insertedPayload.type).toBe('in');
      expect(insertedPayload.cost_price).toBe(15000);
    });

    it('tidak mengubah saldo produk jika pencatatan transaksi mutasi di ledger gagal', async () => {
      const prodId = 'prod-test-99';
      let productUpdateCalled = false;

      const mockSupabase = {
        rpc: vi.fn().mockRejectedValue(new Error('RPC belum terpasang')),
        from: vi.fn((table) => {
          if (table === 'products') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: prodId, name: 'Produk Uji', sku: 'SKU-99', stock: 10, cost_price: 20000 },
                    error: null
                  })
                }))
              })),
              update: vi.fn(() => {
                productUpdateCalled = true;
                return {
                  eq: vi.fn(() => ({
                    select: vi.fn().mockResolvedValue({ data: [], error: null })
                  }))
                };
              })
            };
          }
          if (table === 'transactions') {
            return {
              // Simulasi kegagalan insert transaksi mutasi ledger
              insert: vi.fn().mockResolvedValue({
                error: { code: '42P01', message: 'Relation transactions error' }
              })
            };
          }
        })
      };

      window.supabase = mockSupabase;

      const res = await items.adjustStock(prodId, 15, 'Opname Gagal Test');

      // Verifikasi: Fungsi mengembalikan error dan saldo produk TIDAK PERNAH disentuh
      expect(res.ok).toBe(false);
      expect(res.error).toBeDefined();
      expect(productUpdateCalled).toBe(false);
    });
  });

  // 3. HISTORICAL COST SNAPSHOTTING & IAS 2 PROFIT INTEGRITY
  describe('Pilar 3: Snapshot Modal Historis & Konsistensi Laba IAS 2', () => {
    it('menyimpan snapshot cost_price saat transaksi penjualan (Barang Keluar) dibuat', async () => {
      let savedTxRow = null;

      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === 'products') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 101, stock: 20, cost_price: 45000, name: 'Busa Filter 8D' },
                    error: null
                  })
                }))
              }))
            };
          }
          if (table === 'transactions') {
            return {
              insert: vi.fn((rows) => {
                savedTxRow = rows[0];
                return {
                  select: vi.fn().mockResolvedValue({
                    data: [{ ...savedTxRow, id: 501 }],
                    error: null
                  })
                };
              })
            };
          }
        })
      };

      window.supabase = mockSupabase;

      const res = await transactions.createOut({
        product_id: 101,
        qty: 3,
        price: 65000
      });

      expect(res.ok).toBe(true);
      // Memastikan snapshot modal 45.000 tersimpan pada baris transaksi
      expect(savedTxRow.cost_price).toBe(45000);
      expect(savedTxRow.price).toBe(65000);
      expect(savedTxRow.qty).toBe(3);
    });

    it('menghitung laba berdasarkan snapshot modal historis transaksi, kebal dari perubahan harga master di masa depan', async () => {
      // Skenario: Transaksi dilakukan saat harga modal Rp 30.000 (jual Rp 50.000 -> laba Rp 20.000).
      // Kemudian supplier menaikkan harga modal master menjadi Rp 45.000.
      const mockTransactions = [
        {
          id: 1,
          type: 'out',
          qty: 1,
          price: 50000,
          cost_price: 30000, // Snapshot modal historis saat transaksi terjadi
          channel: 'Offline',
          created_at: '2026-09-01T10:00:00Z',
          product_id: 88,
          products: {
            id: 88,
            name: 'Pakan Ikan Super',
            brand: 'Aquafish',
            cost_price: 45000, // Harga modal master saat ini (sudah naik)
            sell_price: 55000,
            categories: { id: 1, name: 'Pakan' }
          }
        }
      ];

      const mockProducts = [
        { id: 88, name: 'Pakan Ikan Super', stock: 10, min_stock: 2, cost_price: 45000, sell_price: 55000 }
      ];

      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === 'transactions') {
            return {
              select: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: mockTransactions, error: null }))
              }))
            };
          }
          if (table === 'products') {
            return {
              select: vi.fn(() => Promise.resolve({ data: mockProducts, error: null }))
            };
          }
        })
      };

      window.supabase = mockSupabase;

      const res = await report.getSummary();

      expect(res.ok).toBe(true);
      // Laba kotor harus tetap Rp 20.000 (50.000 - 30.000), BUKAN Rp 5.000 (50.000 - 45.000)
      expect(res.data.kpi.totalSales).toBe(50000);
      expect(res.data.kpi.grossProfit).toBe(20000);
      expect(res.data.kpi.profitMargin).toBe(40); // 20.000 / 50.000 = 40%
      // Top products profit juga harus mencerminkan modal historis
      expect(res.data.topProducts[0].profit).toBe(20000);
    });
  });
});
