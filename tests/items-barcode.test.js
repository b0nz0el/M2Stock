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

import { items } from '../public/assets/js/api/items.js';

describe('product barcode API mapping', () => {
  afterEach(() => {
    delete window.supabase;
  });

  it('stores barcode on new Supabase products', async () => {
    const row = {
      sku: 'FILT-002',
      barcode: '0123456789012',
      name: 'Filter Aquarium',
      unit_id: 3
    };
    const select = vi.fn().mockResolvedValue({ data: [row], error: null });
    const insert = vi.fn(() => ({ select }));
    window.supabase = { from: vi.fn(() => ({ insert })) };

    const result = await items.create(row);

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith([{ ...row, category_id: null, brand: null, channel: 'Offline', channel_link: null, stock: 0, min_stock: 0, cost_price: 0, sell_price: 0, image_url: null }]);
  });

  it('returns stored barcodes when reading Supabase products', async () => {
    const row = {
      id: 'product-id',
      sku: 'FILT-002',
      barcode: '0123456789012',
      name: 'Filter Aquarium',
      stock: 1,
      min_stock: 1,
      cost_price: 100,
      sell_price: 200,
      unit_id: 2,
      units: { name: 'botol' }
    };
    const query = {
      select: vi.fn(),
      order: vi.fn()
    };
    query.select.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [row], error: null });
    window.supabase = { from: vi.fn(() => query) };

    const result = await items.getAll();

    expect(result.ok).toBe(true);
    expect(result.data[0].barcode).toBe('0123456789012');
    expect(result.data[0].unit_id).toBe(2);
    expect(result.data[0].unit).toBe('botol');
  });

  it('normalizes empty barcode values to null before saving', async () => {
    const select = vi.fn().mockResolvedValue({ data: [{}], error: null });
    const insert = vi.fn(() => ({ select }));
    window.supabase = { from: vi.fn(() => ({ insert })) };

    const result = await items.create({
      sku: 'NO-BARCODE',
      name: 'Produk tanpa barcode',
      barcode: '   '
    });

    expect(result.ok).toBe(true);
    expect(insert.mock.calls[0][0][0].barcode).toBeNull();
  });

  it('looks up UUID product identifiers as IDs instead of SKUs', async () => {
    const productId = 'c2ef17c0-6344-4526-87e1-dc584f1c5b03';
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: { id: productId, name: 'Filter Aquarium', barcode: '0123456789012' },
        error: null
      })
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    window.supabase = { from: vi.fn(() => query) };

    const result = await items.getById(productId);

    expect(query.eq).toHaveBeenCalledWith('id', productId);
    expect(result.ok).toBe(true);
    expect(result.data.id).toBe(productId);
  });

  it('updates a UUID product without numeric coercion', async () => {
    const productId = 'c2ef17c0-6344-4526-87e1-dc584f1c5b03';
    const query = {
      select: vi.fn().mockResolvedValue({ data: [{ id: productId }], error: null })
    };
    const eq = vi.fn(() => query);
    const update = vi.fn(() => ({ eq }));
    window.supabase = { from: vi.fn(() => ({ update })) };

    const result = await items.update(productId, { barcode: '0123456789012', stock: 99 });

    expect(eq).toHaveBeenCalledWith('id', productId);
    expect(update).toHaveBeenCalledWith({ barcode: '0123456789012' });
    expect(result.ok).toBe(true);
  });

  it('stores the selected stock unit on product create and update', async () => {
    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'new-product' }], error: null });
    const insert = vi.fn(() => ({ select: insertSelect }));
    const updateSelect = vi.fn().mockResolvedValue({ data: [{ id: 'product-id' }], error: null });
    const eq = vi.fn(() => ({ select: updateSelect }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ insert, update }));
    window.supabase = { from };

    await items.create({ sku: 'BOT-1', name: 'Pakan', unit_id: '4' });
    await items.update('product-id', { unit_id: '4' });

    expect(insert.mock.calls[0][0][0].unit_id).toBe(4);
    expect(update).toHaveBeenCalledWith({ unit_id: 4 });
  });
});
