import { beforeEach, describe, expect, it, vi } from 'vitest';

const { supabase, productRows } = vi.hoisted(() => ({
  supabase: { from: vi.fn() },
  productRows: []
}));

vi.mock('../public/assets/js/supabase-client.js', () => ({ supabase }));

import {
  createInternalBarcode,
  filterProductsWithoutBarcode
} from '../public/dashboard/settings-barcode.js';

describe('Internal product barcode creation', () => {
  beforeEach(() => {
    productRows.splice(0, productRows.length,
      { id: 'product-1', name: 'Filter Aquarium', sku: 'FLT-1', barcode: null },
      { id: 'product-2', name: 'Lampu LED', sku: 'LED-2', barcode: 'OLD12345' }
    );
    let updateValues = {};
    let updateId = null;
    const query = {
      select: vi.fn(() => query),
      order: vi.fn(() => query),
      range: vi.fn(async () => ({ data: productRows, error: null })),
      update: vi.fn(values => {
        updateValues = values;
        return query;
      }),
      eq: vi.fn((column, value) => {
        if (column === 'id') updateId = value;
        return query;
      }),
      is: vi.fn(() => query),
      maybeSingle: vi.fn(async () => {
        const product = productRows.find(item => item.id === updateId);
        if (!product || product.barcode) return { data: null, error: null };
        Object.assign(product, updateValues);
        return { data: { ...product }, error: null };
      })
    };
    supabase.from.mockReturnValue(query);

    document.body.innerHTML = `
      <div class="settings-tabs"><button type="button" data-tab="barcode"></button></div>
      <button id="btn-refresh-missing-barcodes"></button>
      <button id="btn-select-missing-barcodes"></button>
      <button id="btn-generate-selected-barcodes"></button>
      <input id="search-missing-barcodes">
      <p id="missing-barcode-count"></p>
      <ul id="missing-barcode-list"></ul>
    `;
    window.showToast = vi.fn();
    window.JsBarcode = vi.fn((element, code) => element.setAttribute('data-barcode-value', code));
  });

  it('creates a scanner-compatible internal Code 128 value without GS1 claims', () => {
    const cryptoApi = {
      getRandomValues(values) {
        values[0] = 0;
        values[1] = 1;
        return values;
      }
    };

    const value = createInternalBarcode(cryptoApi);

    expect(value).toMatch(/^AS\d{10}$/);
    expect(value).toBe('AS0000000001');
    expect(value.length).toBeGreaterThanOrEqual(8);
  });

  it('rejects environments without a cryptographically secure random generator', () => {
    expect(() => createInternalBarcode({})).toThrow('tidak mendukung generator kode acak yang aman');
  });

  it('searches missing products by name or SKU without case sensitivity', () => {
    const products = [
      { name: 'Amara Aquarium Sponge', sku: 'FIL-AMA-306' },
      { name: 'Amara Lampu LED', sku: 'LED-042' }
    ];

    expect(filterProductsWithoutBarcode(products, 'SPONGE')).toEqual([products[0]]);
    expect(filterProductsWithoutBarcode(products, 'led-042')).toEqual([products[1]]);
    expect(filterProductsWithoutBarcode(products, '  ')).toEqual(products);
    expect(filterProductsWithoutBarcode(products, 'not found')).toEqual([]);
  });

  it('provides a settings tab, local renderer and print label path', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const root = path.resolve(__dirname, '..');
    const settingsHtml = fs.readFileSync(path.join(root, 'public/dashboard/index.html'), 'utf8');
    const module = fs.readFileSync(path.join(root, 'public/dashboard/settings-barcode.js'), 'utf8');
    const serviceWorker = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
    const syncScript = fs.readFileSync(path.join(root, 'scripts/sync-vendor-assets.mjs'), 'utf8');
    const icons = fs.readFileSync(path.join(root, 'public/assets/js/icons.js'), 'utf8');

    expect(settingsHtml).toContain('data-tab="barcode"');
    expect(settingsHtml).toContain('tab-content-barcode');
    expect(settingsHtml).toContain('kode internal toko (Code 128)');
    expect(settingsHtml).toContain('data-lucide="scan-line"');
    expect(settingsHtml).toContain('max-h-[55vh] overflow-y-auto overscroll-contain');
    expect(settingsHtml).toContain('aria-label="Daftar produk tanpa barcode"');
    expect(icons).toContain('"scan-line"');
    expect(module).toContain("script.src = '/assets/js/vendor/jsbarcode.all.min.js'");
    expect(module).toContain("format: 'CODE128'");
    expect(module).toContain("@page { size: 50mm 30mm");
    expect(module).toContain(".is('barcode', null)");
    expect(serviceWorker).toContain("'/assets/js/vendor/jsbarcode.all.min.js'");
    expect(syncScript).toContain("syncVendorAsset('jsbarcode', '3.12.1'");
  });

  it('lists only missing barcodes and assigns a code before printing the label', async () => {
    const printDocument = document.implementation.createHTMLDocument('Print labels');
    const print = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({
      document: printDocument,
      setTimeout: callback => callback(),
      focus: vi.fn(),
      print,
      close: vi.fn()
    });

    const { initBarcodeSettings } = await import('../public/dashboard/settings-barcode.js');
    initBarcodeSettings();
    document.querySelector('[data-tab="barcode"]').click();

    await vi.waitFor(() => {
      expect(document.querySelectorAll('#missing-barcode-list [data-generate-barcode]')).toHaveLength(1);
    });
    expect(document.querySelector('#missing-barcode-list').textContent).toContain('Filter Aquarium');
    expect(document.querySelector('#missing-barcode-list').textContent).not.toContain('Lampu LED');

    const checkbox = document.querySelector('#missing-barcode-list input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('btn-generate-selected-barcodes').click();

    await vi.waitFor(() => {
      expect(productRows[0].barcode).toMatch(/^AS\d{10}$/);
    });
    await vi.waitFor(() => {
      expect(print).toHaveBeenCalledOnce();
    });
    expect(productRows[1].barcode).toBe('OLD12345');
    expect(printDocument.body.textContent).toContain('Filter Aquarium');
    expect(printDocument.querySelector('.barcode')?.getAttribute('data-barcode-value')).toBe(productRows[0].barcode);
    expect(printDocument.body.textContent).not.toContain('SKU:');
    expect(printDocument.querySelector('.product-price')).not.toBeNull();
  });

  it('filters visible products and selects only search results while retaining hidden selections', async () => {
    productRows.push({ id: 'product-3', name: 'Pakan Ikan', sku: 'FEED-3', barcode: null });
    const printDocument = document.implementation.createHTMLDocument('Print labels');
    const print = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({
      document: printDocument,
      setTimeout: callback => callback(),
      focus: vi.fn(),
      print,
      close: vi.fn()
    });

    const { initBarcodeSettings } = await import('../public/dashboard/settings-barcode.js');
    initBarcodeSettings();
    document.querySelector('[data-tab="barcode"]').click();

    await vi.waitFor(() => {
      expect(document.querySelectorAll('#missing-barcode-list [data-generate-barcode]')).toHaveLength(2);
    });

    const search = document.getElementById('search-missing-barcodes');
    search.value = 'filter';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.getElementById('missing-barcode-count').textContent).toBe('1 dari 2 produk cocok');
    expect(document.querySelectorAll('#missing-barcode-list [data-generate-barcode]')).toHaveLength(1);

    document.getElementById('btn-select-missing-barcodes').click();
    expect(document.querySelector('#missing-barcode-list input[data-select-row]').checked).toBe(true);
    search.value = 'feed-3';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('#missing-barcode-list [data-generate-barcode]').dataset.generateBarcode).toBe('product-3');
    expect(document.getElementById('btn-generate-selected-barcodes').disabled).toBe(false);

    document.getElementById('btn-select-missing-barcodes').click();
    expect(document.querySelector('#missing-barcode-list input[data-select-row]').checked).toBe(true);
    document.getElementById('btn-generate-selected-barcodes').click();
    await vi.waitFor(() => {
      expect(productRows[0].barcode).toMatch(/^AS\d{10}$/);
      expect(productRows[2].barcode).toMatch(/^AS\d{10}$/);
    });
    expect(productRows[1].barcode).toBe('OLD12345');
    await vi.waitFor(() => {
      expect(print).toHaveBeenCalledOnce();
    });
  });

  it('allows switching to existing barcodes filter and re-printing them', async () => {
    // Tambahkan tombol filter ke DOM
    const filterBtn = document.createElement('button');
    filterBtn.id = 'btn-filter-barcode-existing';
    document.body.appendChild(filterBtn);

    const printDocument = document.implementation.createHTMLDocument('Print labels');
    const print = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({
      document: printDocument,
      setTimeout: callback => callback(),
      focus: vi.fn(),
      print,
      close: vi.fn()
    });

    const { initBarcodeSettings } = await import('../public/dashboard/settings-barcode.js');
    initBarcodeSettings();
    document.querySelector('[data-tab="barcode"]').click();

    await vi.waitFor(() => {
      expect(document.querySelector('#missing-barcode-list').textContent).toContain('Filter Aquarium');
    });

    // Klik filter "Sudah Ada Barcode (Cetak Ulang)"
    filterBtn.click();

    await vi.waitFor(() => {
      expect(document.querySelector('#missing-barcode-list').textContent).toContain('Lampu LED');
      expect(document.querySelector('#missing-barcode-list').textContent).toContain('OLD12345');
    });

    const printBtn = document.querySelector('#missing-barcode-list [data-print-barcode="product-2"]');
    expect(printBtn).not.toBeNull();
    printBtn.click();

    await vi.waitFor(() => {
      expect(print).toHaveBeenCalledOnce();
    });
    expect(printDocument.body.textContent).toContain('Lampu LED');
    expect(printDocument.body.textContent).not.toContain('SKU:');
  });

  it('supports 40x30 2-column layout for 80mm thermal printer via printSingleProductBarcode', async () => {
    const printDocument = document.implementation.createHTMLDocument('Print labels');
    const print = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({
      document: printDocument,
      setTimeout: callback => callback(),
      focus: vi.fn(),
      print,
      close: vi.fn()
    });

    const { printSingleProductBarcode } = await import('../public/dashboard/settings-barcode.js');
    const testProduct = { id: 99, name: 'Pelet Ikan Kura', barcode: 'AS1234567890', sell_price: 35000 };

    await printSingleProductBarcode(testProduct, '40x30_double');

    await vi.waitFor(() => {
      expect(print).toHaveBeenCalledOnce();
    });
    expect(printDocument.body.textContent).toContain('Pelet Ikan Kura');
    expect(printDocument.body.textContent).toContain('Rp 35.000');
    expect(printDocument.body.textContent).not.toContain('SKU:');
    expect(printDocument.querySelector('.barcode-sheet')).not.toBeNull();
  });
});
