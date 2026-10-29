import { supabase } from '../assets/js/supabase-client.js';

let allProducts = [];
let missingProducts = [];
const selectedProductIds = new Set();
let barcodeRendererPromise;
let loading = false;
let processing = false;
let activeFilterMode = 'missing'; // 'missing' | 'existing' | 'all'
let currentLayout = (typeof localStorage !== 'undefined' && localStorage.getItem('aquastock_barcode_layout')) || '50x30_single';

export const BARCODE_LAYOUTS = {
  '50x30_single': {
    id: '50x30_single',
    name: '50 × 30 mm (1 Kolom - Standar)',
    columns: 1,
    css: `
      @page { size: 50mm 30mm; margin: 1mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #000; font: 8pt Arial, sans-serif; background: #fff; }
      .barcode-sheet { display: block; }
      .barcode-label { width: 48mm; height: 28mm; padding: 1mm; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; page-break-after: always; break-after: page; }
      .barcode-label:last-child { page-break-after: auto; break-after: auto; }
      .product-name { width: 100%; max-height: 7.5mm; margin: 0 0 0.5mm; overflow: hidden; text-align: center; font-size: 8pt; font-weight: 700; line-height: 1.15; }
      .barcode { width: 43mm; height: 14mm; }
      .product-price { width: 100%; margin: 0.5mm 0 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; font-size: 8.5pt; font-weight: 800; }
    `
  },
  '40x30_double': {
    id: '40x30_double',
    name: '40 × 30 mm (2 Kolom - Printer 80mm)',
    columns: 2,
    css: `
      @page { size: 82mm 30mm; margin: 1mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #000; font: 7.5pt Arial, sans-serif; background: #fff; }
      .barcode-sheet { display: grid; grid-template-columns: 39mm 39mm; gap: 2mm; width: 80mm; page-break-after: always; break-after: page; }
      .barcode-sheet:last-child { page-break-after: auto; break-after: auto; }
      .barcode-label { width: 39mm; height: 28mm; padding: 0.8mm; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
      .product-name { width: 100%; max-height: 6.5mm; margin: 0 0 0.5mm; overflow: hidden; text-align: center; font-size: 7.5pt; font-weight: 700; line-height: 1.1; }
      .barcode { width: 36mm; height: 13.5mm; }
      .product-price { width: 100%; margin: 0.5mm 0 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; font-size: 8pt; font-weight: 800; }
    `
  },
  '40x30_single': {
    id: '40x30_single',
    name: '40 × 30 mm (1 Kolom)',
    columns: 1,
    css: `
      @page { size: 40mm 30mm; margin: 1mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #000; font: 7.5pt Arial, sans-serif; background: #fff; }
      .barcode-sheet { display: block; }
      .barcode-label { width: 38mm; height: 28mm; padding: 0.8mm; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; page-break-after: always; break-after: page; }
      .barcode-label:last-child { page-break-after: auto; break-after: auto; }
      .product-name { width: 100%; max-height: 6.5mm; margin: 0 0 0.5mm; overflow: hidden; text-align: center; font-size: 7.5pt; font-weight: 700; line-height: 1.1; }
      .barcode { width: 36mm; height: 13.5mm; }
      .product-price { width: 100%; margin: 0.5mm 0 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; font-size: 8pt; font-weight: 800; }
    `
  }
};

export function filterProductsWithoutBarcode(products, searchTerm) {
  const query = String(searchTerm || '').trim().toLocaleLowerCase();
  if (!query) return products;
  return products.filter(product =>
    String(product.name || '').toLocaleLowerCase().includes(query)
    || String(product.sku || '').toLocaleLowerCase().includes(query)
    || String(product.barcode || '').toLocaleLowerCase().includes(query)
  );
}

export function createInternalBarcode(cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.getRandomValues) throw new Error('Browser tidak mendukung generator kode acak yang aman.');
  const values = new Uint32Array(2);
  cryptoApi.getRandomValues(values);
  const number = ((BigInt(values[0]) << 32n) | BigInt(values[1])) % 10000000000n;
  return `AS${number.toString().padStart(10, '0')}`;
}

function showMessage(message, type = 'error') {
  if (typeof window.showToast === 'function') window.showToast(message, type);
}

function formatCurrency(val) {
  const num = Number(val || 0);
  return num > 0 ? `Rp ${num.toLocaleString('id-ID')}` : 'Rp 0';
}

