/* ═══════════════════════════════════════════════════
   Aquastock Pro — navigation.js
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

/* Tentukan id halaman dari URL saat ini (clean URL, query param ?page=, atau hash) */
function currentPageId() {
  if (typeof window !== 'undefined' && window.location) {
    // 1. Cek query parameter (?page=in atau ?tab=in)
    if (window.location.search) {
      try {
        const params = new URLSearchParams(window.location.search);
        const p = params.get('page') || params.get('tab');
        if (p && (PAGE_SLUGS[p] !== undefined || (typeof document !== 'undefined' && document.getElementById('page-' + p)))) {
          return p;
        }
      } catch (e) {}
    }

    // 2. Cek sessionStorage dari 404 recovery
    if (typeof sessionStorage !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('spa_redirect');
        if (saved && (PAGE_SLUGS[saved] !== undefined || (typeof document !== 'undefined' && document.getElementById('page-' + saved)))) {
          sessionStorage.removeItem('spa_redirect');
          return saved;
        }
      } catch (e) {}
    }
  }

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

let isNavigating = false;

/* Trigger inisialisasi / muat ulang data untuk halaman target */
function triggerPageInit(pageId) {
  if (typeof window === 'undefined') return;
  switch (pageId) {
    case 'dashboard':
      if (typeof window.loadDashboardData === 'function') window.loadDashboardData();
      break;
    case 'items':
      if (typeof window.initItems === 'function') window.initItems();
      else if (typeof window.loadItemsFromBackend === 'function') window.loadItemsFromBackend();
      break;
    case 'in':
      if (typeof window.loadInTransactions === 'function') window.loadInTransactions();
      if (typeof window.loadDropdowns === 'function') window.loadDropdowns();
      break;
    case 'out':
      if (typeof window.loadOutTransactions === 'function') window.loadOutTransactions();
      if (typeof window.loadDropdowns === 'function') window.loadDropdowns();
      break;
    case 'po':
      if (typeof window.initPo === 'function') window.initPo();
      break;
    case 'return':
      if (typeof window.initReturn === 'function') window.initReturn();
      break;
    case 'suppliers':
      if (typeof window.loadSuppliers === 'function') window.loadSuppliers();
      break;
    case 'customers':
      if (typeof window.loadCustomers === 'function') window.loadCustomers();
      break;
    case 'cash':
      if (typeof window.initCash === 'function') window.initCash();
      break;
    case 'debt':
      if (typeof window.initDebt === 'function') window.initDebt();
      break;
    case 'report':
      if (typeof window.loadReport === 'function') window.loadReport();
      break;
    case 'users':
      if (typeof window.loadUsers === 'function') window.loadUsers();
      break;
    case 'audit':
      if (typeof window.initAudit === 'function') window.initAudit();
      break;
    case 'backup':
      if (typeof window.initBackup === 'function') window.initBackup();
      break;
    case 'settings':
      if (typeof window.initSettings === 'function') window.initSettings();
      break;
    case 'notif':
      if (typeof window.initNotif === 'function') window.initNotif();
      break;
  }
  if (typeof window.refreshIcons === 'function') {
    window.refreshIcons();
  } else if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/* Navigasi: SPA client routing (0ms transition) dengan fallback MPA clean URL */
function showPage(pageId, pushState = true) {
  if (!pageId) pageId = 'dashboard';

  const targetPageEl = document.getElementById('page-' + pageId);
  const isSpaMode = typeof document !== 'undefined' && document.querySelectorAll('.page').length > 1;

  // Mode SPA: jika ada container halaman target di dokumen
  if (isSpaMode && targetPageEl) {
    // 1. Matikan semua container halaman dan aktifkan target
    document.querySelectorAll('.page').forEach(function(p) {
      p.classList.remove('active');
    });
    targetPageEl.classList.add('active');

    // 2. Tandai item menu aktif di sidebar & bottom nav
    const appSidebar = document.querySelector('app-sidebar');
    if (appSidebar && typeof appSidebar._highlightActiveMenu === 'function') {
      appSidebar._highlightActiveMenu(pageId);
    }
    document.querySelectorAll('.bottom-nav-item').forEach(function(b) {
      const isActive = b.dataset.tab === pageId;
      b.classList.toggle('active', isActive);
      if (isActive) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    activeBottomTab = BOTTOM_TABS.indexOf(pageId) !== -1 ? pageId : 'menu';

    // 3. Update breadcrumb dan judul dokumen
    const bc = document.getElementById('breadcrumb');
    if (bc && pageTitles[pageId]) bc.textContent = pageTitles[pageId];
    if (typeof document !== 'undefined') {
      document.title = 'Aquastock Pro - ' + (pageTitles[pageId] || pageId);
    }

    // 4. Update riwayat peramban tanpa hard reload
    const url = pageUrl(pageId);
    if (pushState && typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
      if (window.location.pathname !== url) {
        window.history.pushState({ pageId: pageId }, '', url);
      }
    }

    // 5. Tutup sidebar mobile jika terbuka
    if (typeof window !== 'undefined' && window.innerWidth <= (typeof MOBILE_BREAKPOINT !== 'undefined' ? MOBILE_BREAKPOINT : 1024)) {
      closeSidebar();
    }

    // 6. Jalankan pemuatan data untuk halaman target
    triggerPageInit(pageId);

    // 7. A11y: pindahkan fokus ke heading halaman baru
    const heading = targetPageEl.querySelector('h1, h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      if (typeof focusProgrammatically === 'function') {
        focusProgrammatically(heading);
      } else {
        heading.focus();
      }
    }
    return;
  }

  // Mode Fallback MPA (jika halaman dibuka standalone)
  if (isNavigating) return;
  const currentId = currentPageId();
  if (currentId === pageId) return;

  const url = pageUrl(pageId);
  isNavigating = true;

  const appSidebar = document.querySelector('app-sidebar');
  if (appSidebar && typeof appSidebar._highlightActiveMenu === 'function') {
    appSidebar._highlightActiveMenu(pageId);
  }
  document.querySelectorAll('.bottom-nav-item').forEach(b => {
    const isActive = b.dataset.tab === pageId;
    b.classList.toggle('active', isActive);
    if (isActive) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });

  if (typeof window !== 'undefined' && window.innerWidth <= (typeof MOBILE_BREAKPOINT !== 'undefined' ? MOBILE_BREAKPOINT : 1024)) {
    closeSidebar();
  }

  window.location.href = url;
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
  if (document.querySelectorAll('.page').length > 1) {
    const initialPage = currentPageId();
    showPage(initialPage, false);
  } else {
    syncActiveState();
  }

  // Selesaikan animasi progress bar & reset state navigasi
  isNavigating = false;
  const navBar = document.getElementById('nav-progress-bar');
  if (navBar) {
    navBar.className = 'nav-progress-done';
    setTimeout(() => {
      if (navBar && navBar.parentNode) navBar.remove();
    }, 280);
  }

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

// Penanganan Back/Forward navigasi peramban (SPA routing)
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', function(e) {
    const pageId = (e.state && e.state.pageId) || currentPageId();
    showPage(pageId, false);
  });
}

// Penanganan Back/Forward cache (bfcache) pada peramban
window.addEventListener('pageshow', function() {
  isNavigating = false;
  const navBar = document.getElementById('nav-progress-bar');
  if (navBar && navBar.parentNode) navBar.remove();
  const mainContent = document.getElementById('main-content') || document.querySelector('main');
  if (mainContent) mainContent.style.opacity = '';
});

/* Meredam log unhandled rejection harmless akibat browser aborting view transitions saat navigasi cepat */
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason &&
      (event.reason.name === 'AbortError' ||
       (typeof event.reason.message === 'string' && event.reason.message.includes('Transition was skipped')))
    ) {
      event.preventDefault();
    }
  });
}

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
