import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('../public/assets/js/supabase-client.js', () => ({ supabase: {} }));

import Api from '../public/assets/js/api/index.js';

describe('Items Table Sorting (A-Z otomatis)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.supabase;
  });

  it('Api.items.getAll meminta query produk diurutkan berdasarkan name A-Z secara default', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });

    window.supabase = { from: fromMock };

    const res = await Api.items.getAll();
    expect(res.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('products');
    expect(orderMock).toHaveBeenCalledWith('name', { ascending: true });
  });

  it('Api.items.getAll menghormati parameter custom order jika diberikan', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });

    window.supabase = { from: fromMock };

    await Api.items.getAll({ order: 'created_at', ascending: false });
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('Algoritma sortir Nama A-Z menyusun daftar produk tidak berurutan menjadi berurutan alfabetis A-Z', () => {
    const rawItems = [
      { id: 1, name: 'Pompa Kandila 1200' },
      { id: 2, name: 'Akari louhan 120g' },
      { id: 3, name: 'Biofom AA 833' },
      { id: 4, name: 'Amara HF 650' },
      { id: 5, name: 'pelet kura kura 1mm' }
    ];

    const sorted = [...rawItems].sort((a, b) => {
      const nameA = (a.name || '').trim();
      const nameB = (b.name || '').trim();
      return nameA.localeCompare(nameB, 'id', { sensitivity: 'base', numeric: true });
    });

    const sortedNames = sorted.map(i => i.name);
    expect(sortedNames).toEqual([
      'Akari louhan 120g',
      'Amara HF 650',
      'Biofom AA 833',
      'pelet kura kura 1mm',
      'Pompa Kandila 1200'
    ]);
  });

  it('Algoritma sortir Nama Z-A menyusun produk dari Z ke A', () => {
    const rawItems = [
      { id: 1, name: 'Akari louhan 120g' },
      { id: 2, name: 'Pompa Kandila 1200' },
      { id: 3, name: 'Biofom AA 833' }
    ];

    const sorted = [...rawItems].sort((a, b) => {
      const nameA = (a.name || '').trim();
      const nameB = (b.name || '').trim();
      return nameB.localeCompare(nameA, 'id', { sensitivity: 'base', numeric: true });
    });

    expect(sorted.map(i => i.name)).toEqual([
      'Pompa Kandila 1200',
      'Biofom AA 833',
      'Akari louhan 120g'
    ]);
  });
});

