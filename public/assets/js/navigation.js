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

  const appSidebar = document.querySelector('app-sidebar');
  if (appSidebar && typeof appSidebar._highlightActiveMenu === 'function') {
    appSidebar._highlightActiveMenu(pageId);
  } else {
    document.querySelectorAll('.menu-item').forEach(function(m) {
      const match = (m.getAttribute('onclick') && m.getAttribute('onclick').match(/'([a-z]+)'/))
        || (m.dataset && m.dataset.page ? [null, m.dataset.page] : null);
      const isActive = !!match && match[1] === pageId;
      m.classList.toggle('active', isActive);
      if (isActive) m.setAttribute('aria-current', 'page');
      else m.removeAttribute('aria-current');
    });
  }

  const tabLabels = {
    dashboard: 'Dashboard',
    items: 'Barang',
    in: 'Barang Masuk',
    out: 'Barang Keluar',
    menu: 'Menu navigasi'
  };

  const tabToActivate = BOTTOM_TABS.indexOf(pageId) !== -1 ? pageId : 'menu';
  document.querySelectorAll('.bottom-nav-item').forEach(function(b) {
    const tab = b.dataset.tab;
    if (!b.getAttribute('aria-label') && tabLabels[tab]) {
      b.setAttribute('aria-label', tabLabels[tab]);
    }
    const isActive = tab === tabToActivate;
    b.classList.toggle('active', isActive);
    if (isActive) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  activeBottomTab = tabToActivate;

  // Inisialisasi aria-expanded pada tombol toggle
  updateSidebarAria(false);
}

/* Bangun URL bersih untuk sebuah halaman, mis. "/aquastock-pro/dashboard/items/" */
function pageUrl(pageId) {
  const slug = PAGE_SLUGS[pageId] !== undefined ? PAGE_SLUGS[pageId] : pageId;
  return dashboardBase() + (slug ? slug + '/' : '');
}

/* Navigasi: multi-page clean URL → arahkan ke /dashboard/<slug>/ */
function showPage(pageId) {
  window.location.href = pageUrl(pageId);
}

function bottomNavTap(tab, event) {
  if (tab === 'menu') { openMenuDrawer(event); return; }
  showPage(tab);
}

/* ═══════════════════════════════════════════════
   ACCESSIBILITY & FOCUS TRAP
   ═══════════════════════════════════════════════ */
let lastFocusedElement = null;

function updateSidebarAria(isOpen) {
  const aside = document.querySelector('aside');
  if (aside && !aside.closest('app-sidebar')) {
    aside.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }
  document.querySelectorAll('button[onclick*="toggleSidebar"], button[onclick*="openMenuDrawer"], [data-action="toggle-sidebar"], [data-action="open-menu"]').forEach(b => {
    b.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
}

function trapSidebarFocus(e) {
  const aside = document.querySelector('aside');
  if (!aside || !aside.classList.contains('open')) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    closeSidebar();
    return;
  }

  if (e.key !== 'Tab') return;

  const focusables = aside.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
  if (!focusables || focusables.length === 0) return;

  const firstFocusable = focusables[0];
  const lastFocusable = focusables[focusables.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === firstFocusable) {
      e.preventDefault();
      lastFocusable.focus();
    }
  } else {
    if (document.activeElement === lastFocusable) {
      e.preventDefault();
      firstFocusable.focus();
    }
  }
}

function openMenuDrawer(event) {
  const appSidebar = document.querySelector('app-sidebar');
  if (appSidebar && typeof appSidebar.open === 'function') {
    const aside = appSidebar.querySelector('aside');
    if (aside && aside.classList.contains('open')) {
      closeSidebar();
      return;
    }
    document.querySelectorAll('.bottom-nav-item').forEach(function(item) {
      item.classList.remove('active');
    });
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
    appSidebar.open();
    return;
  }

  const aside = document.querySelector('aside');
  if (!aside) return;

  if (aside.classList.contains('open')) {
    closeSidebar();
    return;
  }

  lastFocusedElement = (event && event.currentTarget) || document.activeElement;

  document.querySelectorAll('.bottom-nav-item').forEach(function(item) {
    item.classList.remove('active');
  });
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
  aside.classList.add('open');
  updateSidebarAria(true);

  document.addEventListener('keydown', trapSidebarFocus);

  // Fokus elemen pertama di sidebar
  const closeBtn = aside.querySelector('button[onclick*="closeSidebar"]') || aside.querySelector('.menu-item');
  if (closeBtn) setTimeout(() => closeBtn.focus(), 60);
}

function toggleSidebar(event) {
  const appSidebar = document.querySelector('app-sidebar');
  if (appSidebar && typeof appSidebar.open === 'function') {
    const aside = appSidebar.querySelector('aside');
    if (aside && aside.classList.contains('open')) {
      closeSidebar();
    } else {
      appSidebar.open();
    }
    return;
  }

  const aside = document.querySelector('aside');
  if (!aside) return;

  if (aside.classList.contains('open')) {
    closeSidebar();
  } else {
    lastFocusedElement = (event && event.currentTarget) || document.activeElement;
    aside.classList.add('open');
    updateSidebarAria(true);
    document.addEventListener('keydown', trapSidebarFocus);
    const closeBtn = aside.querySelector('button[onclick*="closeSidebar"]') || aside.querySelector('.menu-item');
    if (closeBtn) setTimeout(() => closeBtn.focus(), 60);
  }
}

function closeSidebar() {
  const appSidebar = document.querySelector('app-sidebar');
  if (appSidebar && typeof appSidebar.close === 'function') {
    appSidebar.close();
  } else {
    const aside = document.querySelector('aside');
    if (aside) aside.classList.remove('open');
  }
  updateSidebarAria(false);
  document.removeEventListener('keydown', trapSidebarFocus);

  document.querySelectorAll('.bottom-nav-item').forEach(function(b) {
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });
  const target = document.querySelector('.bottom-nav-item[data-tab="' + activeBottomTab + '"]');
  if (target) {
    target.classList.add('active');
    target.setAttribute('aria-current', 'page');
  }

  // Kembalikan fokus ke elemen pemicu
  if (!appSidebar && lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

/* ═══════════════════════════════════════════════
   CUSTOM EVENT LISTENERS (<app-sidebar>)
   ═══════════════════════════════════════════════ */
document.addEventListener('app-sidebar:navigate', function(e) {
  if (e.detail && e.detail.pageId && typeof showPage === 'function') {
    showPage(e.detail.pageId);
  }
});

/* Expose global functions to window */
if (typeof window !== 'undefined') {
  window.pageUrl = pageUrl;
  window.showPage = showPage;
  window.bottomNavTap = bottomNavTap;
  window.openMenuDrawer = openMenuDrawer;
  window.closeSidebar = closeSidebar;
  window.toggleSidebar = toggleSidebar;
  window.currentPageId = currentPageId;
  window.syncActiveState = syncActiveState;
}

/* ═══════════════════════════════════════════════
   EVENT SIDEBAR & PAGE HEADING FOCUS
   ═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  // Event menu sidebar (hanya jika bukan app-sidebar, karena app-sidebar punya event delegation sendiri)
  if (!document.querySelector('app-sidebar')) {
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
        if (window.innerWidth <= (typeof MOBILE_BREAKPOINT !== 'undefined' ? MOBILE_BREAKPOINT : 1024)) {
          closeSidebar();
        }
      });
    });

    // Tap area gelap di luar sidebar
    const aside = document.querySelector('aside');
    if (aside) {
      aside.addEventListener('click', function(e) {
        if (e.target === aside) closeSidebar();
      });
    }
  }

  // Sinkronkan tab aktif dengan halaman yang sedang dibuka
  syncActiveState();

  // A11y: Pindahkan fokus ke heading halaman setelah navigasi
  const heading = document.querySelector('main h1, main h2, .page h1, .page h2');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    if (typeof focusProgrammatically === 'function') {
      focusProgrammatically(heading);
    } else {
      heading.focus();
    }
  }
});

/* Export untuk keperluan pengujian / module */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pageTitles,
    PAGE_SLUGS,
    BOTTOM_TABS,
    dashboardBase,
    currentPageId,
    syncActiveState,
    pageUrl,
    showPage,
    bottomNavTap,
    openMenuDrawer,
    toggleSidebar,
    closeSidebar,
    updateSidebarAria,
    trapSidebarFocus
  };
}
