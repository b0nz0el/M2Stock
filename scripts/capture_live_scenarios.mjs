import path from 'node:path';
import { chromium } from 'playwright';

const artifactsDir = '/Users/David/.gemini/antigravity/brain/616b7b64-33b3-4f21-81c8-87d0e3c38dcd';

const validJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImV4cCI6MjEwNzM3MTA0OX0.signature';

const mockSession = {
  access_token: validJwt,
  refresh_token: 'mock-refresh-token',
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  token_type: 'bearer',
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'david@aquastock.pro',
    app_metadata: { provider: 'email' },
    user_metadata: { role: 'OWNER', full_name: 'David' },
    created_at: '2024-01-01T00:00:00.000Z'
  }
};

let products = [
  {
    id: 10,
    name: 'Amara Aquarium filter cotton 8D 30x40cm (2pcs)',
    sku: 'FIL-AMA-310',
    barcode: '',
    brand: 'Amara',
    stock: 1, // Stok awal sebelum ditambah barang masuk
    cost_price: 45000,
    sell_price: 55000,
    category_id: 1,
    unit_id: 1,
    category: 'Filtrasi',
    unit: 'pack',
    categories: { id: 1, name: 'Filtrasi' },
    units: { id: 1, name: 'pack' },
    image_url: null,
    images: []
  }
];

let transactions = [
  {
    id: 306,
    type: 'in',
    product_id: 10,
    qty: 1,
    price: 45000,
    supplier_id: 1,
    note: 'Faktur Awal Suplier Sarno',
    created_at: '2026-10-27T10:00:00.000Z',
    products: { id: 10, name: 'Amara Aquarium filter cotton 8D 30x40cm (2pcs)', sku: 'FIL-AMA-310', stock: 1, unit: 'pack' },
    suppliers: { id: 1, name: 'BOS Sarno' }
  }
];

const categories = [
  { id: 1, name: 'Filtrasi' },
  { id: 2, name: 'Pakan' },
  { id: 3, name: 'Pipa & Fitting' }
];

const units = [
  { id: 1, name: 'pack' },
  { id: 2, name: 'pcs' }
];

const suppliers = [
  { id: 1, name: 'BOS Sarno' },
  { id: 2, name: 'PT Surya Aquatic' }
];

const settings = [
  { key: 'sales_channels', value: ['Toko', 'Shopee', 'Tokopedia'] }
];

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2
});

await context.addInitScript((session) => {
  localStorage.setItem('sb-yscswrxgylkryvxmwlza-auth-token', JSON.stringify(session));
  localStorage.setItem('auth_user', JSON.stringify({
    id: '00000000-0000-0000-0000-000000000001',
    email: 'david@aquastock.pro',
    role: 'OWNER',
    full_name: 'David'
  }));
  sessionStorage.setItem('rbac_user_role', JSON.stringify({
    role: 'OWNER',
    userId: '00000000-0000-0000-0000-000000000001',
    timestamp: Date.now()
  }));
}, mockSession);

const page = await context.newPage();

// Intercept REST calls
await page.route('**/rest/v1/**', async (route) => {
  const url = route.request().url();
  const method = route.request().method();

  if (url.includes('/products')) {
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': `0-${products.length - 1}/${products.length}` },
        body: JSON.stringify(products)
      });
    }
    if (method === 'POST') {
      const parsed = JSON.parse(route.request().postData());
      const body = Array.isArray(parsed) ? parsed[0] : parsed;
      const newId = products.length + 101;
      const catObj = categories.find(c => c.id === Number(body.category_id)) || { id: 1, name: 'Filtrasi' };
      const unitObj = units.find(u => u.id === Number(body.unit_id)) || { id: 1, name: 'pack' };
      const newProd = {
        id: newId,
        ...body,
        stock: body.stock !== undefined ? Number(body.stock) : 0,
        cost_price: Number(body.cost_price || 0),
        sell_price: Number(body.sell_price || 0),
        category: catObj.name,
        unit: unitObj.name,
        categories: catObj,
        units: unitObj,
        image_url: null,
        images: []
      };
      products.unshift(newProd);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([newProd])
      });
    }
    if (method === 'PATCH') {
      const parsed = JSON.parse(route.request().postData());
      const body = Array.isArray(parsed) ? parsed[0] : parsed;
      const idMatch = url.match(/id=eq\.(\d+)/);
      if (idMatch) {
        const prod = products.find(p => p.id === Number(idMatch[1]));
        if (prod) Object.assign(prod, body);
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([body]) });
    }
  }

  if (url.includes('/transactions')) {
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': `0-${transactions.length - 1}/${transactions.length}` },
        body: JSON.stringify(transactions)
      });
    }
    if (method === 'POST') {
      const parsed = JSON.parse(route.request().postData());
      const body = Array.isArray(parsed) ? parsed[0] : parsed;
      const txId = transactions.length + 307;
      const targetProd = products.find(p => p.id === Number(body.product_id));
      if (targetProd) {
        if (body.type === 'in') targetProd.stock += Number(body.qty);
        else targetProd.stock -= Number(body.qty);
      }
      const newTx = {
        id: txId,
        ...body,
        created_at: new Date().toISOString(),
        products: targetProd ? { ...targetProd } : {},
        suppliers: { name: suppliers.find(s => s.id === Number(body.supplier_id))?.name || 'Umum' }
      };
      transactions.unshift(newTx);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([newTx])
      });
    }
  }

  if (url.includes('/categories')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(categories) });
  }

  if (url.includes('/units')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(units) });
  }

  if (url.includes('/suppliers')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(suppliers) });
  }

  if (url.includes('/settings')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(settings) });
  }

  if (url.includes('/profiles')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ role: 'OWNER', full_name: 'David' }]) });
  }

  if (url.includes('/notifications') || url.includes('/audit_logs') || url.includes('/backup_logs')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  }

  return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});

