import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../public/assets/js/supabase-client.js', () => ({
  supabase: { from }
}));

import { po } from '../public/assets/js/api/po.js';
import { returnApi } from '../public/assets/js/api/return.js';

describe('delete API feedback', () => {
  let query;

  beforeEach(() => {
    query = {
      delete: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn()
    };
    query.delete.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    from.mockReturnValue(query);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['Purchase Order', po, 'purchase_orders'],
    ['catatan retur', returnApi, 'returns']
  ])('melaporkan %s terhapus jika server mengembalikan baris yang dihapus', async (_label, api, table) => {
    query.maybeSingle.mockResolvedValue({ data: { id: 'record-1' }, error: null });

    const result = await api.delete('record-1');

    expect(from).toHaveBeenCalledWith(table);
    expect(query.eq).toHaveBeenCalledWith('id', 'record-1');
    expect(query.select).toHaveBeenCalledWith('id');
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: 'record-1' });
  });

  it.each([
    ['Purchase Order', po],
    ['catatan retur', returnApi]
  ])('tidak memberi konfirmasi sukses jika %s tidak terhapus', async (_label, api) => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await api.delete('record-1');

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it.each([
    ['Purchase Order', po],
    ['catatan retur', returnApi]
  ])('meneruskan alasan database saat gagal menghapus %s', async (_label, api) => {
    const error = { code: '42501', message: 'Permission denied' };
    query.maybeSingle.mockResolvedValue({ data: null, error });

    const result = await api.delete('record-1');

    expect(result.ok).toBe(false);
    expect(result.error.message).toBe('Permission denied');
  });
});
