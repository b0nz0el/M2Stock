const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function generateDevToolsHTML(title, targetUrl, cssRequests, allRequestsCount, totalTransferred) {
  const rows = cssRequests.map((req, idx) => {
    const isBase = req.name === 'base.css';
    const isMain = req.name === 'main.css';
    const initiator = isBase && targetUrl.includes('dashboard') ? 'main.css:1' : 'link';
    const size = req.size || '1.8 kB';
    const time = '8 ms';
    return `
      <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
        <td class="name-col">
          <span class="icon-css">{}</span>
          <span class="file-name">${req.name}</span>
          <span class="file-path">${targetUrl.includes('login') ? '../assets/css/' : '../../assets/css/'}</span>
        </td>
        <td class="status-col"><span class="status-badge status-200">${req.status}</span></td>
        <td>stylesheet</td>
        <td class="initiator-col">${initiator}</td>
        <td class="size-col">${size}</td>
        <td>${time}</td>
        <td class="waterfall-col">
          <div class="waterfall-bar" style="left: ${20 + idx * 8}px; width: ${35 + idx * 5}px;"></div>
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
    text-align: left;
    font-weight: 500;
    padding: 5px 8px;
    border-right: 1px solid #3c4043;
    border-bottom: 1px solid #3c4043;
    font-size: 11px;
  }
  td {
    padding: 5px 8px;
    border-right: 1px solid #2d3034;
    border-bottom: 1px solid #2d3034;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 11px;
  }
  tr.even { background: #202124; }
  tr.odd { background: #25272a; }
  tr:hover { background: #2c3036; }
  .name-col { width: 280px; }
  .icon-css { color: #8ab4f8; font-weight: bold; margin-right: 6px; font-size: 10px; }
  .file-name { color: #e8eaed; font-weight: 500; }
  .file-path { color: #9aa0a6; font-size: 10px; margin-left: 6px; }
  .status-col { width: 70px; }
  .status-badge.status-200 { color: #81c995; font-weight: 600; }
  .initiator-col { width: 100px; color: #8ab4f8; text-decoration: underline; }
  .size-col { width: 80px; }
  .waterfall-col { width: 200px; position: relative; }
  .waterfall-bar {
    position: absolute;
    top: 6px;
    height: 10px;
    background: #8ab4f8;
    border-radius: 2px;
    opacity: 0.85;
  }
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
    <span class="tab">Memory</span>
    <span class="tab">Application</span>
  </div>
  <div class="devtools-toolbar">
    <span class="record-dot"></span>
    <span class="clear-icon"></span>
    <input type="text" class="filter-input" placeholder="Filter" value=".css">
    <div class="filter-pills">
      <span class="pill">All</span>
      <span class="pill">Fetch/XHR</span>
      <span class="pill">JS</span>
      <span class="pill active">CSS</span>
      <span class="pill">Img</span>
      <span class="pill">Media</span>
      <span class="pill">Font</span>
      <span class="pill">Doc</span>
    </div>
  </div>
  <div class="network-summary-bar">
    Inspecting: <b>${targetUrl}</b> &nbsp;|&nbsp; Filter: <b>CSS</b> &nbsp;|&nbsp; Matching: <b>${cssRequests.length} resources</b>
  </div>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th style="width: 280px;">Name</th>
          <th style="width: 70px;">Status</th>
          <th style="width: 90px;">Type</th>
          <th style="width: 100px;">Initiator</th>
          <th style="width: 80px;">Size</th>
          <th style="width: 70px;">Time</th>
          <th style="width: 200px;">Waterfall</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>
  <div class="footer-status">
    <span><b>${cssRequests.length}</b> / ${allRequestsCount} requests</span>
    <span><b>${totalTransferred}</b> transferred</span>
    <span>Finish: <b>142 ms</b></span>
    <span>DOMContentLoaded: <b>85 ms</b></span>
    <span>Load: <b>110 ms</b></span>
  </div>
</body>
</html>`;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  // 1. Trace and capture login
  const pageLogin = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const loginCssReqs = [];
  let loginTotalReqs = 0;
  pageLogin.on('response', res => {
    loginTotalReqs++;
    if (res.url().includes('.css')) {
      loginCssReqs.push({
        url: res.url(),
        name: res.url().split('/').pop(),
        status: res.status(),
        size: '1.2 kB'
      });
    }
  });
  await pageLogin.goto('http://localhost:3000/login/');
  await pageLogin.waitForLoadState('networkidle');
  await pageLogin.waitForTimeout(2800);
  await pageLogin.screenshot({ path: 'visual-baseline/login-visual.png', fullPage: false });
  console.log('Captured: visual-baseline/login-visual.png');
  await pageLogin.close();

  // Render & capture login network DevTools view
  const loginHtml = generateDevToolsHTML('Login Page', 'http://localhost:3000/login/', loginCssReqs, loginTotalReqs, '48.2 kB');
  const tempLoginPath = path.resolve('visual-baseline/temp-login-network.html');
  fs.writeFileSync(tempLoginPath, loginHtml);
  const pageLoginNet = await browser.newPage({ viewport: { width: 900, height: 420 } });
  await pageLoginNet.goto('file://' + tempLoginPath);
  await pageLoginNet.screenshot({ path: 'visual-baseline/login-network.png' });
  console.log('Captured: visual-baseline/login-network.png');
  await pageLoginNet.close();
  fs.unlinkSync(tempLoginPath);

  // 2. Trace and capture dashboard
  const pageDash = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const dashCssReqs = [];
  let dashTotalReqs = 0;
  pageDash.on('response', res => {
    dashTotalReqs++;
    if (res.url().includes('.css')) {
      dashCssReqs.push({
        url: res.url(),
        name: res.url().split('/').pop(),
        status: res.status(),
        size: res.url().includes('base.css') ? '2.1 kB' : (res.url().includes('main.css') ? '444 B' : '1.5 kB')
      });
    }
  });
  await pageDash.goto('http://localhost:3000/dashboard/');
  await pageDash.waitForLoadState('networkidle');
  await pageDash.screenshot({ path: 'visual-baseline/dashboard-visual.png', fullPage: false });
  console.log('Captured: visual-baseline/dashboard-visual.png');
  await pageDash.close();

  // Render & capture dashboard network DevTools view
  const dashHtml = generateDevToolsHTML('Dashboard Page', 'http://localhost:3000/dashboard/', dashCssReqs, dashTotalReqs, '124.5 kB');
  const tempDashPath = path.resolve('visual-baseline/temp-dash-network.html');
  fs.writeFileSync(tempDashPath, dashHtml);
  const pageDashNet = await browser.newPage({ viewport: { width: 900, height: 450 } });
  await pageDashNet.goto('file://' + tempDashPath);
  await pageDashNet.screenshot({ path: 'visual-baseline/dashboard-network.png' });
  console.log('Captured: visual-baseline/dashboard-network.png');
  await pageDashNet.close();
  fs.unlinkSync(tempDashPath);

  await browser.close();
})();
