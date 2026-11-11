import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const mockProducts = Array.from({ length: 45 }, (_, idx) => ({
  id: `prod-${idx + 1}`,
  name: `Produk Akuarium ${idx + 1}`,
  sku: `SKU-${String(idx + 1).padStart(3, '0')}`,
  barcode: `899000${idx + 1}`,
  brand: 'Amara',
  category: 'Filter',
  stock: idx === 0 ? 0 : idx + 2,
  min_stock: 5,
  cost_price: idx === 1 ? 2100 : 15000 + idx * 1000
}));

vi.mock('../public/assets/js/supabase-client.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-test-1' } } })
    },
    from: vi.fn(),
    rpc: vi.fn()
  }
}));

vi.mock('../public/assets/js/api/po.js', () => ({
  po: {
    getAll: vi.fn().mockResolvedValue({ ok: true, data: [], meta: { total: 0 } }),
    getSummary: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    generateNoPO: vi.fn(() => 'PO-202611-999'),
    create: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    updateStatus: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    updateDraftPO: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    getRestockInsightsForProducts: vi.fn().mockResolvedValue(new Map())
  }
}));

vi.mock('../public/assets/js/api/suppliers.js', () => ({
  suppliers: {
    getAll: vi.fn().mockResolvedValue({ ok: true, data: [{ id: 'sup-1', name: 'Supplier Utama' }] })
  }
}));

vi.mock('../public/assets/js/api/items.js', () => ({
  items: {
    getAll: vi.fn().mockResolvedValue({ ok: true, data: mockProducts })
  }
}));

vi.mock('../public/assets/js/api/settings.js', () => ({
  settings: {
    get: vi.fn().mockResolvedValue({ ok: true, data: { auto_po_enabled: false } })
  }
}));

vi.mock('../public/assets/js/utils/rbac-ui.js', () => ({
  applyReadOnlyUI: vi.fn()
}));

vi.mock('../public/assets/js/utils/rbac.js', () => ({
  getUserRole: vi.fn().mockResolvedValue('OWNER')
}));

