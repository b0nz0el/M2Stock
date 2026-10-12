/* ═══════════════════════════════════════════════════
   aQuaStock Pro — navigation.js
   Routing antar halaman, sidebar drawer & sinkronisasi tab aktif
   ═══════════════════════════════════════════════════ */
const pageTitles = {
  dashboard: 'Dashboard', items: 'Barang', in: 'Barang Masuk',
  out: 'Barang Keluar', po: 'Purchase Order', return: 'Retur',
  suppliers: 'Supplier', customers: 'Customer', cash: 'Kas & Keuangan',
  debt: 'Hutang & Piutang', report: 'Laporan', users: 'Kelola User',
  audit: 'Audit Log', notif: 'Notifikasi', backup: 'Backup', settings: 'Settings'
};

let activeBottomTab = 'dashboard';

/* Peta id halaman → slug folder (clean URL, tanpa .html) */
const PAGE_SLUGS = {
  dashboard: '', items: 'items', in: 'in', out: 'out',
  po: 'po', return: 'return', suppliers: 'suppliers',
  customers: 'customers', cash: 'cash', debt: 'debt',
  report: 'report', users: 'users', audit: 'audit',
  notif: 'notif', backup: 'backup', settings: 'settings'
};

/* Tab yang tersedia di bottom nav */
const BOTTOM_TABS = ['dashboard', 'items', 'in', 'out'];

/* Basis path folder dashboard, mis. "/aquastock-pro/dashboard/" */
function dashboardBase() {
  const path = window.location.pathname;
  const i = path.indexOf('/dashboard/');
  if (i !== -1) return path.slice(0, i + '/dashboard/'.length);
  // fallback: "/dashboard" tanpa garis miring di akhir
  const j = path.replace(/\/+$/, '').lastIndexOf('/dashboard');
  if (j !== -1) return path.slice(0, j + '/dashboard'.length) + '/';
  return './';
}

/* Tentukan id halaman dari URL saat ini (clean URL) */
function currentPageId() {
  let rest = window.location.pathname.slice(dashboardBase().length);
  rest = rest.replace(/\.html$/, '').replace(/\/+$/, '');
  if (!rest) return 'dashboard';
  return rest.split('/')[0];
}

/* Set status aktif (sidebar + bottom nav + breadcrumb) sesuai halaman saat ini */
function syncActiveState() {
  const pageId = currentPageId();

  const bc = document.getElementById('breadcrumb');
  if (bc && pageTitles[pageId]) bc.textContent = pageTitles[pageId];

  document.querySelectorAll('.menu-item').forEach(function(m) {
    const match = m.getAttribute('onclick') && m.getAttribute('onclick').match(/'([a-z]+)'/);
    const isActive = !!match && match[1] === pageId;
    m.classList.toggle('active', isActive);
    m.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  const tabToActivate = BOTTOM_TABS.indexOf(pageId) !== -1 ? pageId : 'menu';
  document.querySelectorAll('.bottom-nav-item').forEach(function(b) {
    const isActive = b.dataset.tab === tabToActivate;
    b.classList.toggle('active', isActive);
    if (isActive) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  activeBottomTab = tabToActivate;
}

/* Bangun URL bersih untuk sebuah halaman, mis. "/aquastock-pro/dashboard/items/" */
function pageUrl(pageId) {
  const slug = PAGE_SLUGS[pageId] !== undefined ? PAGE_SLUGS[pageId] : pageId;
  return dashboardBase() + (slug ? slug + '/' : '');
}

/* Navigasi: multi-page clean URL → arahkan ke /dashboard/<slug>/ */
function showPage(pageId, element) {
  window.location.href = pageUrl(pageId);
}

function bottomNavTap(tab, event) {
  if (tab === 'menu') { openMenuDrawer(event); return; }
  showPage(tab);
}

function openMenuDrawer(event) {
  const aside = document.querySelector('aside');
  if (!aside) return;

  if (aside.classList.contains('open')) {
    closeSidebar();
    return;
  }

  document.querySelectorAll('.bottom-nav-item').forEach(function(item) {
    item.classList.remove('active');
  });
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
  aside.classList.add('open');
}

function toggleSidebar() {
  const aside = document.querySelector('aside');
  if (!aside) return;
  aside.classList.toggle('open');
}

function closeSidebar() {
  const aside = document.querySelector('aside');
  if (aside) aside.classList.remove('open');

  document.querySelectorAll('.bottom-nav-item').forEach(function(b) {
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });
  const target = document.querySelector('.bottom-nav-item[data-tab="' + activeBottomTab + '"]');
  if (target) {
    target.classList.add('active');
    target.setAttribute('aria-current', 'page');
  }
}

/* ═══════════════════════════════════════════════
   EVENT SIDEBAR (menu-item & area gelap)
   ═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  // Event menu sidebar — HANYA SATU tempat
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function() {
      const match = this.getAttribute('onclick')?.match(/'(\w+)'/);
      if (!match) return;
      const tab = match[1];
      activeBottomTab = tab;
      document.querySelectorAll('.bottom-nav-item').forEach(b => {
        const isActive = b.dataset.tab === tab;
        b.classList.toggle('active', isActive);
        if (isActive) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      if (window.innerWidth <= MOBILE_BREAKPOINT) closeSidebar();
    });
  });

  // Tap area gelap di luar sidebar
  const aside = document.querySelector('aside');
  if (aside) {
    aside.addEventListener('click', function(e) {
      if (e.target === aside) closeSidebar();
    });
  }
  // Sinkronkan tab aktif dengan halaman yang sedang dibuka
  syncActiveState();
});
