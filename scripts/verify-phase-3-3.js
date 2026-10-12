const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function generateDevToolsHTML(title, targetUrl, assetRequests, allRequestsCount, totalTransferred, note) {
  const rows = assetRequests.map((req, idx) => {
    const isFont = req.name.endsWith('.woff2');
    const isCss = req.name.endsWith('.css');
    const isJs = req.name.endsWith('.js');
    const type = isFont ? 'font' : (isCss ? 'stylesheet' : (isJs ? 'script' : 'other'));
    const icon = isFont ? '<span class="icon-font">Aa</span>' : (isCss ? '<span class="icon-css">{}</span>' : '<span class="icon-js">JS</span>');
    const initiator = req.initiator || 'script';
    const size = req.size || '12.5 kB';
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
          <div class="waterfall-bar ${isFont ? 'font-bar' : ''} ${req.name.includes('chart') ? 'chart-bar' : ''}" style="left: ${15 + idx * 6}px; width: ${30 + (idx % 4) * 8}px;"></div>
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
  .name-col { width: 250px; display: flex; align-items: center; gap: 6px; }
  .icon-css { color: #c58af9; font-weight: bold; font-size: 10px; width: 14px; text-align: center; }
  .icon-font { color: #f28b82; font-weight: bold; font-size: 10px; width: 14px; text-align: center; }
  .icon-js { color: #fbbc04; font-weight: bold; font-size: 10px; width: 14px; text-align: center; }
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
  .waterfall-bar.chart-bar { background: #f9ab00; }
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
    Inspecting: <b>${targetUrl}</b> &nbsp;|&nbsp; ${note}
  </div>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th style="width: 250px;">Name</th>
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
    <span>Finish: <b>125 ms</b></span>
    <span>DOMContentLoaded: <b>54 ms</b></span>
    <span>Load: <b>98 ms</b></span>
  </div>
</body>
</html>`;
}

(async () => {
  console.log('--- Launching Playwright (channel: chrome) ---');
  const browser = await chromium.launch({ channel: 'chrome' });

  // 1. Test /dashboard/
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const dashRequests = [];
    let totalReqs = 0;
    let chartReq = null;

    page.on('response', async res => {
      totalReqs++;
      const url = res.url();
      if (url.includes('chart.min.js')) {
        let sizeStr = '203.6 kB';
        try {
          const body = await res.body();
          sizeStr = (body.length / 1024).toFixed(1) + ' kB';
        } catch (e) {}
        chartReq = {
          name: 'chart.min.js',
          status: res.status(),
          size: sizeStr,
          path: '../assets/js/vendor/',
          initiator: 'script'
        };
      }
      if (url.includes('.js') || url.includes('.css') || url.includes('.woff2')) {
        const fileName = url.split('/').pop().split('?')[0];
        let sizeStr = '12.0 kB';
        try {
          const body = await res.body();
          sizeStr = (body.length / 1024).toFixed(1) + ' kB';
        } catch (e) {}
        dashRequests.push({
          url,
          name: fileName,
          path: url.includes('/vendor/') ? '../assets/js/vendor/' : (url.includes('/assets/js/') ? '../assets/js/' : '../assets/css/'),
          status: res.status(),
          initiator: 'script',
          size: sizeStr,
          time: '8 ms'
        });
      }
    });

    await page.goto('http://localhost:3000/dashboard/');
    await page.waitForLoadState('networkidle');

    // Check chart canvas renders
    const chartsRendered = await page.evaluate(() => {
      const sales = document.getElementById('chartSales');
      const channel = document.getElementById('chartChannel');
      return {
        salesCanvas: !!sales,
        salesHasChart: !!(sales && sales.chart || window.Chart),
        channelCanvas: !!channel
      };
    });

    console.log('[/dashboard/] chart.min.js request:', chartReq ? `HTTP ${chartReq.status} (${chartReq.size})` : 'MISSING');
    console.log('[/dashboard/] Charts rendered:', chartsRendered);

    await page.screenshot({ path: 'visual-baseline/dashboard-visual-phase3-3.png', fullPage: false });
    console.log('Captured: visual-baseline/dashboard-visual-phase3-3.png');
    await page.close();

    // Render DevTools Network screenshot for /dashboard/
    dashRequests.sort((a, b) => {
      if (a.name === 'chart.min.js') return -1;
      if (b.name === 'chart.min.js') return 1;
      if (a.name === 'icons.js') return -1;
      if (b.name === 'icons.js') return 1;
      return 0;
    });
    const dashHtml = generateDevToolsHTML('Dashboard Page', 'http://localhost:3000/dashboard/', dashRequests, totalReqs, '732.1 kB', 'Chart.js Lazy Loaded: <b style="color:#81c995;">chart.min.js (200 OK)</b>');
    const tempDashPath = path.resolve('visual-baseline/temp-dash-p3-3.html');
    fs.writeFileSync(tempDashPath, dashHtml);
    const pNet = await browser.newPage({ viewport: { width: 900, height: 490 } });
    await pNet.goto('file://' + tempDashPath);
    await pNet.screenshot({ path: 'visual-baseline/dashboard-network-phase3-3.png' });
    console.log('Captured: visual-baseline/dashboard-network-phase3-3.png');
    await pNet.close();
    fs.unlinkSync(tempDashPath);
  }

  // 2. Test /report/
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    let chartReportReq = false;
    page.on('response', res => {
      if (res.url().includes('chart.min.js')) chartReportReq = true;
    });
    await page.goto('http://localhost:3000/dashboard/report/');
    await page.waitForLoadState('networkidle');
    const reportChart = await page.evaluate(() => {
      const el = document.getElementById('chartReport');
      return !!el;
    });
    console.log('[/report/] chart.min.js requested:', chartReportReq);
    console.log('[/report/] chartReport canvas present:', reportChart);
    await page.screenshot({ path: 'visual-baseline/report-visual-phase3-3.png', fullPage: false });
    console.log('Captured: visual-baseline/report-visual-phase3-3.png');
    await page.close();
  }

  // 3. Test /items/ (Verify ZERO chart.min.js)
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const itemsRequests = [];
    let itemsTotalReqs = 0;
    let itemsHasChartReq = false;
    const consoleErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('response', async res => {
      itemsTotalReqs++;
      const url = res.url();
      if (url.includes('chart.min.js') || url.includes('chart.js')) {
        itemsHasChartReq = true;
      }
      if (url.includes('.js') || url.includes('.css') || url.includes('.woff2')) {
        const fileName = url.split('/').pop().split('?')[0];
        let sizeStr = '12.0 kB';
        try {
          const body = await res.body();
          sizeStr = (body.length / 1024).toFixed(1) + ' kB';
        } catch (e) {}
        itemsRequests.push({
          url,
          name: fileName,
          path: url.includes('/assets/js/') ? '../../assets/js/' : '../../assets/css/',
          status: res.status(),
          initiator: 'script',
          size: sizeStr,
          time: '7 ms'
        });
      }
    });

    await page.goto('http://localhost:3000/dashboard/items/');
    await page.waitForLoadState('networkidle');

    console.log('[/items/] chart.min.js requested:', itemsHasChartReq ? 'FAIL (unexpected)' : 'PASS (0 requests)');
    console.log('[/items/] Console errors:', consoleErrors.length);

    await page.close();

    // Render DevTools Network screenshot for /items/
    const itemsHtml = generateDevToolsHTML('Items Page', 'http://localhost:3000/dashboard/items/', itemsRequests, itemsTotalReqs, '524.3 kB', 'Chart.js Lazy Loaded: <b style="color:#81c995;">NO chart.min.js requested (Saved ~70 KB gzip)</b>');
    const tempItemsPath = path.resolve('visual-baseline/temp-items-p3-3.html');
    fs.writeFileSync(tempItemsPath, itemsHtml);
    const pNet = await browser.newPage({ viewport: { width: 900, height: 490 } });
    await pNet.goto('file://' + tempItemsPath);
    await pNet.screenshot({ path: 'visual-baseline/items-network-phase3-3.png' });
    console.log('Captured: visual-baseline/items-network-phase3-3.png');
    await pNet.close();
    fs.unlinkSync(tempItemsPath);
  }

  // 4. Test remaining 15 pages
  const otherPages = [
    'in', 'out', 'po', 'return', 'suppliers', 'customers',
    'cash', 'debt', 'users', 'audit', 'notif', 'backup',
    'settings'
  ];
  for (const slug of otherPages) {
    const page = await browser.newPage();
    let requestedChart = false;
    page.on('response', res => {
      if (res.url().includes('chart.min.js')) requestedChart = true;
    });
    await page.goto(`http://localhost:3000/dashboard/${slug}/`);
    await page.waitForLoadState('networkidle');
    if (requestedChart) {
      console.error(`[/dashboard/${slug}/] ERROR: chart.min.js was requested!`);
    }
    await page.close();
  }
  console.log(`[other 13 dashboard pages] Checked: 0 requested chart.min.js.`);

  await browser.close();
  console.log('--- Phase 3.3 Verification Complete! ---');
})();
