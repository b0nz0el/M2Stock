import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../public/assets/js/supabase-client.js', () => ({ supabase: {} }));

import Api from '../public/assets/js/api/index.js';

describe('Api.items.bulkUpdatePrice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete window.supabase;
  });

  it('membaca harga online tersimpan dan mempertahankan default modal +25%', async () => {
    const records = [
      { id: 1, cost_price: 10000, sell_price: 15000, online_sell_price: 13250 },
      { id: 2, cost_price: 5000, sell_price: 7000, online_sell_price: null }
    ];
    const orderMock = vi.fn().mockResolvedValue({ data: records, error: null });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    window.supabase = { from: vi.fn().mockReturnValue({ select: selectMock }) };

    const result = await Api.items.getAll();

    expect(result.ok).toBe(true);
    expect(result.data.map(item => item.online_sell_price)).toEqual([13250, 6250]);
  });

  it('memperbarui harga jual offline dan online secara terpisah', async () => {
    const updatedRows = [];
    const fromMock = vi.fn().mockReturnValue({
      update: vi.fn((row) => {
        const eq = vi.fn().mockImplementation(async (column, id) => {
          updatedRows.push({ row, column, id });
          return { error: null };
        });
        return { eq };
      })
    });
    window.supabase = { from: fromMock };

    const result = await Api.items.bulkUpdatePrice([
      { id: 11, sell_price: 15000 },
      { id: 12, online_sell_price: 13250 }
    ]);

    expect(result.ok).toBe(true);
    expect(result.data.updatedCount).toBe(2);
    expect(updatedRows).toEqual([
      { row: { sell_price: 15000 }, column: 'id', id: '11' },
      { row: { online_sell_price: 13250 }, column: 'id', id: '12' }
    ]);
  });

  it('menolak input tidak valid tanpa memanggil database', async () => {
    const updateMock = vi.fn();
    window.supabase = { from: vi.fn().mockReturnValue({ update: updateMock }) };

    const result = await Api.items.bulkUpdatePrice([
      { id: 11, online_sell_price: -1 }
    ]);

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_INPUT');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('memberi tahu bila kolom harga online belum dimigrasikan', async () => {
    const eqMock = vi.fn().mockResolvedValue({
      error: {
        code: 'PGRST204',
        message: "Could not find the 'online_sell_price' column of 'products' in the schema cache"
      }
    });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    window.supabase = { from: vi.fn().mockReturnValue({ update: updateMock }) };

    const result = await Api.items.bulkUpdatePrice([
      { id: 11, online_sell_price: 13250 }
    ]);

    expect(result.ok).toBe(false);
    expect(result.error.message).toContain('Terapkan migrasi harga online');
    expect(result.error.details[0].code).toBe('MIGRATION_REQUIRED');
  });

  it('menolak harga online negatif tanpa memanggil database', async () => {
    const updateMock = vi.fn();
    window.supabase = { from: vi.fn().mockReturnValue({ update: updateMock }) };

    const result = await Api.items.bulkUpdatePrice([
      { id: 11, online_sell_price: -100 }
    ]);

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_INPUT');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('menolak harga kosong tanpa menganggapnya sebagai harga gratis', async () => {
    const updateMock = vi.fn();
    window.supabase = { from: vi.fn().mockReturnValue({ update: updateMock }) };

    const result = await Api.items.bulkUpdatePrice([
      { id: 11, online_sell_price: null }
    ]);

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_INPUT');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('tetap dapat menambah produk saat kolom harga online belum dimigrasikan', async () => {
    vi.spyOn(Api.audit, 'log').mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'ip=127.0.0.1'
    }));
    const responses = [
      {
        data: null,
        error: {
          code: 'PGRST204',
          message: "Could not find the 'online_sell_price' column of 'products' in the schema cache"
        }
      },
      { data: [{ id: 21, name: 'Produk' }], error: null }
    ];
    const selectMock = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    window.supabase = { from: vi.fn().mockReturnValue({ insert: insertMock }) };

    const result = await Api.items.create({ name: 'Produk', cost_price: 10000, sell_price: 15000 });

    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock.mock.calls[0][0][0].online_sell_price).toBe(12500);
    expect(insertMock.mock.calls[1][0][0]).not.toHaveProperty('online_sell_price');
  });

  it('melaporkan error saat koneksi database tidak tersedia', async () => {
    const result = await Api.items.bulkUpdatePrice([{ id: 11, sell_price: 15000 }]);

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('SUPABASE_UNAVAILABLE');
  });
});
