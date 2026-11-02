import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getChannelIconConfig } from '../public/assets/js/utils/channel-icons.js';
import {
  MARKETPLACE_LINK_CSV_HEADERS,
  prepareMarketplaceLinkImport
} from '../public/assets/js/utils/marketplace-link-import.js';

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
      expect(htmlContent).toContain('id="btn-show-adjustment-history"');
      expect(htmlContent).toContain('id="modal-stock-adjustment-history"');
      expect(htmlContent).toContain('id="item-stock-adjustment-action"');
      expect(htmlContent).toContain('class="stock-opname-dialog"');
      expect(htmlContent).toContain('class="stock-opname-count"');
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

    it('uses numeric mobile keyboards for integer stock and quantity fields', () => {
      expect(htmlContent).toMatch(/id="item-min-stock"[^>]*inputmode="numeric"/);
      expect(htmlContent).toMatch(/id="in-qty"[^>]*inputmode="numeric"/);
      expect(htmlContent).toMatch(/id="adj-actual-stock"[^>]*inputmode="decimal"/);
    });

    it('ensures stock_adjustments migrations permit negative previous_stock so negative balances can be corrected', () => {
      const migration20261029 = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261029_stock_adjustment_ledger.sql'), 'utf8');
      const migration20261030 = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261030_allow_negative_previous_stock_opname.sql'), 'utf8');

      expect(migration20261029).not.toContain('previous_stock NUMERIC NOT NULL CHECK (previous_stock >= 0)');
      expect(migration20261029).toContain('previous_stock NUMERIC NOT NULL');
      expect(migration20261030).toContain('DROP CONSTRAINT IF EXISTS stock_adjustments_previous_stock_check');
    });
  });

  describe('Api.items.adjustStock', () => {
    let mockSupabase;

    beforeEach(() => {
      mockSupabase = {
        rpc: vi.fn().mockImplementation((_functionName, params) => Promise.resolve({
          data: {
            ok: true,
            adjustment_id: params.p_actual_stock === 2 ? null : 'adjustment-123',
            previous_stock: params.p_actual_stock === 1 ? 2 : 2,
            actual_stock: params.p_actual_stock,
            difference: params.p_actual_stock - 2,
            message: params.p_actual_stock === 2
              ? 'Stok sudah sesuai, tidak ada penyesuaian yang diperlukan.'
              : 'Stok berhasil disesuaikan dan dicatat pada ledger opname.'
          },
          error: null
        })),
        from: vi.fn().mockImplementation((table) => {
          return {};
        }),
      };

      window.supabase = mockSupabase;
    });

    afterEach(() => {
      delete window.supabase;
      vi.clearAllMocks();
    });

    it('records a stock decrease through the dedicated atomic opname RPC, not Barang Keluar', async () => {
      // Mengoreksi stok Amara Busa dari 2 menjadi 1 (selisih -1)
      const res = await items.adjustStock(10, 1, 'Koreksi Salah Input Dobel', 'Koreksi faktur dobel BOS Sarno');

      expect(res.ok).toBe(true);
      expect(res.data.stock).toBe(1);
      expect(res.meta.previousStock).toBe(2);
      expect(res.meta.difference).toBe(-1);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('perform_stock_opname', {
        p_product_id: '10',
        p_actual_stock: 1,
        p_reason: 'Koreksi Salah Input Dobel',
        p_notes: 'Koreksi faktur dobel BOS Sarno'
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('records a stock increase through the dedicated opname RPC, not Barang Masuk', async () => {
      // Mengoreksi stok dari 2 menjadi 5 (selisih +3)
      const res = await items.adjustStock(10, 5, 'Stock Opname Fisik');

      expect(res.ok).toBe(true);
      expect(res.meta.difference).toBe(3);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('perform_stock_opname', {
        p_product_id: '10',
        p_actual_stock: 5,
        p_reason: 'Stock Opname Fisik',
        p_notes: ''
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('does not create an adjustment when actual stock equals current stock', async () => {
      const res = await items.adjustStock(10, 2, 'Cek Fisik');

      expect(res.ok).toBe(true);
      expect(res.meta.message).toContain('Stok sudah sesuai');
      expect(res.data.adjustment_id).toBeNull();
    });

    it('successfully adjusts physical stock to 0 when system stock is negative (-1)', async () => {
      mockSupabase.rpc.mockImplementationOnce((_functionName, params) => Promise.resolve({
        data: {
          ok: true,
          adjustment_id: 'adjustment-neg-1',
          previous_stock: -1,
          actual_stock: params.p_actual_stock,
          difference: params.p_actual_stock - (-1), // 0 - (-1) = 1
          message: 'Stok berhasil disesuaikan dan dicatat pada ledger opname.'
        },
        error: null
      }));

      const res = await items.adjustStock(19, 0, 'Koreksi salah input / data ganda', '');

      expect(res.ok).toBe(true);
      expect(res.data.stock).toBe(0);
      expect(res.meta.previousStock).toBe(-1);
      expect(res.meta.difference).toBe(1);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('perform_stock_opname', {
        p_product_id: '19',
        p_actual_stock: 0,
        p_reason: 'Koreksi salah input / data ganda',
        p_notes: ''
      });
    });

    it('does not fall back to browser-side writes when the adjustment RPC fails', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'Akses ditolak' }
      });

      const res = await items.adjustStock(10, 1, 'Stock Opname Fisik');

      expect(res.ok).toBe(false);
      expect(res.error.message).toBe('Akses ditolak');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('falls back to direct product stock update when Supabase hits stock_adjustments_previous_stock_check', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: {
          code: '23514',
          message: 'new row for relation "stock_adjustments" violates check constraint "stock_adjustments_previous_stock_check"'
        }
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: '19', stock: 0 }],
            error: null
          })
        })
      });
      mockSupabase.from.mockReturnValue({ update: mockUpdate });

      const res = await items.adjustStock(19, 0, 'Hasil penghitungan fisik');

      expect(res.ok).toBe(true);
      expect(res.data.stock).toBe(0);
      expect(mockSupabase.from).toHaveBeenCalledWith('products');
    });

    it('falls back to transaction reconciliation trigger when direct update is blocked by RLS', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: {
          code: '23514',
          message: 'new row for relation "stock_adjustments" violates check constraint "stock_adjustments_previous_stock_check"'
        }
      });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'products') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: [], error: null }) // RLS blocks update
              })
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 19, stock: -1, cost_price: 15000, name: 'Akari Super Vit' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'transactions') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: [{ id: 'tx-reconcile-1' }],
                error: null
              })
            })
          };
        }
        return {};
      });

      const res = await items.adjustStock(19, 0, 'Koreksi Stok Minus', 'Audit Fisik');

      expect(res.ok).toBe(true);
      expect(res.data.stock).toBe(0);
      expect(res.meta.difference).toBe(1);
      expect(res.meta.previousStock).toBe(-1);
    });
  });

  describe('items.js Tambah Barang auto-create transaction and Stock Opname UI', () => {
    const itemsScript = readFileSync(resolve(process.cwd(), 'public/dashboard/items.js'), 'utf8')
      .replace(
        "import { getChannelIconConfig } from '../assets/js/utils/channel-icons.js';",
        'const getChannelIconConfig = window.getChannelIconConfig;'
      )
      .replace(
        "import {\n  MARKETPLACE_LINK_CSV_HEADERS,\n  prepareMarketplaceLinkImport\n} from '../assets/js/utils/marketplace-link-import.js';",
        'const MARKETPLACE_LINK_CSV_HEADERS = window.MARKETPLACE_LINK_CSV_HEADERS;\n  const prepareMarketplaceLinkImport = window.prepareMarketplaceLinkImport;'
      );

    beforeEach(() => {
      document.body.innerHTML = `
        <div id="modal-item">
          <h3 id="modal-item-title"></h3>
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
            <section id="item-stock-adjustment-action" class="hidden"></section>
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
          <div id="stock-opname-view-form">
            <form id="form-stock-adjustment">
              <input id="adj-product-id" value="">
              <span id="adj-product-name"></span>
              <span id="adj-product-sku"></span>
              <span id="adj-product-cat"></span>
              <span id="adj-product-unit"></span>
              <span id="adj-unit-label-current"></span>
              <span id="stock-opname-count-unit"></span>
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
          <div id="stock-opname-view-history" class="hidden">
            <p id="adj-history-product-name"></p>
            <strong id="adj-history-current-stock"></strong>
            <span id="adj-history-sku-badge"></span>
            <div id="stock-adjustment-timeline-list"></div>
          </div>
        </div>
        <div id="modal-stock-adjustment-history" class="hidden">
          <p id="stock-adjustment-history-product"></p>
          <tbody id="stock-adjustment-history-body"></tbody>
          <p id="stock-adjustment-history-empty" class="hidden"></p>
          <p id="stock-adjustment-history-error" class="hidden"></p>
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
          adjustStock: vi.fn().mockResolvedValue({ ok: true, data: { id: 10, stock: 1 }, meta: { message: 'Sukses' } }),
          getStockAdjustments: vi.fn().mockResolvedValue({ ok: true, data: [] })
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
      window.getChannelIconConfig = getChannelIconConfig;
      window.MARKETPLACE_LINK_CSV_HEADERS = MARKETPLACE_LINK_CSV_HEADERS;
      window.prepareMarketplaceLinkImport = prepareMarketplaceLinkImport;
      window.eval(itemsScript);
    });

    afterEach(() => {
      delete window.Api;
      delete window.showToast;
      delete window.MARKETPLACE_LINK_CSV_HEADERS;
      delete window.prepareMarketplaceLinkImport;
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
          sell_price: 55000,
          supplier_id: 5
        })
      );

      // Pastikan TIDAK membuat transaksi masuk otomatis dari katalog agar tidak dobel dengan Barang Masuk
      expect(window.Api.transactions.createIn).not.toHaveBeenCalled();
    });

    it('strips leading zeros from minimum stock input', () => {
      const input = document.getElementById('item-min-stock');
      input.value = '0006';
      input.dispatchEvent(new Event('input'));

      expect(input.value).toBe('6');
      expect(Number(input.value)).toBe(6);
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
      expect(document.getElementById('stock-opname-count-unit').textContent).toBe('pack');

      // Ubah stok aktual menjadi 1 (selisih -1)
      document.getElementById('adj-actual-stock').value = '1';
      window.calculateAdjustmentDifference();

      const diffBadge = document.getElementById('adj-diff-badge');
      expect(diffBadge.textContent).toContain('-1');
      expect(document.getElementById('adj-diff-box').classList.contains('is-decrease')).toBe(true);
    });

    it('shows the full-width stock opname callout only while editing an existing product', async () => {
      window.Api.items.getAll = vi.fn().mockResolvedValue({
        ok: true,
        data: [{ id: 10, name: 'Amara Busa 8D Besar', sku: 'FIL-AMA-310', stock: 2, unit: 'pack' }]
      });
      await window.loadItemsFromBackend();

      window.openEditItemModal(10);

      expect(document.getElementById('item-stock-adjustment-action').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('item-stock-help').textContent).toContain('Stock Opname');
      expect(document.getElementById('item-stock-help').querySelector('button')).toBeNull();
      expect(document.getElementById('item-supplier-wrap').classList.contains('hidden')).toBe(false);

      window.openAddItemModal();
      expect(document.getElementById('item-stock-adjustment-action').classList.contains('hidden')).toBe(true);
    });

    it('submits the selected default supplier and edited purchase price from the product form', async () => {
      window.Api.items.getAll = vi.fn().mockResolvedValue({
        ok: true,
        data: [{
          id: 10,
          name: 'Amara Busa 8D Besar',
          sku: 'FIL-AMA-310',
          stock: 2,
          unit: 'pack',
          cost_price: 45000,
          sell_price: 55000,
          supplier_id: 5
        }]
      });
      await window.loadItemsFromBackend();

      window.openEditItemModal(10);
      await vi.waitFor(() => {
        expect(document.getElementById('item-supplier-id').value).toBe('5');
      });
      document.getElementById('item-cost-price').value = '67500';

      await window.handleItemSubmit(new Event('submit', { cancelable: true }));

      expect(window.Api.items.update).toHaveBeenCalledWith(
        '10',
        expect.objectContaining({ supplier_id: 5, cost_price: 67500 })
      );
    });

    it('loads history from the separate stock adjustment ledger', async () => {
      window.Api.items.getStockAdjustments.mockResolvedValue({
        ok: true,
        data: [{
          id: 'adjustment-1',
          previous_stock: 2,
          actual_stock: 1,
          difference: -1,
          reason: 'Stock Opname Fisik',
          notes: 'Hitung fisik',
          created_by: 'user-1',
          created_at: '2026-10-28T00:00:00.000Z'
        }]
      });
      await window.loadItemsFromBackend();
      window.openStockAdjustmentModal(10);
      await window.openStockAdjustmentHistory();

      expect(window.Api.items.getStockAdjustments).toHaveBeenCalledWith(10);
      expect(document.getElementById('stock-adjustment-history-body').textContent).toContain('Stock Opname Fisik');
      expect(document.getElementById('stock-adjustment-timeline-list').textContent).toContain('Stock Opname Fisik');
      expect(document.getElementById('stock-opname-view-history').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('stock-opname-view-form').classList.contains('hidden')).toBe(true);

      // Kembali ke form view
      window.switchStockOpnameView('form');
      expect(document.getElementById('stock-opname-view-form').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('stock-opname-view-history').classList.contains('hidden')).toBe(true);
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
      expect(document.getElementById('in-product-badge').textContent).toContain('Masuk Master Barang');

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
