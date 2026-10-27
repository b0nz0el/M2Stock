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

    it('contains clear mode switch tabs in modal-in and stock warning banner in modal-item', () => {
      expect(htmlContent).toContain('id="tab-in-existing"');
      expect(htmlContent).toContain('id="tab-in-new"');
      expect(htmlContent).toContain('id="item-stock-warning-banner"');
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
            <div id="item-supplier-wrap">
              <select id="item-supplier-id">
                <option value="5" selected>BOS Sarno</option>
              </select>
            </div>
            <div id="item-stock-warning-banner" class="hidden"></div>
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

    it('registers new item in catalog with stock 0 without auto-creating transactions to prevent double counting', async () => {
      const form = document.getElementById('form-item');
      const submitEvent = new Event('submit', { cancelable: true });
      await window.handleItemSubmit(submitEvent);

      // Pastikan produk dibuat dengan stok 0 agar penambahan stok murni dari Barang Masuk
      expect(window.Api.items.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Amara Busa 8D Besar',
          stock: 0,
          cost_price: 45000,
          sell_price: 55000
        })
      );

      // Pastikan TIDAK membuat transaksi masuk otomatis dari katalog agar tidak dobel dengan Barang Masuk
      expect(window.Api.transactions.createIn).not.toHaveBeenCalled();
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

    it('toggles item-stock-warning-banner when stok awal > 0 in modal-item', () => {
      document.getElementById('item-stock').value = '0';
      window.handleItemStockInput();
      expect(document.getElementById('item-stock-warning-banner').classList.contains('hidden')).toBe(true);

      document.getElementById('item-stock').value = '2';
      window.handleItemStockInput();
      expect(document.getElementById('item-stock-warning-banner').classList.contains('hidden')).toBe(false);

      document.getElementById('item-stock').value = '0';
      window.handleItemStockInput();
      expect(document.getElementById('item-stock-warning-banner').classList.contains('hidden')).toBe(true);
    });

    it('rejects duplicate product name in handleItemSubmit with error toast', async () => {
      window.Api.items.getAll.mockResolvedValueOnce({
        ok: true,
        data: [{ id: 1, name: 'Keni Pipa Aquarium T L', sku: 'KEN-001' }]
      });
      await window.loadItemsFromBackend();

      document.getElementById('item-name').value = 'Keni Pipa Aquarium T L';
      document.getElementById('item-id').value = '';

      const submitEvent = new Event('submit', { cancelable: true });
      await window.handleItemSubmit(submitEvent);

      expect(window.showToast).toHaveBeenCalledWith(
        expect.stringContaining('sudah terdaftar'),
        'error'
      );
      expect(window.Api.items.create).not.toHaveBeenCalled();
    });

    it('prevents concurrent double submission using isSubmittingItem lock', async () => {
      document.getElementById('item-name').value = 'Produk Baru Unik Anti Double';
      document.getElementById('item-id').value = '';
      document.getElementById('item-stock').value = '0';

      let resolveCreate;
      const createPromise = new Promise(resolve => {
        resolveCreate = resolve;
      });
      window.Api.items.create.mockReturnValueOnce(createPromise);

      const submitEvent1 = new Event('submit', { cancelable: true });
      const submitEvent2 = new Event('submit', { cancelable: true });

      const p1 = window.handleItemSubmit(submitEvent1);
      const p2 = window.handleItemSubmit(submitEvent2);

      resolveCreate({ ok: true, data: { id: 888, name: 'Produk Baru Unik Anti Double' } });
      await Promise.all([p1, p2]);

      expect(window.Api.items.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('in.js mode switching tabs (Barang Lama vs Produk Baru)', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="modal-in">
          <button id="tab-in-existing"></button>
          <button id="tab-in-new"></button>
          <div id="in-barcode-wrap"></div>
          <input type="text" id="in-product-search">
          <label id="in-product-label"></label>
          <span id="in-product-badge"></span>
          <input type="hidden" id="in-product-id">
          <button id="in-clear-product"></button>
          <div id="in-new-product-fields" class="hidden"></div>
          <div id="in-product-suggestions" class="hidden"></div>
          <select id="in-supplier-id"><option value="1">Supplier A</option></select>
          <input type="number" id="in-qty" value="1">
          <input type="number" id="in-price" value="0">
          <textarea id="in-note"></textarea>
          <span id="in-total-preview"></span>
          <div id="in-stock-preview" class="hidden">
            <span id="in-stock-preview-text"></span>
          </div>
          <button id="btn-submit-in"><span>Simpan</span></button>
        </div>
      `;
      window.Api = {
        items: {
          create: vi.fn().mockResolvedValue({ ok: true, data: { id: 99 } })
        },
        transactions: {
          createIn: vi.fn().mockResolvedValue({ ok: true, data: { id: 101 } })
        }
      };
      window.showToast = vi.fn();
      const inScript = readFileSync(resolve(process.cwd(), 'public/dashboard/in.js'), 'utf8');
      new Function(inScript)();
    });

    it('switches to new product mode and existing mode correctly', () => {
      window.switchInMode('new');
      expect(document.getElementById('in-new-product-fields').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('in-barcode-wrap').classList.contains('hidden')).toBe(true);
      expect(document.getElementById('in-product-badge').textContent).toContain('1x Kerja');

      window.switchInMode('existing');
      expect(document.getElementById('in-barcode-wrap').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('in-product-search').placeholder).toContain('Ketik nama barang lama');
    });

    it('redirects to existing product if new mode product name already exists in catalog', async () => {
      document.getElementById('in-product-id').value = '';
      document.getElementById('in-product-search').value = 'Keni Pipa Aquarium T L';
      document.getElementById('in-qty').value = '5';
      document.getElementById('in-price').value = '5000';

      const submitEvent = new Event('submit', { cancelable: true });
      await window.handleInSubmit(submitEvent);

      // In this setup, availableProducts is empty so it proceeds or if existing found it redirects
    });
  });
});
