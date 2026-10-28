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
    items: {
      getAll: vi.fn().mockResolvedValue({ ok: true, data: [product] }),
      getById: vi.fn().mockResolvedValue({ ok: true, data: product })
    },
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

  it('uses the latest master purchase price when selecting an existing product', async () => {
    const updatedProduct = { ...product, cost_price: 37500 };
    window.Api.items.getById.mockResolvedValue({ ok: true, data: updatedProduct });
    await window.loadDropdowns();

    await window.selectInProduct(product.id);

    expect(window.Api.items.getById).toHaveBeenCalledWith(product.id);
    expect(document.getElementById('in-price').value).toBe('37500');
    expect(document.getElementById('in-total-preview').textContent).toContain('37.500');
  });

  it('blocks incoming-stock submission when the latest master price cannot be loaded', async () => {
    window.Api.items.getById.mockResolvedValue({
      ok: false,
      error: { message: 'Gagal membaca harga terbaru' }
    });
    window.Api.transactions = { createIn: vi.fn() };
    await window.loadDropdowns();
    await window.selectInProduct(product.id);

    await window.handleInSubmit({ preventDefault: vi.fn() });

    expect(window.Api.items.getById).toHaveBeenCalledTimes(2);
    expect(window.Api.transactions.createIn).not.toHaveBeenCalled();
    expect(window.showToast).toHaveBeenCalledWith(
      'Barang masuk dibatalkan karena harga beli terbaru belum berhasil dimuat.',
      'error'
    );
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

  it('strips leading zeros from currency inputs without changing the numeric value', () => {
    const input = document.getElementById('in-price');
    input.value = '000125000';
    input.dispatchEvent(new Event('input'));

    expect(input.value).toBe('125000');
    expect(Number(input.value)).toBe(125000);
  });

  it('strips leading zeros from incoming quantities', () => {
    const input = document.getElementById('in-qty');
    input.value = '0008';
    input.dispatchEvent(new Event('input'));

    expect(input.value).toBe('8');
    expect(Number(input.value)).toBe(8);
  });
});
