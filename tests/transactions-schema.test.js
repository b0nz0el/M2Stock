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

  it('maps app fields to the live database schema (qty, price, note, created_by)', async () => {
    const insertedRow = {
      id: 101,
      type: 'in',
      product_id: 12,
      qty: 4,
      price: 12500,
      supplier_id: 5,
      customer_id: null,
      channel: 'Offline',
      note: 'Pembelian stok',
      created_by: 'f68fa94f-2e1d-453d-9d3f-ea6d811d5f28'
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
      created_by: insertedRow.created_by
    });

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith([{
      type: 'in',
      product_id: 12,
      qty: 4,
      price: 12500,
      cost_price: 12500,
      customer_id: null,
      supplier_id: 5,
      channel: 'Offline',
      note: 'Pembelian stok',
      created_by: insertedRow.created_by
    }]);
    expect(result.data).toMatchObject({
      id: insertedRow.id,
      qty: 4,
      price: 12500,
      note: 'Pembelian stok',
      created_by: insertedRow.created_by
    });
  });

  it('retries with modern columns if Supabase schema cache returns PGRST204', async () => {
    const modernRow = {
      id: 102,
      type: 'in',
      product_id: 12,
      quantity: 4,
      unit_price: 12500,
      total_price: 50000,
      supplier_id: 5,
      customer_id: null,
      channel: 'Offline',
      notes: 'Pembelian stok modern',
      user_id: 'f68fa94f-2e1d-453d-9d3f-ea6d811d5f28'
    };

    let callCount = 0;
    const insert = vi.fn(() => ({
      select: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: null,
            error: { code: 'PGRST204', message: "Could not find the 'qty' column of 'transactions' in the schema cache" }
          });
        }
        return Promise.resolve({ data: [modernRow], error: null });
      })
    }));
    window.supabase = { from: vi.fn(() => ({ insert })) };

    const result = await transactions.createIn({
      product_id: 12,
      supplier_id: 5,
      qty: 4,
      price: 12500,
      note: 'Pembelian stok modern',
      created_by: modernRow.user_id
    });

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(result.data.note).toBe('Pembelian stok modern');
    expect(result.data.qty).toBe(4);
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
