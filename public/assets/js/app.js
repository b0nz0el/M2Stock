/* ═══════════════════════════════════════════════════
   Aquastock Pro — app.js
   Inisialisasi aplikasi, konversi tabel→card, bulk selection, shortcut
   ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════ */
if (typeof refreshIcons === 'function') {
  refreshIcons();
} else if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
  lucide.createIcons();
}

/* ═══════════════════════════════════════════════
   CUSTOM EVENT LISTENERS (Web Components)
   ═══════════════════════════════════════════════ */
document.addEventListener('app-sidebar:navigate', function(e) {
  if (e.detail && e.detail.pageId && typeof showPage === 'function') {
    showPage(e.detail.pageId);
  }
});

/* ═══════════════════════════════════════════════
   AUTO-CONVERT TABLE → CARD (data-label)
   ═══════════════════════════════════════════════ */
const MOBILE_BREAKPOINT = 1024;

/**
 * Sync data-label ke semua <td> dalam tabel .card
 * Berdasarkan header <thead> yang ada di table tersebut.
 * Sinkronkan saat inisialisasi dan saat baris dinamis ditambahkan.
 */
function syncTableLabels(table = null) {
  const tables = table ? [table] : document.querySelectorAll('.card table');
  tables.forEach(function(table) {
    if (!table.matches('.card table')) return;

    const headers = [];
    table.querySelectorAll('thead th').forEach(function(th) {
      headers.push(th.textContent.trim().toUpperCase());
    });

    table.querySelectorAll('tbody tr').forEach(function(row) {
      row.querySelectorAll('td').forEach(function(td, index) {
        if (td.colSpan > 1 || td.classList.contains('empty-state-cell')) {
          td.removeAttribute('data-label');
          return;
        }

        const label = headers[index] || '';
        if (label) {
          td.setAttribute('data-label', label);
        } else {
          td.removeAttribute('data-label');
        }
      });
    });
  });
}

// Expose ke global supaya bisa dipanggil dari script lain
window.syncTableLabels = syncTableLabels;

document.addEventListener('DOMContentLoaded', function() {
  syncTableLabels();

  const tableObserver = new MutationObserver(function(mutations) {
    const changedTables = new Set();
    mutations.forEach(function(mutation) {
      const table = mutation.target.closest('table');
      if (table) changedTables.add(table);
    });
    changedTables.forEach(syncTableLabels);
  });

  document.querySelectorAll('.card table tbody').forEach(function(tbody) {
    tableObserver.observe(tbody, { childList: true });
  });

  // Pilih semua checkbox
  const selectAll = document.getElementById('select-all-items');
  if (selectAll) {
    selectAll.addEventListener('change', function(e) {
      document.querySelectorAll('.card table tbody input[type="checkbox"]').forEach(c => {
        c.checked = e.target.checked;
      });
      updateBulkBar();
    });
  }
});

/* ═══════════════════════════════════════════════
   BULK SELECTION
   ═══════════════════════════════════════════════ */
function updateBulkBar() {
  const checked = document.querySelectorAll('.card table tbody input[type="checkbox"]:checked');
  const bar = document.getElementById('bulk-bar');
  const count = document.getElementById('bulk-count');
  const badge = document.getElementById('bulk-count-badge');
  if (!bar) return;

  if (checked.length > 0) {
    bar.classList.remove('hidden');
    bar.classList.add('flex');
    if (count) count.textContent = checked.length + ' produk dipilih';
    if (badge) badge.textContent = String(checked.length);
    if (typeof window.refreshIcons === 'function') window.refreshIcons(bar);
  } else {
    bar.classList.add('hidden');
    bar.classList.remove('flex');
    if (count) count.textContent = '0 produk dipilih';
    if (badge) badge.textContent = '0';
  }
}

function clearSelection() {
  document.querySelectorAll('.card table tbody input[type="checkbox"]').forEach(c => c.checked = false);
  const selectAll = document.getElementById('select-all-items');
  if (selectAll) selectAll.checked = false;
  updateBulkBar();
}

document.addEventListener('change', function(e) {
  if (e.target.matches('.card table tbody input[type="checkbox"]')) {
    updateBulkBar();
  }
});

