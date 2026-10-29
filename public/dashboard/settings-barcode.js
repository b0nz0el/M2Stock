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
    widthMm: 50,
    heightMm: 30,
    columns: 1,
    css: `
      @page { size: 50mm 30mm; margin: 0; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { width: 100%; margin: 0; padding: 0; color: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #fff; }
      .barcode-sheet { display: block; width: 100%; max-width: 50mm; margin: 0 auto; }
      .barcode-label { width: 100%; height: 30mm; max-height: 30mm; padding: 0.5mm 1mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; box-sizing: border-box; text-align: center; page-break-inside: avoid; break-inside: avoid; page-break-after: always; break-after: page; }
      .barcode-label:last-child { page-break-after: auto; break-after: auto; }
      .product-name { width: 100%; max-height: 5.5mm; margin: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; font-size: 8.5pt; font-weight: 700; line-height: 1.15; }
      .barcode { width: 100%; max-width: 48mm; height: 18mm; display: block; margin: 0 auto; }
      .product-price { width: 100%; margin: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; font-size: 9.5pt; font-weight: 800; line-height: 1.15; }
    `
  },
  '40x30_double': {
    id: '40x30_double',
    name: '40 × 30 mm (2 Kolom - Printer 80mm)',
    widthMm: 80,
    heightMm: 30,
    columns: 2,
    css: `
      @page { size: 80mm 30mm; margin: 0; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { width: 100%; margin: 0; padding: 0; color: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #fff; }
      .barcode-sheet { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 1mm; width: 100%; max-width: 80mm; height: 30mm; max-height: 30mm; margin: 0 auto; padding: 0.5mm 0.5mm; align-items: center; justify-content: center; overflow: hidden; page-break-inside: avoid; break-inside: avoid; page-break-after: always; break-after: page; }
      .barcode-sheet:last-child { page-break-after: auto; break-after: auto; }
      .barcode-label { width: 100%; height: 29mm; max-height: 29mm; padding: 0.2mm 0.5mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; box-sizing: border-box; text-align: center; }
      .product-name { width: 100%; max-height: 5.5mm; margin: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; font-size: 8pt; font-weight: 700; line-height: 1.15; }
      .barcode { width: 100%; max-width: 39mm; height: 18mm; display: block; margin: 0 auto; }
      .product-price { width: 100%; margin: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; font-size: 9pt; font-weight: 800; line-height: 1.15; }
    `
  },
  '40x30_single': {
    id: '40x30_single',
    name: '40 × 30 mm (1 Kolom)',
    widthMm: 40,
    heightMm: 30,
    columns: 1,
    css: `
      @page { size: 40mm 30mm; margin: 0; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { width: 100%; margin: 0; padding: 0; color: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #fff; }
      .barcode-sheet { display: block; width: 100%; max-width: 40mm; margin: 0 auto; }
      .barcode-label { width: 100%; height: 30mm; max-height: 30mm; padding: 0.5mm 1mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; box-sizing: border-box; text-align: center; page-break-inside: avoid; break-inside: avoid; page-break-after: always; break-after: page; }
      .barcode-label:last-child { page-break-after: auto; break-after: auto; }
      .product-name { width: 100%; max-height: 5.5mm; margin: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; font-size: 8pt; font-weight: 700; line-height: 1.15; }
      .barcode { width: 100%; max-width: 38.5mm; height: 18mm; display: block; margin: 0 auto; }
      .product-price { width: 100%; margin: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; font-size: 9pt; font-weight: 800; line-height: 1.15; }
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

  const shareButton = document.getElementById('btn-share-pdf-barcodes');
  if (selectButton) selectButton.disabled = filteredProducts.length === 0;
  generateButton.disabled = selectedProductIds.size === 0;
  if (shareButton) shareButton.disabled = selectedProductIds.size === 0;

  // Update text tombol batch
  const span = generateButton.querySelector('span') || generateButton;
  const spanShare = shareButton?.querySelector('span') || shareButton;
  if (activeFilterMode === 'missing') {
    span.textContent = 'Cetak browser';
    if (spanShare) spanShare.textContent = 'Buat & Bagikan PDF';
  } else {
    span.textContent = 'Cetak browser';
    if (spanShare) spanShare.textContent = 'Bagikan PDF (Thermal 80mm)';
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

    const btnGroup = document.createElement('div');
    btnGroup.className = 'shrink-0 flex items-center gap-1.5 flex-wrap sm:flex-nowrap';

    if (hasBarcode) {
      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.dataset.action = 'edit';
      shareBtn.dataset.shareBarcode = String(product.id);
      shareBtn.className = 'rounded-lg border border-[#34C759]/30 bg-[#34C759]/10 hover:bg-[#34C759]/20 text-[#34C759] px-2.5 py-1.5 text-xs font-semibold transition flex items-center gap-1 cursor-pointer active:scale-95';
      shareBtn.innerHTML = '<i data-lucide="share-2" class="w-3.5 h-3.5"></i><span>Bagikan PDF</span>';
      shareBtn.setAttribute('aria-label', `Bagikan PDF label barcode untuk ${product.name || 'produk'}`);

      const printBtn = document.createElement('button');
      printBtn.type = 'button';
      printBtn.dataset.action = 'edit';
      printBtn.dataset.printBarcode = String(product.id);
      printBtn.className = 'rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white px-2.5 py-1.5 text-xs font-semibold transition flex items-center gap-1 cursor-pointer active:scale-95';
      printBtn.innerHTML = '<span>Cetak</span>';
      printBtn.setAttribute('aria-label', `Cetak barcode label untuk ${product.name || 'produk'}`);

      btnGroup.append(shareBtn, printBtn);
    } else {
      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.dataset.action = 'edit';
      shareBtn.dataset.shareBarcode = String(product.id);
      shareBtn.className = 'rounded-lg border border-[#34C759]/30 bg-[#34C759]/10 hover:bg-[#34C759]/20 text-[#34C759] px-2.5 py-1.5 text-xs font-semibold transition flex items-center gap-1 cursor-pointer active:scale-95';
      shareBtn.innerHTML = '<i data-lucide="share-2" class="w-3.5 h-3.5"></i><span>PDF</span>';
      shareBtn.setAttribute('aria-label', `Buat barcode dan bagikan PDF untuk ${product.name || 'produk'}`);

      const genBtn = document.createElement('button');
      genBtn.type = 'button';
      genBtn.dataset.action = 'edit';
      genBtn.dataset.generateBarcode = String(product.id);
      genBtn.className = 'rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition flex items-center gap-1 cursor-pointer active:scale-95';
      genBtn.innerHTML = '<span>Buat</span>';
      genBtn.setAttribute('aria-label', `Buat barcode untuk ${product.name || 'produk'}`);

      btnGroup.append(shareBtn, genBtn);
    }

    row.append(checkbox, details, btnGroup);
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
    <html lang="id"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Label Barcode Produk</title>
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
    width: isCompact ? 1.85 : 2.0,
    height: isCompact ? 58 : 65,
    displayValue: true,
    fontSize: isCompact ? 11 : 12,
    textMargin: 1,
    margin: 0
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
        // Efisiensi kertas printer 80mm: jika kolom kanan kosong, cetak ulang barcode produk yang sama di sampingnya sehingga ada 2 barcode
        sheet.appendChild(createSingleLabelElement(doc, products[i], JsBarcode, isCompact));
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
  }, 450);
}

export function buildPdfFromJpegs(pages, widthMm, heightMm) {
  const widthPt = Number(((widthMm / 25.4) * 72).toFixed(2));
  const heightPt = Number(((heightMm / 25.4) * 72).toFixed(2));

  const chunks = [];
  const offsets = [];
  let currentOffset = 0;

  function write(chunk) {
    if (typeof chunk === 'string') {
      const len = chunk.length;
      const buf = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        buf[i] = chunk.charCodeAt(i) & 0xff;
      }
      chunks.push(buf);
      currentOffset += len;
    } else if (chunk instanceof Uint8Array) {
      chunks.push(chunk);
      currentOffset += chunk.length;
    }
  }

  write('%PDF-1.4\n%\xff\xff\xff\xff\n');

  const numPages = pages.length;
  const pageObjIds = [];
  let nextId = 3;

  for (let i = 0; i < numPages; i++) {
    pageObjIds.push({
      pageId: nextId++,
      contentId: nextId++,
      imageId: nextId++
    });
  }

  const totalObjs = nextId;

  // Obj 1: Catalog
  offsets[1] = currentOffset;
  write('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Obj 2: Pages
  offsets[2] = currentOffset;
  const kidsStr = pageObjIds.map(p => `${p.pageId} 0 R`).join(' ');
  write(`2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${numPages} >>\nendobj\n`);

  for (let i = 0; i < numPages; i++) {
    const { pageId, contentId, imageId } = pageObjIds[i];
    const { jpegBytes, widthPx, heightPx } = pages[i];

    offsets[pageId] = currentOffset;
    write(
      `${pageId} 0 obj\n` +
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] ` +
      `/Contents ${contentId} 0 R ` +
      `/Resources << /ProcSet [/PDF /ImageC] /XObject << /Im${imageId} ${imageId} 0 R >> >> >>\n` +
      `endobj\n`
    );

    offsets[contentId] = currentOffset;
    const streamContent = `q\n${widthPt} 0 0 ${heightPt} 0 0 cm\n/Im${imageId} Do\nQ\n`;
    write(
      `${contentId} 0 obj\n` +
      `<< /Length ${streamContent.length} >>\n` +
      `stream\n${streamContent}endstream\nendobj\n`
    );

    offsets[imageId] = currentOffset;
    write(
      `${imageId} 0 obj\n` +
      `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
      `/Length ${jpegBytes.length} >>\n` +
      `stream\n`
    );
    write(jpegBytes);
    write('\nendstream\nendobj\n');
  }

  const xrefOffset = currentOffset;
  write(`xref\n0 ${totalObjs}\n0000000000 65535 f \n`);
  for (let i = 1; i < totalObjs; i++) {
    const offStr = String(offsets[i]).padStart(10, '0');
    write(`${offStr} 00000 n \n`);
  }

  write(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  let totalLength = 0;
  for (const c of chunks) totalLength += c.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const c of chunks) {
    result.set(c, pos);
    pos += c.length;
  }
  return result;
}

export async function createBarcodePdf(products, layoutKey = currentLayout, JsBarcode) {
  const layout = BARCODE_LAYOUTS[layoutKey] || BARCODE_LAYOUTS['40x30_double'];
  const isDoubleColumn = layout.columns === 2;
  const widthMm = layout.widthMm || (isDoubleColumn ? 80 : 50);
  const heightMm = layout.heightMm || 30;

  // Skala: 12 px per mm (~300 DPI) untuk hasil cetak thermal tajam
  const scale = 12;
  const pagePxW = Math.round(widthMm * scale);
  const pagePxH = Math.round(heightMm * scale);

  const pages = [];

  function drawSingleLabel(ctx, product, x, y, w, h) {
    const centerX = x + w / 2;

    // 1. Nama Produk (Atas)
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

    let nameText = String(product.name || 'Produk');
    const maxTextW = w - 16;
    if (ctx.measureText && ctx.measureText(nameText).width > maxTextW) {
      while (nameText.length > 3 && ctx.measureText(nameText + '...').width > maxTextW) {
        nameText = nameText.slice(0, -1);
      }
      nameText += '...';
    }
    ctx.fillText(nameText, centerX, y + 10);

    // 2. Barcode Batang (Tengah)
    const bcCanvas = document.createElement('canvas');
    try {
      if (typeof JsBarcode === 'function') {
        JsBarcode(bcCanvas, String(product.barcode || ''), {
          format: 'CODE128',
          lineColor: '#000000',
          width: isDoubleColumn ? 2.6 : 3.0,
          height: 130,
          displayValue: true,
          fontSize: 22,
          font: 'Arial, sans-serif',
          textMargin: 3,
          margin: 0
        });

        if (bcCanvas.width > 0 && bcCanvas.height > 0 && typeof ctx.drawImage === 'function') {
          const targetW = w - 12;
          const targetH = 205;
          const s = Math.min(targetW / bcCanvas.width, targetH / bcCanvas.height, 1.25);
          const finalW = Math.round(bcCanvas.width * s);
          const finalH = Math.round(bcCanvas.height * s);
          const drawX = x + Math.round((w - finalW) / 2);
          const drawY = y + 42 + Math.round((targetH - finalH) / 2);
          ctx.drawImage(bcCanvas, drawX, drawY, finalW, finalH);
        }
      }
    } catch (e) {
      console.warn('Gagal render JsBarcode canvas:', e);
    }

    // 3. Harga Jual (Bawah)
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(formatCurrency(product.sell_price), centerX, y + h - 8);
  }

  function getJpegBytesFromCanvas(canvas) {
    let dataUrl = '';
    try {
      dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    } catch (_) {}
    if (!dataUrl || dataUrl === 'data:image/jpeg;base64,') {
      dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    }
    const base64 = dataUrl.split(',')[1];
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  if (isDoubleColumn) {
    for (let i = 0; i < products.length; i += 2) {
      const canvas = document.createElement('canvas');
      canvas.width = pagePxW;
      canvas.height = pagePxH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (typeof ctx.fillRect === 'function') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, pagePxW, pagePxH);
        }
        const colW = Math.round(pagePxW / 2);
        const prod1 = products[i];
        const prod2 = products[i + 1] || prod1; // duplikasi jika ganjil untuk efisiensi kertas roll 80mm

        drawSingleLabel(ctx, prod1, 0, 0, colW, pagePxH);
        drawSingleLabel(ctx, prod2, colW, 0, colW, pagePxH);
      }
      const jpegBytes = getJpegBytesFromCanvas(canvas);
      pages.push({ jpegBytes, widthPx: pagePxW, heightPx: pagePxH });
    }
  } else {
    for (const product of products) {
      const canvas = document.createElement('canvas');
      canvas.width = pagePxW;
      canvas.height = pagePxH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (typeof ctx.fillRect === 'function') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, pagePxW, pagePxH);
        }
        drawSingleLabel(ctx, product, 0, 0, pagePxW, pagePxH);
      }
      const jpegBytes = getJpegBytesFromCanvas(canvas);
      pages.push({ jpegBytes, widthPx: pagePxW, heightPx: pagePxH });
    }
  }

  const pdfBytes = buildPdfFromJpegs(pages, widthMm, heightMm);
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const filename = `Label-Barcode-${widthMm}mm.pdf`;
  return { blob, filename, byteLength: pdfBytes.length, pageCount: pages.length };
}

export async function shareOrDownloadPdf(blob, filename = 'Label-Barcode-80mm.pdf') {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const canShareFiles = typeof navigator.canShare === 'function'
      ? navigator.canShare({ files: [file] })
      : false;
    if (canShareFiles) {
      try {
        await navigator.share({
          title: 'Label Barcode Produk',
          text: 'Cetak label barcode via Printer Thermal (PrinterJTM / Bluetooth Print)',
          files: [file]
        });
        return { method: 'share', success: true };
      } catch (shareErr) {
        if (shareErr.name === 'AbortError') {
          return { method: 'share', canceled: true };
        }
        console.warn('Navigator share error, falling back to download/open:', shareErr);
      }
    }
  }

  // Fallback: unduh file & buka URL blob
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { method: 'download', success: true };
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

export async function generateAndPrint(products, trigger, layoutKey = currentLayout, mode = 'print') {
  if (processing) return;
  if (!products.length) {
    showMessage('Pilih minimal satu produk.');
    return;
  }
  if (products.length > 200) {
    showMessage('Pilih maksimal 200 produk untuk satu kali cetak label.');
    return;
  }

  let printWindow = null;
  if (mode === 'print') {
    try {
      printWindow = openPrintWindow(layoutKey);
    } catch (error) {
      showMessage(error.message);
      return;
    }
  }

  processing = true;
  if (trigger) trigger.disabled = true;
  document.querySelectorAll('#missing-barcode-list button').forEach(button => {
    button.disabled = true;
  });
  const refreshButton = document.getElementById('btn-refresh-missing-barcodes');
  const shareBtn = document.getElementById('btn-share-pdf-barcodes');
  const generateBtn = document.getElementById('btn-generate-selected-barcodes');
  if (refreshButton) refreshButton.disabled = true;
  if (shareBtn) shareBtn.disabled = true;
  if (generateBtn) generateBtn.disabled = true;

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

    if (mode === 'pdf') {
      const { blob, filename } = await createBarcodePdf(toPrint, layoutKey, JsBarcode);
      await shareOrDownloadPdf(blob, filename);
      const msg = newlyCreated > 0
        ? `${newlyCreated} barcode baru dibuat dan PDF label siap dibagikan ke printer.`
        : `PDF ${toPrint.length} barcode berhasil dibuat untuk printer thermal.`;
      showMessage(msg, 'success');
    } else {
      renderPrintLabels(printWindow, toPrint, JsBarcode, layoutKey);
      const msg = newlyCreated > 0
        ? `${newlyCreated} barcode baru dibuat dan total ${toPrint.length} label siap dicetak.`
        : `${toPrint.length} barcode siap dicetak.`;
      showMessage(msg, 'success');
    }
    await loadMissingProducts();
  } catch (error) {
    console.error('Gagal memproses barcode produk:', error);
    if (printWindow) printWindow.close();
    showMessage(error.message || 'Gagal memproses barcode.');
  } finally {
    processing = false;
    if (refreshButton) refreshButton.disabled = false;
    document.querySelectorAll('#missing-barcode-list button').forEach(button => {
      button.disabled = false;
    });
    updateSelectionControls();
  }
}

export async function printSingleProductBarcode(productOrId, layoutKey = currentLayout, mode = 'print') {
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

  await generateAndPrint([targetProduct], null, layoutKey, mode);
}

export async function shareSingleProductBarcodePdf(productOrId, layoutKey = currentLayout) {
  return printSingleProductBarcode(productOrId, layoutKey, 'pdf');
}

function updateGenerateButton() {
  const button = document.getElementById('btn-generate-selected-barcodes');
  const shareBtn = document.getElementById('btn-share-pdf-barcodes');
  const hasSelection = selectedProductIds.size > 0 && !loading;
  if (button) button.disabled = !hasSelection;
  if (shareBtn) shareBtn.disabled = !hasSelection;
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
    window.shareSingleProductBarcodePdf = shareSingleProductBarcodePdf;
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
    const shareButton = event.target.closest('[data-share-barcode]');
    if (shareButton) {
      const pool = getActiveProductPool();
      const product = pool.find(item => String(item.id) === shareButton.dataset.shareBarcode);
      if (product) generateAndPrint([product], shareButton, currentLayout, 'pdf');
      return;
    }

    const genButton = event.target.closest('[data-generate-barcode]');
    if (genButton) {
      const pool = getActiveProductPool();
      const product = pool.find(item => String(item.id) === genButton.dataset.generateBarcode);
      if (product) generateAndPrint([product], genButton, currentLayout, 'print');
      return;
    }

    const printButton = event.target.closest('[data-print-barcode]');
    if (printButton) {
      const pool = getActiveProductPool();
      const product = pool.find(item => String(item.id) === printButton.dataset.printBarcode);
      if (product) generateAndPrint([product], printButton, currentLayout, 'print');
    }
  });

  document.getElementById('btn-share-pdf-barcodes')?.addEventListener('click', event => {
    const pool = getActiveProductPool();
    const selected = pool.filter(product => selectedProductIds.has(String(product.id)));
    if (selected.length) generateAndPrint(selected, event.currentTarget, currentLayout, 'pdf');
  });

  document.getElementById('btn-generate-selected-barcodes')?.addEventListener('click', event => {
    const pool = getActiveProductPool();
    const selected = pool.filter(product => selectedProductIds.has(String(product.id)));
    if (selected.length) generateAndPrint(selected, event.currentTarget, currentLayout, 'print');
  });
}
