/* ═══════════════════════════════════════════════════
   Aquastock Pro — sw.js
   Local-First Progressive Web App (PWA) Service Worker
   ═══════════════════════════════════════════════════ */

const CACHE_NAME = 'aquastock-v3.4.85-pwa';

const STATIC_PRECACHE = [
  '/',
  '/dashboard/',
  '/dashboard/index.html',
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
  '/dashboard/settings-barcode.js',
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
  '/assets/js/pwa-register.js',
  '/assets/js/vendor/jsbarcode.all.min.js',
  '/assets/js/vendor/html5-qrcode.min.js',
  '/assets/js/utils/offline-sync.js',
  '/assets/js/utils/user-resolver.js'
];

self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    self.skipWaiting();
  }
});

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

  // Critical Assets (CSS & JS): Network-First dengan Cache Fallback
  // Menjamin pembaruan layout dan skrip langsung aktif saat online tanpa tertahan cache basi
  if (url.pathname.startsWith('/assets/css/') || url.pathname.startsWith('/assets/js/') || (url.pathname.startsWith('/dashboard/') && url.pathname.endsWith('.js'))) {
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
          throw new Error('Offline and critical asset not cached: ' + req.url);
        })
    );
    return;
  }

  // Static Assets (Fonts, Images, Icons, Manifest): Stale-While-Revalidate
  if (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkRes));
          }
          return networkRes;
        }).catch(() => {});
        return cached || fetchPromise;
      })
    );
  }
});
