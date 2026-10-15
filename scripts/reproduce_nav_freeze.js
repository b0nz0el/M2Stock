import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function run() {
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
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  const futureExpiresAt = Math.floor(Date.now() / 1000) + 86400 * 365;
  const mockOwnerUser = {
    id: '00000000-0000-0000-0000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'owner@aquastock.pro',
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

  await page.route('**/rest/v1/cash_flow*', route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify([{
        id: 'cf-001', tanggal: '2026-10-15', keterangan: 'Penjualan Test', kategori: 'Penjualan', metode: 'Cash', pemasukan: 100000, pengeluaran: 0
      }])
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

  // Login session setup
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

  console.log('--- Step 1: Navigate to /dashboard/cash/ ---');
  await page.goto('http://localhost:8000/dashboard/cash/', { waitUntil: 'networkidle' });
  console.log('Current URL:', page.url());

  // Check if app.js is present
  const hasAppJs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script')).some(s => s.src && s.src.includes('app.js'));
  });
  console.log('Is app.js loaded on /dashboard/cash/?', hasAppJs);

  // Check bottom nav "Menu" button onclick
  const menuBottomBtn = await page.$('.bottom-nav-item[data-tab="menu"]');
  const bottomMenuOnclick = menuBottomBtn ? await menuBottomBtn.getAttribute('onclick') : null;
  console.log('Bottom nav Menu button onclick attribute:', bottomMenuOnclick);

  // Attempt click on sidebar menu item "Dashboard"
  console.log('--- Step 2: Click sidebar menu item Dashboard ---');
  const dashboardItem = await page.$('app-sidebar .menu-item[data-page="dashboard"]');
  if (dashboardItem) {
    await dashboardItem.click();
    await page.waitForTimeout(1000);
    console.log('URL after clicking sidebar Dashboard:', page.url());
    console.log('Did URL change?', page.url() !== 'http://localhost:8000/dashboard/cash/' ? 'YES' : 'NO (FAILED - STUCK ON CASH)');
  }

  // Attempt click on sidebar menu item "Barang"
  console.log('--- Step 3: Click sidebar menu item Barang (items) ---');
  const itemsItem = await page.$('app-sidebar .menu-item[data-page="items"]');
  if (itemsItem) {
    await itemsItem.click();
    await page.waitForTimeout(1000);
    console.log('URL after clicking sidebar Barang:', page.url());
    console.log('Did URL change?', page.url() !== 'http://localhost:8000/dashboard/cash/' ? 'YES' : 'NO (FAILED - STUCK ON CASH)');
  }

  // Take screenshot of failure state
  await page.screenshot({ path: path.join(outputDir, 'verify_freeze_before.png'), fullPage: true });
  console.log('Saved before reproduction screenshot to verification/bugfix-nav/verify_freeze_before.png');

  await browser.close();
}

run().catch(console.error);
