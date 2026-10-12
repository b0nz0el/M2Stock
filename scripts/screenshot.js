const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    browser = await chromium.launch({ channel: 'chrome' });
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const targetPath = process.argv[2];
  const targetOut = process.argv[3];

  if (targetPath && targetOut) {
    await page.goto('http://localhost:3000' + targetPath);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: targetOut, fullPage: false });
    console.log('Captured: ' + targetOut);
  } else {
    const pages = [
      ['dashboard', '/dashboard/'],
      ['items', '/dashboard/items/'],
      ['in', '/dashboard/in/'],
      ['out', '/dashboard/out/'],
      ['po', '/dashboard/po/'],
      ['return', '/dashboard/return/'],
      ['suppliers', '/dashboard/suppliers/'],
      ['customers', '/dashboard/customers/'],
      ['cash', '/dashboard/cash/'],
      ['debt', '/dashboard/debt/'],
    ];
    for (const [name, path] of pages) {
      await page.goto('http://localhost:3000' + path);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `visual-baseline/${name}-after.png`, fullPage: false });
      console.log('Captured: ' + name);
    }
  }
  await browser.close();
})();