describe('Purchase Order Search Engine Combobox & Typo Search Contract', () => {
  const rootDir = process.cwd();
  const poJs = fs.readFileSync(path.join(rootDir, 'public/dashboard/po.js'), 'utf8');
  const itemsJs = fs.readFileSync(path.join(rootDir, 'public/dashboard/items.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
  const componentsCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/components.css'), 'utf8');

  it('memastikan createItemRow di po.js menggunakan input search engine combobox dual-state', () => {
    expect(poJs).toContain('item-search-input');
    expect(poJs).toContain('po-search-state');
    expect(poJs).toContain('po-selected-state');
    expect(poJs).toContain('btn-change-item');
    expect(poJs).toContain('btn-clear-selection');
    expect(poJs).toContain('po-floating-search-dropdown');
    expect(poJs).toContain('openPoDropdown');
    expect(poJs).toContain('closePoDropdown');
    expect(poJs).toContain('selectProductInRow');
  });

  it('memastikan PO Combobox mendukung keyboard navigation dan integrasi fuzzy matching', () => {
    expect(poJs).toContain("e.key === 'ArrowDown'");
    expect(poJs).toContain("e.key === 'ArrowUp'");
    expect(poJs).toContain("e.key === 'Enter'");
    expect(poJs).toContain("e.key === 'Escape'");
    expect(poJs).toContain('fuzzyScore');
  });

  it('memastikan sinkronisasi ke selectEl untuk kompatibilitas penuh handleSubmitForm', () => {
    expect(poJs).toContain('const selectEl = row.querySelector(\'.item-select\');');
    expect(poJs).toContain('selectEl.dispatchEvent(new Event(\'change\', { bubbles: true }));');
    expect(poJs).toContain('handleSubmitForm');
    expect(poJs).toContain('row._updateRowSubtotal');
  });

  it('memastikan input search-items dan global-search mematikan browser autofill popup', () => {
    expect(indexHtml).toMatch(/id="search-items"[^>]*autocomplete="off"/);
    expect(indexHtml).toMatch(/id="search-items"[^>]*autocorrect="off"/);
    expect(indexHtml).toMatch(/id="search-items"[^>]*spellcheck="false"/);

    expect(indexHtml).toMatch(/id="global-search"[^>]*autocomplete="off"/);
  });

  it('memastikan filterItems di items.js menggunakan fuzzyScore dengan relevansi ranking', () => {
    expect(itemsJs).toContain('window.fuzzyScore');
    expect(itemsJs).toContain('item._searchScore = score;');
    expect(itemsJs).toContain('const scoreDiff = (b._searchScore || 0) - (a._searchScore || 0);');
  });

  it('memastikan styling dropdown elevated dan scrollbar tersedia di components.css', () => {
    expect(componentsCss).toContain('#po-floating-search-dropdown');
    expect(componentsCss).toContain('.po-dropdown-item.is-highlighted');
  });

  it('memastikan Daftar Item Barang & Search Engine mendukung scroll di tablet, mobile, dan PWA', () => {
    expect(indexHtml).toContain('id="po-items-count-badge"');
    expect(indexHtml).toContain('po-items-scroll-list');

    expect(componentsCss).toContain('.po-modal-dialog #po-items-container');
    expect(componentsCss).toContain('-webkit-overflow-scrolling: touch');
    expect(componentsCss).toContain('touch-action: pan-y');
    expect(componentsCss).toContain('@media (max-width: 1023px)');
    expect(componentsCss).toContain('@media (min-width: 640px) and (max-width: 1023px)');
    expect(componentsCss).toContain('@media (display-mode: standalone)');
    expect(componentsCss).toContain('#po-floating-search-dropdown .po-dropdown-list');
    expect(componentsCss).toContain('.po-dropdown-touch-hint');

    expect(poJs).toContain('updatePoItemsCountBadge');
    expect(poJs).toContain('window.visualViewport');
    expect(poJs).toContain("modalEl.querySelector('.po-modal-dialog')");
    expect(poJs).toContain('po-dropdown-close-btn');
    expect(poJs).toContain('wasDragged');
  });

  it('memastikan form PO dan item input tidak memicu error validasi step="1000" atau dropdown "-- Pilih Barang --"', () => {
    const selectUiJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/components/select-ui.js'), 'utf8');

    expect(indexHtml).toMatch(/<form[^>]*id="form-po"[^>]*novalidate/);
    expect(poJs).not.toContain('step="1000"');
    expect(poJs).toContain('step="any"');
    expect(poJs).not.toContain('-- Pilih Barang --');
    expect(poJs).toContain('data-native-select');

    expect(selectUiJs).toContain('data-native-select');
    expect(selectUiJs).toContain('getAttribute("aria-hidden") === "true"');
  });

  it('memastikan konfirmasi penerimaan PO memakai modal UI bawaan (#modal-receive-po) dan bukan prompt() sistem device', () => {
    expect(poJs).not.toMatch(/\bprompt\s*\(/);
    expect(poJs).toContain('openReceiveConfirmation');
    expect(poJs).toContain('modal-receive-po');

    expect(indexHtml).toContain('id="modal-receive-po"');
    expect(indexHtml).toContain('id="form-receive-po"');
    expect(indexHtml).toContain('id="receive-po-payment-options"');
    expect(indexHtml).toContain('value="Cash"');
    expect(indexHtml).toContain('value="Transfer"');
    expect(indexHtml).toContain('value="Tempo"');

    expect(componentsCss).toContain('.po-receive-dialog');
    expect(componentsCss).toContain('.po-payment-option');
  });
});

describe('Purchase Order Mobile/Tablet/PWA Runtime Behavior', () => {
  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="page-po">
        <button type="button" id="btn-open-po-modal">Buat PO</button>
        <table><tbody id="po-table-body"></tbody></table>
      </div>
      <div id="modal-po" class="po-modal-overlay hidden">
        <div class="po-modal-dialog">
          <form id="form-po" novalidate>
            <input type="text" id="po-no" />
            <input type="date" id="po-tanggal" />
            <select id="po-supplier"></select>
            <select id="po-status"><option value="draft">Draft</option></select>
            <textarea id="po-catatan"></textarea>
            <span id="po-items-count-badge">1 item</span>
            <button type="button" id="btn-add-item-row">Tambah Item</button>
            <div id="po-items-container" class="po-items-scroll-list"></div>
            <span id="po-modal-grand-total">Rp 0</span>
            <button type="button" id="btn-close-po-modal"></button>
            <button type="button" id="btn-cancel-po-modal"></button>
            <button type="submit" id="btn-submit-po">Simpan PO</button>
          </form>
        </div>
      </div>
      <div id="modal-receive-po" class="hidden" role="dialog" aria-modal="true">
        <div class="po-receive-dialog">
          <button type="button" id="btn-close-receive-po"></button>
          <span id="receive-po-no">-</span>
          <span id="receive-po-supplier">-</span>
          <span id="receive-po-total">Rp 0</span>
          <form id="form-receive-po">
            <div id="receive-po-payment-options">
              <label class="po-payment-option is-selected" data-payment-card="Cash">
                <input type="radio" name="po-receive-payment" value="Cash" checked />
              </label>
              <label class="po-payment-option" data-payment-card="Transfer">
                <input type="radio" name="po-receive-payment" value="Transfer" />
              </label>
              <label class="po-payment-option" data-payment-card="Tempo">
                <input type="radio" name="po-receive-payment" value="Tempo" />
              </label>
            </div>
            <p id="receive-po-feedback" class="action-feedback hidden"></p>
            <button type="button" id="btn-cancel-receive-po">Batal</button>
            <button type="submit" id="btn-confirm-receive-po">Konfirmasi Terima PO</button>
          </form>
        </div>
      </div>
      <div id="modal-print-po" class="hidden" role="dialog" aria-modal="true">
        <div class="modal-po-content">
          <button type="button" id="btn-close-print-po"></button>
          <div id="doc-po-draft-banner" class="hidden">Mode Edit Draf</div>
          <div id="po-document-paper">
            <span id="doc-po-no">-</span>
            <span id="doc-po-supplier">-</span>
            <span id="doc-po-supplier-subtitle" class="hidden"></span>
            <span id="doc-po-supplier-notes">-</span>
            <span id="doc-po-date">-</span>
            <span id="doc-po-status">DRAFT</span>
            <table class="po-document-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Barang</th>
                  <th>Jumlah</th>
                  <th>Harga Satuan</th>
                  <th>Subtotal</th>
                  <th id="doc-po-action-header" class="po-doc-action-col hidden">Aksi</th>
                </tr>
              </thead>
              <tbody id="doc-po-items-tbody"></tbody>
              <tfoot>
                <tr class="po-document-total-row">
                  <td colspan="4">Total Nilai Pesanan:</td>
                  <td id="doc-po-total">Rp 0</td>
                  <td id="doc-po-total-action-spacer" class="po-doc-action-col hidden"></td>
                </tr>
              </tfoot>
            </table>
            <p id="doc-po-notes"></p>
          </div>
          <div class="modal-po-actions">
            <button type="button" id="btn-cancel-print-po">Tutup</button>
            <button type="button" id="btn-doc-share-wa">Kirim via WhatsApp</button>
            <button type="button" id="btn-doc-print-action">Cetak / Simpan PDF</button>
          </div>
        </div>
      </div>
    `;

    window.innerWidth = 412;
    window.innerHeight = 914;
    window.showToast = vi.fn();
    window.escapeHtml = (s) => String(s ?? '');
    window.fuzzyScore = (q, t) => (String(t).toLowerCase().includes(String(q).toLowerCase()) ? 100 : 0);

    vi.resetModules();
    await import('../public/dashboard/po.js');
    await window.initPo();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.initPo;
    delete window.showToast;
    delete window.escapeHtml;
    delete window.fuzzyScore;
    vi.restoreAllMocks();
  });

  it('memperbarui badge jumlah item dan melakukan scroll ke baris baru saat Tambah Item diklik', async () => {
    document.getElementById('btn-open-po-modal').click();
    await vi.waitFor(() => {
      expect(document.querySelectorAll('#po-items-container .po-item-row').length).toBe(1);
    });
    expect(document.getElementById('po-items-count-badge').textContent).toBe('1 item');

    const scrollIntoViewMock = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'div') el.scrollIntoView = scrollIntoViewMock;
      return el;
    });

    document.getElementById('btn-add-item-row').click();
    expect(document.querySelectorAll('#po-items-container .po-item-row').length).toBe(2);
    expect(document.getElementById('po-items-count-badge').textContent).toBe('2 item');
    expect(scrollIntoViewMock).toHaveBeenCalled();

    const removeButtons = document.querySelectorAll('.btn-remove-item');
    removeButtons[1].click();
    expect(document.querySelectorAll('#po-items-container .po-item-row').length).toBe(1);
    expect(document.getElementById('po-items-count-badge').textContent).toBe('1 item');
  });

  it('memposisikan dropdown ke atas saat ruang bawah sempit (mobile 412x914) dan menampilkan >35 item untuk di-scroll', async () => {
    document.getElementById('btn-open-po-modal').click();
    await vi.waitFor(() => {
      expect(document.querySelector('.item-search-input')).not.toBeNull();
    });

    const anchor = document.querySelector('.po-search-state');
    anchor.getBoundingClientRect = () => ({
      top: 640,
      bottom: 682,
      left: 24,
      right: 388,
      width: 364,
      height: 42
    });

    const input = document.querySelector('.item-search-input');
    input.dispatchEvent(new Event('focus'));

    const dropdown = document.getElementById('po-floating-search-dropdown');
    expect(dropdown).not.toBeNull();
    expect(dropdown.classList.contains('hidden')).toBe(false);
    // Ruang bawah 220px (< 260px) dan ruang atas 628px lebih besar -> flip ke atas
    expect(dropdown.style.top).toBe('auto');
    expect(parseInt(dropdown.style.bottom, 10)).toBeGreaterThan(200);
    expect(parseInt(dropdown.style.maxHeight, 10)).toBeLessThanOrEqual(400);
    // Semua 45 produk tersedia di list (sebelumnya terpotong di 35)
    expect(dropdown.querySelectorAll('.po-dropdown-item').length).toBe(45);
  });

  it('tidak langsung memilih item saat touch drag/scroll, tetapi memilih saat tap/click dan menutup saat tombol tutup diklik', async () => {
    document.getElementById('btn-open-po-modal').click();
    await vi.waitFor(() => {
      expect(document.querySelector('.item-search-input')).not.toBeNull();
    });

    const input = document.querySelector('.item-search-input');
    input.dispatchEvent(new Event('focus'));

    const dropdown = document.getElementById('po-floating-search-dropdown');
    const firstItem = dropdown.querySelector('.po-dropdown-item');

    // Simulasikan gesture scroll (geser > 8px) sebelum click
    const pDown = new Event('pointerdown', { bubbles: true });
    pDown.clientX = 100;
    pDown.clientY = 200;
    firstItem.dispatchEvent(pDown);

    const pMove = new Event('pointermove', { bubbles: true });
    pMove.clientX = 100;
    pMove.clientY = 240;
    firstItem.dispatchEvent(pMove);

    firstItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dropdown.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('.item-select').value).toBe('');

    // Simulasikan tap bersih (tanpa geser)
    const pDownTap = new Event('pointerdown', { bubbles: true });
    pDownTap.clientX = 100;
    pDownTap.clientY = 200;
    firstItem.dispatchEvent(pDownTap);
    firstItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dropdown.classList.contains('hidden')).toBe(true);
    expect(document.querySelector('.item-select').value).toBe('prod-1');

    // Buka lagi dan tutup via tombol close di header dropdown
    document.querySelector('.btn-change-item').click();
    expect(dropdown.classList.contains('hidden')).toBe(false);
    document.getElementById('po-dropdown-close-btn').click();
    expect(dropdown.classList.contains('hidden')).toBe(true);
  });

  it('menyesuaikan posisi dan tinggi dropdown terhadap visualViewport saat keyboard virtual terbuka', async () => {
    const listeners = {};
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        offsetTop: 0,
        offsetLeft: 0,
        width: 768,
        height: 460,
        addEventListener: vi.fn((evt, cb) => { listeners[evt] = cb; }),
        removeEventListener: vi.fn()
      }
    });
    window.innerWidth = 768;
    window.innerHeight = 1024;

    document.getElementById('btn-open-po-modal').click();
    await vi.waitFor(() => {
      expect(document.querySelector('.item-search-input')).not.toBeNull();
    });

    const anchor = document.querySelector('.po-search-state');
    anchor.getBoundingClientRect = () => ({
      top: 310,
      bottom: 352,
      left: 48,
      right: 480,
      width: 432,
      height: 42
    });

    document.querySelector('.item-search-input').dispatchEvent(new Event('focus'));
    const dropdown = document.getElementById('po-floating-search-dropdown');
    expect(dropdown.classList.contains('hidden')).toBe(false);
    // Ruang di bawah anchor terhadap keyboard (460 - 352 - 16 = 92) < ruang atas (310 - 16 = 294)
    expect(dropdown.style.top).toBe('auto');
    expect(parseInt(dropdown.style.maxHeight, 10)).toBeLessThanOrEqual(294);
    expect(parseInt(dropdown.style.maxHeight, 10)).toBeGreaterThanOrEqual(150);

    delete window.visualViewport;
  });

  it('berhasil menyimpan PO dengan harga satuan non-kelipatan 1000 (mis. Rp 2.100) tanpa gagal validasi value', async () => {
    const { po: poApi } = await import('../public/assets/js/api/po.js');

    document.getElementById('btn-open-po-modal').click();
    await vi.waitFor(() => {
      expect(document.querySelector('.item-search-input')).not.toBeNull();
    });

    document.getElementById('po-no').value = 'PO-202611-237';
    document.getElementById('po-tanggal').value = '2026-11-11';
    document.getElementById('po-supplier').value = 'sup-1';
    document.getElementById('po-status').value = 'draft';

    const input = document.querySelector('.item-search-input');
    input.dispatchEvent(new Event('focus'));

    const dropdown = document.getElementById('po-floating-search-dropdown');
    const item2100 = dropdown.querySelector('.po-dropdown-item[data-id="prod-2"]');
    expect(item2100).not.toBeNull();
    item2100.click();

    const hargaInput = document.querySelector('.item-harga');
    expect(hargaInput.step).toBe('any');
    expect(hargaInput.value).toBe('2100');
    expect(hargaInput.checkValidity()).toBe(true);

    hargaInput.value = '2150.5';
    expect(hargaInput.checkValidity()).toBe(true);
    hargaInput.value = '2100';

    document.getElementById('form-po').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(poApi.create).toHaveBeenCalledTimes(1);
    });
    expect(poApi.create).toHaveBeenCalledWith(expect.objectContaining({
      no_po: 'PO-202611-237',
      supplier_id: 'sup-1',
      items: [expect.objectContaining({
        product_id: 'prod-2',
        qty: 1,
        harga: 2100
      })]
    }));
  });

  it('mengisi No. PO berurutan dari 001 sebelum disimpan, berkelanjutan setelah disimpan, dan reset/lanjut saat PO dihapus', async () => {
    const actualPoModule = await vi.importActual('../public/assets/js/api/po.js');
    const { supabase } = await import('../public/assets/js/supabase-client.js');
    const { po: poApi } = await import('../public/assets/js/api/po.js');
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    let savedPOs = [];
    supabase.from.mockImplementation(() => ({
      select: () => ({
        ilike: (_col, pattern) => {
          const prefix = String(pattern).replace(/%$/, '').toUpperCase();
          const matched = savedPOs.filter((row) => String(row.no_po || '').toUpperCase().startsWith(prefix));
          return {
            limit: async () => ({ data: matched, error: null })
          };
        }
      })
    }));

    poApi.generateNoPO.mockImplementation((list, dateInput) => actualPoModule.po.generateNoPO(list, dateInput));
    poApi.getNextNoPO = vi.fn((dateInput, fallback) => actualPoModule.po.getNextNoPO(dateInput, fallback));
    poApi.getAll.mockImplementation(async () => ({ ok: true, data: [...savedPOs], meta: { total: savedPOs.length } }));
    poApi.create.mockImplementation(async (payload) => {
      const created = { id: `po-${savedPOs.length + 1}`, ...payload };
      savedPOs.push(created);
      return { ok: true, data: created };
    });

    const selectFirstProductAndSubmit = async () => {
      document.getElementById('po-supplier').value = 'sup-1';
      const input = document.querySelector('.item-search-input');
      input.dispatchEvent(new Event('focus'));
      const dropdown = document.getElementById('po-floating-search-dropdown');
      dropdown.querySelector('.po-dropdown-item[data-id="prod-2"]').click();
      document.getElementById('form-po').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await vi.waitFor(() => {
        expect(document.getElementById('modal-po').classList.contains('hidden')).toBe(true);
      });
    };

    // 1. Sebelum ada PO tersimpan (Status Awal: draft) -> 001
    document.getElementById('btn-open-po-modal').click();
    await vi.waitFor(() => {
      expect(document.querySelector('.item-search-input')).not.toBeNull();
    });
    expect(document.getElementById('po-status').value).toBe('draft');
    expect(document.getElementById('po-no').value).toBe(`PO-${ym}-001`);

    // Tutup modal tanpa menyimpan -> tetap 001 saat dibuka lagi
    document.getElementById('btn-cancel-po-modal').click();
    document.getElementById('btn-open-po-modal').click();
    await vi.waitFor(() => {
      expect(document.getElementById('modal-po').classList.contains('hidden')).toBe(false);
    });
    expect(document.getElementById('po-no').value).toBe(`PO-${ym}-001`);

    // 2. Simpan PO pertama -> 001 tersimpan, buka lagi jadi 002
    await selectFirstProductAndSubmit();
    expect(savedPOs.map((p) => p.no_po)).toEqual([`PO-${ym}-001`]);

    document.getElementById('btn-open-po-modal').click();
    await vi.waitFor(() => {
      expect(document.getElementById('modal-po').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('po-no').value).toBe(`PO-${ym}-002`);
    });

    // Simpan PO kedua -> 002 tersimpan
    await selectFirstProductAndSubmit();
    expect(savedPOs.map((p) => p.no_po)).toEqual([`PO-${ym}-001`, `PO-${ym}-002`]);

    // 3. Hapus PO 001 (002 masih tersimpan) -> mulai lagi dari 001 lalu lanjut ke 003
    savedPOs = savedPOs.filter((p) => p.no_po !== `PO-${ym}-001`);
    document.getElementById('btn-open-po-modal').click();
    await vi.waitFor(() => {
      expect(document.getElementById('modal-po').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('po-no').value).toBe(`PO-${ym}-001`);
    });
    await selectFirstProductAndSubmit();

    document.getElementById('btn-open-po-modal').click();
    await vi.waitFor(() => {
      expect(document.getElementById('modal-po').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('po-no').value).toBe(`PO-${ym}-003`);
    });

    // Mengubah tanggal pesanan ke bulan lain otomatis menyesuaikan prefix bulan
    const dateInput = document.getElementById('po-tanggal');
    dateInput.value = '2026-12-05';
    dateInput.dispatchEvent(new Event('change'));
    await vi.waitFor(() => {
      expect(document.getElementById('po-no').value).toBe('PO-202612-001');
    });

    // 4. Hapus seluruh PO -> reset bersih ke 001
    savedPOs = [];
    document.getElementById('btn-cancel-po-modal').click();
    document.getElementById('btn-open-po-modal').click();
    await vi.waitFor(() => {
      expect(document.getElementById('modal-po').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('po-no').value).toBe(`PO-${ym}-001`);
    });

    // 5. Simulasikan tab lain lebih dulu menyimpan PO-YYYYMM-001 saat modal terbuka -> retry otomatis ke 002
    savedPOs.push({ id: 'po-concurrent', no_po: `PO-${ym}-001` });
    poApi.create.mockImplementationOnce(async () => ({
      ok: false,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "purchase_orders_no_po_key"' }
    }));
    await selectFirstProductAndSubmit();
    expect(savedPOs.map((p) => p.no_po)).toEqual([`PO-${ym}-001`, `PO-${ym}-002`]);

    delete poApi.getNextNoPO;
  });

  it('menampilkan dialog UI Konfirmasi Penerimaan PO (#modal-receive-po) tanpa prompt sistem dan mengirim metode bayar terpilih', async () => {
    const { po: poApi } = await import('../public/assets/js/api/po.js');
    const promptSpy = vi.fn();
    window.prompt = promptSpy;

    poApi.getAll.mockResolvedValue({
      ok: true,
      data: [{
        id: 'po-dikirim-1',
        no_po: 'PO-202611-001',
        tanggal: '2026-11-11',
        supplier_name: 'Supplier Utama',
        status: 'dikirim',
        total: 125000,
        purchase_order_items: [{ product_id: 'prod-1', qty: 1 }]
      }],
      meta: { total: 1 }
    });

    await window.initPo();
    // Gunakan trigger tombol terima PO pada baris tabel
    const receiveBtn = document.querySelector('.btn-receive-po[data-id="po-dikirim-1"]');
    expect(receiveBtn).not.toBeNull();
    receiveBtn.click();

    expect(promptSpy).not.toHaveBeenCalled();

    const modal = document.getElementById('modal-receive-po');
    expect(modal.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('receive-po-no').textContent).toBe('PO-202611-001');
    expect(document.getElementById('receive-po-supplier').textContent).toBe('Supplier Utama');
    expect(document.getElementById('receive-po-total').textContent).toContain('125.000');

    // Default terpilih: Cash
    expect(modal.querySelector('input[value="Cash"]').checked).toBe(true);
    expect(modal.querySelector('[data-payment-card="Cash"]').classList.contains('is-selected')).toBe(true);

    // Pilih Transfer (Bank)
    const transferRadio = modal.querySelector('input[value="Transfer"]');
    transferRadio.checked = true;
    transferRadio.dispatchEvent(new Event('change', { bubbles: true }));
    expect(modal.querySelector('[data-payment-card="Transfer"]').classList.contains('is-selected')).toBe(true);
    expect(modal.querySelector('[data-payment-card="Cash"]').classList.contains('is-selected')).toBe(false);

    // Batal via Escape tidak memanggil updateStatus
    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(modal.classList.contains('hidden')).toBe(true);
    expect(poApi.updateStatus).not.toHaveBeenCalled();

    // Buka lagi, pilih Tempo, gagal sekali lalu sukses saat konfirmasi ulang
    receiveBtn.click();
    const tempoRadio = modal.querySelector('input[value="Tempo"]');
    tempoRadio.checked = true;
    tempoRadio.dispatchEvent(new Event('change', { bubbles: true }));

    poApi.updateStatus.mockResolvedValueOnce({
      ok: false,
      error: { message: 'Stok RPC sementara sibuk' }
    });
    document.getElementById('form-receive-po').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      const feedback = document.getElementById('receive-po-feedback');
      expect(feedback.classList.contains('hidden')).toBe(false);
      expect(feedback.textContent).toContain('Stok RPC sementara sibuk');
    });
    expect(modal.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('btn-confirm-receive-po').disabled).toBe(false);

    poApi.updateStatus.mockResolvedValueOnce({ ok: true, data: { status: 'diterima' } });
    document.getElementById('form-receive-po').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(modal.classList.contains('hidden')).toBe(true);
    });
    expect(poApi.updateStatus).toHaveBeenLastCalledWith('po-dikirim-1', 'diterima', 'Tempo');

    delete window.prompt;
  });

  it('tidak membungkus .item-select menjadi dropdown "-- Pilih Barang --" saat select-ui.js aktif dan saat Tambah Item diklik', async () => {
    await import('../public/assets/js/components/select-ui.js');

    document.getElementById('btn-open-po-modal').click();
    await vi.waitFor(() => {
      expect(document.querySelectorAll('#po-items-container .po-item-row').length).toBe(1);
    });

    document.getElementById('btn-add-item-row').click();
    expect(document.querySelectorAll('#po-items-container .po-item-row').length).toBe(2);

    window.refreshCustomSelects?.(document);

    // Select terlihat (supplier) tetap memakai custom select UI
    const supplierSelect = document.getElementById('po-supplier');
    expect(supplierSelect.closest('.ui-select')).not.toBeNull();

    // Baris item barang tidak boleh memiliki dropdown ".ui-select" atau teks "-- Pilih Barang --"
    const itemsContainer = document.getElementById('po-items-container');
    expect(itemsContainer.querySelectorAll('.ui-select').length).toBe(0);
    expect(itemsContainer.textContent).not.toContain('Pilih Barang');

    const hiddenSelects = itemsContainer.querySelectorAll('.item-select');
    expect(hiddenSelects.length).toBe(2);
    hiddenSelects.forEach((sel) => {
      expect(sel.hasAttribute('data-native-select')).toBe(true);
      expect(sel.hidden).toBe(true);
      expect(sel.getAttribute('aria-hidden')).toBe('true');
      expect(sel.closest('.ui-select')).toBeNull();
    });

    delete window.refreshCustomSelects;
  });

  it('mengubah Jumlah & Harga Satuan langsung pada modal Draft PO, menghapus baris, dan mengunci status ke ORDERED saat Kirim WA / Cetak PDF', async () => {
    const { po: poApi } = await import('../public/assets/js/api/po.js');
    const draftPO = {
      id: 'po-auto-draft-1',
      no_po: 'PO-AUTO-261111-001',
      tanggal: '2026-11-11',
      supplier_id: 'sup-1',
      supplier_name: 'Supplier Utama',
      suppliers: { id: 'sup-1', name: 'Supplier Utama', phone: '081234567890' },
      status: 'draft',
      total: 80000,
      catatan: 'Restock Otomatis',
      purchase_order_items: [
        { product_id: 'prod-1', product_name: 'Filter Canister', qty: 2, harga: 25000, subtotal: 50000 },
        { product_id: 'prod-2', product_name: 'Selang Silikon', qty: 3, harga: 10000, subtotal: 30000 }
      ]
    };

    poApi.getAll.mockResolvedValue({ ok: true, data: [draftPO], meta: { total: 1 } });
    poApi.updateDraftPO.mockImplementation(async (id, items, opts) => ({
      ok: true,
      data: {
        id,
        status: opts?.status || 'draft',
        total: items.reduce((s, it) => s + it.qty * it.harga, 0),
        items
      }
    }));

    await window.initPo();

    const printBtn = document.querySelector('.btn-print-po[data-id="po-auto-draft-1"]');
    expect(printBtn).not.toBeNull();
    printBtn.click();

    await vi.waitFor(() => {
      const modal = document.getElementById('modal-print-po');
      expect(modal.classList.contains('hidden')).toBe(false);
    });

    // Pastikan kolom Jumlah & Harga Satuan menjadi input angka selama berstatus DRAFT
    const qtyInputs = document.querySelectorAll('#doc-po-items-tbody .doc-item-qty-input');
    const hargaInputs = document.querySelectorAll('#doc-po-items-tbody .doc-item-harga-input');
    const removeBtns = document.querySelectorAll('#doc-po-items-tbody .btn-doc-remove-item');
    expect(qtyInputs.length).toBe(2);
    expect(hargaInputs.length).toBe(2);
    expect(removeBtns.length).toBe(2);
    expect(document.getElementById('po-document-paper').classList.contains('is-draft-editable')).toBe(true);
    expect(document.getElementById('doc-po-draft-banner').classList.contains('hidden')).toBe(false);

    // Edit Jumlah baris 1 menjadi 5 & Harga Satuan menjadi 30000 -> Subtotal real-time 150.000, Grand Total 180.000
    qtyInputs[0].value = '5';
    qtyInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    hargaInputs[0].value = '30000';
    hargaInputs[0].dispatchEvent(new Event('change', { bubbles: true }));

    expect(document.querySelector('#doc-po-items-tbody .doc-item-subtotal[data-idx="0"]').textContent).toContain('150.000');
    expect(document.getElementById('doc-po-total').textContent).toContain('180.000');

    await vi.waitFor(() => {
      expect(poApi.updateDraftPO).toHaveBeenCalledWith(
        'po-auto-draft-1',
        expect.arrayContaining([
          expect.objectContaining({ product_id: 'prod-1', qty: 5, harga: 30000, subtotal: 150000 }),
          expect.objectContaining({ product_id: 'prod-2', qty: 3, harga: 10000, subtotal: 30000 })
        ]),
        expect.objectContaining({ status: 'draft' })
      );
    });

    // Hapus baris ke-2 -> total turun menjadi 150.000 dan tersisa 1 item
    removeBtns[1].click();
    await vi.waitFor(() => {
      expect(document.querySelectorAll('#doc-po-items-tbody tr').length).toBe(1);
    });
    expect(document.getElementById('doc-po-total').textContent).toContain('150.000');

    // Hapus baris terakhir ditolak agar Draft PO tidak kosong
    document.querySelector('#doc-po-items-tbody .btn-doc-remove-item').click();
    expect(document.querySelectorAll('#doc-po-items-tbody tr').length).toBe(1);

    // Klik "Kirim via WhatsApp" -> simpan qty terakhir (5) & kunci status ke ORDERED (dikirim)
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn(), fonts: { ready: Promise.resolve() }, images: [], readyState: 'complete' },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn()
    }));

    document.getElementById('btn-doc-share-wa').click();
    await vi.waitFor(() => {
      expect(poApi.updateDraftPO).toHaveBeenLastCalledWith(
        'po-auto-draft-1',
        [expect.objectContaining({ product_id: 'prod-1', qty: 5, harga: 30000, subtotal: 150000 })],
        { status: 'dikirim' }
      );
    });
    expect(document.getElementById('doc-po-status').textContent).toBe('ORDERED (DIKIRIM)');
    expect(document.getElementById('doc-po-draft-banner').classList.contains('hidden')).toBe(true);
    expect(document.querySelectorAll('#doc-po-items-tbody .doc-item-qty-input').length).toBe(0);
    await vi.waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('Filter%20Canister%20(5%20unit)'), '_blank');
    });
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('Rp%20150.000'), '_blank');
    openSpy.mockRestore();
  });

  it('mengunci status Draft PO ke ORDERED dan mencetak dokumen bersih saat Cetak / Simpan PDF diklik', async () => {
    const { po: poApi } = await import('../public/assets/js/api/po.js');
    const draftPrintPO = {
      id: 'po-auto-print-1',
      no_po: 'PO-AUTO-261111-002',
      tanggal: '2026-11-11',
      supplier_id: 'sup-1',
      supplier_name: 'Supplier Utama',
      status: 'draft',
      total: 40000,
      purchase_order_items: [
        { product_id: 'prod-3', product_name: 'Lampu UV', qty: 2, harga: 20000, subtotal: 40000 }
      ]
    };

    poApi.getAll.mockResolvedValue({ ok: true, data: [draftPrintPO], meta: { total: 1 } });
    poApi.updateDraftPO.mockResolvedValue({
      ok: true,
      data: { id: 'po-auto-print-1', status: 'dikirim', total: 120000 }
    });
    poApi.getRestockInsightsForProducts.mockResolvedValueOnce(
      new Map([['prod-3', { reason: 'Stok: 1 • Terjual 30h: 18 • Saran 18h' }]])
    );

    await window.initPo();
    document.querySelector('.btn-print-po[data-id="po-auto-print-1"]').click();

    await vi.waitFor(() => {
      expect(document.querySelectorAll('#doc-po-items-tbody .doc-item-qty-input').length).toBe(1);
    });
    expect(document.querySelector('#doc-po-items-tbody .po-doc-item-insight')?.textContent).toContain('Terjual 30h: 18');

    // Ubah jumlah langsung tanpa blur terlebih dahulu, lalu langsung klik Cetak / Simpan PDF
    const qtyInput = document.querySelector('#doc-po-items-tbody .doc-item-qty-input');
    qtyInput.value = '6';
    qtyInput.dispatchEvent(new Event('input', { bubbles: true }));

    let printedHtml = '';
    const fakePrintWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html) => { printedHtml = html; }),
        close: vi.fn(),
        fonts: { ready: Promise.resolve() },
        images: [],
        readyState: 'complete'
      },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn()
    };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakePrintWindow);

    document.getElementById('btn-doc-print-action').click();
    await vi.waitFor(() => {
      expect(fakePrintWindow.print).toHaveBeenCalled();
    });

    expect(poApi.updateDraftPO).toHaveBeenLastCalledWith(
      'po-auto-print-1',
      [expect.objectContaining({ product_id: 'prod-3', qty: 6, harga: 20000, subtotal: 120000 })],
      { status: 'dikirim' }
    );
    expect(document.getElementById('doc-po-status').textContent).toBe('ORDERED (DIKIRIM)');
    expect(printedHtml).toContain('6 unit');
    expect(printedHtml).not.toContain('doc-item-qty-input');
    expect(printedHtml).not.toContain('btn-doc-remove-item');
    expect(printedHtml).not.toContain('Terjual 30h: 18');
    expect(document.querySelectorAll('#doc-po-items-tbody .po-doc-item-insight').length).toBe(0);
    openSpy.mockRestore();
  });
});
