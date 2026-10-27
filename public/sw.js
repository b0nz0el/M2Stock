/* ═══════════════════════════════════════════════════
   aQuaStock Pro — sw.js
   Local-First Progressive Web App (PWA) Service Worker
   ═══════════════════════════════════════════════════ */

const CACHE_NAME = 'aquastock-v3.2.1';

const STATIC_PRECACHE = [
  '/',
  '/dashboard/',
  '/dashboard/items/',
  '/dashboard/out/',
  '/dashboard/in/',
  '/dashboard/po/',
  '/dashboard/cash/',
  '/dashboard/debt/',
  '/dashboard/return/',
  '/dashboard/suppliers/',
  '/dashboard/customers/',
  '/dashboard/report/',
  '/dashboard/users/',
  '/dashboard/audit/',
  '/dashboard/backup/',
  '/dashboard/settings/',
  '/dashboard/notif/',
  '/manifest.json',
  '/assets/images/logo.svg',
  '/assets/images/icons/icon-192x192.png',
  '/assets/images/icons/icon-512x512.png',
  '/assets/fonts/InterVariable.woff2',
  '/assets/fonts/inter.css',
  '/assets/css/tailwind.static.css',
  '/assets/css/main.css',
  '/assets/css/base.css',
  '/assets/css/components.css',
  '/assets/css/layout.css',
  '/assets/css/pages.css',
  '/assets/css/responsive.css',
  '/assets/js/app.js',
  '/assets/js/utils.js',
  '/assets/js/navigation.js',
  '/assets/js/components/app-sidebar.js',
  '/assets/js/components/command-palette.js',
  '/assets/js/components/barcode-scanner.js',
  '/assets/js/utils/offline-sync.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn('[SW] Some precache assets failed to fetch:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Abaikan non-GET dan request ke backend Supabase (API ditangani oleh offline-sync.js)
  if (req.method !== 'GET' || url.origin.includes('supabase.co')) {
    return;
  }

  // Navigasi HTML: Network-First dengan Cache Fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return caches.match('/dashboard/');
        })
    );
    return;
  }

  // Static Assets (CSS, JS, Fonts, Images): Cache-First
  if (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          // Revalidate in background
          fetch(req).then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, networkRes));
            }
          }).catch(() => {});
          return cached;
        }

        return fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        });
      })
    );
  }
});