/* ═══════════════════════════════════════════════
   KEYBOARD SHORTCUT CMD+K
   ═══════════════════════════════════════════════ */
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
      showToast('Pencarian aktif — ketik untuk mencari', 'info');
    }
  }
  // ESC tutup sidebar & notif dropdown
  if (e.key === 'Escape') {
    closeSidebar();
    const panel = document.getElementById('notif-dropdown-panel');
    if (panel) panel.remove();
  }
});

/* ═══════════════════════════════════════════════
   NOTIFICATION DROPDOWN PANEL
   ═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   GLOBAL NOTIFICATION BADGE SYNC
   ═══════════════════════════════════════════════ */
window.syncNotificationBadge = async function() {
  try {
    let unreadCount = 0;
    if (window.Api && window.Api.notif && typeof window.Api.notif.getUnreadCount === 'function') {
      unreadCount = await window.Api.notif.getUnreadCount();
    } else if (window.supabase) {
      const { count } = await window.supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);
      unreadCount = count || 0;
    }

    const headerBadge = document.getElementById('header-notif-badge');
    if (headerBadge) {
      if (unreadCount > 0) {
        headerBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        headerBadge.classList.remove('hidden');
      } else {
        headerBadge.textContent = '';
        headerBadge.classList.add('hidden');
      }
    }

    const sidebarBadge = document.getElementById('sidebar-notif-badge') || document.querySelector('.menu-item[data-page="notif"] span');
    if (sidebarBadge) {
      if (unreadCount > 0) {
        sidebarBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        sidebarBadge.classList.remove('hidden');
        sidebarBadge.style.display = '';
      } else {
        sidebarBadge.classList.add('hidden');
        sidebarBadge.style.display = 'none';
      }
    }
  } catch (err) {
    console.debug('[NotifSync] Error checking unread count:', err);
  }
};

/* ═══════════════════════════════════════════════
   NOTIFICATION DROPDOWN PANEL (LIVE DATA)
   ═══════════════════════════════════════════════ */
