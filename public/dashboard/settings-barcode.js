import { supabase } from '../assets/js/supabase-client.js';

let missingProducts = [];
const selectedProductIds = new Set();
let barcodeRendererPromise;
let loading = false;
let processing = false;

export function filterProductsWithoutBarcode(products, searchTerm) {
  const query = String(searchTerm || '').trim().toLocaleLowerCase();
  if (!query) return products;
  return products.filter(product =>
    String(product.name || '').toLocaleLowerCase().includes(query)
    || String(product.sku || '').toLocaleLowerCase().includes(query)
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

async function loadMissingProducts() {
  if (loading) return;
  loading = true;
  const list = document.getElementById('missing-barcode-list');
  const count = document.getElementById('missing-barcode-count');
  const refreshButton = document.getElementById('btn-refresh-missing-barcodes');
  const generateButton = document.getElementById('btn-generate-selected-barcodes');
  if (refreshButton) refreshButton.disabled = true;
  if (generateButton) generateButton.disabled = true;
  if (count) count.textContent = 'Memuat produk tanpa barcode...';
  if (list) list.textContent = 'Memuat produk tanpa barcode...';

  try {
    const pageSize = 500;
    const products = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, barcode')
        .order('name')
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      products.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    missingProducts = products.filter(product => !String(product.barcode || '').trim());
    selectedProductIds.clear();
    renderMissingProducts();
  } catch (error) {
    console.error('Gagal memuat produk tanpa barcode:', error);
    if (count) count.textContent = 'Produk tanpa barcode gagal dimuat.';
    if (list) list.textContent = error.message || 'Periksa koneksi dan hak akses, lalu coba lagi.';
    showMessage(error.message || 'Gagal memuat produk tanpa barcode.');
  } finally {
    loading = false;
    if (refreshButton) refreshButton.disabled = false;
  }
}

function renderMissingProducts() {
  const list = document.getElementById('missing-barcode-list');
  const count = document.getElementById('missing-barcode-count');
  const generateButton = document.getElementById('btn-generate-selected-barcodes');
  const selectButton = document.getElementById('btn-select-missing-barcodes');
  const searchInput = document.getElementById('search-missing-barcodes');
  if (!list || !count || !generateButton) return;

  list.replaceChildren();
  const filteredProducts = filterProductsWithoutBarcode(missingProducts, searchInput?.value);
  count.textContent = searchInput?.value.trim()
    ? `${filteredProducts.length} dari ${missingProducts.length} produk cocok`
    : `${missingProducts.length} produk belum memiliki barcode`;
  if (selectButton) selectButton.disabled = filteredProducts.length === 0;
  generateButton.disabled = true;

  if (missingProducts.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'py-6 text-center text-sm text-[#A0A0A5]';
    empty.textContent = 'Semua produk sudah memiliki barcode.';
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
    row.className = 'flex items-center gap-3 py-3';
    row.dataset.productId = String(product.id);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.selectRow = '';
    checkbox.dataset.productId = String(product.id);
    checkbox.checked = selectedProductIds.has(String(product.id));
    checkbox.setAttribute('aria-label', `Pilih ${product.name || 'produk'}`);
    checkbox.className = 'h-4 w-4 shrink-0 accent-[#0088CC]';

    const details = document.createElement('div');
    details.className = 'min-w-0 flex-1';
    const name = document.createElement('p');
    name.className = 'truncate text-sm font-medium text-white';
    name.textContent = product.name || 'Produk tanpa nama';
    const sku = document.createElement('p');
    sku.className = 'mt-0.5 truncate text-xs text-[#A0A0A5]';
    sku.textContent = `SKU: ${product.sku || '-'}`;
    details.append(name, sku);

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'edit';
    button.dataset.generateBarcode = String(product.id);
    button.className = 'shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 transition';
    button.textContent = 'Buat barcode';
    button.setAttribute('aria-label', `Buat barcode untuk ${product.name || 'produk'}`);

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

function openPrintWindow() {
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Jendela cetak diblokir browser. Izinkan pop-up lalu coba lagi.');
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="id"><head><meta charset="utf-8"><title>Label Barcode Produk</title>
    <style>
      @page { size: 50mm 30mm; margin: 1mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #000; font: 8pt Arial, sans-serif; }
      .barcode-label { width: 48mm; height: 28mm; padding: 1mm; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; page-break-after: always; break-after: page; }
      .barcode-label:last-child { page-break-after: auto; break-after: auto; }
      .product-name { width: 100%; max-height: 7mm; margin: 0 0 1mm; overflow: hidden; text-align: center; font-size: 8pt; font-weight: 700; }
      .barcode { width: 43mm; height: 15mm; }
      .product-sku { max-width: 100%; margin-top: 0.5mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 7pt; }
    </style></head><body></body></html>`);
  printWindow.document.close();
  return printWindow;
}

function renderPrintLabels(printWindow, products, JsBarcode) {
  const doc = printWindow.document;
  for (const product of products) {
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
      width: 1.6,
      height: 38,
      displayValue: true,
      fontSize: 10,
      margin: 2
    });
    const sku = doc.createElement('p');
    sku.className = 'product-sku';
    sku.textContent = `SKU: ${product.sku || '-'}`;
    label.append(name, barcode, sku);
    doc.body.appendChild(label);
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

    const { data, error } = await query.select('id, name, sku, barcode').maybeSingle();
    if (error?.code === '23505') continue;
    if (error) throw error;
    if (!data) throw new Error(`${product.name || 'Produk'} sudah berubah. Muat ulang daftar barcode.`);
    return data;
  }
  throw new Error('Tidak berhasil membuat kode unik setelah beberapa percobaan. Coba lagi.');
}

async function generateAndPrint(products, trigger) {
  if (processing) return;
  if (!products.length) {
    showMessage('Pilih minimal satu produk.');
    return;
  }
  if (products.length > 100) {
    showMessage('Pilih maksimal 100 produk untuk satu kali cetak label.');
    return;
  }

  let printWindow;
  try {
    printWindow = openPrintWindow();
  } catch (error) {
    showMessage(error.message);
    return;
  }

  processing = true;
  trigger.disabled = true;
  document.querySelectorAll('#missing-barcode-list [data-generate-barcode]').forEach(button => {
    button.disabled = true;
  });
  const refreshButton = document.getElementById('btn-refresh-missing-barcodes');
  if (refreshButton) refreshButton.disabled = true;
  const generated = [];
  try {
    const JsBarcode = await loadBarcodeRenderer();
    for (const product of products) {
      generated.push(await assignBarcode(product));
    }
    renderPrintLabels(printWindow, generated, JsBarcode);
    showMessage(`${generated.length} barcode berhasil dibuat dan siap dicetak.`, 'success');
    await loadMissingProducts();
  } catch (error) {
    console.error('Gagal membuat barcode produk:', error);
    if (generated.length) {
      try {
        const JsBarcode = await loadBarcodeRenderer();
        renderPrintLabels(printWindow, generated, JsBarcode);
        showMessage(`${generated.length} barcode tersimpan dan siap dicetak; produk lainnya gagal diproses: ${error.message}`, 'error');
        await loadMissingProducts();
        return;
      } catch (printError) {
        console.error('Gagal menyiapkan cetak barcode:', printError);
      }
    }
    printWindow.close();
    showMessage(error.message || 'Gagal membuat barcode. Tidak ada perubahan yang dilaporkan berhasil.');
  } finally {
    processing = false;
    if (refreshButton) refreshButton.disabled = false;
    document.querySelectorAll('#missing-barcode-list [data-generate-barcode]').forEach(button => {
      button.disabled = false;
    });
    updateSelectionControls();
  }
}

function updateGenerateButton() {
  const button = document.getElementById('btn-generate-selected-barcodes');
  if (button && !loading) button.disabled = selectedProductIds.size === 0;
}

function updateSelectionControls(products = filterProductsWithoutBarcode(
  missingProducts,
  document.getElementById('search-missing-barcodes')?.value
)) {
  const selectButton = document.getElementById('btn-select-missing-barcodes');
  if (selectButton) {
    const hasUnselected = products.some(product => !selectedProductIds.has(String(product.id)));
    selectButton.textContent = hasUnselected ? 'Pilih semua hasil' : 'Batalkan pilihan hasil';
  }
  updateGenerateButton();
}

export function initBarcodeSettings() {
  const list = document.getElementById('missing-barcode-list');
  if (!list || list.dataset.barcodeBound === 'true') return;
  list.dataset.barcodeBound = 'true';

  document.querySelector('.settings-tabs')?.addEventListener('click', event => {
    if (event.target.closest('[data-tab="barcode"]')) loadMissingProducts();
  });
  document.getElementById('btn-refresh-missing-barcodes')?.addEventListener('click', loadMissingProducts);
  document.getElementById('search-missing-barcodes')?.addEventListener('input', renderMissingProducts);
  document.getElementById('btn-select-missing-barcodes')?.addEventListener('click', event => {
    const filteredProducts = filterProductsWithoutBarcode(
      missingProducts,
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
    const button = event.target.closest('[data-generate-barcode]');
    if (!button) return;
    const product = missingProducts.find(item => String(item.id) === button.dataset.generateBarcode);
    if (product) generateAndPrint([product], button);
  });
  document.getElementById('btn-generate-selected-barcodes')?.addEventListener('click', event => {
    const selected = missingProducts.filter(product => selectedProductIds.has(String(product.id)));
    if (selected.length) generateAndPrint(selected, event.currentTarget);
  });
}
