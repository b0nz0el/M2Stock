/* ═══════════════════════════════════════════════════
   Aquastock Pro — notif.js
   Controller Modul Notifikasi (notifications)
   Data notifikasi langsung dari Supabase
   ═══════════════════════════════════════════════════ */

import { notif as notifApi } from '../assets/js/api/notif.js';
import { applyReadOnlyUI } from '../assets/js/utils/rbac-ui.js';
import { getUserRole } from '../assets/js/utils/rbac.js';

(function () {
  'use strict';

  let currentFilter = 'all'; // 'all' | 'unread' | 'read'
  let notificationsList = [];
  let userRole = 'VIEWER';

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffDay > 7) {
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      if (diffDay > 0) return `${diffDay} hari lalu`;
      if (diffHour > 0) return `${diffHour} jam lalu`;
      if (diffMin > 0) return `${diffMin} menit lalu`;
      return 'Baru saja';
    } catch (_) {
      return dateStr;
    }
  }

  function getTypeConfig(type) {
    const t = (type || 'info').toLowerCase();
    switch (t) {
      case 'warning':
        return {
          icon: 'alert-triangle',
          color: '#FF9F0A',
          borderLeft: 'border-l-[#FF9F0A]',
          bgIcon: 'bg-[#FF9F0A]/15 text-[#FF9F0A]'
        };
      case 'success':
        return {
          icon: 'check-circle-2',
          color: '#34C759',
          borderLeft: 'border-l-[#34C759]',
          bgIcon: 'bg-[#34C759]/15 text-[#34C759]'
        };
      case 'error':
        return {
          icon: 'alert-circle',
          color: '#FF3B30',
          borderLeft: 'border-l-[#FF3B30]',
          bgIcon: 'bg-[#FF3B30]/15 text-[#FF3B30]'
        };
      case 'info':
      default:
        return {
          icon: 'info',
          color: '#32ADE6',
          borderLeft: 'border-l-[#0088CC]',
          bgIcon: 'bg-[#0088CC]/15 text-[#32ADE6]'
        };
    }
  }

  function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    }
  }

  async function loadNotifications() {
    const listContainer = document.getElementById('notif-list-container');
    const emptyState = document.getElementById('notif-empty-state');
    const refreshBtn = document.getElementById('btn-refresh-notif');

    if (refreshBtn) refreshBtn.classList.add('opacity-50', 'pointer-events-none');
    if (listContainer) {
      listContainer.innerHTML = `
        <div class="py-16 text-center text-[#A0A0A5]">
          <div class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#0088CC] border-t-transparent mb-2"></div>
          <p class="text-xs">Memuat notifikasi...</p>
        </div>
      `;
    }

    try {
      const res = await notifApi.getAll({ filter: currentFilter, limit: 100 });
      // Jika gagal atau kosong, tampilkan daftar kosong.
      notificationsList = res.ok && Array.isArray(res.data) ? res.data : [];

      renderNotifications();
      updateBadges();
    } catch (err) {
      console.error('Error fetching notifications:', err);
      notificationsList = [];
      renderNotifications();
      showToast('Gagal memuat notifikasi', 'error');
    } finally {
      if (refreshBtn) refreshBtn.classList.remove('opacity-50', 'pointer-events-none');
    }
  }

  function renderNotifications() {
    const listContainer = document.getElementById('notif-list-container');
    const emptyState = document.getElementById('notif-empty-state');
    if (!listContainer) return;

    if (!notificationsList || notificationsList.length === 0) {
      listContainer.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    listContainer.innerHTML = notificationsList.map((item) => {
      const typeCfg = getTypeConfig(item.tipe);
      const isUnread = !item.is_read;
      const borderClass = isUnread ? `${typeCfg.borderLeft} border-l-4` : 'border-l-4 border-l-white/10 opacity-75';

      return `
        <div 
          class="notif-card card p-4 rounded-xl bg-[#1C1C1E] border border-white/5 hover:border-white/15 transition cursor-pointer ${borderClass} relative group" 
          data-id="${item.id}"
          data-link="${item.link || ''}"
          data-is-read="${item.is_read ? 'true' : 'false'}"
        >
          <div class="flex items-start gap-3.5">
            <div class="w-10 h-10 rounded-xl ${typeCfg.bgIcon} grid place-items-center shrink-0">
              <i data-lucide="${typeCfg.icon}" class="w-5 h-5"></i>
            </div>

            <div class="flex-1 min-w-0 pr-6">
              <div class="flex items-center gap-2">
                <h4 class="text-sm font-semibold text-white tracking-tight ${isUnread ? 'font-bold' : ''}">
                  ${item.judul || 'Notifikasi'}
                </h4>
                ${isUnread ? '<span class="w-2 h-2 rounded-full bg-[#FF3B30] inline-block shrink-0 animate-pulse" title="Belum dibaca"></span>' : ''}
              </div>

              ${item.pesan ? `<p class="text-xs text-[#A0A0A5] mt-1 leading-relaxed">${item.pesan}</p>` : ''}

              <div class="flex items-center gap-3 mt-2 text-[11px] text-[#A0A0A5]">
                <span class="flex items-center gap-1">
                  <i data-lucide="clock" class="w-3 h-3"></i>
                  ${formatTimeAgo(item.created_at)}
                </span>
                ${item.link ? `
                  <span class="text-[#32ADE6] flex items-center gap-0.5 hover:underline">
                    <span>Buka tautan</span>
                    <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
                  </span>
                ` : ''}
              </div>
            </div>

            ${isUnread ? `
              <button 
                type="button" 
                class="btn-mark-single-read p-1.5 rounded-lg text-[#A0A0A5] hover:text-white hover:bg-white/5 transition opacity-0 group-hover:opacity-100" 
                data-id="${item.id}"
                title="Tandai sudah dibaca"
              >
                <i data-lucide="check" class="w-4 h-4"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    } else if (window.refreshIcons && typeof window.refreshIcons === 'function') {
      window.refreshIcons();
    }

    applyReadOnlyUI();
  }

  function updateBadges() {
    const unreadCount = notificationsList.filter(n => !n.is_read).length;
    const badgeAll = document.getElementById('count-notif-all');
    const badgeUnread = document.getElementById('count-notif-unread');
    const headerNotifBadge = document.getElementById('header-notif-badge') || document.querySelector('header [data-action="notif"] span');

    if (badgeAll) badgeAll.textContent = notificationsList.length;
    if (badgeUnread) badgeUnread.textContent = unreadCount;

    // Sinkronkan badge notifikasi di sidebar
    try {
      sessionStorage.setItem('notif_unread_count', unreadCount.toString());
    } catch (_) {}
    const sidebarNotifBadge = document.querySelector('#sidebar-notif-badge') || document.querySelector('.menu-item[data-page="notif"] span');
    if (sidebarNotifBadge) {
      if (unreadCount > 0) {
        sidebarNotifBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        sidebarNotifBadge.classList.remove('hidden');
        sidebarNotifBadge.style.display = '';
      } else {
        sidebarNotifBadge.classList.add('hidden');
        sidebarNotifBadge.style.display = 'none';
      }
    }

    if (headerNotifBadge) {
      if (unreadCount > 0) {
        headerNotifBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        headerNotifBadge.classList.remove('hidden');
      } else {
        headerNotifBadge.textContent = '';
        headerNotifBadge.classList.add('hidden');
      }
    }
  }

  async function handleNotificationClick(card) {
    const id = card.getAttribute('data-id');
    const link = card.getAttribute('data-link');
    const isRead = card.getAttribute('data-is-read') === 'true';

    if (!isRead && id) {
      // Tandai sudah dibaca di database
      try {
        await notifApi.markAsRead(id);
        card.setAttribute('data-is-read', 'true');
        card.classList.remove('border-l-4', 'border-l-[#FF3B30]', 'border-l-[#FF9F0A]', 'border-l-[#34C759]', 'border-l-[#0088CC]');
        card.classList.add('border-l-4', 'border-l-white/10', 'opacity-75');

        const redDot = card.querySelector('span.bg-\\[\\#FF3B30\\]');
        if (redDot) redDot.remove();

        const item = notificationsList.find(n => n.id === id);
        if (item) item.is_read = true;
        updateBadges();
      } catch (e) {
        console.error('Failed to mark notification as read:', e);
      }
    }

    if (link && link.trim() !== '') {
      const cleanLink = link.trim();
      const targetSlug = cleanLink.replace(/^\/dashboard\/?/, '').replace(/^\//, '').replace(/\/$/, '').split(/[?#]/)[0];
      const validPages = [
        'dashboard', 'items', 'in', 'out', 'po', 'return',
        'suppliers', 'customers', 'cash', 'debt', 'report',
        'users', 'audit', 'notif', 'backup', 'settings'
      ];

      if (validPages.includes(targetSlug) && typeof window.showPage === 'function') {
        window.showPage(targetSlug);
      } else if (cleanLink.startsWith('http://') || cleanLink.startsWith('https://')) {
        window.location.href = cleanLink;
      } else {
        const fullUrl = cleanLink.startsWith('/dashboard') ? cleanLink : ('/dashboard/' + (targetSlug ? targetSlug + '/' : ''));
        window.location.href = fullUrl;
      }
    }
  }

  async function handleMarkAllRead() {
    const btn = document.getElementById('btn-mark-all-read');
    if (btn) btn.classList.add('opacity-50', 'pointer-events-none');

    try {
      const res = await notifApi.markAllAsRead();
      if (res.ok) {
        showToast('Semua notifikasi telah ditandai dibaca', 'success');
        await loadNotifications();
      } else {
        showToast(res.error?.message || 'Gagal menandai notifikasi', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Terjadi kesalahan sistem', 'error');
    } finally {
      if (btn) btn.classList.remove('opacity-50', 'pointer-events-none');
    }
  }

  function setupEvents() {
    // Filter tabs
    const tabButtons = document.querySelectorAll('[data-notif-filter]');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => {
          b.classList.remove('bg-[#0088CC]', 'text-white', 'border-transparent');
          b.classList.add('bg-[#1C1C1E]', 'text-[#A0A0A5]', 'border-white/10');
        });
        btn.classList.add('bg-[#0088CC]', 'text-white', 'border-transparent');
        btn.classList.remove('bg-[#1C1C1E]', 'text-[#A0A0A5]', 'border-white/10');

        currentFilter = btn.getAttribute('data-notif-filter') || 'all';
        loadNotifications();
      });
    });

    // Refresh
    const refreshBtn = document.getElementById('btn-refresh-notif');
    if (refreshBtn) refreshBtn.addEventListener('click', loadNotifications);

    // Mark all read button
    const markAllBtn = document.getElementById('btn-mark-all-read');
    if (markAllBtn) markAllBtn.addEventListener('click', handleMarkAllRead);

    // Click card delegation
    document.addEventListener('click', (e) => {
      const singleReadBtn = e.target.closest('.btn-mark-single-read');
      if (singleReadBtn) {
        e.stopPropagation();
        const id = singleReadBtn.getAttribute('data-id');
        if (id) {
          notifApi.markAsRead(id).then(() => {
            showToast('Notifikasi ditandai dibaca', 'success');
            loadNotifications();
          });
        }
        return;
      }

      const card = e.target.closest('.notif-card');
      if (card) {
        handleNotificationClick(card);
      }
    });
  }

  async function initNotif() {
    try {
      userRole = await getUserRole();
    } catch (_) {}

    setupEvents();
    await loadNotifications();
  }

  if (typeof window !== 'undefined') {
    window.initNotif = initNotif;
    window.loadNotifications = loadNotifications;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotif);
  } else {
    initNotif();
  }

})();
