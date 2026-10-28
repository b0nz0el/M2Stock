import { beforeEach, describe, expect, it, vi } from 'vitest';

const { supabase, productRows } = vi.hoisted(() => ({
  supabase: { from: vi.fn() },
  productRows: []
}));

vi.mock('../public/assets/js/supabase-client.js', () => ({ supabase }));

import { createInternalBarcode } from '../public/dashboard/settings-barcode.js';

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
  });
});
