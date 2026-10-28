import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('../public/assets/js/supabase-client.js', () => ({ supabase: {} }));

import Api from '../public/assets/js/api/index.js';

describe('Master Barang — Saluran & Link Channel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.supabase;
  });

  it('Api.items.getAll memetakan channel dan channel_link dari Supabase', async () => {
    const mockProducts = [
      {
        id: 1,
        name: 'Filter Aquarium Canister',
        sku: 'FLT-001',
        channel: 'Shopee',
        channel_link: 'https://shopee.co.id/filter-canister',
        stock: 5,
        sell_price: 150000,
        cost_price: 100000,
        min_stock: 2,
        categories: { name: 'Filter' },
        units: { name: 'pcs' }
      },
      {
        id: 2,
        name: 'Pakan Ikan Pelet',
        sku: 'PKN-001',
        channel: null,
        channel_link: null,
        stock: 10,
        sell_price: 25000,
        cost_price: 15000,
        min_stock: 5,
        categories: { name: 'Pakan' },
        units: { name: 'pcs' }
      }
    ];

    const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });

    window.supabase = { from: fromMock };

    const res = await Api.items.getAll();
    expect(res.ok).toBe(true);
    expect(res.data[0].channel).toBe('Shopee');
    expect(res.data[0].channel_link).toBe('https://shopee.co.id/filter-canister');
    expect(res.data[1].channel).toBe('Offline');
    expect(res.data[1].channel_link).toBe('');
  });

  it('Api.items.create menyertakan channel dan channel_link pada row insert', async () => {
    const selectMock = vi.fn().mockResolvedValue({
      data: [{ id: 10, name: 'Lampu LED Aquascape', channel: 'Tokopedia', channel_link: 'https://tokopedia.com/lampu-led' }],
      error: null
    });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });

    window.supabase = { from: fromMock };

    const res = await Api.items.create({
      name: 'Lampu LED Aquascape',
      sku: 'LMP-001',
      channel: 'Tokopedia',
      channel_link: 'https://tokopedia.com/lampu-led',
      sell_price: 85000,
      cost_price: 60000
    });

    expect(res.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('products');
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        channel: 'Tokopedia',
        channel_link: 'https://tokopedia.com/lampu-led'
      })
    ]);
  });

  it('Api.items.update melakukan retry fallback jika kolom channel belum ada di Supabase', async () => {
    const selectFail = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'column "channel_link" of relation "products" does not exist' }
    });
    const selectSuccess = vi.fn().mockResolvedValue({
      data: [{ id: 10, name: 'Lampu LED Aquascape' }],
      error: null
    });

    const eqFail = vi.fn().mockReturnValue({ select: selectFail });
    const eqSuccess = vi.fn().mockReturnValue({ select: selectSuccess });

    const updateMock = vi.fn()
      .mockReturnValueOnce({ eq: eqFail })
      .mockReturnValueOnce({ eq: eqSuccess });

    const fromMock = vi.fn().mockReturnValue({ update: updateMock });

    window.supabase = { from: fromMock };

    const res = await Api.items.update(10, {
      name: 'Lampu LED Aquascape',
      channel: 'Tokopedia',
      channel_link: 'https://tokopedia.com/lampu-led'
    });

    expect(res.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(2);
    // Panggilan kedua menghapus channel & channel_link agar tetap berhasil tersimpan
    expect(updateMock).toHaveBeenNthCalledWith(2, expect.not.objectContaining({
      channel: 'Tokopedia',
      channel_link: 'https://tokopedia.com/lampu-led'
    }));
  });

  it('HTML index.html tidak lagi memuat aksi massal di bawah tabel', () => {
    const htmlPath = path.resolve(__dirname, '../public/dashboard/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).not.toContain('id="select-all-items"');
    expect(html).not.toContain('id="btn-bulk-price"');
    expect(html).not.toContain('id="btn-bulk-meta"');
    expect(html).not.toContain('id="btn-bulk-delete"');
    expect(html).not.toContain('Pilih semua halaman ini');

    // Memastikan sticky bulk bar atas tetap ada
    expect(html).toContain('id="bulk-bar"');
  });

  it('HTML index.html memuat input Saluran Penjualan dan Link Channel di modal item', () => {
    const htmlPath = path.resolve(__dirname, '../public/dashboard/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain('id="item-channel"');
    expect(html).toContain('id="item-channel-link"');
    expect(html).toContain('id="btn-open-channel-link"');
    // Memastikan modal item menggunakan lebar lapang max-w-2xl
    expect(html).toContain('max-w-xl sm:max-w-2xl');
    // Memastikan tombol buka link tidak menggunakan atribut title native agar tidak memicu tooltip yang menutupi harga
    const btnMatch = html.match(/<a id="btn-open-channel-link"[^>]*>/);
    expect(btnMatch).not.toBeNull();
    expect(btnMatch[0]).not.toContain('title=');
  });

  it('HTML index.html memposisikan #toast-container di Top-Center secara modern', () => {
    const htmlPath = path.resolve(__dirname, '../public/dashboard/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain('id="toast-container"');
    expect(html).toContain('left-1/2 -translate-x-1/2');
    expect(html).toContain('top-4');
  });

  it('Ikon Lucide "link", "globe", dan "message-circle" terdaftar di icons.js', () => {
    const iconsPath = path.resolve(__dirname, '../public/assets/js/icons.js');
    const iconsContent = fs.readFileSync(iconsPath, 'utf8');

    expect(iconsContent).toContain('"link":');
    expect(iconsContent).toContain('"globe":');
    expect(iconsContent).toContain('"message-circle":');
  });

  it('HTML index.html memiliki opsi Offline murni tanpa embel-embel dan input URL dengan placeholder kosong lapang', () => {
    const htmlPath = path.resolve(__dirname, '../public/dashboard/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain('<option value="Offline">Offline</option>');
    expect(html).not.toContain('<option value="Offline">Offline / Toko Fisik</option>');
    expect(html).toContain('<input type="url" id="item-channel-link" placeholder=""');
    expect(html).toContain('pl-10');
  });

  it('Dual-layer persistence: saveLocalChannelMeta dan getLocalChannelMeta menjaga data channel dan link tetap tersimpan', async () => {
    // 1. Simpan channel meta ke local storage
    Api.items.saveLocalChannelMeta(99, 'SKU-99', 'Shopee', 'https://shopee.co.id/ikan-cupang');
    const stored = Api.items.getLocalChannelMeta(99, 'SKU-99');
    expect(stored).not.toBeNull();
    expect(stored.channel).toBe('Shopee');
    expect(stored.channel_link).toBe('https://shopee.co.id/ikan-cupang');

    // 2. Simulasi getAll dari Supabase yang belum memiliki kolom channel
    const mockProducts = [
      {
        id: 99,
        sku: 'SKU-99',
        name: 'Ikan Cupang Halfmoon',
        channel: null,
        channel_link: null,
        categories: { name: 'Ikan' },
        units: { name: 'ekor' }
      }
    ];

    const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    window.supabase = { from: fromMock };

    const res = await Api.items.getAll();
    expect(res.ok).toBe(true);
    expect(res.data[0].channel).toBe('Shopee');
    expect(res.data[0].channel_link).toBe('https://shopee.co.id/ikan-cupang');
  });
});
