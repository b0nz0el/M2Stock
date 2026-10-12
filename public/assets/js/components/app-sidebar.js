/* ═══════════════════════════════════════════════════
   aQuaStock Pro — app-sidebar.js
   Web Component <app-sidebar> (Light DOM)
   ═══════════════════════════════════════════════════ */

class AppSidebar extends HTMLElement {
  constructor() {
    super();
    this._lastFocused = null;
    this._handleTrapFocus = this._trapFocus.bind(this);
    this._handleClick = this._onClick.bind(this);
  }

  connectedCallback() {
    this.render();

    // Inisialisasi ikon Lucide
    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons(this);
    } else if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

    // Event delegation & highlight menu aktif
    this.addEventListener('click', this._handleClick);
    this._highlightActiveMenu();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._handleClick);
    document.removeEventListener('keydown', this._handleTrapFocus);
  }

  _onClick(e) {
    // 1. Aksi tombol tutup (mobile)
    if (e.target.closest('[data-action="close-sidebar"]')) {
      this.close();
      return;
    }

    // 2. Aksi navigasi menu item
    const menuItem = e.target.closest('.menu-item[data-page]');
    if (menuItem) {
      const pageId = menuItem.getAttribute('data-page');
      if (window.innerWidth <= 1024) {
        this.close();
      }
      this.dispatchEvent(new CustomEvent('app-sidebar:navigate', {
        bubbles: true,
        detail: { pageId }
      }));
      return;
    }

    // 3. Tap area backdrop di luar panel sidebar (mobile)
    const aside = this.querySelector('aside');
    if (aside && e.target === aside) {
      this.close();
    }
  }

  _highlightActiveMenu(targetPageId) {
    const pageId = targetPageId || (typeof currentPageId === 'function' ? currentPageId() : 'dashboard');
    this.querySelectorAll('.menu-item[data-page]').forEach((item) => {
      const isActive = item.getAttribute('data-page') === pageId;
      item.classList.toggle('active', isActive);
      if (isActive) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  _trapFocus(e) {
    const aside = this.querySelector('aside');
    if (!aside || !aside.classList.contains('open')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }

    if (e.key !== 'Tab') return;

    const focusables = aside.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusables || focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    // Guard: Mencegah fokus bocor ke elemen di luar drawer
    if (!aside.contains(active)) {
      e.preventDefault();
      first.focus();
      return;
    }

    if (e.shiftKey) {
      if (active === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  open() {
    const aside = this.querySelector('aside');
    if (!aside) return;

    aside.classList.add('open');

    // Update aria-expanded pada tombol toggle
    document.querySelectorAll('[data-action="toggle-sidebar"], [data-action="open-menu"]').forEach(b => {
      b.setAttribute('aria-expanded', 'true');
    });

    // Simpan trigger focus dengan fallback tombol menu
    this._lastFocused = (document.activeElement && document.activeElement !== document.body)
      ? document.activeElement
      : document.querySelector('[data-action="toggle-sidebar"], [data-action="open-menu"]');

    document.addEventListener('keydown', this._handleTrapFocus);

    const targetFocus = aside.querySelector('[data-action="close-sidebar"]') || aside.querySelector('.menu-item');
    if (targetFocus) setTimeout(() => targetFocus.focus(), 60);
  }

  close() {
    const aside = this.querySelector('aside');
    if (!aside) return;

    aside.classList.remove('open');

    document.querySelectorAll('[data-action="toggle-sidebar"], [data-action="open-menu"]').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
    });

    document.removeEventListener('keydown', this._handleTrapFocus);

    if (this._lastFocused?.focus) {
      if (typeof focusProgrammatically === 'function') {
        focusProgrammatically(this._lastFocused);
      } else {
        this._lastFocused.focus();
      }
      this._lastFocused = null;
    }
  }

  render() {
    this.innerHTML = `
      <aside class="w-64 bg-[#1C1C1E] flex flex-col border-r border-white/5" aria-label="Sidebar navigasi">
        <!-- Brand Header -->
        <div class="p-5 flex items-center gap-3 border-b border-white/5">
          <div class="w-10 h-10 rounded-xl overflow-hidden grid place-items-center shadow-lg shadow-[#0088CC]/20">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="w-full h-full" aria-hidden="true">
              <defs>
                <linearGradient id="aq-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#32ADE6"/>
                  <stop offset="100%" stop-color="#0088CC"/>
                </linearGradient>
              </defs>
              <rect x="10" y="10" width="80" height="80" rx="22" fill="url(#aq-gradient)"/>
              <path d="M50 26 L32 66 L38 66 L42 58 L58 58 L62 66 L68 66 L50 26 Z M45 53 L50 42 L55 53 Z"
                    fill="#FFFFFF"/>
              <circle cx="50" cy="72" r="3.5" fill="#FFFFFF"/>
            </svg>
          </div>
          <div class="min-w-0">
            <span class="text-base font-bold block truncate">aQuaStock</span>
            <span class="text-[10px] text-[#A0A0A5] flex items-center gap-1">
              <span class="w-1.5 h-1.5 bg-[#34C759] rounded-full"></span>
              v3.0 PRO
            </span>
          </div>
        </div>

        <!-- Tombol Tutup Mobile (data-action) -->
        <button type="button" data-action="close-sidebar" aria-label="Tutup menu"
                class="md:hidden absolute top-4 right-4 text-[#A0A0A5] hover:text-white p-2 z-10">
          <i data-lucide="x" class="w-5 h-5" aria-hidden="true"></i>
        </button>

        <!-- Navigasi Menu (data-page, no inline onclick) -->
        <nav class="flex-1 p-2 overflow-y-auto" aria-label="Menu utama">
          <div class="section-title">Utama</div>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium" data-page="dashboard">
            <i data-lucide="layout-dashboard" class="w-4 h-4" aria-hidden="true"></i> Dashboard
          </button>

          <div class="section-title">Inventori</div>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="items">
            <i data-lucide="package" class="w-4 h-4" aria-hidden="true"></i> Barang
            <span class="ml-auto text-xs bg-white/5 px-2 py-0.5 rounded font-mono">10</span>
          </button>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="in">
            <i data-lucide="arrow-down-circle" class="w-4 h-4" aria-hidden="true"></i> Barang Masuk
          </button>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="out">
            <i data-lucide="arrow-up-circle" class="w-4 h-4" aria-hidden="true"></i> Barang Keluar
          </button>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="po">
            <i data-lucide="clipboard-list" class="w-4 h-4" aria-hidden="true"></i> Purchase Order
          </button>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="return">
            <i data-lucide="rotate-ccw" class="w-4 h-4" aria-hidden="true"></i> Retur
          </button>

          <div class="section-title">Master Data</div>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="suppliers">
            <i data-lucide="factory" class="w-4 h-4" aria-hidden="true"></i> Supplier
          </button>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="customers">
            <i data-lucide="users" class="w-4 h-4" aria-hidden="true"></i> Customer
          </button>

          <div class="section-title">Keuangan</div>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="cash">
            <i data-lucide="wallet" class="w-4 h-4" aria-hidden="true"></i> Kas & Keuangan
          </button>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="debt">
            <i data-lucide="trending-down" class="w-4 h-4" aria-hidden="true"></i> Hutang & Piutang
          </button>

          <div class="section-title">Laporan</div>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="report">
            <i data-lucide="bar-chart-3" class="w-4 h-4" aria-hidden="true"></i> Laporan
          </button>

          <div class="section-title">Sistem</div>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="users">
            <i data-lucide="user-cog" class="w-4 h-4" aria-hidden="true"></i> Kelola User
          </button>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="audit">
            <i data-lucide="scroll-text" class="w-4 h-4" aria-hidden="true"></i> Audit Log
          </button>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="notif">
            <i data-lucide="bell" class="w-4 h-4" aria-hidden="true"></i> Notifikasi
            <span class="ml-auto text-xs bg-[#FF3B30] px-2 py-0.5 rounded-full font-semibold">3</span>
          </button>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="backup">
            <i data-lucide="database-backup" class="w-4 h-4" aria-hidden="true"></i> Backup
          </button>
          <button type="button" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="settings">
            <i data-lucide="settings" class="w-4 h-4" aria-hidden="true"></i> Settings
          </button>
        </nav>

        <!-- User Profile Footer -->
        <div class="p-4 border-t border-white/5 flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[#0088CC] to-[#32ADE6] grid place-items-center font-bold text-sm shadow-lg">M</div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold truncate">Mr David</p>
            <span class="badge bg-[#0088CC]/20 text-[#32ADE6]">OWNER</span>
          </div>
        </div>
      </aside>
    `;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('app-sidebar')) {
  customElements.define('app-sidebar', AppSidebar);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AppSidebar };
}