function initNotificationDropdown() {
  document.addEventListener('click', function(e) {
    const notifBtn = e.target.closest && e.target.closest('[data-action="notif"]');
    const existingDropdown = document.getElementById('notif-dropdown-panel');

    if (notifBtn) {
      e.preventDefault();
      e.stopPropagation();

      if (existingDropdown) {
        existingDropdown.remove();
        return;
      }

      const rect = notifBtn.getBoundingClientRect();
      const panel = document.createElement('div');
      panel.id = 'notif-dropdown-panel';
      panel.className = 'fixed z-50 bg-[#1C1C1E] border border-white/10 rounded-2xl shadow-2xl p-4 w-88 max-w-[calc(100vw-32px)] backdrop-blur-xl';
      
      const rightOffset = Math.max(16, window.innerWidth - rect.right);
      panel.style.top = `${rect.bottom + 8}px`;
      panel.style.right = `${rightOffset}px`;

      panel.innerHTML = `
        <div class="flex items-center justify-between pb-3 border-b border-white/5">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-bold text-white">Notifikasi</h4>
            <span id="notif-panel-badge" class="text-[10px] font-semibold bg-[#0088CC]/20 text-[#32ADE6] px-2 py-0.5 rounded-full">Memuat...</span>
          </div>
          <button type="button" id="btn-close-notif-panel" aria-label="Tutup notifikasi" class="p-1 hover:bg-white/5 rounded-lg text-[#A0A0A5] hover:text-white transition">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <div id="notif-panel-content" class="py-6 text-center text-[#A0A0A5] text-xs">
          <span class="inline-block animate-spin mr-1">⌛</span> Memuat notifikasi...
        </div>
      `;

      document.body.appendChild(panel);
      if (typeof window.refreshIcons === 'function') window.refreshIcons(panel);

      const closeBtn = panel.querySelector('#btn-close-notif-panel');
      if (closeBtn) {
        closeBtn.onclick = () => panel.remove();
      }

      // Fetch notifikasi riil dari Supabase
      (async () => {
        try {
          let list = [];
          if (window.Api?.notif?.getAll) {
            const res = await window.Api.notif.getAll({ limit: 5 });
            if (res.ok) list = res.data || [];
          } else if (window.supabase) {
            const { data } = await window.supabase
              .from('notifications')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(5);
            list = data || [];
          }

          const unreadCount = list.filter(n => !n.is_read).length;
          const badgeEl = panel.querySelector('#notif-panel-badge');
          if (badgeEl) badgeEl.textContent = `${unreadCount} Baru`;

          const contentEl = panel.querySelector('#notif-panel-content');
          if (!contentEl) return;

          if (list.length === 0) {
            contentEl.innerHTML = `
              <div class="w-11 h-11 rounded-full bg-white/5 grid place-items-center mx-auto text-[#A0A0A5] mb-2">
                <i data-lucide="bell" class="w-5 h-5 opacity-60"></i>
              </div>
              <p class="text-sm font-semibold text-white">Belum ada notifikasi</p>
              <p class="text-xs text-[#A0A0A5] max-w-[220px] mx-auto mt-1 leading-relaxed">
                Notifikasi seputar transaksi kasir, stok kritis, dan aktivitas akun akan muncul di sini.
              </p>
            `;
          } else {
            contentEl.className = 'py-2 divide-y divide-white/5 max-h-72 overflow-y-auto';
            contentEl.innerHTML = list.map(item => {
              const isUnread = !item.is_read;
              const typeColor = item.tipe === 'warning' ? '#FF9F0A' : (item.tipe === 'success' ? '#34C759' : '#0088CC');
              const typeIcon = item.tipe === 'warning' ? 'alert-triangle' : (item.tipe === 'success' ? 'check-circle-2' : 'info');
              const timeStr = item.created_at ? new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';

              return `
                <div class="py-2.5 px-2 hover:bg-white/5 rounded-xl transition flex gap-3 text-left ${isUnread ? 'bg-white/[0.03]' : ''}">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style="background: ${typeColor}20; color: ${typeColor};">
                    <i data-lucide="${typeIcon}" class="w-3.5 h-3.5"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1">
                      <p class="text-xs font-semibold text-white truncate">${item.judul || 'Notifikasi'}</p>
                      <span class="text-[10px] text-[#A0A0A5] shrink-0">${timeStr}</span>
                    </div>
                    <p class="text-[11px] text-[#A0A0A5] mt-0.5 leading-snug line-clamp-2">${item.pesan || ''}</p>
                  </div>
                  ${isUnread ? '<span class="w-1.5 h-1.5 rounded-full bg-[#0088CC] shrink-0 mt-2"></span>' : ''}
                </div>
              `;
            }).join('');
          }

          // Footer link & action
          const footerDiv = document.createElement('div');
          footerDiv.className = 'pt-3 border-t border-white/5 flex items-center justify-between';
          footerDiv.innerHTML = `
            <button type="button" id="btn-mark-all-read" class="text-[11px] text-[#A0A0A5] hover:text-white transition">
              Tandai dibaca
            </button>
            <a href="#notif" id="link-view-all-notif" class="text-xs font-semibold text-[#32ADE6] hover:underline inline-flex items-center gap-1">
              Lihat Semua <i data-lucide="arrow-right" class="w-3 h-3"></i>
            </a>
          `;
          panel.appendChild(footerDiv);

          const markAllBtn = panel.querySelector('#btn-mark-all-read');
          if (markAllBtn) {
            markAllBtn.onclick = async () => {
              if (window.Api?.notif?.markAllAsRead) {
                await window.Api.notif.markAllAsRead();
              }
              panel.remove();
              if (typeof window.syncNotificationBadge === 'function') {
                window.syncNotificationBadge();
              }
            };
          }

          const viewAllLink = panel.querySelector('#link-view-all-notif');
          if (viewAllLink) {
            viewAllLink.onclick = (e) => {
              e.preventDefault();
              panel.remove();
              if (typeof window.showPage === 'function') {
                window.showPage('notif');
              } else {
                window.location.href = '/dashboard/notif/';
              }
            };
          }

          if (typeof window.refreshIcons === 'function') window.refreshIcons(panel);
        } catch (fetchErr) {
          console.warn('[NotifPanel] Load error:', fetchErr);
        }
      })();

      return;
    }

    if (existingDropdown && !existingDropdown.contains(e.target)) {
      existingDropdown.remove();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initNotificationDropdown();
    setTimeout(window.syncNotificationBadge, 500);
  });
} else {
  initNotificationDropdown();
  setTimeout(window.syncNotificationBadge, 500);
}

// Polling badge setiap 30 detik
setInterval(() => {
  if (typeof window.syncNotificationBadge === 'function') {
    window.syncNotificationBadge();
  }
}, 30000);

/* Card hover lift */
document.querySelectorAll('.card').forEach(card => card.classList.add('card-hover'));

/* Initial animation */
if (typeof animateActivePage === 'function') {
  setTimeout(animateActivePage, 100);
}

/* Welcome toast — hanya 1x per session (pindah halaman tidak mengulang) */
if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('welcomeShown')) {
  sessionStorage.setItem('welcomeShown', 'true');
  if (typeof showToast === 'function') {
    setTimeout(() => showToast('Selamat datang di Aquastock Pro 3.0', 'success'), 500);
  }
}

