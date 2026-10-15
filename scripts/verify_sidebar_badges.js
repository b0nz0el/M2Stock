import { chromium } from 'playwright';

async function verifySidebarBadges() {
  console.log('--- Starting Sidebar Badges Verification ---');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Inject dummy mock auth session so dashboard doesn't redirect to login
  await page.addInitScript(() => {
    localStorage.setItem('auth_user', JSON.stringify({
      id: 'e0676611-f7d2-4547-9247-fe03263d3ad1',
      email: 'yt.hackrandom@gmail.com',
      full_name: 'David Owner',
      role: 'OWNER'
    }));
    sessionStorage.setItem('rbac_user_role', JSON.stringify({ role: 'OWNER' }));
  });

  // 1. Kunjungi /dashboard/in/ (Barang Masuk)
  console.log('1. Mengunjungi /dashboard/in/ ...');
  await page.goto('http://localhost:8000/dashboard/in/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const itemsBadgeIn = await page.locator('#sidebar-items-badge, .menu-item[data-page="items"] span').first();
  const itemsBadgeInText = await itemsBadgeIn.innerText();
  console.log(`Badge Barang di /dashboard/in/: "${itemsBadgeInText}"`);

  if (itemsBadgeInText === '10') {
    throw new Error('FAIL: Badge Barang masih menampilkan hardcoded "10" di /dashboard/in/!');
  }
  console.log('PASS: Badge Barang bukan "10" di /dashboard/in/');

  const notifBadgeIn = await page.locator('#sidebar-notif-badge, .menu-item[data-page="notif"] span').first();
  const notifBadgeVisible = await notifBadgeIn.isVisible();
  const notifBadgeInText = await notifBadgeIn.innerText();
  console.log(`Badge Notif di /dashboard/in/: text="${notifBadgeInText}", visible=${notifBadgeVisible}`);
  if (notifBadgeInText === '3' && notifBadgeVisible) {
    throw new Error('FAIL: Badge Notifikasi masih menampilkan hardcoded "3"!');
  }
  console.log('PASS: Badge Notifikasi tidak menampilkan angka dummy "3"');

  // 2. Navigasi ke /dashboard/items/
  console.log('2. Navigasi ke /dashboard/items/ ...');
  await page.goto('http://localhost:8000/dashboard/items/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const itemsBadgeItems = await page.locator('#sidebar-items-badge, .menu-item[data-page="items"] span').first();
  const itemsBadgeItemsText = await itemsBadgeItems.innerText();
  console.log(`Badge Barang di /dashboard/items/: "${itemsBadgeItemsText}"`);

  // 3. Kembali lagi ke /dashboard/in/
  console.log('3. Kembali lagi ke /dashboard/in/ ...');
  await page.goto('http://localhost:8000/dashboard/in/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const itemsBadgeInReturn = await page.locator('#sidebar-items-badge, .menu-item[data-page="items"] span').first();
  const itemsBadgeInReturnText = await itemsBadgeInReturn.innerText();
  console.log(`Badge Barang setelah kembali ke /dashboard/in/: "${itemsBadgeInReturnText}"`);

  if (itemsBadgeInReturnText === '10') {
    throw new Error('FAIL: Badge Barang kembali menjadi "10" saat berpindah ke /dashboard/in/!');
  }
  if (itemsBadgeInReturnText !== itemsBadgeItemsText) {
    throw new Error(`FAIL: Badge tidak konsisten! items=${itemsBadgeItemsText}, in=${itemsBadgeInReturnText}`);
  }

  console.log(`SUCCESS: Badge konsisten di semua halaman (${itemsBadgeInReturnText})!`);
  await browser.close();
}

verifySidebarBadges().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
