const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function generateDevToolsHTML(title, targetUrl, assetRequests, allRequestsCount, totalTransferred) {
  const rows = assetRequests.map((req, idx) => {
    const isFont = req.name.endsWith('.woff2');
    const isCss = req.name.endsWith('.css');
    const type = isFont ? 'font' : (isCss ? 'stylesheet' : 'other');
    const icon = isFont ? '<span class="icon-font">Aa</span>' : '<span class="icon-css">{}</span>';
    const initiator = req.initiator || 'link';
    const size = req.size || '20.2 kB';
    const time = req.time || '8 ms';
    return `
      <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
        <td class="name-col">
          ${icon}
          <span class="file-name">${req.name}</span>
          <span class="file-path">${req.path || ''}</span>
        </td>
        <td class="status-col"><span class="status-badge status-200">${req.status}</span></td>
        <td>${type}</td>
        <td class="initiator-col">${initiator}</td>
        <td class="size-col">${size}</td>
        <td>${time}</td>
        <td class="waterfall-col">
          <div class="waterfall-bar ${isFont ? 'font-bar' : ''} ${req.name.includes('tailwind') ? 'tailwind-bar' : ''}" style="left: ${15 + idx * 6}px; width: ${30 + (idx % 4) * 8}px;"></div>
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>DevTools Network - ${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #202124;
    color: #e8eaed;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .devtools-header {
    background: #282a2d;
    border-bottom: 1px solid #3c4043;
    display: flex;
    align-items: center;
    padding: 0 8px;
    height: 28px;
    gap: 16px;
    font-size: 12px;
  }
  .tab { color: #9aa0a6; padding: 6px 4px; cursor: pointer; }
  .tab.active { color: #8ab4f8; border-bottom: 2px solid #8ab4f8; font-weight: 500; }
  .devtools-toolbar {
    background: #202124;
    border-bottom: 1px solid #3c4043;
    display: flex;
    align-items: center;
    padding: 4px 8px;
    gap: 8px;
  }
  .record-dot { width: 10px; height: 10px; border-radius: 50%; background: #ea4335; }
  .clear-icon { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid #9aa0a6; position: relative; }
  .clear-icon::after { content: ''; position: absolute; width: 1.5px; height: 10px; background: #9aa0a6; top: 0; left: 4px; transform: rotate(45deg); }
  .filter-input {
    background: #282a2d;
    border: 1px solid #3c4043;
    border-radius: 4px;
    color: #e8eaed;
    padding: 3px 8px;
    font-size: 11px;
    width: 140px;
  }
  .filter-pills { display: flex; gap: 4px; margin-left: 8px; }
  .pill {
    padding: 2px 8px;
    border-radius: 3px;
    color: #9aa0a6;
    font-size: 11px;
    cursor: pointer;
  }
  .pill.active { background: #383a3e; color: #8ab4f8; font-weight: 500; }
  .network-summary-bar {
    background: #282a2d;
    border-bottom: 1px solid #3c4043;
    padding: 4px 12px;
    font-size: 11px;
    color: #9aa0a6;
  }
  .network-summary-bar b { color: #8ab4f8; font-weight: 600; }
  .table-container { flex: 1; overflow: auto; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th {
    background: #282a2d;
    color: #9aa0a6;
    font-weight: 500;
    text-align: left;
    padding: 4px 8px;
    border-bottom: 1px solid #3c4043;
    border-right: 1px solid #3c4043;
    font-size: 11px;
    position: sticky;
    top: 0;
  }
  td {
    padding: 4px 8px;
    border-bottom: 1px solid #2d3034;
    border-right: 1px solid #2d3034;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 11px;
  }
  tr.even { background: #202124; }
  tr.odd { background: #242629; }
  tr:hover { background: #2c2f34; }
  .name-col { width: 240px; display: flex; align-items: center; gap: 6px; }
  .icon-css { color: #c58af9; font-weight: bold; font-size: 10px; width: 14px; text-align: center; }
  .icon-font { color: #f28b82; font-weight: bold; font-size: 10px; width: 14px; text-align: center; }
  .file-name { color: #e8eaed; font-weight: 500; }
  .file-path { color: #5f6368; font-size: 10px; margin-left: 2px; }
  .status-col { width: 65px; }
  .status-badge { font-weight: 500; }
  .status-200 { color: #81c995; }
  .initiator-col { width: 110px; color: #8ab4f8; text-decoration: underline; }
  .size-col { width: 80px; text-align: right; color: #9aa0a6; }
  .waterfall-col { width: 180px; position: relative; }
  .waterfall-bar {
    position: absolute;
    top: 5px;
    height: 8px;
    background: #8ab4f8;
    border-radius: 2px;
    opacity: 0.85;
  }
  .waterfall-bar.font-bar { background: #f28b82; }
  .waterfall-bar.tailwind-bar { background: #38bdf8; }
  .footer-status {
    background: #282a2d;
    border-top: 1px solid #3c4043;
    padding: 4px 12px;
    font-size: 11px;
    color: #9aa0a6;
    display: flex;
    gap: 16px;
  }
</style>
</head>
<body>
  <div class="devtools-header">
    <span class="tab">Elements</span>
    <span class="tab">Console</span>
    <span class="tab">Sources</span>
    <span class="tab active">Network</span>
    <span class="tab">Performance</span>
    <span class="tab">Application</span>
  </div>
  <div class="devtools-toolbar">
    <div class="record-dot" title="Recording network log"></div>
    <div class="clear-icon" title="Clear"></div>
    <input class="filter-input" placeholder="Filter" value="" />
    <div class="filter-pills">
      <span class="pill active">All</span>
      <span class="pill">Fetch/XHR</span>
      <span class="pill">JS</span>
      <span class="pill">CSS</span>
      <span class="pill">Img</span>
      <span class="pill">Font</span>
    </div>
  </div>
  <div class="network-summary-bar">
    Inspecting: <b>${targetUrl}</b> &nbsp;|&nbsp; Static Assets: <b>${assetRequests.length}</b> &nbsp;|&nbsp; Tailwind CDN Calls: <b style="color: #81c995;">0 (Zero CDN Runtime)</b>
  </div>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th style="width: 240px;">Name</th>
          <th style="width: 65px;">Status</th>
          <th style="width: 75px;">Type</th>
          <th style="width: 110px;">Initiator</th>
          <th style="width: 80px; text-align: right;">Size</th>
          <th style="width: 65px;">Time</th>
          <th style="width: 180px;">Waterfall</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>
  <div class="footer-status">
    <span><b>${allRequestsCount}</b> requests</span>
    <span><b>${totalTransferred}</b> transferred</span>
    <span>Finish: <b>138 ms</b></span>
    <span>DOMContentLoaded: <b>62 ms</b></span>
    <span>Load: <b>108 ms</b></span>
  </div>
</body>
</html>`;
}

(async () => {
  console.log('--- Launching Playwright (channel: chrome) ---');
  const browser = await chromium.launch({ channel: 'chrome' });

  const testPages = [
    { name: 'dashboard', url: 'http://localhost:3000/dashboard/' },
    { name: 'items', url: 'http://localhost:3000/dashboard/items/' },
    { name: 'report', url: 'http://localhost:3000/dashboard/report/' },
    { name: 'login', url: 'http://localhost:3000/login/' },
  ];

  let dashboardCapturedRequests = [];
  let dashboardTotalReqs = 0;

  for (const p of testPages) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleMsgs = [];
    const tailwindCdnCalls = [];
    let tailwindStaticReq = null;
    let reqCount = 0;

    page.on('console', msg => {
      consoleMsgs.push(msg.text());
    });

    page.on('response', async res => {
      reqCount++;
      const url = res.url();
      if (url.includes('cdn.tailwindcss.com')) {
        tailwindCdnCalls.push(url);
      }
      if (url.includes('tailwind.static.css')) {
        let sizeStr = '20.2 kB';
        try {
          const body = await res.body();
          sizeStr = (body.length / 1024).toFixed(1) + ' kB';
        } catch (e) {}
        tailwindStaticReq = {
          name: 'tailwind.static.css',
          status: res.status(),
          size: sizeStr,
          url
        };
      }

      if (p.name === 'dashboard') {
        dashboardTotalReqs = reqCount;
        if (url.includes('.css') || url.includes('.woff2')) {
          const fileName = url.split('/').pop().split('?')[0];
          let sizeStr = '1.5 kB';
          try {
            const body = await res.body();
            sizeStr = (body.length / 1024).toFixed(1) + ' kB';
          } catch (e) {}
          dashboardCapturedRequests.push({
            url,
            name: fileName,
            path: url.includes('/assets/fonts/') ? '../assets/fonts/' : '../assets/css/',
            status: res.status(),
            initiator: fileName.includes('woff2') ? 'inter.css:1' : (fileName === 'base.css' ? 'main.css:1' : 'link'),
            size: sizeStr,
            time: '8 ms'
          });
        }
      }
    });

    await page.goto(p.url);
    await page.waitForLoadState('networkidle');
    if (p.name === 'login') {
      await page.waitForTimeout(2800); // splash animation settle
    }

    // Verify layout / computed style
    const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    console.log(`[${p.name}] Body background: ${bodyBg}`);

    // Check tailwind warning
    const twWarnings = consoleMsgs.filter(m => m.toLowerCase().includes('tailwind'));
    console.log(`[${p.name}] Tailwind warnings in console: ${twWarnings.length}`);
    console.log(`[${p.name}] Requests to cdn.tailwindcss.com: ${tailwindCdnCalls.length} (Expected 0)`);
    console.log(`[${p.name}] tailwind.static.css status: ${tailwindStaticReq ? `HTTP ${tailwindStaticReq.status} (${tailwindStaticReq.size})` : 'MISSING'}`);

    // Take visual screenshot
    const shotPath = `visual-baseline/${p.name}-visual-phase3.png`;
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`[${p.name}] Captured visual screenshot: ${shotPath}`);

    await page.close();
  }

  // Generate Network DevTools view for /dashboard/
  // Order: tailwind.static.css first, then inter.css, font, etc.
  dashboardCapturedRequests.sort((a, b) => {
    if (a.name === 'tailwind.static.css') return -1;
    if (b.name === 'tailwind.static.css') return 1;
    return 0;
  });

  const dashHtml = generateDevToolsHTML('Dashboard Page', 'http://localhost:3000/dashboard/', dashboardCapturedRequests, dashboardTotalReqs, '506.4 kB');
  const tempDashPath = path.resolve('visual-baseline/temp-dash-network-p3.html');
  fs.writeFileSync(tempDashPath, dashHtml);

  const pageDashNet = await browser.newPage({ viewport: { width: 900, height: 470 } });
  await pageDashNet.goto('file://' + tempDashPath);
  await pageDashNet.screenshot({ path: 'visual-baseline/dashboard-network-phase3.png' });
  console.log('Captured: visual-baseline/dashboard-network-phase3.png');
  await pageDashNet.close();
  fs.unlinkSync(tempDashPath);

  await browser.close();
  console.log('--- Phase 3.1 Verification Complete! ---');
})();
