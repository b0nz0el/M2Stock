import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA & Mobile UI/UX Ergonomics Compliance', () => {
  const rootDir = path.resolve(__dirname, '..');

  describe('Meta Viewport Standard (fixed mobile scale)', () => {
    it('disables pinch zoom on the dashboard', () => {
      const htmlPath = path.join(rootDir, 'public/dashboard/index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">');
    });

    it('disables pinch zoom on the login, landing, and 404 pages', () => {
      const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login/index.html'), 'utf8');
      const landingHtml = fs.readFileSync(path.join(rootDir, 'public/index.html'), 'utf8');
      const errorHtml = fs.readFileSync(path.join(rootDir, 'public/404.html'), 'utf8');

      for (const html of [loginHtml, landingHtml, errorHtml]) {
        expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">');
      }
    });
  });

  describe('Touch-Action and Tap Delay Elimination', () => {
    it('avoids double-tap delay for touch controls', () => {
      const baseCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/base.css'), 'utf8');
      expect(baseCss).toContain('touch-action: manipulation;');
      expect(baseCss).not.toContain('touch-action: pan-x pan-y !important;');
      expect(baseCss).toContain('-webkit-tap-highlight-color: transparent;');
    });

    it('prevents mobile viewport overflow and keeps dashboard controls inside the viewport', () => {
      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('overflow-x: clip !important;');
      expect(responsiveCss).toContain('touch-action: pan-y !important;');
      expect(responsiveCss).toContain('#main-content,');
      expect(responsiveCss).toContain('min-width: 0 !important;');
      expect(responsiveCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
      expect(responsiveCss).toContain('#page-in #in-filter-buttons > button');
    });

    it('constrains Master Barang cards and wraps marketplace actions on mobile', () => {
      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('#page-items .card table {');
      expect(responsiveCss).toContain('max-width: 100% !important;');
      expect(responsiveCss).toContain('#page-items .card table tbody td:last-child:has(button) .flex {');
      expect(responsiveCss).toContain('grid-template-columns: repeat(4, 44px);');
      expect(responsiveCss).toContain('overflow-wrap: anywhere;');
    });
  });

  describe('Header Touch Targets & Safe Area Insets (iOS Notch & Dynamic Island)', () => {
    it('enforces 44px min touch target on mobile header buttons (hamburger, notif, logout)', () => {
      const html = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
      
      // Hamburger button: w-11 h-11 (44px x 44px)
      expect(html).toMatch(/data-action="toggle-sidebar"[^>]*class="[^"]*w-11 h-11/);
      
      // Notif button: w-11 h-11
      expect(html).toMatch(/data-action="notif"[^>]*class="[^"]*w-11 h-11/);

      // Logout button: w-11 h-11
      expect(html).toMatch(/data-action="logout"[^>]*class="[^"]*w-11 h-11/);
    });

    it('protects header from notch collision using safe-area-inset-top and avoids overflow-x: hidden breaking sticky', () => {
      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('env(safe-area-inset-top');
      expect(responsiveCss).toContain('overflow-x: clip;');
    });
  });

  describe('Bottom Navigation & iOS Home Indicator Ergonomics', () => {
    it('ensures bottom-nav-item typography is 11px (0.6875rem) semi-bold with 44px height', () => {
      const componentsCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/components.css'), 'utf8');
      expect(componentsCss).toContain('font-size: 0.6875rem;');
      expect(componentsCss).toContain('font-weight: 600;');
      expect(componentsCss).toContain('min-height: 44px;');
    });

    it('provides generous clearance for iOS home indicator bar in layout.css and responsive.css', () => {
      const layoutCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/layout.css'), 'utf8');
      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      
      expect(layoutCss).toContain('env(safe-area-inset-bottom');
      expect(responsiveCss).toContain('padding-bottom: max(18px, env(safe-area-inset-bottom, 18px))');
    });

    it('positions mobile toast container as top-center dynamic HUD avoiding bottom navigation obstruction', () => {
      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('#toast-container');
      expect(responsiveCss).toContain('top: calc(1rem + env(safe-area-inset-top))');
      expect(responsiveCss).toContain('transform: translateX(-50%)');
    });

    it('enforces 44x44px touch targets on table card action buttons in responsive.css', () => {
      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('.card table tbody td:last-child:has(button) button');
      expect(responsiveCss).toContain('min-width: 44px !important;');
      expect(responsiveCss).toContain('min-height: 44px !important;');
    });
  });

  describe('Barang Keluar (#page-out) and Barang Masuk (#page-in) Mobile Optimization', () => {
    it('ensures primary CTA (Kasir POS / Tambah) is prominent and metric cards are in compact grid', () => {
      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('#page-out > div:first-child .flex.gap-2 > button[data-action="add"]');
      expect(responsiveCss).toContain('#page-out .grid.grid-cols-4');
      expect(responsiveCss).toContain('grid-template-columns: repeat(3, 1fr)');
    });
  });

  describe('PWA Auto-Update & Zero-Stale Cache Synchronization', () => {
    it('registers the service worker from the public login page', () => {
      const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login/index.html'), 'utf8');
      const registrationScript = fs.readFileSync(path.join(rootDir, 'public/assets/js/pwa-register.js'), 'utf8');

      expect(loginHtml).toContain('../assets/js/pwa-register.js');
      expect(registrationScript).toContain("navigator.serviceWorker.register('/sw.js'");
      expect(registrationScript).toContain("updateViaCache: 'none'");
    });

    it('serves manifest icons at their declared dimensions', () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/manifest.json'), 'utf8'));

      for (const icon of manifest.icons) {
        const image = fs.readFileSync(path.join(rootDir, 'public', icon.src.replace(/^\//, '')));
        const [width, height] = icon.sizes.split('x').map(Number);

        expect(image.subarray(1, 4).toString()).toBe('PNG');
        expect(image.readUInt32BE(16)).toBe(width);
        expect(image.readUInt32BE(20)).toBe(height);
        expect(icon.purpose).toBe('any');
      }
    });

    it('verifies Cloudflare Pages public/_headers prevents caching sw.js', () => {
      const headersPath = path.join(rootDir, 'public/_headers');
      expect(fs.existsSync(headersPath)).toBe(true);
      const headers = fs.readFileSync(headersPath, 'utf8');
      expect(headers).toContain('/sw.js');
      expect(headers).toContain('Cache-Control: no-cache, no-store, must-revalidate');
    });

    it('serves the barcode fallback locally and precaches it for offline use', () => {
      const scannerJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/components/barcode-scanner.js'), 'utf8');
      const dashboardHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
      const serviceWorker = fs.readFileSync(path.join(rootDir, 'public/sw.js'), 'utf8');

      expect(scannerJs).toContain("script.src = '/assets/js/vendor/html5-qrcode.min.js'");
      expect(scannerJs).not.toContain('unpkg.com/html5-qrcode');
      expect(dashboardHtml).not.toContain('unpkg.com/html5-qrcode');
      expect(serviceWorker).toContain("'/assets/js/vendor/html5-qrcode.min.js'");
    });

    it('verifies sw.js employs Network-First strategy for critical CSS/JS', () => {
      const sw = fs.readFileSync(path.join(rootDir, 'public/sw.js'), 'utf8');
      expect(sw).toContain("url.pathname.startsWith('/assets/css/') || url.pathname.startsWith('/assets/js/')");
      expect(sw).toContain('SKIP_WAITING');
      expect(sw).toContain('fetch(req, { cache: \'no-store\' })');
    });

    it('precaches marketplace icon modules and item screens for offline PWA consistency', () => {
      const sw = fs.readFileSync(path.join(rootDir, 'public/sw.js'), 'utf8');
      [
        '/assets/js/icons.js',
        '/assets/js/utils/channel-icons.js',
        '/dashboard/items.js',
        '/dashboard/settings.js'
      ].forEach((asset) => expect(sw).toContain(`'${asset}'`));
    });

    it('verifies app.js registers SW with updateViaCache none and listens to controllerchange', () => {
      const appJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/app.js'), 'utf8');
      expect(appJs).toContain("updateViaCache: 'none'");
      expect(appJs).toContain("navigator.serviceWorker.addEventListener('controllerchange'");
      expect(appJs).toContain('window.checkForPwaUpdate');
      expect(appJs).toContain("fetch(`/version.json?check=${Date.now()}`");
      expect(appJs).toContain("cache: 'no-store'");
      expect(appJs).not.toContain('caches.delete');
    });

    it('synchronizes the version metadata generated by GitHub with the UI', () => {
      const indexHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
      const versionMetadata = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/version.json'), 'utf8'));
      const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      const bumpScript = fs.readFileSync(path.join(rootDir, 'scripts/bump-version.mjs'), 'utf8');
      const workflow = fs.readFileSync(path.join(rootDir, '.github/workflows/version-bump.yml'), 'utf8');

      expect(indexHtml).toContain(`<meta name="app-version" content="${packageJson.version}">`);
      expect(versionMetadata.version).toBe(packageJson.version);
      expect(versionMetadata.branch).toBe('main');
      expect(bumpScript).toContain("path.join(rootDir, 'public/version.json')");
      expect(workflow).toContain('git add package.json public/version.json');
    });

    it('verifies prominent PWA update banner in Settings and Cek Pembaruan in Sidebar', () => {
      const indexHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
      expect(indexHtml).toContain('btn-check-pwa-update');
      expect(indexHtml).toContain('Pembaruan &amp; Sinkronisasi Sistem');

      const sidebarJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/components/app-sidebar.js'), 'utf8');
      expect(sidebarJs).toContain('data-action="check-update"');
      expect(sidebarJs).toContain('Cek Pembaruan');
      expect(sidebarJs).toContain('data-app-version-sidebar');
      expect(sidebarJs).toContain('bg-[#FF453A]/10');
      expect(sidebarJs).toContain('sidebar-drawer-logout');

      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('app-sidebar aside .sidebar-drawer-logout');
      expect(responsiveCss).toContain('min-width: 44px !important;');
    });

    it('verifies card view visual hierarchy in responsive.css (header divider, hero item, green total)', () => {
      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;');
      expect(responsiveCss).toContain('.card table tbody td[data-label="TOTAL"]');
      expect(responsiveCss).toContain('color: #34C759 !important;');
      expect(responsiveCss).toContain('.card table tbody td[data-label="BARANG"]');
    });

    it('verifies card action buttons are rendered as an ergonomic bottom footer without overlapping', () => {
      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('position: static !important;');
      expect(responsiveCss).toContain('border-top: 1px solid rgba(255, 255, 255, 0.08) !important;');
      expect(responsiveCss).toContain('justify-content: flex-end !important;');
      expect(responsiveCss).toContain('min-height: 44px !important;');
    });

    it('verifies user directory resolver exists and maps user IDs to human-readable names', () => {
      const resolverPath = path.join(rootDir, 'public/assets/js/utils/user-resolver.js');
      expect(fs.existsSync(resolverPath)).toBe(true);
      const resolverCode = fs.readFileSync(resolverPath, 'utf8');
      expect(resolverCode).toContain('resolveUserName');
      expect(resolverCode).toContain('loadUserDirectory');

      const indexHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
      expect(indexHtml).toContain('user-resolver.js');
    });

    it('verifies client IP address resolution via Cloudflare trace with fallback', () => {
      const clientCode = fs.readFileSync(path.join(rootDir, 'public/assets/js/api/_client.js'), 'utf8');
      expect(clientCode).toContain('getClientIp');
      expect(clientCode).toContain('/cdn-cgi/trace');

      const auditCode = fs.readFileSync(path.join(rootDir, 'public/assets/js/api/audit.js'), 'utf8');
      expect(auditCode).toContain('getClientIp');

      const loginCode = fs.readFileSync(path.join(rootDir, 'public/assets/js/login.js'), 'utf8');
      expect(loginCode).toContain('ip: clientIp || null');
    });

    it('verifies sidebar mobile drawer has iOS notch safe-area in responsive.css', () => {
      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('padding-top: max(env(safe-area-inset-top, 24px), 20px) !important;');
      expect(responsiveCss).toContain('button[data-action="close-sidebar"]');
    });

    it('keeps PO mobile toolbar actions readable and touch-friendly', () => {
      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      const poJs = fs.readFileSync(path.join(rootDir, 'public/dashboard/po.js'), 'utf8');
      const indexHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');

      expect(responsiveCss).toContain('#page-po .po-header-actions');
      expect(responsiveCss).toContain('grid-column: 1 / -1 !important;');
      expect(responsiveCss).toContain('min-height: 52px !important;');
      expect(indexHtml).toContain('class="po-auto-restock-button');
      expect(indexHtml).toContain('id="auto-restock-po-count"');
      expect(poJs).toContain("restockCount.textContent = String(lowStockCount);");
      expect(poJs).toContain("restockCount.classList.toggle('hidden', lowStockCount === 0);");
    });

    it('verifies mobile audit log layout has responsive cards and toolbar', () => {
      const auditHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
      expect(auditHtml).toContain('audit-search-input');
      expect(auditHtml).toContain('btn-refresh-audit');
      expect(auditHtml).toContain('btn-export-audit');

      const auditJs = fs.readFileSync(path.join(rootDir, 'public/dashboard/audit.js'), 'utf8');
      expect(auditJs).toContain('data-label="WAKTU"');
      expect(auditJs).toContain('data-label="IP ADDRESS"');

      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('#page-audit .card table tbody tr');
      expect(responsiveCss).toContain('#page-audit .card table tbody td[data-label="WAKTU"]');
    });

    it('verifies barcode scanner has lenient constraints and photo fallback', () => {
      const scannerJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/components/barcode-scanner.js'), 'utf8');
      expect(scannerJs).toContain('btn-scan-via-photo');
      expect(scannerJs).toContain('item-scanner-file-input');
      expect(scannerJs).toContain('scanFile');
      expect(scannerJs).toContain('facingMode: { ideal:');
    });

    it('verifies photo product picker provides dual camera and gallery options for all mobile devices', () => {
      const modalHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
      expect(modalHtml).toContain('id="item-image-file" accept="image/*,image/heic"');
      expect(modalHtml).toContain('id="item-image-camera" accept="image/*" capture="environment"');
      expect(modalHtml).toContain('id="btn-capture-camera"');
      expect(modalHtml).toContain('id="btn-pick-photo"');
    });

    it('verifies Google Drive cloud backup provides dedicated auth dialog and connection flow', () => {
      const modalHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
      expect(modalHtml).toContain('id="modal-gdrive-auth"');
      expect(modalHtml).toContain('id="btn-sync-gdrive"');
      expect(modalHtml).toContain('id="btn-disconnect-gdrive"');

      const backupJs = fs.readFileSync(path.join(rootDir, 'public/dashboard/backup.js'), 'utf8');
      expect(backupJs).toContain('handleGoogleDriveLogin');
      expect(backupJs).toContain('aquastock_gdrive_auth');
    });

    it('verifies Barang Masuk and items add button has sleek professional styling and responsive labels', () => {
      const modalHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
      expect(modalHtml).toContain('Catat Barang Masuk');
      expect(modalHtml).toContain('Catat Masuk');
      expect(modalHtml).toContain('package-plus');

      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('#page-in > div:first-child .flex.gap-2 > button[data-action="add"]');
      expect(responsiveCss).toContain('background: #0088CC !important;');
    });

    it('verifies multi-touch pinch-to-zoom and gesture events are prevented in app.js', () => {
      const appJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/app.js'), 'utf8');
      expect(appJs).toContain('gesturestart');
      expect(appJs).toContain('e.preventDefault()');
      expect(appJs).toContain('e.touches.length > 1');
    });

    it('verifies service worker and components are bumped to current version', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      const ver = pkg.version;
      const sw = fs.readFileSync(path.join(rootDir, 'public/sw.js'), 'utf8');
      expect(sw).toContain(`aquastock-v${ver}-pwa`);

      const appSidebar = fs.readFileSync(path.join(rootDir, 'public/assets/js/components/app-sidebar.js'), 'utf8');
      expect(appSidebar).toContain(`v${ver}`);
    });
  });
});
