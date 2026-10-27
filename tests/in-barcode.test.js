import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const inScript = readFileSync(resolve(process.cwd(), 'public/dashboard/in.js'), 'utf8');
const product = {
  id: 7,
  name: 'Filter Aquarium',
  barcode: '0123456789012',
  stock: 3,
  cost_price: 25000
};

function setupForm() {
  document.body.innerHTML = `
    <input id="in-barcode">
    <p id="in-barcode-status"></p>
    <select id="in-product-id"></select>
    <input id="in-price" value="0">
    <input id="in-qty" value="1">
    <span id="in-total-preview"></span>
  `;

  window.Api = {
    items: { getAll: vi.fn().mockResolvedValue({ ok: true, data: [product] }) },
    suppliers: { getAll: vi.fn().mockResolvedValue({ ok: true, data: [] }) }
  };
  window.showToast = vi.fn();
  window.eval(inScript);
  document.getElementById('in-product-id').addEventListener('change', window.handleInProductChange);
}

describe('Barang Masuk barcode lookup', () => {
  beforeEach(() => {
    setupForm();
  });

  afterEach(() => {
    delete window.Api;
    delete window.showToast;
    document.body.innerHTML = '';
  });

  it('selects the matching product and loads its purchase price', async () => {
    await window.loadDropdowns();
    await window.handleInBarcodeLookup('0123456789012');

    expect(document.getElementById('in-barcode').value).toBe('0123456789012');
    expect(document.getElementById('in-product-id').value).toBe('7');
    expect(document.getElementById('in-price').value).toBe('25000');
    expect(document.getElementById('in-barcode-status').textContent).toContain('Filter Aquarium');
  });

  it('clears product selection when barcode is not registered', async () => {
    await window.loadDropdowns();
    document.getElementById('in-product-id').value = '7';
    document.getElementById('in-price').value = '25000';

    await window.handleInBarcodeLookup('UNKNOWN-CODE');

    expect(document.getElementById('in-product-id').value).toBe('');
    expect(document.getElementById('in-price').value).toBe('0');
    expect(window.showToast).toHaveBeenCalledWith(
      'Produk dengan barcode tersebut tidak ditemukan',
      'error'
    );
  });
});
