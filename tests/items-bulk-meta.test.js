import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('../public/assets/js/supabase-client.js', () => ({ supabase: {} }));

import Api from '../public/assets/js/api/index.js';

describe('Api.items.bulkUpdateMeta', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.supabase;
  });

  it('gagal jika ids kosong atau bukan array', async () => {
    const res1 = await Api.items.bulkUpdateMeta([], { unit_id: 1 });
    expect(res1.ok).toBe(false);
    expect(res1.error.code).toBe('INVALID_INPUT');

    const res2 = await Api.items.bulkUpdateMeta(null, { unit_id: 1 });
    expect(res2.ok).toBe(false);
    expect(res2.error.code).toBe('INVALID_INPUT');
  });

  it('gagal jika tidak ada unit_id atau supplier_id yang diberikan', async () => {
    const res = await Api.items.bulkUpdateMeta([1, 2], {});
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('INVALID_INPUT');
  });

  it('menggunakan window.supabase update saat supabase aktif', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ update: updateMock });

    window.supabase = {
      from: fromMock
    };

    const res = await Api.items.bulkUpdateMeta([1, 2], { unit_id: 4, supplier_id: 5 });
    expect(res.ok).toBe(true);
    expect(res.data.updatedCount).toBe(2);
    expect(fromMock).toHaveBeenCalledWith('products');
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ unit_id: 4, supplier_id: 5 }));
    expect(eqMock).toHaveBeenCalledWith('id', '1');
    expect(eqMock).toHaveBeenCalledWith('id', '2');
  });

  it('melakukan fallback tanpa supplier_id jika kolom supplier_id belum ada di Supabase', async () => {
    const eqMock1 = vi.fn().mockResolvedValue({
      error: { message: 'column "supplier_id" of relation "products" does not exist' }
    });
    const eqMock2 = vi.fn().mockResolvedValue({ error: null });

    const updateMock = vi.fn()
      .mockReturnValueOnce({ eq: eqMock1 })
      .mockReturnValueOnce({ eq: eqMock2 });

    const fromMock = vi.fn().mockReturnValue({ update: updateMock });

    window.supabase = {
      from: fromMock
    };

    const res = await Api.items.bulkUpdateMeta([10], { unit_id: 2, supplier_id: 99 });
    expect(res.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ unit_id: 2 }));
    expect(updateMock.mock.calls[1][0]).not.toHaveProperty('supplier_id');
  });

  it('mengirim request HTTP jika Supabase tidak tersedia', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ updatedCount: 2 })
    });

    const res = await Api.items.bulkUpdateMeta([1, 2], { unit_id: 3 });
    expect(res.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/items/bulk-meta'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ ids: [1, 2], unit_id: 3 })
      })
    );
  });
});
