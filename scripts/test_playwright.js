import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  const page = await browser.newPage();
  console.log('Playwright Chrome launched successfully!');
  await browser.close();
}

test().catch(err => {
  console.error('Playwright error:', err);
  process.exit(1);
});