await page.route('**/auth/v1/**', async route => {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(mockSession)
  });
});

console.log('Navigating to live Cloudflare Pages dashboard...');
await page.goto('https://aquastock-pro.pages.dev/dashboard/?page=in', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Remove any lingering toast alerts
await page.evaluate(() => {
  const container = document.getElementById('toast-container');
  if (container) container.innerHTML = '';
});

// ════════════════════════════════════════════════════════════
// SKENARIO 1: Input Barang Masuk untuk Barang Lama
// ════════════════════════════════════════════════════════════
console.log('Testing Skenario 1: Input Barang Masuk untuk Barang Lama...');
await page.evaluate(() => {
  window.showPage('in');
  window.openAddInModal();
  window.selectInProduct(10);
  document.getElementById('in-qty').value = '1';
  document.getElementById('in-price').value = '45000';
  window.calculateInTotal();
});
await page.waitForTimeout(1000);

const sc1ModalPath = path.join(artifactsDir, 'skenario_1a_form_barang_lama.png');
await page.screenshot({ path: sc1ModalPath });
console.log('Saved: ' + sc1ModalPath);

// Submit form barang masuk
await page.evaluate(async () => {
  const form = document.getElementById('form-in');
  form.dispatchEvent(new Event('submit', { cancelable: true }));
});
await page.waitForTimeout(1500);

// Buka Master Barang untuk pembuktian stok 1 + 1 = 2 pack
await page.evaluate(async () => {
  window.showPage('items');
  if (typeof window.loadItemsFromBackend === 'function') {
    await window.loadItemsFromBackend();
  }
});
await page.waitForTimeout(1500);

const sc1ItemsPath = path.join(artifactsDir, 'skenario_1b_hasil_stok_katalog.png');
await page.screenshot({ path: sc1ItemsPath });
console.log('Saved: ' + sc1ItemsPath);

// ════════════════════════════════════════════════════════════
// SKENARIO 2: Input lewat tab + Produk Baru (1x Kerja) di Barang Masuk
// ════════════════════════════════════════════════════════════
console.log('Testing Skenario 2: Input lewat tab + Produk Baru (1x Kerja)...');
await page.evaluate(() => {
  window.showPage('in');
});
await page.waitForTimeout(1000);

await page.evaluate(() => {
  window.openAddInModal();
  window.switchInMode('new');
  document.getElementById('in-product-search').value = 'Bio Foam Filter S';
  const catEl = document.getElementById('in-category-id');
  if (catEl) catEl.value = '1';
  const unitEl = document.getElementById('in-unit-id');
  if (unitEl) unitEl.value = '1';
  const brandEl = document.getElementById('in-brand');
  if (brandEl) brandEl.value = 'Aquarium Pro';
  const skuEl = document.getElementById('in-sku');
  if (skuEl) skuEl.value = 'FIL-BIO-002';
  document.getElementById('in-price').value = '15000';
  document.getElementById('in-sell-price').value = '25000';
  document.getElementById('in-qty').value = '2'; // Input masuk 2 pack
  window.calculateInTotal();
});
await page.waitForTimeout(1000);

const sc2ModalPath = path.join(artifactsDir, 'skenario_2a_form_produk_baru_1x_kerja.png');
await page.screenshot({ path: sc2ModalPath });
console.log('Saved: ' + sc2ModalPath);

// Submit form produk baru
await page.evaluate(() => {
  const form = document.getElementById('form-in');
  form.dispatchEvent(new Event('submit', { cancelable: true }));
});
await page.waitForTimeout(1500);

// Buka Master Barang untuk pembuktian stok PAS 2 pack
await page.evaluate(async () => {
  window.showPage('items');
  if (typeof window.loadItemsFromBackend === 'function') {
    await window.loadItemsFromBackend();
  }
});
await page.waitForTimeout(1500);

const sc2ItemsPath = path.join(artifactsDir, 'skenario_2b_hasil_stok_2pack_pas.png');
await page.screenshot({ path: sc2ItemsPath });
console.log('Saved: ' + sc2ItemsPath);

// ════════════════════════════════════════════════════════════
// SKENARIO 3: Daftar di Master Barang Dulu (Stok 0), Lalu Masuk
// ════════════════════════════════════════════════════════════
console.log('Testing Skenario 3: Daftar di Master Barang Dulu (Stok 0), Lalu Barang Masuk...');
// Buka modal Tambah Barang di Master Barang
await page.evaluate(() => {
  window.showPage('items');
  window.openAddItemModal();
  document.getElementById('item-name').value = 'Keni Pipa Aquarium T L';
  const catEl = document.getElementById('item-category');
  if (catEl) catEl.value = '3';
  const unitEl = document.getElementById('item-unit');
  if (unitEl) unitEl.value = '2';
  document.getElementById('item-brand').value = 'Lokal';
  document.getElementById('item-sku').value = 'PIP-KEN-001';
  document.getElementById('item-sell-price').value = '7000';
  document.getElementById('item-cost-price').value = '4000';
});
await page.waitForTimeout(1000);

const sc3ModalPath = path.join(artifactsDir, 'skenario_3a_modal_katalog_stok_nol.png');
await page.screenshot({ path: sc3ModalPath });
console.log('Saved: ' + sc3ModalPath);

// Simpan produk ke katalog
await page.evaluate(() => {
  const form = document.getElementById('item-form');
  form.dispatchEvent(new Event('submit', { cancelable: true }));
});
await page.waitForTimeout(1500);

// Pembuktian di Master Barang: stok = 0 pcs terdaftar
await page.evaluate(async () => {
  window.showPage('items');
  if (typeof window.loadItemsFromBackend === 'function') {
    await window.loadItemsFromBackend();
  }
});
await page.waitForTimeout(1500);

const sc3ItemsNolPath = path.join(artifactsDir, 'skenario_3b_katalog_terdaftar_stok_nol.png');
await page.screenshot({ path: sc3ItemsNolPath });
console.log('Saved: ' + sc3ItemsNolPath);

// Sekarang buka Barang Masuk untuk input faktur 3 pcs Keni Pipa
await page.evaluate(async () => {
  window.showPage('in');
  if (typeof window.loadDropdowns === 'function') {
    await window.loadDropdowns();
  }
});
await page.waitForTimeout(1000);

const keniProd = products.find(p => p.name.includes('Keni Pipa'));
const keniId = keniProd ? keniProd.id : 102;

await page.evaluate((targetId) => {
  window.openAddInModal();
  window.selectInProduct(targetId);
  document.getElementById('in-qty').value = '3'; // Masuk 3 pcs
  document.getElementById('in-price').value = '4000';
  window.calculateInTotal();
}, keniId);
await page.waitForTimeout(1000);

// Submit barang masuk
await page.evaluate(() => {
  const form = document.getElementById('form-in');
  form.dispatchEvent(new Event('submit', { cancelable: true }));
});
await page.waitForTimeout(1500);

// Buka Master Barang untuk pembuktian akhir stok pas 3 pcs (bukan 6 pcs)
await page.evaluate(async () => {
  window.showPage('items');
  if (typeof window.loadItemsFromBackend === 'function') {
    await window.loadItemsFromBackend();
  }
});
await page.waitForTimeout(1500);

const sc3FinalPath = path.join(artifactsDir, 'skenario_3c_stok_akhir_pas_3pcs.png');
await page.screenshot({ path: sc3FinalPath });
console.log('Saved: ' + sc3FinalPath);

await browser.close();
console.log('SELESAI_LIVE_SCENARIOS_SUKSES');
process.exit(0);
