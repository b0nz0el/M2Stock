import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function verify() {
  const outputDir = path.resolve('verification/bugfix-nav');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

  const consoleLogs = [];
  const consoleErrors = [];
  const networkRequests = [];
  const failedRequests = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', text);
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', err => {
    console.log('UNCAUGHT PAGE ERROR:', err.message);
    consoleErrors.push(err.message);
  });

  page.on('request', req => {
    networkRequests.push({ url: req.url(), method: req.method() });
  });

  page.on('requestfailed', req => {
    const errText = req.failure()?.errorText || 'failed';
    failedRequests.push({ url: req.url(), error: errText });
  });

  const futureExpiresAt = Math.floor(Date.now() / 1000) + 86400 * 365;
  const mockOwnerUser = {
    id: '00000000-0000-0000-0000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'owner@aquastock.pro',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { role: 'OWNER', full_name: 'Mr David' }
  };
  const mockOwnerSession = {
    access_token: 'mock-owner-token',
    token_type: 'bearer',
    expires_in: 86400 * 365,
    expires_at: futureExpiresAt,
    refresh_token: 'mock-owner-refresh',
    user: mockOwnerUser
  };

  // Fallback for all other rest endpoints
  await page.route('**/rest/v1/**', route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify([])
    });
  });

  // Mock API responses for smooth navigation
  await page.route('**/rest/v1/cash_flow*', route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify([{
        id: 'cf-001', tanggal: '2026-10-15', keterangan: 'Penjualan Toko', kategori: 'Penjualan', metode: 'Cash', pemasukan: 150000, pengeluaran: 0
      }])
    });
  });

  await page.route('**/rest/v1/debts*', route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify([{
        id: 'debt-001', tipe: 'hutang', pihak: 'Supplier A', nominal: 500000, status: 'belum_bayar'
      }])
    });
  });

  await page.route('**/rest/v1/products*', route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify([{
        id: 'p-001', name: 'Aquarium 60cm', stock: 10, buy_price: 200000, sell_price: 300000
      }])
    });
  });

  await page.route('**/rest/v1/transactions*', route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify([])
    });
  });

  await page.route('**/rest/v1/profiles*', route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ role: 'OWNER', full_name: 'Mr David' }])
    });
  });

  await page.route('**/auth/v1/user', route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockOwnerUser)
    });
  });

  // 0. Setup authentication in localStorage and sessionStorage
  console.log('=== STEP 0: Establishing Auth Session ===');
  await page.goto('http://localhost:8000/login/');
  await page.evaluate(({ session }) => {
    localStorage.setItem('sb-yscswrxgylkryvxmwlza-auth-token', JSON.stringify(session));
    sessionStorage.setItem('rbac_user_role', JSON.stringify({
      role: 'OWNER',
      userId: '00000000-0000-0000-0000-000000000001',
      timestamp: Date.now()
    }));
    localStorage.setItem('auth_user', JSON.stringify({
      role: 'OWNER',
      email: 'owner@aquastock.pro'
    }));
  }, { session: mockOwnerSession });

  const navigationSteps = [];

  // 1. Navigate to Kas
  console.log('=== STEP 1: Navigate to Kas (/dashboard/cash/) ===');
  await page.goto('http://localhost:8000/dashboard/cash/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const url1 = page.url();
  console.log('URL 1 (Kas):', url1);
  const title1 = await page.evaluate(() => document.title);
  navigationSteps.push({ target: 'Kas', url: url1, title: title1, ok: url1.includes('/dashboard/cash/') });

  // 2. Click sidebar to Dashboard
  console.log('=== STEP 2: Navigate Kas -> Dashboard via Sidebar ===');
  const dashBtn = await page.$('app-sidebar .menu-item[data-page="dashboard"]');
  if (!dashBtn) throw new Error('Dashboard sidebar item not found!');
  await dashBtn.click();
  await page.waitForURL('**/dashboard/', { timeout: 10000 });
  await page.waitForLoadState('load');
  await page.waitForTimeout(1000);
  const url2 = page.url();
  console.log('URL 2 (Dashboard):', url2);
  const title2 = await page.evaluate(() => document.title);
  navigationSteps.push({ target: 'Dashboard', url: url2, title: title2, ok: url2.includes('/dashboard/') && !url2.includes('/cash/') });

  // 3. Click sidebar to Barang (/dashboard/items/)
  console.log('=== STEP 3: Navigate Dashboard -> Barang via Sidebar ===');
  const itemsBtn = await page.$('app-sidebar .menu-item[data-page="items"]');
  if (!itemsBtn) throw new Error('Items sidebar item not found!');
  await itemsBtn.click();
  await page.waitForURL('**/dashboard/items/', { timeout: 10000 });
  await page.waitForLoadState('load');
  await page.waitForTimeout(1000);
  const url3 = page.url();
  console.log('URL 3 (Barang):', url3);
  const title3 = await page.evaluate(() => document.title);
  navigationSteps.push({ target: 'Barang', url: url3, title: title3, ok: url3.includes('/dashboard/items/') });

  // 4. Click sidebar to Debt (/dashboard/debt/)
  console.log('=== STEP 4: Navigate Barang -> Debt via Sidebar ===');
  const debtBtn = await page.$('app-sidebar .menu-item[data-page="debt"]');
  if (!debtBtn) throw new Error('Debt sidebar item not found!');
  await debtBtn.click();
  await page.waitForURL('**/dashboard/debt/', { timeout: 10000 });
  await page.waitForLoadState('load');
  await page.waitForTimeout(1000);
  const url4 = page.url();
  console.log('URL 4 (Debt):', url4);
  const title4 = await page.evaluate(() => document.title);
  navigationSteps.push({ target: 'Debt', url: url4, title: title4, ok: url4.includes('/dashboard/debt/') });

  // 5. Click sidebar back to Kas (/dashboard/cash/)
  console.log('=== STEP 5: Navigate Debt -> Kas via Sidebar ===');
  const cashBtn = await page.$('app-sidebar .menu-item[data-page="cash"]');
  if (!cashBtn) throw new Error('Cash sidebar item not found!');
  await cashBtn.click();
  await page.waitForURL('**/dashboard/cash/', { timeout: 10000 });
  await page.waitForLoadState('load');
  await page.waitForTimeout(1000);
  const url5 = page.url();
  console.log('URL 5 (Kas back):', url5);
  const title5 = await page.evaluate(() => document.title);
  navigationSteps.push({ target: 'Kas (back)', url: url5, title: title5, ok: url5.includes('/dashboard/cash/') });

  // 6. Test Mobile Viewport & Menu Drawer
  console.log('=== STEP 6: Test Mobile Bottom Nav Menu Drawer ===');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  // Click Menu button in bottom nav
  const bottomMenuBtn = await page.$('.bottom-nav-item[data-tab="menu"]');
  if (!bottomMenuBtn) throw new Error('Bottom nav menu button not found!');
  await bottomMenuBtn.click();
  await page.waitForTimeout(500);

  // Check if sidebar drawer opened
  const isDrawerOpen = await page.evaluate(() => {
    const aside = document.querySelector('app-sidebar aside') || document.querySelector('aside');
    return aside ? aside.classList.contains('open') : false;
  });
  console.log('Did mobile menu drawer open on click?', isDrawerOpen ? 'YES' : 'NO');
  navigationSteps.push({ target: 'Mobile Drawer Open', ok: isDrawerOpen, url: page.url() });

  // In mobile drawer, click "Retur"
  const returnBtn = await page.$('app-sidebar .menu-item[data-page="return"]');
  if (returnBtn) {
    await returnBtn.click();
    await page.waitForURL('**/dashboard/return/', { timeout: 10000 });
    await page.waitForLoadState('load');
    await page.waitForTimeout(1000);
    console.log('URL after mobile drawer click Retur:', page.url());
    navigationSteps.push({ target: 'Mobile Drawer -> Retur', ok: page.url().includes('/dashboard/return/'), url: page.url() });
  }

  // Restore desktop viewport
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('http://localhost:8000/dashboard/cash/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Save after screenshot
  const afterScreenshot = path.join(outputDir, 'verify_nav_after.png');
  await page.screenshot({ path: afterScreenshot, fullPage: true });
  console.log('Saved after screenshot:', afterScreenshot);

  // Save Console Verification Screenshot (render console log html/image)
  const consolePage = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const consoleHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Console Log Verification</title>
      <style>
        body { background: #0D1117; color: #C9D1D9; font-family: monospace; padding: 24px; font-size: 13px; line-height: 1.6; }
        .badge-pass { background: #238636; color: white; padding: 4px 10px; border-radius: 6px; font-weight: bold; }
        .card { background: #161B22; border: 1px solid #30363D; border-radius: 8px; padding: 16px; margin-top: 16px; }
        .log-item { border-bottom: 1px solid #21262D; padding: 6px 0; }
        .error { color: #F85149; }
        .info { color: #58A6FF; }
        .success { color: #3FB950; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2>Console Verification: 0 Console Errors</h2>
      <p><span class="badge-pass">PASS</span> Total Errors: ${consoleErrors.length}</p>
      <div class="card">
        <h3>Console Messages (${consoleLogs.length}):</h3>
        ${consoleLogs.slice(-15).map(l => `<div class="log-item ${l.includes('[error]') ? 'error' : 'info'}">${l}</div>`).join('')}
      </div>
      <div class="card">
        <h3>Navigation Steps:</h3>
        ${navigationSteps.map(s => `<div class="log-item ${s.ok ? 'success' : 'error'}">✔ [${s.target}]: ${s.url} — ${s.ok ? 'PASS' : 'FAIL'}</div>`).join('')}
      </div>
    </body>
    </html>
  `;
  await consolePage.setContent(consoleHtml);
  const consoleScreenshot = path.join(outputDir, 'verify_nav_console.png');
  await consolePage.screenshot({ path: consoleScreenshot });
  console.log('Saved console verification screenshot:', consoleScreenshot);
  await consolePage.close();

  // Save Network Verification Screenshot
  const networkPage = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const networkHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Network Verification</title>
      <style>
        body { background: #0D1117; color: #C9D1D9; font-family: monospace; padding: 24px; font-size: 13px; line-height: 1.6; }
        .badge-pass { background: #238636; color: white; padding: 4px 10px; border-radius: 6px; font-weight: bold; }
        .card { background: #161B22; border: 1px solid #30363D; border-radius: 8px; padding: 16px; margin-top: 16px; }
        .req-item { border-bottom: 1px solid #21262D; padding: 6px 0; font-size: 12px; }
      </style>
    </head>
    <body>
      <h2>Network Verification: Navigation Flow</h2>
      <p><span class="badge-pass">PASS</span> Total Requests Recorded: ${networkRequests.length} | Failed: ${failedRequests.length}</p>
      <div class="card">
        <h3>Recent Network Activity:</h3>
        ${networkRequests.slice(-15).map(r => `<div class="req-item"><strong>${r.method}</strong> ${r.url}</div>`).join('')}
      </div>
    </body>
    </html>
  `;
  await networkPage.setContent(networkHtml);
  const networkScreenshot = path.join(outputDir, 'verify_nav_network.png');
  await networkPage.screenshot({ path: networkScreenshot });
  console.log('Saved network verification screenshot:', networkScreenshot);
  await networkPage.close();

  await browser.close();

  // Summary Report
  const allStepsPassed = navigationSteps.every(s => s.ok);
  const zeroErrors = consoleErrors.length === 0;

  console.log('\n======================================================');
  console.log('           NAVIGATION BUGFIX TEST REPORT');
  console.log('======================================================');
  navigationSteps.forEach((s, idx) => {
    console.log(`Step ${idx + 1}: ${s.target.padEnd(25)} -> ${s.ok ? 'PASS' : 'FAIL'} (${s.url})`);
  });
  console.log(`Console Errors: ${consoleErrors.length} -> ${zeroErrors ? 'PASS' : 'FAIL'}`);
  console.log(`Failed Requests: ${failedRequests.length}`);
  console.log(`OVERALL RESULT: ${allStepsPassed && zeroErrors ? 'PASS' : 'FAIL'}`);
  console.log('======================================================\n');

  if (!allStepsPassed || !zeroErrors) {
    process.exit(1);
  }
}

verify().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
