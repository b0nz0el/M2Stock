import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA & Mobile UI/UX Ergonomics Compliance', () => {
  const rootDir = path.resolve(__dirname, '..');

  describe('Meta Viewport Standard (WCAG 2.1 SC 1.4.4 & Lighthouse)', () => {
    it('verifies public/dashboard/index.html viewport permits zooming and covers notches', () => {
      const htmlPath = path.join(rootDir, 'public/dashboard/index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
      expect(html).not.toContain('user-scalable=no');
      expect(html).not.toContain('maximum-scale=1.0');
    });

    it('verifies login and 404 pages have compliant viewport tags', () => {
      const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login/index.html'), 'utf8');
      const errorHtml = fs.readFileSync(path.join(rootDir, 'public/404.html'), 'utf8');

      expect(loginHtml).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
      expect(loginHtml).not.toContain('user-scalable=no');

      expect(errorHtml).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
      expect(errorHtml).not.toContain('user-scalable=no');
    });
  });

  describe('Touch-Action and Tap Delay Elimination', () => {
    it('defines touch-action: manipulation in base.css', () => {
      const baseCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/base.css'), 'utf8');
      expect(baseCss).toContain('touch-action: manipulation;');
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
  });
});


