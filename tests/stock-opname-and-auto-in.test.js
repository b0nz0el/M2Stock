import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const htmlContent = readFileSync(resolve(process.cwd(), 'public/dashboard/index.html'), 'utf8');

vi.mock('../public/assets/js/api/_client.js', () => ({
  isSupabaseAvailable: vi.fn(() => true),
  formatResponse: (response) => ({
    ok: Boolean(response.ok),
    data: response.data ?? null,
    error: response.error ?? null,
    meta: response.meta ?? {}
  }),
  handleError: (error) => ({ ok: false, data: null, error }),
  apiRequest: vi.fn(),
  logAudit: vi.fn()
}));

import { items } from '../public/assets/js/api/items.js';

describe('Professional Inventory Standard: Stock Opname & Auto-IN Transaction', () => {
  describe('HTML Markup Validation', () => {
    it('contains modal-stock-adjustment and all required controls', () => {
      expect(htmlContent).toContain('id="modal-stock-adjustment"');
      expect(htmlContent).toContain('id="adj-product-id"');
      expect(htmlContent).toContain('id="adj-current-stock"');
      expect(htmlContent).toContain('id="adj-actual-stock"');
      expect(htmlContent).toContain('id="adj-diff-badge"');
      expect(htmlContent).toContain('id="adj-diff-box"');
      expect(htmlContent).toContain('id="adj-reason"');
      expect(htmlContent).toContain('id="btn-submit-adjustment"');
    });

    it('contains item-supplier-id in modal-item', () => {
      expect(htmlContent).toContain('id="item-supplier-id"');
      expect(htmlContent).toContain('id="item-supplier-wrap"');
    });

    it('contains in-stock-preview in modal-in', () => {
      expect(htmlContent).toContain('id="in-stock-preview"');
      expect(htmlContent).toContain('id="in-stock-preview-text"');
    });
  });

  describe('Api.items.adjustStock', () => {
    let mockSupabase;

    beforeEach(() => {
      mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'products') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 10, name: 'Amara Busa 8D Besar', sku: 'FIL-AMA-310', stock: 2, cost_price: 45000 },
                    error: null
                  })
                })
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: [{ id: 10, name: 'Amara Busa 8D Besar', stock: 1 }],
                    error: null
                  })
                })
              })
            };
          }
          if (table === 'transactions') {
            return {
              insert: vi.fn().mockResolvedValue({ data: [{ id: 999 }], error: null })
            };
          }
          return {};
        }),
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-uuid-123' } } })
        }
      };

      window.supabase = mockSupabase;
    });

    afterEach(() => {
      delete window.supabase;
      vi.clearAllMocks();
    });

    it('creates an OUT transaction and adjusts stock when actual stock is less than current stock', async () => {
      // Mengoreksi stok Amara Busa dari 2 menjadi 1 (selisih -1)
      const res = await items.adjustStock(10, 1, 'Koreksi Salah Input Dobel', 'Koreksi faktur dobel BOS Sarno');

      expect(res.ok).toBe(true);
      expect(res.data.stock).toBe(1);
      expect(res.meta.previousStock).toBe(2);
      expect(res.meta.difference).toBe(-1);

      // Verifikasi insert transaksi keluar (OUT)
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
    });

    it('creates an IN transaction and adjusts stock when actual stock is greater than current stock', async () => {
      // Mengoreksi stok dari 2 menjadi 5 (selisih +3)
      const res = await items.adjustStock(10, 5, 'Stock Opname Fisik');

      expect(res.ok).toBe(true);
      expect(res.meta.difference).toBe(3);
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
    });

    it('returns without transaction when actual stock equals current stock', async () => {
      const res = await items.adjustStock(10, 2, 'Cek Fisik');

      expect(res.ok).toBe(true);
      expect(res.meta.message).toContain('Stok sudah sesuai');
    });
  });

  describe('items.js Tambah Barang auto-create transaction and Stock Opname UI', () => {
    const itemsScript = readFileSync(resolve(process.cwd(), 'public/dashboard/items.js'), 'utf8');

    beforeEach(() => {
      document.body.innerHTML = `
        <div id="modal-item">
          <form id="form-item">
            <input id="item-id" value="">
            <input id="item-name" value="Amara Busa 8D Besar">
            <input id="item-sku" value="FIL-AMA-310">
            <input id="item-barcode" value="">
            <input id="item-brand" value="Amara">
            <select id="item-category"><option value="1">Filtrasi</option></select>
            <select id="item-unit"><option value="1">pack</option></select>
            <input id="item-stock" value="1">
            <span id="item-stock-label"></span>
            <p id="item-stock-help"></p>
            <div id="item-supplier-wrap">
              <select id="item-supplier-id">
                <option value="5" selected>BOS Sarno</option>
              </select>
            </div>
            <input id="item-cost-price" value="45000">
            <input id="item-sell-price" value="55000">
            <input id="item-min-stock" value="3">
            <button id="btn-submit-item"><span>Simpan Produk</span></button>
          </form>
        </div>

        <div id="modal-stock-adjustment" class="hidden">
          <form id="form-stock-adjustment">
            <input id="adj-product-id" value="">
            <span id="adj-product-name"></span>
            <span id="adj-product-sku"></span>
            <span id="adj-product-cat"></span>
            <span id="adj-product-unit"></span>
            <span id="adj-unit-label-current"></span>
            <span id="adj-current-stock"></span>
            <input id="adj-actual-stock" value="">
            <div id="adj-diff-box">
              <span id="adj-diff-badge"></span>
            </div>
            <select id="adj-reason">
              <option value="Koreksi Salah Input / Dobel">Koreksi Salah Input / Dobel</option>
            </select>
            <textarea id="adj-notes"></textarea>
            <button id="btn-submit-adjustment"><span>Simpan Penyesuaian</span></button>
          </form>
        </div>

        <table id="items-table">
          <tbody id="items-tbody"></tbody>
        </table>
      `;

      window.Api = {
        items: {
          getAll: vi.fn().mockResolvedValue({ ok: true, data: [] }),
          create: vi.fn().mockResolvedValue({ ok: true, data: { id: 101, name: 'Amara Busa 8D Besar' } }),
          update: vi.fn().mockResolvedValue({ ok: true, data: { id: 101 } }),
          adjustStock: vi.fn().mockResolvedValue({ ok: true, data: { id: 10, stock: 1 }, meta: { message: 'Sukses' } })
        },
        transactions: {
          createIn: vi.fn().mockResolvedValue({ ok: true, data: { id: 202 } })
        },
        suppliers: {
          getAll: vi.fn().mockResolvedValue({ ok: true, data: [{ id: 5, name: 'BOS Sarno' }] })
        },
        storage: {
          uploadImage: vi.fn().mockResolvedValue({ ok: true, data: { publicUrl: 'https://example.com/img.webp' } })
        }
      };

      window.showToast = vi.fn();
      window.eval(itemsScript);
    });

    afterEach(() => {
      delete window.Api;
      delete window.showToast;
      document.body.innerHTML = '';
      vi.clearAllMocks();
    });

    it('automatically calls Api.transactions.createIn when registering new item with stock > 0', async () => {
      const form = document.getElementById('form-item');
      const submitEvent = new Event('submit', { cancelable: true });
      await window.handleItemSubmit(submitEvent);

      // Pastikan produk dibuat dengan stok 0 agar transaksi masuk tidak terhitung ganda
      expect(window.Api.items.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Amara Busa 8D Besar',
          stock: 0,
          cost_price: 45000,
          sell_price: 55000
        })
      );

      // Pastikan transaksi masuk otomatis dibuat atas nama BOS Sarno dengan qty = 1
      expect(window.Api.transactions.createIn).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 101,
          supplier_id: '5',
          qty: 1,
          price: 45000
        })
      );
    });

    it('opens stock adjustment modal and calculates difference correctly', async () => {
      window.Api.items.getAll = vi.fn().mockResolvedValue({
        ok: true,
        data: [{ id: 10, name: 'Amara Busa 8D Besar', sku: 'FIL-AMA-310', stock: 2, unit: 'pack' }]
      });
      await window.loadItemsFromBackend();

      // Buka modal penyesuaian stok untuk produk ID 10
      window.openStockAdjustmentModal(10);

      expect(document.getElementById('adj-current-stock').textContent).toBe('2');
      expect(document.getElementById('adj-actual-stock').value).toBe('2');

      // Ubah stok aktual menjadi 1 (selisih -1)
      document.getElementById('adj-actual-stock').value = '1';
      window.calculateAdjustmentDifference();

      const diffBadge = document.getElementById('adj-diff-badge');
      expect(diffBadge.textContent).toContain('-1');
    });

    it('submits stock adjustment successfully', async () => {
      document.getElementById('adj-product-id').value = '10';
      document.getElementById('adj-actual-stock').value = '1';
      document.getElementById('adj-reason').value = 'Koreksi Salah Input / Dobel';
      document.getElementById('adj-notes').value = 'Koreksi dari 2 menjadi 1 pack';

      const event = new Event('submit', { cancelable: true });
      await window.handleStockAdjustmentSubmit(event);

      expect(window.Api.items.adjustStock).toHaveBeenCalledWith(
        '10',
        1,
        'Koreksi Salah Input / Dobel',
        'Koreksi dari 2 menjadi 1 pack'
      );
    });
  });
});
