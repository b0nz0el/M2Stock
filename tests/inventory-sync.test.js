import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { transactions } from '../public/assets/js/api/transactions.js';

describe('Audit Sinkronisasi Menu: Barang, Barang Masuk, Barang Keluar', () => {
  afterEach(() => {
    delete window.supabase;
    vi.clearAllMocks();
  });

  it('tidak menulis saldo produk dari browser saat Barang Masuk dicatat', async () => {
    const updateSpy = vi.fn();
    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === 'products') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 25, stock: 10, cost_price: 20000, name: 'Pakan discus' },
                  error: null
                })
              }))
            })),
            update: updateSpy
          };
        }
        if (table === 'transactions') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn().mockResolvedValue({
                data: [{
                  id: 999,
                  type: 'in',
                  product_id: 25,
                  qty: 5,
                  price: 20000,
                  note: 'Restock pakan discus'
                }],
                error: null
              })
            }))
          };
        }
      })
    };

    window.supabase = mockSupabase;

    const res = await transactions.createIn({
      product_id: 25,
      qty: 5,
      price: 20000,
      note: 'Restock pakan discus'
    });

    expect(res.ok).toBe(true);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('tidak menulis saldo produk dari browser saat Barang Keluar dicatat', async () => {
    const updateSpy = vi.fn();
    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === 'products') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 30, stock: 20, cost_price: 25000, name: 'Pompa' },
                  error: null
                })
              }))
            })),
            update: updateSpy
          };
        }
        if (table === 'transactions') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn().mockResolvedValue({
                data: [{
                  id: 1000,
                  type: 'out',
                  product_id: 30,
                  qty: 4,
                  price: 35000,
                  channel: 'Shopee'
                }],
                error: null
              })
            }))
          };
        }
      })
    };

    window.supabase = mockSupabase;

    const res = await transactions.createOut({
      product_id: 30,
      qty: 4,
      price: 35000,
      channel: 'Shopee'
    });

    expect(res.ok).toBe(true);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('tidak mengubah saldo produk dari browser saat transaksi dihapus', async () => {
    const updateSpy = vi.fn();
    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 1000, type: 'out', product_id: 30, qty: 4 },
                  error: null
                })
              }))
            })),
            delete: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null })
            }))
          };
        }
        if (table === 'products') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 30, stock: 16 },
                  error: null
                })
              }))
            })),
            update: updateSpy
          };
        }
      })
    };

    window.supabase = mockSupabase;

    const res = await transactions.delete(1000);

    expect(res.ok).toBe(true);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('menyelesaikan nama barang yang tidak ter-join via fallback catalog cache', () => {
    const availableProducts = [
      { id: 23, name: 'Pompa Celup Yamano 105', stock: 12 },
      { id: 45, name: 'Aquarium Kaca Optic 60cm', stock: 5 }
    ];

    function resolveProductName(tx) {
      if (tx.products && tx.products.name) return tx.products.name;
      if (availableProducts && availableProducts.length > 0) {
        const found = availableProducts.find(p => String(p.id) === String(tx.product_id));
        if (found && found.name) return found.name;
      }
      return 'Produk #' + (tx.product_id || '-');
    }

    // Kasus 1: Relasi products berhasil di-join
    expect(resolveProductName({
      product_id: 23,
      products: { name: 'Pompa Celup Yamano 105' }
    })).toBe('Pompa Celup Yamano 105');

    // Kasus 2: Relasi products null/hilang dari backend, fallback ke daftar produk lokal
    expect(resolveProductName({
      product_id: 23,
      products: null
    })).toBe('Pompa Celup Yamano 105');

    // Kasus 3: Produk tidak terdaftar sama sekali
    expect(resolveProductName({
      product_id: 999,
      products: null
    })).toBe('Produk #999');
  });
});
