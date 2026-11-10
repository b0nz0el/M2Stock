import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const inScript = readFileSync(resolve(process.cwd(), 'public/dashboard/in.js'), 'utf8');

const sampleProduct = {
  id: 7,
  name: 'Pelet Ikan Premium 500g',
  barcode: '8991234567890',
  sku: 'PLT-007',
  stock: 12,
  cost_price: 25000,
  supplier_id: 5,
  supplier: 'PT Aqua Prima',
  unit: 'pcs'
};

const sampleSuppliers = [
  { id: 5, name: 'PT Aqua Prima' },
  { id: 6, name: 'CV Mina Jaya' },
  { id: 8, name: 'Toko Sumber Pakan' }
];

function setupDOM() {
  document.body.innerHTML = `
    <form id="form-in">
      <input id="in-product-search" value="">
      <input type="hidden" id="in-product-id" value="">
      <input id="in-barcode" value="">
      <p id="in-barcode-status"></p>
      <input id="in-price" value="0">
      <input id="in-qty" value="1">
      <input id="in-note" value="">
      <select id="in-supplier-id">
        <option value="">Umum / Tanpa Supplier</option>
      </select>
      <div id="in-product-suggestions" class="hidden"></div>
      <button id="in-clear-product" class="hidden"></button>
      <div id="in-stock-preview" class="hidden">
        <span id="in-stock-preview-text"></span>
      </div>
      <span id="in-total-preview"></span>
      <span id="in-product-badge"></span>
      <div id="in-new-product-fields" class="hidden"></div>
      <button id="tab-in-existing"></button>
      <button id="tab-in-new"></button>
      <div id="in-barcode-wrap"></div>
      <label id="in-product-label"></label>
    </form>
    <div id="modal-in" class="hidden"></div>
    <div id="modal-delete-in" class="hidden"></div>
    <table><tbody id="in-tbody"></tbody></table>
    <div id="in-pagination-wrap" class="hidden"></div>
    <div id="in-page-buttons"></div>
    <button id="btn-confirm-delete-in"></button>
    <span id="stat-in-today-count"></span>
    <span id="stat-in-today-amount"></span>
    <span id="stat-in-7d-count"></span>
    <span id="stat-in-7d-amount"></span>
    <span id="stat-in-30d-count"></span>
    <span id="stat-in-30d-amount"></span>
    <span id="stat-in-total-count"></span>
    <span id="stat-in-total-amount"></span>
  `;

  window.Api = {
    items: {
      getAll: vi.fn().mockResolvedValue({ ok: true, data: [{ ...sampleProduct }] }),
      getById: vi.fn().mockResolvedValue({ ok: true, data: { ...sampleProduct } }),
      create: vi.fn().mockResolvedValue({ ok: true, data: { id: 99, ...sampleProduct } }),
      update: vi.fn().mockResolvedValue({ ok: true, data: [{ ...sampleProduct }] }),
      delete: vi.fn().mockResolvedValue({ ok: true, data: { success: true } })
    },
    suppliers: {
      getAll: vi.fn().mockResolvedValue({ ok: true, data: [...sampleSuppliers] })
    },
    transactions: {
      createIn: vi.fn().mockResolvedValue({ ok: true, data: { id: 101 } }),
      getByType: vi.fn().mockResolvedValue({ ok: true, data: [] }),
      delete: vi.fn().mockResolvedValue({ ok: true, data: { success: true } })
    }
  };

  window.showToast = vi.fn();
  window.eval(inScript);
}

