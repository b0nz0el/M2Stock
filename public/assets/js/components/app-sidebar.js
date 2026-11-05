/* ═══════════════════════════════════════════════════
   Aquastock Pro — app-sidebar.js
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

    // 0. Terapkan role & filter menu instan dari cache untuk mencegah flash menu
    let initialRole = 'OWNER';
    try {
      const rawRbac = sessionStorage.getItem('rbac_user_role');
      if (rawRbac) {
        initialRole = JSON.parse(rawRbac)?.role || initialRole;
      } else {
        const rawAuth = localStorage.getItem('auth_user');
        if (rawAuth) {
          initialRole = JSON.parse(rawAuth)?.role || initialRole;
        }
      }
    } catch (_) {}
    this._applyRoleBadge(initialRole);
    this._applyMenuAccess(initialRole);

    // Inisialisasi ikon Lucide
    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons(this);
    } else if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

    // Event delegation & highlight menu aktif
    this.addEventListener('click', this._handleClick);
    this._highlightActiveMenu();
    this._loadUserProfile();
    this._loadStoreInfo();
    this._loadBadgeCounts();

    this._handleStoreUpdate = (e) => {
      if (e?.detail?.name) this._updateStoreName(e.detail.name);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('aquastock:store-info-updated', this._handleStoreUpdate);
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._handleClick);
    document.removeEventListener('keydown', this._handleTrapFocus);
    if (typeof window !== 'undefined' && this._handleStoreUpdate) {
      window.removeEventListener('aquastock:store-info-updated', this._handleStoreUpdate);
    }
  }

  _applyRoleBadge(role) {
    const roleEl = this.querySelector('#sidebar-user-role');
    if (!roleEl || !role) return;
    const r = role.toString().trim().toUpperCase();
    if (r === 'STAFF') {
      roleEl.textContent = 'STAFF';
      roleEl.className = 'badge bg-[#34C759]/20 text-[#34C759]';
    } else if (r === 'VIEWER') {
      roleEl.textContent = 'VIEWER';
      roleEl.className = 'badge bg-[#AF52DE]/20 text-[#AF52DE]';
    } else if (r === 'OWNER') {
      roleEl.textContent = 'OWNER';
      roleEl.className = 'badge bg-[#0088CC]/20 text-[#32ADE6]';
    }
    this._applyMenuAccess(r);
  }

  _applyMenuAccess(role) {
    const r = (role || 'VIEWER').toString().trim().toUpperCase();
    const accessMatrix = (typeof window !== 'undefined' && window.RBAC?.MENU_ACCESS)
      ? window.RBAC.MENU_ACCESS
      : {
          dashboard:  ['OWNER', 'STAFF', 'VIEWER'],
          items:      ['OWNER', 'STAFF'],
          pricing:    ['OWNER', 'STAFF'],
          in:         ['OWNER', 'STAFF'],
        out:        ['OWNER', 'STAFF'],
          po:         ['OWNER', 'STAFF', 'VIEWER'],
          return:     ['OWNER', 'STAFF', 'VIEWER'],
        suppliers:  ['OWNER', 'STAFF'],
        customers:  ['OWNER', 'STAFF'],
        cash:       ['OWNER', 'STAFF'],
        debt:       ['OWNER', 'STAFF'],
        report:     ['OWNER'],
        users:      ['OWNER', 'STAFF'],
        audit:      ['OWNER', 'STAFF'],
        backup:     ['OWNER', 'STAFF'],
        settings:   ['OWNER', 'STAFF'],
          notif:      ['OWNER', 'STAFF'],
        };

    const menuItems = this.querySelectorAll('.menu-item[data-page]');
    menuItems.forEach(item => {
      const page = item.getAttribute('data-page');
      const allowed = accessMatrix[page];
      if (allowed && allowed.includes(r)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });

    // Sembunyikan group separator jika semua item di dalam group hidden
    const sectionTitles = this.querySelectorAll('.section-title');
    sectionTitles.forEach(title => {
      let next = title.nextElementSibling;
      let hasVisibleItem = false;
      while (next && !next.classList.contains('section-title')) {
        if (next.classList.contains('menu-item') && next.style.display !== 'none') {
          hasVisibleItem = true;
          break;
        }
        next = next.nextElementSibling;
      }
      title.style.display = hasVisibleItem ? '' : 'none';
    });
  }

  async _loadUserProfile() {
    // 1. Sinkronisasi instan dari cache localStorage (jika tersedia)
    try {
      const rawAuth = localStorage.getItem('auth_user');
      if (rawAuth) {
        const cached = JSON.parse(rawAuth);
        const emailEl = this.querySelector('#sidebar-user-email');
        const avatarEl = this.querySelector('#sidebar-user-avatar');
        const name = cached.full_name || cached.name || cached.email;
        if (name) {
          if (emailEl) emailEl.textContent = name;
          if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
        }
        if (cached.role) {
          this._applyRoleBadge(cached.role);
        }
      }
    } catch (_) {}

    // 2. Ambil user & role aktual dari Auth dan Supabase
    try {
      let retries = 0;
      while ((typeof window === 'undefined' || (!window.Auth && !window.supabase)) && retries < 25) {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
          break;
        }
        await new Promise(r => setTimeout(r, 40));
        retries++;
      }

      let user = null;
      if (typeof window !== 'undefined' && window.Auth && typeof window.Auth.getCurrentUser === 'function') {
        user = await window.Auth.getCurrentUser();
      } else if (typeof window !== 'undefined' && window.supabase && window.supabase.auth) {
        const { data } = await window.supabase.auth.getUser();
        user = data?.user || null;
      }

      if (user) {
        const emailEl = this.querySelector('#sidebar-user-email');
        const avatarEl = this.querySelector('#sidebar-user-avatar');
        let displayName = user.full_name || user.user_metadata?.full_name || user.name || user.email || 'Pengguna';

        // Filter valid app roles: abaikan role internal auth seperti 'authenticated' / 'anon'
        let role = null;
        const candidateRole = (user.role || '').toUpperCase();
        if (['OWNER', 'STAFF', 'VIEWER'].includes(candidateRole)) {
          role = candidateRole;
        } else if (user.user_metadata?.role) {
          const metaRole = (user.user_metadata.role).toString().trim().toUpperCase();
          if (['OWNER', 'STAFF', 'VIEWER'].includes(metaRole)) {
            role = metaRole;
          }
        }

        // Ambil role langsung dari tabel profiles di Supabase jika client tersedia
        if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.from === 'function' && user.id) {
          try {
            const { data: profile, error } = await window.supabase
              .from('profiles')
              .select('role, full_name')
              .eq('id', user.id)
              .maybeSingle();

            if (!error && profile) {
              if (profile.role) role = profile.role.toString().trim().toUpperCase();
              if (profile.full_name) {
                displayName = profile.full_name;
              }
            }
          } catch (_) {}
        }

        if (emailEl) emailEl.textContent = displayName;
        if (avatarEl && displayName) avatarEl.textContent = displayName.charAt(0).toUpperCase();

        if (role) {
          this._applyRoleBadge(role);
          try {
            const currentCache = JSON.parse(localStorage.getItem('auth_user') || '{}');
            localStorage.setItem('auth_user', JSON.stringify({
              ...currentCache,
              id: user.id || currentCache.id,
              email: user.email || currentCache.email,
              full_name: displayName,
              name: displayName,
              role: role
            }));
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  _updateStoreName(name) {
    const storeEl = this.querySelector('#sidebar-store-name');
    if (storeEl && name) {
      storeEl.textContent = name;
    }
  }

  async _loadStoreInfo() {
    try {
      const cached = localStorage.getItem('aquastock_store_info');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.name) {
          this._updateStoreName(parsed.name);
        }
      }
    } catch (_) {}

    try {
      if (typeof window !== 'undefined' && window.Api?.settings?.getStoreInfo) {
        const storeInfo = await window.Api.settings.getStoreInfo();
        if (storeInfo && storeInfo.name) {
          this._updateStoreName(storeInfo.name);
        }
      }
    } catch (_) {}
  }

  async _loadBadgeCounts() {
    const itemsBadge = this.querySelector('#sidebar-items-badge') || this.querySelector('.menu-item[data-page="items"] span');
    const notifBadge = this.querySelector('#sidebar-notif-badge') || this.querySelector('.menu-item[data-page="notif"] span');

    // 1. Tampilkan dari cache instan (sessionStorage)
    try {
      const cachedItems = sessionStorage.getItem('items_count');
      if (cachedItems !== null && itemsBadge) {
        itemsBadge.textContent = cachedItems;
      }
      const cachedNotif = sessionStorage.getItem('notif_unread_count');
      if (cachedNotif !== null && notifBadge) {
        const count = parseInt(cachedNotif, 10) || 0;
        if (count > 0) {
          notifBadge.textContent = count;
          notifBadge.classList.remove('hidden');
          notifBadge.style.display = '';
        } else {
          notifBadge.classList.add('hidden');
          notifBadge.style.display = 'none';
        }
      }
    } catch (_) {}

    // 2. Sinkronkan dengan Supabase jika client tersedia
    try {
      let retries = 0;
      while ((typeof window === 'undefined' || !window.supabase) && retries < 25) {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
          break;
        }
        await new Promise(r => setTimeout(r, 40));
        retries++;
      }

      if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.from === 'function') {
        // Ambil jumlah produk aktual dari database
        const { count: itemsCount, error: itemsError } = await window.supabase
          .from('products')
          .select('*', { count: 'exact', head: true });

        if (!itemsError && itemsCount !== null && itemsCount !== undefined) {
          try { sessionStorage.setItem('items_count', itemsCount.toString()); } catch (_) {}
          if (itemsBadge) {
            itemsBadge.textContent = itemsCount;
          }
        }

        // Ambil jumlah notifikasi belum dibaca
        const { count: unreadCount, error: notifError } = await window.supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false);

        if (!notifError && unreadCount !== null && unreadCount !== undefined) {
          try { sessionStorage.setItem('notif_unread_count', unreadCount.toString()); } catch (_) {}
          if (notifBadge) {
            if (unreadCount > 0) {
              notifBadge.textContent = unreadCount;
              notifBadge.classList.remove('hidden');
              notifBadge.style.display = '';
            } else {
              notifBadge.classList.add('hidden');
              notifBadge.style.display = 'none';
            }
          }
        }
      }
    } catch (err) {
      // Abaikan jika network belum siap
    }
  }

  _onClick(e) {
    // 0. Aksi logout
    if (e.target.closest('[data-action="logout"]')) {
      try { localStorage.removeItem('auth_user'); } catch (_) {}
      try { sessionStorage.removeItem('rbac_user_role'); } catch (_) {}
      if (typeof window !== 'undefined') {
        if (window.Auth && typeof window.Auth.logout === 'function') {
          window.Auth.logout().then(() => {
            window.location.replace('/login/');
          }).catch(() => {
            window.location.replace('/login/');
          });
        } else {
          window.location.replace('/login/');
        }
      }
      return;
    }

    // 1. Aksi tombol tutup (mobile)
    if (e.target.closest('[data-action="close-sidebar"]')) {
      this.close();
      return;
    }

    // 2. Aksi navigasi menu item
    const menuItem = e.target.closest('.menu-item[data-page]');
    if (menuItem) {
      e.preventDefault();
      const pageId = menuItem.getAttribute('data-page');
      if (window.innerWidth <= 1024) {
        this.close();
      }
      this.dispatchEvent(new CustomEvent('app-sidebar:navigate', {
        bubbles: true,
        detail: { pageId }
      }));

      // Feedback visual instan: highlight langsung menu yang diklik
      this._highlightActiveMenu(pageId);

      if (typeof window !== 'undefined' && typeof window.showPage === 'function') {
        window.showPage(pageId);
      }
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

    // Sync active state back to current active page so 'menu' tab does not remain stuck
    const curPage = (typeof window !== 'undefined' && typeof window.currentPageId === 'function')
      ? window.currentPageId()
      : 'dashboard';
    const bottomTab = ['dashboard', 'items', 'in', 'out'].includes(curPage) ? curPage : 'menu';
    document.querySelectorAll('.bottom-nav-item').forEach(b => {
      const isActive = b.dataset.tab === bottomTab;
      b.classList.toggle('active', isActive);
      if (isActive) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });

    if (this._lastFocused && typeof this._lastFocused.focus === 'function' && document.body.contains(this._lastFocused)) {
      try {
        if (typeof focusProgrammatically === 'function') {
          focusProgrammatically(this._lastFocused);
        } else {
          this._lastFocused.focus();
        }
      } catch (_) {}
    }
    this._lastFocused = null;
  }

  render() {
    const getUrl = (slug) => {
      if (typeof window !== 'undefined' && typeof window.pageUrl === 'function') {
        return window.pageUrl(slug);
      }
      return '/dashboard/' + (slug === 'dashboard' ? '' : slug + '/');
    };

    this.innerHTML = `
      <aside class="w-64 bg-[#1C1C1E] flex flex-col border-r border-white/5" aria-label="Sidebar navigasi">
        <!-- Brand Header -->
        <div class="p-5 flex items-center gap-3 border-b border-white/5 shrink-0">
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
            <span class="text-base font-bold block truncate">Aquastock</span>
            <span class="text-[10px] text-[#A0A0A5] flex items-center gap-1">
              <span class="w-1.5 h-1.5 bg-[#34C759] rounded-full"></span>
              <span id="sidebar-store-name" class="truncate max-w-[130px]">Habitic</span>
            </span>
          </div>
        </div>

        <!-- Tombol Tutup Mobile (data-action) -->
        <button type="button" data-action="close-sidebar" aria-label="Tutup menu"
                class="md:hidden absolute top-4 right-4 text-[#A0A0A5] hover:text-white p-2 z-10">
          <i data-lucide="x" class="w-5 h-5" aria-hidden="true"></i>
        </button>

        <!-- Navigasi Menu (data-page, semantic <a> links untuk View Transition API) -->
        <nav class="flex-1 p-2 overflow-y-auto min-h-0" aria-label="Menu utama">
          <div class="section-title">Utama</div>
          <a href="${getUrl('dashboard')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium" data-page="dashboard">
            <i data-lucide="layout-dashboard" class="w-4 h-4" aria-hidden="true"></i> Dashboard
          </a>

          <div class="section-title">Master Data</div>
          <a href="${getUrl('items')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="items">
            <i data-lucide="package" class="w-4 h-4" aria-hidden="true"></i> Master Barang
            <span id="sidebar-items-badge" class="ml-auto text-xs bg-white/5 px-2 py-0.5 rounded font-mono">0</span>
          </a>
          <a href="${getUrl('pricing')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="pricing">
            <i data-lucide="sliders" class="w-4 h-4" aria-hidden="true"></i> Simulasi Harga
          </a>
          <a href="${getUrl('suppliers')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="suppliers">
            <i data-lucide="factory" class="w-4 h-4" aria-hidden="true"></i> Supplier
          </a>
          <a href="${getUrl('customers')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="customers">
            <i data-lucide="users" class="w-4 h-4" aria-hidden="true"></i> Customer
          </a>

          <div class="section-title">Inventori</div>
          <a href="${getUrl('in')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="in">
            <i data-lucide="arrow-down-circle" class="w-4 h-4" aria-hidden="true"></i> Barang Masuk
          </a>
          <a href="${getUrl('out')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="out">
            <i data-lucide="arrow-up-circle" class="w-4 h-4" aria-hidden="true"></i> Barang Keluar
          </a>
          <a href="${getUrl('po')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="po">
            <i data-lucide="clipboard-list" class="w-4 h-4" aria-hidden="true"></i> Purchase Order
          </a>
          <a href="${getUrl('return')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="return">
            <i data-lucide="rotate-ccw" class="w-4 h-4" aria-hidden="true"></i> Retur
          </a>

          <div class="section-title">Keuangan</div>
          <a href="${getUrl('cash')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="cash">
            <i data-lucide="wallet" class="w-4 h-4" aria-hidden="true"></i> Kas & Keuangan
          </a>
          <a href="${getUrl('debt')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="debt">
            <i data-lucide="trending-down" class="w-4 h-4" aria-hidden="true"></i> Hutang & Piutang
          </a>

          <div class="section-title">Laporan</div>
          <a href="${getUrl('report')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="report">
            <i data-lucide="bar-chart-3" class="w-4 h-4" aria-hidden="true"></i> Laporan
          </a>

          <div class="section-title">Sistem</div>
          <a href="${getUrl('users')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="users">
            <i data-lucide="user-cog" class="w-4 h-4" aria-hidden="true"></i> Kelola User
          </a>
          <a href="${getUrl('audit')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="audit">
            <i data-lucide="scroll-text" class="w-4 h-4" aria-hidden="true"></i> Audit Log
          </a>
          <a href="${getUrl('notif')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="notif">
            <i data-lucide="bell" class="w-4 h-4" aria-hidden="true"></i> Notifikasi
            <span id="sidebar-notif-badge" class="ml-auto text-xs bg-[#FF3B30] px-2 py-0.5 rounded-full font-semibold hidden">0</span>
          </a>
          <a href="${getUrl('backup')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="backup">
            <i data-lucide="database-backup" class="w-4 h-4" aria-hidden="true"></i> Backup
          </a>
          <a href="${getUrl('settings')}" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" data-page="settings">
            <i data-lucide="settings" class="w-4 h-4" aria-hidden="true"></i> Settings
          </a>
          <button type="button" onclick="window.checkForPwaUpdate()" class="menu-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#32ADE6] hover:bg-[#32ADE6]/10 transition cursor-pointer" data-action="check-update" title="Periksa dan update pembaruan PWA">
            <i data-lucide="refresh-cw" class="w-4 h-4 text-[#32ADE6]" aria-hidden="true"></i> Cek Pembaruan
            <span class="ml-auto text-[10px] bg-[#32ADE6]/15 text-[#32ADE6] px-1.5 py-0.5 rounded font-mono font-semibold" data-app-version-sidebar>v3.5.42</span>
          </button>

          <!-- Tombol Keluar Langsung di Drawer Mobile -->
          <button type="button" data-action="logout" class="sidebar-drawer-logout w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-[#FF453A] hover:bg-[#FF453A]/10 border border-[#FF453A]/20 transition mt-4 mb-2">
            <i data-lucide="log-out" class="w-4 h-4 text-[#FF453A]" aria-hidden="true"></i>
            <span>Keluar dari Akun</span>
          </button>
        </nav>

        <!-- User Profile Footer -->
        <div class="sidebar-user-footer p-4 border-t border-white/5 flex items-center gap-3 shrink-0">
          <div id="sidebar-user-avatar" class="w-10 h-10 rounded-full bg-gradient-to-br from-[#0088CC] to-[#32ADE6] grid place-items-center font-bold text-sm shadow-lg flex-shrink-0">D</div>
          <div class="flex-1 min-w-0">
            <p id="sidebar-user-email" class="text-sm font-semibold truncate">User</p>
            <span id="sidebar-user-role" class="badge bg-[#0088CC]/20 text-[#32ADE6]">OWNER</span>
          </div>
          <button type="button" data-action="logout" title="Keluar / Logout" aria-label="Keluar / Logout"
                  class="w-11 h-11 bg-[#FF453A]/10 hover:bg-[#FF453A]/15 rounded-xl text-[#FF453A] hover:text-[#FF3B30] border border-[#FF453A]/20 transition flex-shrink-0 grid place-items-center">
            <i data-lucide="log-out" class="w-4 h-4" aria-hidden="true"></i>
          </button>
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
