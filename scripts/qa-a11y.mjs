import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import axe from 'axe-core';

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:8000';
const systemChromium = [
  process.env.CHROMIUM_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].find(candidate => candidate && existsSync(candidate));

const browser = await chromium.launch({
  headless: true,
  ...(systemChromium ? { executablePath: systemChromium } : {})
});

const findings = [];
try {
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 }
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.goto(new URL('/login/', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1400);
    await page.addScriptTag({ content: axe.source });

    const result = await page.evaluate(async () => {
      const accessibility = await window.axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
        }
      });
      return {
        title: document.title,
        language: document.documentElement.lang,
        viewportWidth: document.documentElement.clientWidth,
        contentWidth: document.documentElement.scrollWidth,
        violations: accessibility.violations.map(({ id, impact, help, nodes }) => ({
          id,
          impact,
          help,
          count: nodes.length,
          targets: nodes.slice(0, 3).map(node => node.target)
        }))
      };
    });

    if (!result.title || result.language !== 'id') {
      findings.push(`${viewport.name}: judul halaman atau bahasa dokumen tidak tersedia.`);
    }
    if (result.contentWidth > result.viewportWidth + 1) {
      findings.push(`${viewport.name}: konten melebar ${result.contentWidth - result.viewportWidth}px dari viewport.`);
    }

    const email = page.locator('#email');
    const password = page.locator('#password');
    const revealPassword = page.locator('button[aria-label="Tampilkan sandi"]');
    const submit = page.locator('#login-btn');
    await email.focus();
    await page.keyboard.press('Tab');
    if (!(await password.evaluate(element => element === document.activeElement))) {
      findings.push(`${viewport.name}: urutan keyboard dari email ke kata sandi tidak benar.`);
    }
    await page.keyboard.press('Tab');
    if (!(await revealPassword.evaluate(element => element === document.activeElement))) {
      findings.push(`${viewport.name}: tombol tampilkan sandi tidak dapat dicapai melalui keyboard.`);
    }
    let submitReached = false;
    for (let tab = 0; tab < 8; tab += 1) {
      await page.keyboard.press('Tab');
      if (await submit.evaluate(element => element === document.activeElement)) {
        submitReached = true;
        break;
      }
    }
    if (!submitReached) {
      findings.push(`${viewport.name}: tombol masuk tidak dapat dicapai melalui keyboard.`);
    }

    const serious = result.violations.filter(issue => ['critical', 'serious'].includes(issue.impact));
    findings.push(...serious.map(issue =>
      `${viewport.name}: axe ${issue.impact} ${issue.id} — ${issue.help} (${issue.count} elemen: ${issue.targets.join(', ')})`
    ));
    console.log(JSON.stringify({
      viewport: viewport.name,
      size: `${viewport.width}x${viewport.height}`,
      axeViolations: result.violations.map(({ id, impact, help }) => ({ id, impact, help })),
      seriousOrCritical: serious.length,
      horizontalOverflowPx: Math.max(0, result.contentWidth - result.viewportWidth)
    }));
    await page.close();
  }
} finally {
  await browser.close();
}

if (findings.length > 0) {
  console.error(findings.map(finding => `- ${finding}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Pemeriksaan login WCAG A/AA dan alur keyboard lulus pada 3 ukuran viewport.');
}
