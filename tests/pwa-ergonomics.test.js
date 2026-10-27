import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA & Mobile UI/UX Ergonomics Compliance', () => {
  const rootDir = path.resolve(__dirname, '..');

  describe('Meta Viewport Standard (Apple HIG Native App Solid Ergonomics)', () => {
    it('verifies public/dashboard/index.html locks viewport zoom to guarantee native app stability', () => {
      const htmlPath = path.join(rootDir, 'public/dashboard/index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">');
      expect(html).toContain('user-scalable=no');
      expect(html).toContain('maximum-scale=1.0');
    });

    it('verifies login and 404 pages have compliant locked viewport tags', () => {
      const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login/index.html'), 'utf8');
      const errorHtml = fs.readFileSync(path.join(rootDir, 'public/404.html'), 'utf8');

      expect(loginHtml).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">');
      expect(loginHtml).toContain('user-scalable=no');

      expect(errorHtml).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">');
      expect(errorHtml).toContain('user-scalable=no');
    });
  });

  describe('Touch-Action and Tap Delay Elimination', () => {
    it('defines touch-action: pan-x pan-y !important in base.css to lock pinch-zoom while enabling smooth scrolling', () => {
      const baseCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/base.css'), 'utf8');
      expect(baseCss).toContain('touch-action: pan-x pan-y !important;');
      expect(baseCss).toContain('-webkit-tap-highlight-color: transparent;');
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

    it('positions mobile toast container above bottom navigation', () => {
      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('#toast-container');
      expect(responsiveCss).toContain('bottom: calc(76px + env(safe-area-inset-bottom))');
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
    it('verifies Cloudflare Pages public/_headers prevents caching sw.js', () => {
      const headersPath = path.join(rootDir, 'public/_headers');
      expect(fs.existsSync(headersPath)).toBe(true);
      const headers = fs.readFileSync(headersPath, 'utf8');
      expect(headers).toContain('/sw.js');
      expect(headers).toContain('Cache-Control: no-cache, no-store, must-revalidate');
    });

    it('verifies sw.js employs Network-First strategy for critical CSS/JS', () => {
      const sw = fs.readFileSync(path.join(rootDir, 'public/sw.js'), 'utf8');
      expect(sw).toContain("url.pathname.startsWith('/assets/css/') || url.pathname.startsWith('/assets/js/')");
      expect(sw).toContain('SKIP_WAITING');
    });

    it('verifies app.js registers SW with updateViaCache none and listens to controllerchange', () => {
      const appJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/app.js'), 'utf8');
      expect(appJs).toContain("updateViaCache: 'none'");
      expect(appJs).toContain("navigator.serviceWorker.addEventListener('controllerchange'");
      expect(appJs).toContain('window.checkForPwaUpdate');
    });

    it('verifies prominent PWA update banner in Settings and Cek Pembaruan in Sidebar', () => {
      const indexHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
      expect(indexHtml).toContain('btn-check-pwa-update');
      expect(indexHtml).toContain('Pembaruan &amp; Sinkronisasi Sistem');

      const sidebarJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/components/app-sidebar.js'), 'utf8');
      expect(sidebarJs).toContain('data-action="check-update"');
      expect(sidebarJs).toContain('Cek Pembaruan');
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

    it('verifies Barang Masuk add button has modern gradient styling', () => {
      const modalHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
      expect(modalHtml).toContain('Catat Barang Masuk');
      expect(modalHtml).toContain('package-plus');

      const responsiveCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/responsive.css'), 'utf8');
      expect(responsiveCss).toContain('#page-in > div:first-child .flex.gap-2 > button[data-action="add"]');
      expect(responsiveCss).toContain('linear-gradient(135deg, #0088CC 0%, #32ADE6 100%)');
    });

    it('verifies multi-touch pinch-to-zoom and gesture events are prevented in app.js', () => {
      const appJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/app.js'), 'utf8');
      expect(appJs).toContain('gesturestart');
      expect(appJs).toContain('e.preventDefault()');
      expect(appJs).toContain('e.touches.length > 1');
    });

    it('verifies service worker and components are bumped to v3.4.5', () => {
      const sw = fs.readFileSync(path.join(rootDir, 'public/sw.js'), 'utf8');
      expect(sw).toContain('aquastock-v3.4.5-pwa');

      const appSidebar = fs.readFileSync(path.join(rootDir, 'public/assets/js/components/app-sidebar.js'), 'utf8');
      expect(appSidebar).toContain('v3.4.5');
    });
  });
});