console.info('Aquastock Pro v3.0 — Fully Responsive');

/* ═══ Set Welcome Name dari Profile ═══ */
(async function setWelcomeName() {
  try {
    const el = document.getElementById('welcome-name');
    if (!el) return;
    
    let client = (typeof window !== 'undefined' && window.supabase) ? window.supabase : null;
    if (!client && typeof window !== 'undefined') {
      try {
        const mod = await import(/* @vite-ignore */ './supabase-client.js');
        client = mod?.supabase || window.supabase;
      } catch (_) {}
    }
    if (!client || !client.auth) return;

    const { data: authData } = await client.auth.getUser();
    const user = authData?.user;
    if (!user) return;
    
    const { data: profile } = await client
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    
    if (profile?.full_name) {
      el.textContent = profile.full_name;
    } else if (user.email) {
      el.textContent = user.email.split('@')[0];
    }
  } catch (err) {
    console.warn('[Welcome] Failed to load name:', err.message);
  }
})();

/* ═══ Command Palette (⌘K / Ctrl+K) ═══ */
(function loadCommandPalette() {
  if (typeof document === 'undefined' || document.getElementById('command-palette-script')) return;
  const script = document.createElement('script');
  script.id = 'command-palette-script';
  script.src = '/assets/js/components/command-palette.js';
  script.defer = true;
  document.head.appendChild(script);
})();

/* ═══ Zero Native Alert / Modern Toast Interceptor ═══ */
if (typeof window !== 'undefined') {
  window.alert = function (message) {
    if (typeof showToast === 'function') {
      showToast(message, 'info');
    } else {
      console.warn('[Alert]', message);
    }
  };
}

/* ═══ Offline Sync Engine Loader ═══ */
(function loadOfflineSync() {
  if (typeof document === 'undefined' || document.getElementById('offline-sync-script')) return;
  const script = document.createElement('script');
  script.id = 'offline-sync-script';
  script.src = '/assets/js/utils/offline-sync.js';
  script.defer = true;
  document.head.appendChild(script);
})();

