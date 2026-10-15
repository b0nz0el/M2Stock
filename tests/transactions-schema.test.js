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

describe('transaction Supabase schema mapping', () => {
  afterEach(() => {
    delete window.supabase;
  });

  it('maps app fields to the documented UUID transaction schema', async () => {
    const insertedRow = {
      id: '7c1bd6c1-3520-4ecb-9350-7174afc12723',
      type: 'in',
      product_id: 'c2ef17c0-6344-4526-87e1-dc584f1c5b03',
      quantity: 4,
      unit_price: 12500,
      total_price: 50000,
      supplier_id: '2be8e6f6-9c7e-4e1b-b5ac-8db2799bf8da',
      customer_id: null,
      channel: 'Offline',
      notes: 'Pembelian stok',
      user_id: 'f68fa94f-2e1d-453d-9d3f-ea6d811d5f28'
    };
    const select = vi.fn().mockResolvedValue({ data: [insertedRow], error: null });
    const insert = vi.fn(() => ({ select }));
    window.supabase = { from: vi.fn(() => ({ insert })) };

    const result = await transactions.createIn({
      product_id: insertedRow.product_id,
      supplier_id: insertedRow.supplier_id,
      qty: 4,
      price: 12500,
      note: 'Pembelian stok',
      created_by: insertedRow.user_id
    });

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith([{
      type: 'in',
      product_id: insertedRow.product_id,
      quantity: 4,
      unit_price: 12500,
      total_price: 50000,
      customer_id: null,
      supplier_id: insertedRow.supplier_id,
      channel: 'Offline',
      notes: 'Pembelian stok',
      user_id: insertedRow.user_id
    }]);
    expect(result.data).toMatchObject({
      id: insertedRow.id,
      qty: 4,
      price: 12500,
      note: 'Pembelian stok',
      created_by: insertedRow.user_id
    });
  });

  it('deletes a UUID transaction without numeric coercion', async () => {
    const transactionId = '7c1bd6c1-3520-4ecb-9350-7174afc12723';
    const eq = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn(() => ({ eq }));
    window.supabase = { from: vi.fn(() => ({ delete: remove })) };

    const result = await transactions.delete(transactionId);

    expect(result.ok).toBe(true);
    expect(eq).toHaveBeenCalledWith('id', transactionId);
  });

  it('rejects invalid quantities and negative unit prices before writing', async () => {
    const insert = vi.fn();
    window.supabase = { from: vi.fn(() => ({ insert })) };

    const result = await transactions.createOut({
      product_id: 'c2ef17c0-6344-4526-87e1-dc584f1c5b03',
      qty: 1.5,
      price: -1
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(insert).not.toHaveBeenCalled();
  });
});
