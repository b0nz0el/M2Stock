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

  it('HTML index.html memiliki opsi Offline murni tanpa embel-embel dan input URL bersih tanpa icon di dalamnya', () => {
    const htmlPath = path.resolve(__dirname, '../public/dashboard/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain('<option value="Offline">Offline</option>');
    expect(html).not.toContain('<option value="Offline">Offline / Toko Fisik</option>');
    expect(html).toContain('<input type="url" id="item-channel-link" placeholder=""');
    expect(html).toContain('px-3.5 py-2.5');
    expect(html).not.toContain('<span class="absolute inset-y-0 left-0 pl-3.5');
  });

  it('Halaman Purchase Order memuat toolbar Restock Otomatis, Export PDF, dan Buat PO', () => {
    const htmlPath = path.resolve(__dirname, '../public/dashboard/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain('id="btn-auto-restock-po"');
    expect(html).toContain('id="label-auto-restock-po">Restock Otomatis</span>');
    expect(html).toContain('id="auto-restock-po-count"');
    expect(html).toContain('id="btn-export-po"');
    expect(html).toContain('Export pdf');
    expect(html).toContain('id="btn-add-po-header"');
    expect(html).toContain('Buat PO');
    expect(html).toContain('id="btn-auto-restock-empty"');
    expect(html).toContain('id="po-auto-status-indicator"');
  });

  it('Master Barang menggunakan Icon Link Original (external-link) pada badge saluran dan aksi tabel', () => {
    const itemsPath = path.resolve(__dirname, '../public/dashboard/items.js');
    const itemsJs = fs.readFileSync(itemsPath, 'utf8');

    // Memastikan aksi link di baris tabel menggunakan icon link original external-link
    expect(itemsJs).toContain('<i data-lucide="external-link" class="w-4 h-4" aria-hidden="true"></i>');
    // Memastikan badge saluran menggunakan icon link original external-link
    expect(itemsJs).toContain('<i data-lucide="external-link" class="w-3 h-3 opacity-80" aria-hidden="true"></i>');
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

  it('Multi-Channel CRUD: index.html menyediakan container #item-channels-list dan tombol #btn-add-item-channel', () => {
    const htmlPath = path.resolve(__dirname, '../public/dashboard/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain('id="item-channels-list"');
    expect(html).toContain('id="btn-add-item-channel"');
    expect(html).toContain('Tambah Saluran');
  });

  it('Api.items.parseItemChannels mengurai JSON array string, string tunggal, dan localMeta dengan benar', () => {
    const parse = Api.items.parseItemChannels;
    expect(typeof parse).toBe('function');

    // JSON array string
    const jsonStr = JSON.stringify([
      { channel: 'Shopee', link: 'https://shopee.co.id/item-1' },
      { channel: 'Tokopedia', link: 'https://tokopedia.com/item-1' }
    ]);
    const res1 = parse('Shopee', jsonStr);
    expect(res1).toHaveLength(2);
    expect(res1[0].channel).toBe('Shopee');
    expect(res1[1].channel).toBe('Tokopedia');

    // Single link string
    const res2 = parse('Tokopedia', 'https://tokopedia.com/single');
    expect(res2).toEqual([{ channel: 'Tokopedia', link: 'https://tokopedia.com/single' }]);

    // Fallback localMeta channels
    const localMeta = {
      channels: [
        { channel: 'TikTok Shop', link: 'https://shop.tiktok.com/item-x' },
        { channel: 'WhatsApp', link: 'https://wa.me/628123456789' }
      ]
    };
    const res3 = parse(null, null, localMeta);
    expect(res3).toHaveLength(2);
    expect(res3[0].channel).toBe('TikTok Shop');
    expect(res3[1].channel).toBe('WhatsApp');

    // Offline / Kosong
    const res4 = parse('Offline', '');
    expect(res4).toEqual([]);
  });

  it('Multi-Channel CRUD: saveLocalChannelMeta dan getLocalChannelMeta mendukung array channels', () => {
    const channels = [
      { channel: 'Shopee', link: 'https://shopee.co.id/ikan' },
      { channel: 'Tokopedia', link: 'https://tokopedia.com/ikan' }
    ];
    Api.items.saveLocalChannelMeta(101, 'SKU-MULTI', 'Shopee', JSON.stringify(channels), channels);
    const stored = Api.items.getLocalChannelMeta(101, 'SKU-MULTI');
    expect(stored).not.toBeNull();
    expect(stored.channel).toBe('Shopee');
    expect(stored.channels).toHaveLength(2);
    expect(stored.channels[1].channel).toBe('Tokopedia');
  });

  it('Api.items.create dan update menyimpan channels array ke channel_link sebagai JSON jika memiliki banyak channel', async () => {
    const channels = [
      { channel: 'Shopee', link: 'https://shopee.co.id/ikan-hias' },
      { channel: 'TikTok Shop', link: 'https://tiktok.com/@aqua/item' }
    ];
    const selectMock = vi.fn().mockResolvedValue({
      data: [{ id: 105, name: 'Ikan Guppy', channel: 'Shopee', channel_link: JSON.stringify(channels) }],
      error: null
    });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    window.supabase = { from: fromMock };

    const res = await Api.items.create({
      name: 'Ikan Guppy',
      sku: 'GUP-001',
      channels: channels,
      sell_price: 15000,
      cost_price: 8000
    });

    expect(res.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        channel: 'Shopee',
        channel_link: JSON.stringify(channels)
      })
    ]);
  });

  it('items.js me-render input URL tanpa placeholder atau ikon yang mengganggu dan tombol hapus profesional', () => {
    const fs = require('fs');
    const path = require('path');
    const itemsJs = fs.readFileSync(path.resolve(process.cwd(), 'public/dashboard/items.js'), 'utf-8');

    // Input URL tetap jelas melalui label, tanpa placeholder atau ikon di dalam field.
    expect(itemsJs).toContain('class="item-channel-url');
    expect(itemsJs).not.toContain('placeholder=" "');
    expect(itemsJs).not.toContain('data-lucide="link"');
    expect(itemsJs).toContain('class="item-channel-url w-full bg-[#1C1C1E] border border-white/10 rounded-xl px-3.5');

    // Memastikan tombol hapus saluran menggunakan styling danger profesional
    expect(itemsJs).toContain('class="btn-channel-row-delete inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#FF453A]');
    expect(itemsJs).toContain('data-lucide="trash-2"');
    expect(itemsJs).toContain('Hapus</span>');
  });
});