describe('Sinkronisasi Supplier dan Harga Beli Barang Masuk M2Stock', () => {
  beforeEach(() => {
    setupDOM();
  });

  afterEach(() => {
    delete window.Api;
    delete window.showToast;
    document.body.innerHTML = '';
  });

  it('1. Mempertahankan supplier pilihan manual pengguna jika dipilih SEBELUM produk dipilih (Fix Repro 1)', async () => {
    await window.loadDropdowns();
    const supSelect = document.getElementById('in-supplier-id');

    // Pengguna secara sadar memilih supplier 'CV Mina Jaya' (ID: 6) terlebih dahulu
    supSelect.value = '6';
    supSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(window._getSelectedSupplierManuallyChanged()).toBe(true);

    // Pengguna kemudian memilih produk sampleProduct (yang memiliki default supplier ID: 5)
    await window.selectInProduct(sampleProduct.id);

    // Verifikasi: Supplier ID tetap 6, TIDAK tertimpa oleh default supplier produk (5)
    expect(supSelect.value).toBe('6');
    expect(document.getElementById('in-price').value).toBe('25.000');
  });

  it('2. Menangani race condition loadDropdowns(): supplier default terpasang saat opsi selesai dimuat (Fix Repro 2)', async () => {
    let resolveSuppliers;
    window.Api.suppliers.getAll = vi.fn().mockReturnValue(
      new Promise(resolve => {
        resolveSuppliers = resolve;
      })
    );

    // Modal dibuka, memicu loadDropdowns() secara asinkron
    const dropdownPromise = window.loadDropdowns();

    // Di DOM, opsi supplier belum ada (masih kosong / hanya Umum)
    const supSelect = document.getElementById('in-supplier-id');
    expect(supSelect.options.length).toBe(1);

    // Pengguna memilih produk sementara suppliers.getAll() masih pending di jaringan
    const selectPromise = window.selectInProduct(sampleProduct.id);

    // Respon supplier tiba dari jaringan
    resolveSuppliers({ ok: true, data: [...sampleSuppliers] });
    await dropdownPromise;
    await selectPromise;

    // Verifikasi: Supplier default (5) berhasil dipilih karena dropdown ditunggu dan diaplikasikan ulang
    expect(supSelect.value).toBe('5');
    expect(document.getElementById('in-price').value).toBe('25.000');
  });

  it('3. Tidak menimpa harga faktur yang diinput manual oleh pengguna saat refreshSelectedProductPrice selesai (Fix Repro 3)', async () => {
    let resolveFreshItem;
    window.Api.items.getById = vi.fn().mockReturnValue(
      new Promise(resolve => {
        resolveFreshItem = resolve;
      })
    );

    await window.loadDropdowns();

    const selectPromise = window.selectInProduct(sampleProduct.id);

    // Pengguna langsung mengubah harga beli sesuai faktur fisik yang baru masuk (misal Rp 27.500)
    const priceInput = document.getElementById('in-price');
    priceInput.value = '27500';
    priceInput.dispatchEvent(new Event('input', { bubbles: true }));
    priceInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(window._getSelectedPriceManuallyChanged()).toBe(true);

    // Async getById selesai dengan harga master lama (25000)
    resolveFreshItem({ ok: true, data: { ...sampleProduct, cost_price: 25000 } });
    await selectPromise;

    // Verifikasi: Harga faktur 27.500 tidak tertimpa kembali ke 25.000
    expect(priceInput.value).toBe('27.500');
    expect(document.getElementById('in-total-preview').textContent).toContain('27.500');
  });

  it('4. Memakai harga beli dan supplier default terbaru dari Master Barang jika pengguna TIDAK mengubah manual', async () => {
    // Di Master Barang harga beli diubah jadi 28.000 dan supplier diubah ke 8
    const updatedMaster = { ...sampleProduct, cost_price: 28000, supplier_id: 8 };
    window.Api.items.getById = vi.fn().mockResolvedValue({ ok: true, data: updatedMaster });

    await window.loadDropdowns();
    await window.selectInProduct(sampleProduct.id);

    const priceInput = document.getElementById('in-price');
    const supSelect = document.getElementById('in-supplier-id');

    expect(priceInput.value).toBe('28.000');
    expect(supSelect.value).toBe('8');
    expect(document.getElementById('in-total-preview').textContent).toContain('28.000');
  });

  it('5. Read-after-write Master Barang: update supplier_id dan cost_price tersimpan dan terbaca oleh Barang Masuk', async () => {
    let storedProduct = {
      id: 7,
      name: 'Pelet Ikan Premium 500g',
      cost_price: 25000,
      supplier_id: 5
    };

    // Simulasi Master Barang update
    window.Api.items.update = vi.fn().mockImplementation(async (id, payload) => {
      storedProduct = { ...storedProduct, ...payload };
      return { ok: true, data: [{ ...storedProduct }] };
    });

    window.Api.items.getById = vi.fn().mockImplementation(async (id) => {
      return { ok: true, data: { ...storedProduct } };
    });

    // 1. Simpan perubahan di Master Barang
    const updateRes = await window.Api.items.update(7, {
      cost_price: 32000,
      supplier_id: 8
    });
    expect(updateRes.ok).toBe(true);
    expect(storedProduct.cost_price).toBe(32000);
    expect(storedProduct.supplier_id).toBe(8);

    // 2. Baca kembali di Barang Masuk
    await window.loadDropdowns();
    await window.selectInProduct(7);

    expect(document.getElementById('in-price').value).toBe('32.000');
    expect(document.getElementById('in-supplier-id').value).toBe('8');
  });

  it('6. Transaksi Barang Masuk BARU: menyimpan harga dan supplier terpilih ke transaksi', async () => {
    await window.loadDropdowns();
    await window.selectInProduct(sampleProduct.id);

    // Pengguna ubah supplier ke 6 dan harga ke 26000
    const supSelect = document.getElementById('in-supplier-id');
    supSelect.value = '6';
    supSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const priceInput = document.getElementById('in-price');
    priceInput.value = '26000';
    priceInput.dispatchEvent(new Event('input', { bubbles: true }));

    const qtyInput = document.getElementById('in-qty');
    qtyInput.value = '10';

    await window.handleInSubmit();

    expect(window.Api.transactions.createIn).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: '7',
        supplier_id: '6',
        price: 26000,
        cost_price: 26000,
        qty: 10
      })
    );
  });

  it('7. Transaksi LAMA: tetap menjadi snapshot histori dan TIDAK terpengaruh perubahan Master Barang', async () => {
    // Ada 2 transaksi historis lama yang dicatat dengan harga dan supplier masing-masing
    const historicalTransactions = [
      {
        id: 1,
        type: 'in',
        product_id: 7,
        products: { name: 'Pelet Ikan Premium 500g' },
        supplier_id: 5,
        suppliers: { name: 'PT Aqua Prima' },
        qty: 5,
        price: 20000, // Harga saat transaksi dulu: Rp 20.000
        cost_price: 20000,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        type: 'in',
        product_id: 7,
        products: { name: 'Pelet Ikan Premium 500g' },
        supplier_id: 6,
        suppliers: { name: 'CV Mina Jaya' },
        qty: 10,
        price: 22000, // Harga saat transaksi dulu: Rp 22.000
        cost_price: 22000,
        created_at: new Date().toISOString()
      }
    ];

    window.Api.transactions.getByType = vi.fn().mockResolvedValue({
      ok: true,
      data: historicalTransactions
    });

    await window.loadInTransactions();

    // Verifikasi tampilan tabel transaksi lama
    const tbody = document.getElementById('in-tbody');
    expect(tbody.innerHTML).toContain('PT Aqua Prima');
    expect(tbody.innerHTML).toContain('CV Mina Jaya');
    expect(tbody.innerHTML).toContain('Rp&nbsp;20.000');
    expect(tbody.innerHTML).toContain('Rp&nbsp;22.000');

    // Total metrik dihitung dari snapshot transaksi lama: (5 * 20000) + (10 * 22000) = 100.000 + 220.000 = 320.000
    const totalAmount = document.getElementById('stat-in-total-amount');
    expect(totalAmount.textContent).toBe('Rp 320rb');

    // Sekarang, Master Barang diubah harganya ke 50.000 dan supplier ke 8
    await window.Api.items.update(7, { cost_price: 50000, supplier_id: 8 });

    // Muat ulang daftar transaksi (tanpa mutasi database)
    await window.loadInTransactions();

    // Verifikasi tabel dan metrik transaksi lama TIDAK BERUBAH SAMA SEKALI
    expect(tbody.innerHTML).toContain('PT Aqua Prima');
    expect(tbody.innerHTML).toContain('CV Mina Jaya');
    expect(tbody.innerHTML).toContain('Rp&nbsp;20.000');
    expect(tbody.innerHTML).toContain('Rp&nbsp;22.000');
    expect(tbody.innerHTML).not.toContain('Rp&nbsp;50.000');
    expect(totalAmount.textContent).toBe('Rp 320rb');
  });

  it('8. Autocomplete product ID aman untuk string / non-numeric tanpa JS syntax error', async () => {
    await window.loadDropdowns();
    const input = document.getElementById('in-product-search');
    const suggestionsEl = document.getElementById('in-product-suggestions');

    // Trigger search input
    input.value = 'Pelet';
    window.handleProductSearchInput({ target: input });

    // Verifikasi onclick menggunakan quotes: selectInProduct('7')
    expect(suggestionsEl.innerHTML).toContain("selectInProduct('7')");
  });

  it('9. Sinkronisasi Harga Transaksi Rp 0 dengan Hrg Beli Master Barang (Elite & Bradley bug fix)', async () => {
    const transactions = [
      {
        id: 'IN-31D691EC',
        type: 'in',
        product_id: 101,
        products: { id: 101, name: 'Elite', cost_price: 8500 },
        qty: 26,
        price: 0,
        created_at: new Date().toISOString()
      },
      {
        id: 'IN-C3B88305',
        type: 'in',
        product_id: 102,
        products: { id: 102, name: 'Bradley', cost_price: 24000 },
        qty: 6,
        price: null,
        created_at: new Date().toISOString()
      },
      {
        id: 'IN-2FEBABD4',
        type: 'in',
        product_id: 103,
        products: { id: 103, name: 'Batik Series 1053B', cost_price: 12000 },
        qty: 15,
        price: 12000,
        created_at: new Date().toISOString()
      }
    ];

    window.Api.transactions.getByType = vi.fn().mockResolvedValue({
      ok: true,
      data: transactions
    });

    await window.loadInTransactions();

    expect(window.resolveProductPrice(transactions[0])).toBe(8500);
    expect(window.resolveProductPrice(transactions[1])).toBe(24000);
    expect(window.resolveProductPrice(transactions[2])).toBe(12000);

    const tbody = document.getElementById('in-tbody');
    expect(tbody.innerHTML).toContain('Rp&nbsp;8.500');
    expect(tbody.innerHTML).toContain('Rp&nbsp;221.000');
    expect(tbody.innerHTML).toContain('Rp&nbsp;24.000');
    expect(tbody.innerHTML).toContain('Rp&nbsp;144.000');
    expect(tbody.innerHTML).toContain('Rp&nbsp;12.000');
    expect(tbody.innerHTML).toContain('Rp&nbsp;180.000');

    const elTodayAmount = document.getElementById('stat-in-today-amount');
    const elTotalAmount = document.getElementById('stat-in-total-amount');
    expect(elTodayAmount.textContent).toBe('Rp 545rb');
    expect(elTotalAmount.textContent).toBe('Rp 545rb');
  });

  it('10. handleInSubmit otomatis memakai cost_price produk jika input harga Rp 0 / kosong', async () => {
    await window.loadDropdowns();
    await window.selectInProduct(sampleProduct.id);

    const priceInput = document.getElementById('in-price');
    priceInput.value = '0';
    const qtyInput = document.getElementById('in-qty');
    qtyInput.value = '5';

    await window.handleInSubmit();

    expect(window.Api.transactions.createIn).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: String(sampleProduct.id),
        price: 25000,
        qty: 5
      })
    );
  });
});