async function loadMissingProducts() {
  if (loading) return;
  loading = true;
  const list = document.getElementById('missing-barcode-list');
  const count = document.getElementById('missing-barcode-count');
  const refreshButton = document.getElementById('btn-refresh-missing-barcodes');
  const generateButton = document.getElementById('btn-generate-selected-barcodes');
  if (refreshButton) refreshButton.disabled = true;
  if (generateButton) generateButton.disabled = true;
  if (count) count.textContent = 'Memuat daftar barcode produk...';
  if (list) list.textContent = 'Memuat daftar barcode produk...';

  try {
    const pageSize = 500;
    const products = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, barcode, sell_price')
        .order('name')
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      products.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    allProducts = products;
    missingProducts = products.filter(product => !String(product.barcode || '').trim());
    selectedProductIds.clear();
    renderMissingProducts();
  } catch (error) {
    console.error('Gagal memuat produk barcode:', error);
    if (count) count.textContent = 'Data barcode produk gagal dimuat.';
    if (list) list.textContent = error.message || 'Periksa koneksi dan hak akses, lalu coba lagi.';
    showMessage(error.message || 'Gagal memuat data barcode produk.');
  } finally {
    loading = false;
    if (refreshButton) refreshButton.disabled = false;
  }
}

function getActiveProductPool() {
  if (activeFilterMode === 'existing') {
    return allProducts.filter(p => Boolean(String(p.barcode || '').trim()));
  }
  if (activeFilterMode === 'all') {
    return allProducts;
  }
  return missingProducts;
}

function renderMissingProducts() {
  const list = document.getElementById('missing-barcode-list');
  const count = document.getElementById('missing-barcode-count');
  const generateButton = document.getElementById('btn-generate-selected-barcodes');
  const selectButton = document.getElementById('btn-select-missing-barcodes');
  const searchInput = document.getElementById('search-missing-barcodes');
  if (!list || !count || !generateButton) return;

  list.replaceChildren();
  const pool = getActiveProductPool();
  const filteredProducts = filterProductsWithoutBarcode(pool, searchInput?.value);

  const filterLabel = activeFilterMode === 'existing'
    ? 'sudah memiliki barcode'
    : (activeFilterMode === 'all' ? 'total produk' : 'belum memiliki barcode');

  count.textContent = searchInput?.value.trim()
    ? `${filteredProducts.length} dari ${pool.length} produk cocok`
    : `${pool.length} produk ${filterLabel}`;

  if (selectButton) selectButton.disabled = filteredProducts.length === 0;
  generateButton.disabled = selectedProductIds.size === 0;

  // Update text tombol batch
  const span = generateButton.querySelector('span') || generateButton;
  if (activeFilterMode === 'missing') {
    span.textContent = 'Buat & cetak barcode terpilih';
  } else {
    span.textContent = 'Cetak barcode terpilih';
  }

  if (pool.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'py-6 text-center text-sm text-[#A0A0A5]';
    empty.textContent = activeFilterMode === 'missing'
      ? 'Semua produk sudah memiliki barcode.'
      : 'Belum ada produk pada kategori ini.';
    list.appendChild(empty);
    return;
  }

  if (filteredProducts.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'py-6 text-center text-sm text-[#A0A0A5]';
    empty.textContent = 'Produk tidak ditemukan. Coba kata kunci atau SKU lain.';
    list.appendChild(empty);
    if (selectButton) selectButton.textContent = 'Pilih semua';
    return;
  }

  filteredProducts.forEach(product => {
    const row = document.createElement('li');
    row.className = 'flex items-center gap-3 py-3 border-b border-white/5 last:border-b-0';
    row.dataset.productId = String(product.id);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.selectRow = '';
    checkbox.dataset.productId = String(product.id);
    checkbox.checked = selectedProductIds.has(String(product.id));
    checkbox.setAttribute('aria-label', `Pilih ${product.name || 'produk'}`);
    checkbox.className = 'h-4 w-4 shrink-0 accent-[#0088CC] cursor-pointer';

    const details = document.createElement('div');
    details.className = 'min-w-0 flex-1';
    const name = document.createElement('p');
    name.className = 'truncate text-sm font-medium text-white';
    name.textContent = product.name || 'Produk tanpa nama';

    const meta = document.createElement('p');
    meta.className = 'mt-0.5 truncate text-xs text-[#A0A0A5] flex items-center gap-2 flex-wrap';
    const priceFormatted = formatCurrency(product.sell_price);

    const hasBarcode = Boolean(String(product.barcode || '').trim());
    if (hasBarcode) {
      meta.innerHTML = `<span class="font-mono text-[#32ADE6] font-semibold">${product.barcode}</span> <span class="text-white/20">•</span> <span class="font-semibold text-emerald-400">${priceFormatted}</span> <span class="text-white/20">•</span> <span>SKU: ${product.sku || '-'}</span>`;
    } else {
      meta.innerHTML = `<span class="text-[#FF9500] font-medium">Belum ada barcode</span> <span class="text-white/20">•</span> <span class="font-semibold text-emerald-400">${priceFormatted}</span> <span class="text-white/20">•</span> <span>SKU: ${product.sku || '-'}</span>`;
    }
    details.append(name, meta);

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'edit';
    if (hasBarcode) {
      button.dataset.printBarcode = String(product.id);
      button.className = 'shrink-0 rounded-lg border border-[#34C759]/30 bg-[#34C759]/10 hover:bg-[#34C759]/20 text-[#34C759] px-3 py-2 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer active:scale-95';
      button.innerHTML = '<span>Cetak label</span>';
      button.setAttribute('aria-label', `Cetak barcode label untuk ${product.name || 'produk'}`);
    } else {
      button.dataset.generateBarcode = String(product.id);
      button.className = 'shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer active:scale-95';
      button.innerHTML = '<span>Buat barcode</span>';
      button.setAttribute('aria-label', `Buat barcode untuk ${product.name || 'produk'}`);
    }

    row.append(checkbox, details, button);
    list.appendChild(row);
  });
  updateSelectionControls(filteredProducts);
}

