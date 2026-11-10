import { afterEach, describe, expect, it, vi } from 'vitest';

const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn()
  }
}));

vi.mock('../public/assets/js/supabase-client.js', () => ({ supabase }));

import { backup, BACKUP_TABLES } from '../public/assets/js/api/backup.js';

function configureTables({ reads = {}, readErrors = {}, writeErrors = {} } = {}) {
  supabase.from.mockImplementation((tableId) => ({
    select: vi.fn().mockResolvedValue({
      data: reads[tableId] || [],
      error: readErrors[tableId] || null
    }),
    upsert: vi.fn().mockResolvedValue({
      error: writeErrors[tableId] || null
    })
  }));
}

describe('Backup export and restore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    supabase.from.mockReset();
  });

  it('exports every supported table when all database reads succeed', async () => {
    configureTables({ reads: { products: [{ id: 'product-1' }] } });
    vi.spyOn(backup, 'log').mockResolvedValue({ ok: true });

    const result = await backup.exportAllJSON();

    expect(result.ok).toBe(true);
    expect(result.data.payload.data.products).toEqual([{ id: 'product-1' }]);
    expect(result.data.payload.meta.tables).toEqual(BACKUP_TABLES.map(table => table.id));
    expect(result.data.totalRecords).toBe(1);
  });

  it('refuses to report a complete backup when any table cannot be read', async () => {
    configureTables({ readErrors: { products: { message: 'permission denied' } } });
    const logSpy = vi.spyOn(backup, 'log');

    const result = await backup.exportAllJSON();

    expect(result.ok).toBe(false);
    expect(result.error.message).toContain('products');
    expect(result.error.message).toContain('permission denied');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('restores table rows from an exported backup payload', async () => {
    configureTables();
    vi.spyOn(backup, 'log').mockResolvedValue({ ok: true });
    const payload = {
      meta: { app: 'M2Stock' },
      data: {
        products: [{ id: 'product-1', name: 'Test Aquarium' }],
        suppliers: []
      }
    };

    const result = await backup.importJSON(payload, 'test-backup.json');

    expect(result.ok).toBe(true);
    expect(result.data.totalImported).toBe(1);
    expect(result.data.details.products.status).toBe('success');
    expect(result.data.details.suppliers.status).toBe('success');
    expect(supabase.from).toHaveBeenCalledWith('products');
  });

  it('reports partial restores instead of claiming success', async () => {
    configureTables({
      writeErrors: { products: { message: 'foreign key constraint failed' } }
    });
    vi.spyOn(backup, 'log').mockResolvedValue({ ok: true });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await backup.importJSON({
      data: {
        products: [{ id: 'product-1' }],
        suppliers: [{ id: 'supplier-1' }]
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('PARTIAL_RESTORE');
    expect(result.error.message).toContain('Sebagian data mungkin sudah tersimpan');
    expect(result.data.failedTables).toEqual(['products']);
    expect(result.data.details.suppliers.status).toBe('success');
  });

  it('rejects backup files without any supported table data', async () => {
    configureTables();

    const result = await backup.importJSON({ data: { unknown_table: [{ id: 'x' }] } });

    expect(result.ok).toBe(false);
    expect(result.error.message).toContain('tidak berisi tabel M2Stock');
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