/* ═══ PWA Service Worker Registration & Seamless Auto-Update Engine ═══ */
(function registerPwaServiceWorker() {
  if (typeof window === 'undefined') return;

  const supportsServiceWorker = 'serviceWorker' in navigator;
  let isRefreshing = false;

  if (supportsServiceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isRefreshing) return;
      isRefreshing = true;
      window.location.reload();
    });
  }

  function promptAndActivate(worker) {
    if (!worker) return;
    worker.postMessage({ type: 'SKIP_WAITING' });
  }

  const installedVersion = document.querySelector('meta[name="app-version"]')?.content || '';

  function renderVersionStatus(release) {
    const badge = document.querySelector('[data-app-version-badge]');
    const localVersion = document.querySelector('[data-app-version-local]');
    const syncStatus = document.getElementById('github-version-status');
    const sidebarVersion = document.querySelector('[data-app-version-sidebar]');
    const isCurrent = release.version === installedVersion;

    if (badge) {
      badge.textContent = `v${installedVersion} (${isCurrent ? 'Terkini' : 'Pembaruan tersedia'})`;
      badge.classList.toggle('is-update-available', !isCurrent);
    }
    if (localVersion) localVersion.textContent = `Aquastock Pro v${installedVersion} (PWA Local-First)`;
    if (sidebarVersion) sidebarVersion.textContent = `v${installedVersion}`;
    if (syncStatus) {
      syncStatus.textContent = isCurrent
        ? `GitHub ${release.branch} v${release.version} · sinkron`
        : `GitHub ${release.branch} v${release.version} · versi aplikasi v${installedVersion}`;
    }
    window.AQUASTOCK_RELEASE_VERSION = release.version;
  }

  async function fetchReleaseVersion() {
    const response = await fetch(`/version.json?check=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`Pemeriksaan versi gagal (HTTP ${response.status})`);
    const release = await response.json();
    if (!release || !/^\d+\.\d+\.\d+$/.test(release.version || '') ||
        release.repository !== 'b0nz0el/aquastock-pro' || !release.branch) {
      throw new Error('Metadata versi GitHub tidak valid');
    }
    renderVersionStatus(release);
    if (release.version !== installedVersion && supportsServiceWorker) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          try { reg.update(); } catch (_) {}
          if (reg.waiting) {
            promptAndActivate(reg.waiting);
          }
        }
      }).catch(() => {});
    }
    return release;
  }

  function showUpdateToast(message, type) {
    if (typeof showToast === 'function') showToast(message, type);
  }

  const syncStatus = document.getElementById('github-version-status');
  fetchReleaseVersion().catch((error) => {
    console.warn('[PWA] Release version check failed:', error);
    if (syncStatus) {
      syncStatus.textContent = `GitHub main belum dapat diperiksa · aplikasi v${installedVersion}`;
    }
  });

  window.addEventListener('load', () => {
    if (!supportsServiceWorker) return;
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((reg) => {
      // 2. Periksa pembaruan segera saat aplikasi dimuat
      try { reg.update(); } catch (_) {}

      // 3. Periksa pembaruan saat pengguna membuka kembali PWA dari background (iOS Safari / PWA Standalone)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          try { reg.update(); } catch (_) {}
          fetchReleaseVersion().catch(() => {});
        }
      });
      window.addEventListener('focus', () => {
        try { reg.update(); } catch (_) {}
        fetchReleaseVersion().catch(() => {});
      });

      // 4. Periksa pembaruan berkala setiap 2 menit saat online dan aktif
      setInterval(() => {
        if (navigator.onLine && document.visibilityState === 'visible') {
          try { reg.update(); } catch (_) {}
        }
      }, 2 * 60 * 1000);

      // 5. Jika ada worker baru yang sedang menunggu, aktifkan segera
      if (reg.waiting) {
        promptAndActivate(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              if (typeof showToast === 'function') {
                showToast('Versi terbaru Aquastock Pro terpasang! Memperbarui...', 'info');
              }
              promptAndActivate(newWorker);
            }
          });
        }
      });
    }).catch((err) => {
      console.warn('[PWA] SW registration failed:', err);
    });
  });

  window.checkForPwaUpdate = async function () {
    const buttons = document.querySelectorAll('[data-action="check-update"]');
    buttons.forEach((button) => {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    });
    showUpdateToast('Memeriksa versi rilis GitHub main...', 'loading');

    try {
      const release = await fetchReleaseVersion();
      const versionDiffers = release.version !== installedVersion;

      if (supportsServiceWorker) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting) {
            promptAndActivate(reg.waiting);
            showUpdateToast(`Pembaruan v${release.version} ditemukan. Aplikasi sedang dimuat ulang...`, 'info');
            return;
          }
          if (reg.installing) {
            const worker = reg.installing;
            const state = await new Promise((resolve) => {
              const timeout = setTimeout(() => resolve(worker.state), 20000);
              const onStateChange = () => {
                if (['installed', 'activated', 'redundant'].includes(worker.state)) {
                  clearTimeout(timeout);
                  worker.removeEventListener('statechange', onStateChange);
                  resolve(worker.state);
                }
              };
              worker.addEventListener('statechange', onStateChange);
              onStateChange();
            });
            if (state === 'installed' && navigator.serviceWorker.controller) {
              promptAndActivate(worker);
              showUpdateToast(`Pembaruan v${release.version} ditemukan. Aplikasi sedang dimuat ulang...`, 'info');
              return;
            }
            if (state === 'activated') {
              window.location.reload();
              return;
            }
            if (state === 'redundant') {
              throw new Error('Service Worker pembaruan gagal dipasang');
            }
            showUpdateToast('Pembaruan sedang diunduh. Silakan coba kembali sebentar lagi.', 'info');
            return;
          }
        }
      }

      if (versionDiffers) {
        showUpdateToast(`Versi v${release.version} tersedia. Memuat ulang aplikasi...`, 'info');
        setTimeout(() => window.location.reload(), 1000);
        return;
      }

      showUpdateToast(`Aquastock Pro v${installedVersion} sudah sinkron dengan GitHub main.`, 'success');
    } catch (error) {
      console.warn('[PWA] Manual update check error:', error);
      const status = document.getElementById('github-version-status');
      if (status) status.textContent = `Pemeriksaan pembaruan gagal · aplikasi v${installedVersion}`;
      showUpdateToast(error.message || 'Pemeriksaan pembaruan gagal. Silakan coba kembali.', 'error');
    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      });
    }
  };
})();

/* ═══ Global Logout Event Delegation ═══ */
document.addEventListener('click', function handleGlobalLogout(e) {
  const logoutBtn = e.target.closest('[data-action="logout"]');
  if (!logoutBtn) return;
  e.preventDefault();
  try { localStorage.removeItem('auth_user'); } catch (_) {}
  try { sessionStorage.removeItem('rbac_user_role'); } catch (_) {}
  if (window.Auth && typeof window.Auth.logout === 'function') {
    window.Auth.logout().then(() => {
      window.location.replace('/login/');
    }).catch(() => {
      window.location.replace('/login/');
    });
  } else {
    window.location.replace('/login/');
  }
});

/* ═══ THEME ACCENT & COMPACT MODE ENGINE ═══ */
function applyAppearance(settings) {
  if (typeof document === 'undefined') return;
  if (!settings) {
    try {
      settings = JSON.parse(localStorage.getItem('aquastock_appearance') || '{}');
    } catch (_) {
      settings = {};
    }
  }
  const accent = settings.primary_color || '#0088CC';
  const compact = Boolean(settings.compact_mode);

  if (accent && accent !== '#0088CC') {
    document.documentElement.setAttribute('data-accent', accent);
  } else {
    document.documentElement.removeAttribute('data-accent');
  }

  if (compact) {
    document.documentElement.setAttribute('data-compact', 'true');
  } else {
    document.documentElement.removeAttribute('data-compact');
  }
}

// Inisialisasi tema segera saat runtime dimulai
if (typeof window !== 'undefined') {
  window.applyAppearance = applyAppearance;
  try { applyAppearance(); } catch (_) {}
}

/* ═══ UNIVERSAL IMAGE VIEWER (LIGHTBOX) ═══ */
let viewerImageList = [];
let viewerImageIndex = 0;
let viewerTitle = '';
let viewerSku = '';

function updateImageViewerDisplay() {
  if (typeof document === 'undefined') return;
  const img = document.getElementById('image-viewer-img');
  const counterEl = document.getElementById('image-viewer-counter');
  const prevBtn = document.getElementById('btn-viewer-prev');
  const nextBtn = document.getElementById('btn-viewer-next');
  const thumbsContainer = document.getElementById('image-viewer-thumbs');
  const downloadLink = document.getElementById('image-viewer-download');

  const currentSrc = viewerImageList[viewerImageIndex];
  if (!currentSrc || !img) return;

  img.src = currentSrc;
  img.alt = viewerTitle || 'Foto Produk';

  if (downloadLink) {
    downloadLink.href = currentSrc;
    const namePart = (viewerSku || viewerTitle || 'foto-produk').toLowerCase().replace(/\s+/g, '-');
    downloadLink.download = `${namePart}-${viewerImageIndex + 1}.webp`;
  }

  const isMulti = viewerImageList.length > 1;
  if (counterEl) {
    if (isMulti) {
      counterEl.textContent = `Foto ${viewerImageIndex + 1} / ${viewerImageList.length}`;
      counterEl.classList.remove('hidden');
    } else {
      counterEl.classList.add('hidden');
    }
  }

  if (prevBtn) {
    if (isMulti) {
      prevBtn.classList.remove('hidden');
    } else {
      prevBtn.classList.add('hidden');
    }
  }

  if (nextBtn) {
    if (isMulti) {
      nextBtn.classList.remove('hidden');
    } else {
      nextBtn.classList.add('hidden');
    }
  }

  if (thumbsContainer) {
    if (isMulti) {
      thumbsContainer.innerHTML = viewerImageList.map((src, idx) => `
        <button type="button" onclick="window.setImageViewerIndex ? window.setImageViewerIndex(${idx}) : null" class="w-11 h-11 rounded-lg overflow-hidden border-2 transition ${idx === viewerImageIndex ? 'border-[#0088CC] scale-105 shadow-md' : 'border-white/20 opacity-50 hover:opacity-100'} flex-shrink-0 cursor-pointer" title="Foto ${idx + 1}">
          <img src="${src}" alt="Thumb ${idx + 1}" class="w-full h-full object-cover">
        </button>
      `).join('');
      thumbsContainer.classList.remove('hidden');
    } else {
      thumbsContainer.innerHTML = '';
      thumbsContainer.classList.add('hidden');
    }
  }

  if (typeof window.refreshIcons === 'function') window.refreshIcons();
}

function navigateImageViewer(direction) {
  if (viewerImageList.length <= 1) return;
  viewerImageIndex = (viewerImageIndex + direction + viewerImageList.length) % viewerImageList.length;
  updateImageViewerDisplay();
}

function setImageViewerIndex(index) {
  if (index >= 0 && index < viewerImageList.length) {
    viewerImageIndex = index;
    updateImageViewerDisplay();
  }
}

function openImageViewer(srcOrList, title = '', sku = '', initialIndex = 0) {
  if (!srcOrList || typeof document === 'undefined') return;
  const modal = document.getElementById('modal-image-viewer');
  const titleEl = document.getElementById('image-viewer-title');
  const skuEl = document.getElementById('image-viewer-sku');

  if (!modal) return;

  if (Array.isArray(srcOrList)) {
    viewerImageList = srcOrList.filter(Boolean);
  } else if (typeof srcOrList === 'string' && srcOrList.trim().startsWith('[') && srcOrList.trim().endsWith(']')) {
    try {
      const parsed = JSON.parse(srcOrList);
      viewerImageList = Array.isArray(parsed) ? parsed.filter(Boolean) : [srcOrList];
    } catch (_) {
      viewerImageList = [srcOrList];
    }
  } else {
    viewerImageList = [srcOrList];
  }

  if (viewerImageList.length === 0) return;

  viewerImageIndex = Math.max(0, Math.min(Number(initialIndex) || 0, viewerImageList.length - 1));
  viewerTitle = title || 'Foto Produk';
  viewerSku = sku || '';

  if (titleEl) titleEl.textContent = viewerTitle;
  if (skuEl) skuEl.textContent = viewerSku ? `SKU: ${viewerSku}` : '';

  updateImageViewerDisplay();

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
  if (typeof window.refreshIcons === 'function') window.refreshIcons();
}

function closeImageViewer() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('modal-image-viewer');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = '';
  const img = document.getElementById('image-viewer-img');
  if (img) img.src = '';
  viewerImageList = [];
  viewerImageIndex = 0;
}

if (typeof window !== 'undefined') {
  window.openImageViewer = openImageViewer;
  window.closeImageViewer = closeImageViewer;
  window.navigateImageViewer = navigateImageViewer;
  window.setImageViewerIndex = setImageViewerIndex;

  // Tutup saat backdrop diklik
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('modal-image-viewer');
    if (modal && !modal.classList.contains('hidden') && e.target === modal) {
      closeImageViewer();
    }
  });

  // Tutup dengan tombol Esc & navigasi panah kiri/kanan
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('modal-image-viewer');
    if (!modal || modal.classList.contains('hidden')) return;

    if (e.key === 'Escape') {
      closeImageViewer();
    } else if (e.key === 'ArrowLeft') {
      navigateImageViewer(-1);
    } else if (e.key === 'ArrowRight') {
      navigateImageViewer(1);
    }
  });

  // Delegasi klik untuk gambar dengan class .product-thumbnail-img atau atribut [data-zoomable]
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-zoomable], .product-thumbnail-img');
    if (target && target.tagName === 'IMG' && target.src) {
      e.stopPropagation();
      const title = target.getAttribute('data-title') || target.alt || '';
      const sku = target.getAttribute('data-sku') || '';
      const rawGallery = target.getAttribute('data-gallery');
      if (rawGallery) {
        try {
          const list = JSON.parse(rawGallery);
          if (Array.isArray(list) && list.length > 0) {
            openImageViewer(list, title, sku);
            return;
          }
        } catch (_) {}
      }
      openImageViewer(target.src, title, sku);
    }
  });
}

// Lock pinch-to-zoom on Android & iOS to enforce solid native-app ergonomics
if (typeof window !== 'undefined') {
  // 1. Cegah pinch-to-zoom 2 jari pada Android & iOS
  window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  // 2. Cegah zoom gestur iOS Safari
  window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  window.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  window.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

  // 3. Cegah Ctrl + Wheel / Trackpad zoom
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });
}

/* ═══════════════════════════════════════════════
   QUICK CLEAR HELPER FOR NUMERIC & MODERN INPUTS
   ═══════════════════════════════════════════════ */
function updateNumericClearButton(input) {
  if (!input) return;
  const id = typeof input === 'string' ? input : input.id;
  const inputEl = typeof input === 'string' ? document.getElementById(input) : input;
  if (!inputEl || !id) return;
  const btn = document.getElementById('btn-clear-' + id);
  if (!btn) return;
  const val = String(inputEl.value || '').trim();
  if (val !== '') {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

function clearNumericInput(inputId) {
  const input = typeof inputId === 'string' ? document.getElementById(inputId) : inputId;
  if (!input) return;
  input.value = '';
  updateNumericClearButton(input);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  try {
    input.focus();
  } catch (_) {}
}

function parseNumericValue(value) {
  if (value === null || value === undefined) return 0;
  const digitsOnly = String(value).replace(/\D+/g, '');
  return digitsOnly ? Number(digitsOnly) : 0;
}

function formatNumberInput(value) {
  const cleanDigits = String(value || '').replace(/\D/g, '');
  const num = cleanDigits === '' ? 0 : Number(cleanDigits);
  return num > 0 ? new Intl.NumberFormat('id-ID').format(num) : (value === '' ? '' : '0');
}

function refreshNumericClearButtons(container = document) {
  if (!container || typeof container.querySelectorAll !== 'function') return;
  const buttons = container.querySelectorAll('[id^="btn-clear-"]');
  buttons.forEach((btn) => {
    const inputId = btn.id.replace('btn-clear-', '');
    const input = document.getElementById(inputId);
    if (input) {
      updateNumericClearButton(input);
    }
  });
  if (typeof refreshIcons === 'function') {
    refreshIcons();
  } else if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

if (typeof window !== 'undefined') {
  window.parseNumericValue = parseNumericValue;
  window.formatNumberInput = formatNumberInput;
  window.updateNumericClearButton = updateNumericClearButton;
  window.clearNumericInput = clearNumericInput;
  window.refreshNumericClearButtons = refreshNumericClearButtons;

  document.addEventListener('input', (e) => {
    if (e.target && e.target.id && document.getElementById('btn-clear-' + e.target.id)) {
      updateNumericClearButton(e.target);
    }
  });

  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.id && document.getElementById('btn-clear-' + e.target.id)) {
      updateNumericClearButton(e.target);
    }
  });

  const setupModalObserver = () => {
    refreshNumericClearButtons();

    if (typeof MutationObserver !== 'undefined') {
      const modalObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target;
            if (target && target.id && target.id.startsWith('modal-') && !target.classList.contains('hidden')) {
              refreshNumericClearButtons(target);
            }
          }
        }
      });

      document.querySelectorAll('[id^="modal-"]').forEach((modal) => {
        modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupModalObserver);
  } else {
    setupModalObserver();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    syncTableLabels,
    applyAppearance,
    openImageViewer,
    closeImageViewer,
    navigateImageViewer,
    setImageViewerIndex,
    updateNumericClearButton,
    clearNumericInput,
    refreshNumericClearButtons,
    parseNumericValue,
    formatNumberInput
  };
}


