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

import { items } from '../public/assets/js/api/items.js';

describe('Items Delete & Relational Integrity Audit', () => {
  afterEach(() => {
    delete window.supabase;
    vi.clearAllMocks();
  });

  it('checkDeletable memindai 3 tabel relasi: transactions, purchase_order_items, dan returns', async () => {
    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({ data: [{ product_id: 'prod-tx' }], error: null })
            }))
          };
        }
        if (table === 'purchase_order_items') {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({ data: [{ product_id: 'prod-po' }], error: null })
            }))
          };
        }
        if (table === 'returns') {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({ data: [{ produk_id: 'prod-ret' }], error: null })
            }))
          };
        }
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        };
      })
    };

    const res = await items.checkDeletable(['prod-free', 'prod-tx', 'prod-po', 'prod-ret']);

    expect(res.ok).toBe(true);
    expect(res.data.deletableIds).toEqual(['prod-free']);
    expect(res.data.skippedIds).toContain('prod-tx');
    expect(res.data.skippedIds).toContain('prod-po');
    expect(res.data.skippedIds).toContain('prod-ret');
    expect(res.data.skippedIds.length).toBe(3);
  });

  it('items.delete menolak penghapusan produk jika masih tercatat di Purchase Order sebelum query delete dikirim', async () => {
    const deleteSpy = vi.fn();
    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'purchase_order_items') {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({ data: [{ product_id: 'prod-in-po' }], error: null })
            }))
          };
        }
        if (table === 'products') {
          return {
            delete: deleteSpy
          };
        }
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        };
      })
    };

    const res = await items.delete('prod-in-po');

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('RELATION_CONSTRAINT');
    expect(res.error.message).toContain('Purchase Order');
    // Pastikan query delete ke table products TIDAK dieksekusi sama sekali
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('items.delete menangani error 23503 fk_poi_product dari database dan memberikan pesan ramah', async () => {
    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'products') {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: {
                  code: '23503',
                  message: 'update or delete on table "products" violates foreign key constraint "fk_poi_product" on table "purchase_order_items"'
                }
              })
            }))
          };
        }
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        };
      })
    };

    const res = await items.delete('orphan-id');

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('RELATION_CONSTRAINT');
    expect(res.error.message).toBe('Produk tidak dapat dihapus karena masih tercatat dalam riwayat Purchase Order, transaksi, atau Retur.');
  });
});
