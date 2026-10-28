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

import { suppliers } from '../public/assets/js/api/suppliers.js';

describe('supplier update API', () => {
  afterEach(() => {
    delete window.supabase;
  });

  it('explains when a supplier update affects no visible row', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object' }
    });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    window.supabase = { from: vi.fn(() => ({ update })) };

    const result = await suppliers.update(404, { name: 'Supplier Baru' });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('PGRST116');
    expect(result.error.message).toContain('Supplier tidak ditemukan');
  });
});