async function loadBarcodeRenderer() {
  if (window.JsBarcode) return window.JsBarcode;
  if (!barcodeRendererPromise) {
    barcodeRendererPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/assets/js/vendor/jsbarcode.all.min.js';
      script.onload = () => window.JsBarcode
        ? resolve(window.JsBarcode)
        : reject(new Error('Pustaka pembuat barcode gagal diinisialisasi.'));
      script.onerror = () => {
        barcodeRendererPromise = null;
        reject(new Error('Pustaka pembuat barcode gagal dimuat.'));
      };
      document.head.appendChild(script);
    });
  }
  return barcodeRendererPromise;
}

function openPrintWindow(layoutKey = currentLayout) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Jendela cetak diblokir browser. Izinkan pop-up lalu coba lagi.');
  const layout = BARCODE_LAYOUTS[layoutKey] || BARCODE_LAYOUTS['50x30_single'];

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="id"><head><meta charset="utf-8"><title>Label Barcode Produk</title>
    <style>
      ${layout.css}
    </style></head><body></body></html>`);
  printWindow.document.close();
  return printWindow;
}

function createSingleLabelElement(doc, product, JsBarcode, isCompact = false) {
  const label = doc.createElement('article');
  label.className = 'barcode-label';

  const name = doc.createElement('p');
  name.className = 'product-name';
  name.textContent = product.name || 'Produk';

  const barcode = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  barcode.classList.add('barcode');
  JsBarcode(barcode, product.barcode, {
    format: 'CODE128',
    lineColor: '#000',
    width: isCompact ? 1.4 : 1.6,
    height: isCompact ? 32 : 36,
    displayValue: true,
    fontSize: isCompact ? 9 : 10,
    margin: 1
  });

  const price = doc.createElement('p');
  price.className = 'product-price';
  price.textContent = formatCurrency(product.sell_price);

  label.append(name, barcode, price);
  return label;
}

function renderPrintLabels(printWindow, products, JsBarcode, layoutKey = currentLayout) {
  const doc = printWindow.document;
  const layout = BARCODE_LAYOUTS[layoutKey] || BARCODE_LAYOUTS['50x30_single'];
  const isDoubleColumn = layout.columns === 2;
  const isCompact = layoutKey === '40x30_double' || layoutKey === '40x30_single';

  if (isDoubleColumn) {
    // Format 2 kolom (40x30 double): bungkus per 2 label dalam satu .barcode-sheet grid
    for (let i = 0; i < products.length; i += 2) {
      const sheet = doc.createElement('div');
      sheet.className = 'barcode-sheet';
      sheet.appendChild(createSingleLabelElement(doc, products[i], JsBarcode, isCompact));

      if (products[i + 1]) {
        sheet.appendChild(createSingleLabelElement(doc, products[i + 1], JsBarcode, isCompact));
      } else {
        // Placeholder kosong agar posisi label tunggal ganjil tetap di kolom kiri
        const dummy = doc.createElement('div');
        dummy.className = 'barcode-label';
        sheet.appendChild(dummy);
      }
      doc.body.appendChild(sheet);
    }
  } else {
    // Format 1 kolom: append tiap label langsung
    for (const product of products) {
      const label = createSingleLabelElement(doc, product, JsBarcode, isCompact);
      doc.body.appendChild(label);
    }
  }

  printWindow.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 300);
}

async function assignBarcode(product) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const barcode = createInternalBarcode();
    let query = supabase
      .from('products')
      .update({ barcode })
      .eq('id', product.id);
    query = product.barcode == null
      ? query.is('barcode', null)
      : query.eq('barcode', product.barcode);

    const { data, error } = await query.select('id, name, sku, barcode, sell_price').maybeSingle();
    if (error?.code === '23505') continue;
    if (error) throw error;
    if (!data) throw new Error(`${product.name || 'Produk'} sudah berubah. Muat ulang daftar barcode.`);
    return data;
  }
  throw new Error('Tidak berhasil membuat kode unik setelah beberapa percobaan. Coba lagi.');
}

async function generateAndPrint(products, trigger, layoutKey = currentLayout) {
  if (processing) return;
  if (!products.length) {
    showMessage('Pilih minimal satu produk.');
    return;
  }
  if (products.length > 200) {
    showMessage('Pilih maksimal 200 produk untuk satu kali cetak label.');
    return;
  }

  let printWindow;
  try {
    printWindow = openPrintWindow(layoutKey);
  } catch (error) {
    showMessage(error.message);
    return;
  }

  processing = true;
  if (trigger) trigger.disabled = true;
  document.querySelectorAll('#missing-barcode-list [data-generate-barcode], #missing-barcode-list [data-print-barcode]').forEach(button => {
    button.disabled = true;
  });
  const refreshButton = document.getElementById('btn-refresh-missing-barcodes');
  if (refreshButton) refreshButton.disabled = true;

  const toPrint = [];
  try {
    const JsBarcode = await loadBarcodeRenderer();
    let newlyCreated = 0;

    for (const product of products) {
      if (product.barcode) {
        toPrint.push(product);
      } else {
        const assigned = await assignBarcode(product);
        toPrint.push(assigned);
        newlyCreated += 1;
      }
    }

    renderPrintLabels(printWindow, toPrint, JsBarcode, layoutKey);
    const msg = newlyCreated > 0
      ? `${newlyCreated} barcode baru dibuat dan total ${toPrint.length} label siap dicetak.`
      : `${toPrint.length} barcode siap dicetak.`;
    showMessage(msg, 'success');
    await loadMissingProducts();
  } catch (error) {
    console.error('Gagal memproses barcode produk:', error);
    if (toPrint.length) {
      try {
        const JsBarcode = await loadBarcodeRenderer();
        renderPrintLabels(printWindow, toPrint, JsBarcode, layoutKey);
        showMessage(`${toPrint.length} barcode tersimpan dan siap dicetak; produk lainnya gagal diproses: ${error.message}`, 'error');
        await loadMissingProducts();
        return;
      } catch (printError) {
        console.error('Gagal menyiapkan cetak barcode:', printError);
      }
    }
    printWindow.close();
    showMessage(error.message || 'Gagal memproses barcode.');
  } finally {
    processing = false;
    if (refreshButton) refreshButton.disabled = false;
    document.querySelectorAll('#missing-barcode-list [data-generate-barcode], #missing-barcode-list [data-print-barcode]').forEach(button => {
      button.disabled = false;
    });
    updateSelectionControls();
  }
}

export async function printSingleProductBarcode(productOrId, layoutKey = currentLayout) {
  let targetProduct = null;
  if (typeof productOrId === 'object' && productOrId !== null) {
    targetProduct = { ...productOrId };
  } else if (productOrId) {
    targetProduct = allProducts.find(p => String(p.id) === String(productOrId));
    if (!targetProduct && typeof window !== 'undefined' && Array.isArray(window.currentItems)) {
      targetProduct = window.currentItems.find(p => String(p.id) === String(productOrId));
    }
    if (!targetProduct) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, sku, barcode, sell_price')
          .eq('id', productOrId)
          .maybeSingle();
        if (!error && data) targetProduct = data;
      } catch (_) {}
    }
  }

  if (!targetProduct) {
    showMessage('Data produk tidak ditemukan untuk mencetak barcode.');
    return;
  }

  await generateAndPrint([targetProduct], null, layoutKey);
}

function updateGenerateButton() {
  const button = document.getElementById('btn-generate-selected-barcodes');
  if (button && !loading) button.disabled = selectedProductIds.size === 0;
}

function updateSelectionControls(products = filterProductsWithoutBarcode(
  getActiveProductPool(),
  document.getElementById('search-missing-barcodes')?.value
)) {
  const selectButton = document.getElementById('btn-select-missing-barcodes');
  if (selectButton) {
    const hasUnselected = products.some(product => !selectedProductIds.has(String(product.id)));
    selectButton.textContent = hasUnselected ? 'Pilih semua hasil' : 'Batalkan pilihan hasil';
  }
  updateGenerateButton();
}

function setFilterMode(mode) {
  if (activeFilterMode === mode) return;
  activeFilterMode = mode;
  selectedProductIds.clear();

  // Update styles of filter buttons
  const btnMissing = document.getElementById('btn-filter-barcode-missing');
  const btnExisting = document.getElementById('btn-filter-barcode-existing');
  const btnAll = document.getElementById('btn-filter-barcode-all');

  const activeClasses = ['bg-[#0088CC]', 'text-white', 'shadow-sm'];
  const inactiveClasses = ['text-[#A0A0A5]', 'hover:text-white', 'hover:bg-white/5'];

  [btnMissing, btnExisting, btnAll].forEach(btn => {
    if (!btn) return;
    btn.classList.remove(...activeClasses);
    btn.classList.add(...inactiveClasses);
  });

  const activeBtn = mode === 'missing' ? btnMissing : (mode === 'existing' ? btnExisting : btnAll);
  if (activeBtn) {
    activeBtn.classList.remove(...inactiveClasses);
    activeBtn.classList.add(...activeClasses);
  }

  renderMissingProducts();
}

export function initBarcodeSettings() {
  const list = document.getElementById('missing-barcode-list');
  if (!list || list.dataset.barcodeBound === 'true') return;
  list.dataset.barcodeBound = 'true';

  // Expose global window helper
  if (typeof window !== 'undefined') {
    window.printSingleProductBarcode = printSingleProductBarcode;
  }

  // Restore saved layout dropdown value
  const layoutSelect = document.getElementById('select-barcode-layout');
  if (layoutSelect) {
    layoutSelect.value = currentLayout;
    layoutSelect.addEventListener('change', event => {
      currentLayout = event.target.value;
      try {
        localStorage.setItem('aquastock_barcode_layout', currentLayout);
      } catch (_) {}
    });
  }

  // Filter Buttons
  document.getElementById('btn-filter-barcode-missing')?.addEventListener('click', () => setFilterMode('missing'));
  document.getElementById('btn-filter-barcode-existing')?.addEventListener('click', () => setFilterMode('existing'));
  document.getElementById('btn-filter-barcode-all')?.addEventListener('click', () => setFilterMode('all'));

  document.querySelector('.settings-tabs')?.addEventListener('click', event => {
    if (event.target.closest('[data-tab="barcode"]')) loadMissingProducts();
  });
  document.getElementById('btn-refresh-missing-barcodes')?.addEventListener('click', loadMissingProducts);
  document.getElementById('search-missing-barcodes')?.addEventListener('input', renderMissingProducts);

  document.getElementById('btn-select-missing-barcodes')?.addEventListener('click', () => {
    const filteredProducts = filterProductsWithoutBarcode(
      getActiveProductPool(),
      document.getElementById('search-missing-barcodes')?.value
    );
    const shouldSelect = filteredProducts.some(product => !selectedProductIds.has(String(product.id)));
    filteredProducts.forEach(product => {
      const id = String(product.id);
      if (shouldSelect) selectedProductIds.add(id);
      else selectedProductIds.delete(id);
    });
    document.querySelectorAll('#missing-barcode-list input[data-select-row]').forEach(input => {
      input.checked = selectedProductIds.has(input.dataset.productId);
    });
    updateSelectionControls(filteredProducts);
  });

  list.addEventListener('change', event => {
    if (event.target.matches('input[data-select-row]')) {
      const id = event.target.dataset.productId;
      if (event.target.checked) selectedProductIds.add(id);
      else selectedProductIds.delete(id);
      updateSelectionControls();
    }
  });

  list.addEventListener('click', event => {
    const genButton = event.target.closest('[data-generate-barcode]');
    if (genButton) {
      const pool = getActiveProductPool();
      const product = pool.find(item => String(item.id) === genButton.dataset.generateBarcode);
      if (product) generateAndPrint([product], genButton, currentLayout);
      return;
    }

    const printButton = event.target.closest('[data-print-barcode]');
    if (printButton) {
      const pool = getActiveProductPool();
      const product = pool.find(item => String(item.id) === printButton.dataset.printBarcode);
      if (product) generateAndPrint([product], printButton, currentLayout);
    }
  });

  document.getElementById('btn-generate-selected-barcodes')?.addEventListener('click', event => {
    const pool = getActiveProductPool();
    const selected = pool.filter(product => selectedProductIds.has(String(product.id)));
    if (selected.length) generateAndPrint(selected, event.currentTarget, currentLayout);
  });
}
