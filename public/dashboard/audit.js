/* ═══════════════════════════════════════════════════
   Aquastock Pro — audit.js
   Controller Modul Audit Log & Jejak Aktivitas User
   ═══════════════════════════════════════════════════ */

import { audit as auditApi } from '../assets/js/api/audit.js';
import { getClientIp } from '../assets/js/api/_client.js';
import { applyReadOnlyUI } from '../assets/js/utils/rbac-ui.js';
import { getUserRole } from '../assets/js/utils/rbac.js';

(function () {
  'use strict';

  let currentPage = 1;
  const pageSize = 15;
  let currentActionFilter = 'ALL';
  let currentSearch = '';
  let totalRecords = 0;
  let totalPages = 1;
  let currentLogs = [];
  let detectedCurrentIp = null;

  if (typeof getClientIp === 'function') {
    getClientIp().then(ip => {
      detectedCurrentIp = ip;
      if (currentLogs && currentLogs.length > 0) renderTable();
    }).catch(() => {});
  }

  function formatDateTime(isoString) {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' WIB';
    } catch (_) {
      return isoString;
    }
  }

  function getActionBadge(action) {
    const act = (action || '').toUpperCase();
    if (act === 'CREATE') {
      return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/20">
        <span class="w-1.5 h-1.5 rounded-full bg-[#34C759]"></span> CREATE
      </span>`;
    }
    if (act === 'UPDATE') {
      return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#0088CC]/15 text-[#32ADE6] border border-[#0088CC]/20">
        <span class="w-1.5 h-1.5 rounded-full bg-[#32ADE6]"></span> UPDATE
      </span>`;
    }
    if (act === 'DELETE') {
      return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FF3B30]/15 text-[#FF3B30] border border-[#FF3B30]/20">
        <span class="w-1.5 h-1.5 rounded-full bg-[#FF3B30]"></span> DELETE
      </span>`;
    }
    if (act === 'LOGIN') {
      return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#AF52DE]/15 text-[#AF52DE] border border-[#AF52DE]/20">
        <span class="w-1.5 h-1.5 rounded-full bg-[#AF52DE]"></span> LOGIN
      </span>`;
    }
    return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-white/10 text-white">${act}</span>`;
  }

  async function loadAuditLogs() {
    const tbody = document.getElementById('audit-table-body');
    const emptyState = document.getElementById('audit-empty-state');
    const refreshBtn = document.getElementById('btn-refresh-audit');

    if (refreshBtn) refreshBtn.classList.add('opacity-50', 'pointer-events-none');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-12 text-center text-[#A0A0A5]">
            <div class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#0088CC] border-t-transparent mb-2"></div>
            <p class="text-xs">Memuat jejak audit...</p>
          </td>
        </tr>
      `;
    }

    try {
      const res = await auditApi.getAll({
        page: currentPage,
        limit: pageSize,
        action: currentActionFilter === 'ALL' ? null : currentActionFilter,
        search: currentSearch
      });

      if (!res.ok) {
        throw new Error(res.error?.message || 'Gagal mengambil data audit');
      }

      currentLogs = res.data || [];
      totalRecords = res.meta?.total || currentLogs.length;
      totalPages = res.meta?.totalPages || Math.max(1, Math.ceil(totalRecords / pageSize));

      renderTable();
      renderPagination();
      updateKPI(currentLogs);
    } catch (err) {
      console.error('Error loadAuditLogs:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="py-8 text-center text-[#FF3B30]">
              <i data-lucide="alert-circle" class="w-6 h-6 mx-auto mb-1"></i>
              <p class="text-xs font-medium">${err.message || 'Gagal memuat log aktivitas'}</p>
            </td>
          </tr>
        `;
      }
      if (emptyState) emptyState.classList.add('hidden');
    } finally {
      if (refreshBtn) refreshBtn.classList.remove('opacity-50', 'pointer-events-none');
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    }
  }

  function renderTable() {
    const tbody = document.getElementById('audit-table-body');
    const emptyState = document.getElementById('audit-empty-state');
    if (!tbody) return;

    if (!currentLogs || currentLogs.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = currentLogs.map(log => {
      let userDisplay = log.user_email || log.profiles?.full_name || 'System / Guest';
      if (typeof window.resolveUserName === 'function') {
        const resolved = window.resolveUserName(log.user_id, log.user_email);
        if (resolved && !resolved.startsWith('User-')) {
          userDisplay = resolved;
        }
      }
      const rawIp = log.ip && log.ip !== '-' ? log.ip : (detectedCurrentIp || '-');
      return `
        <tr class="table-row border-b border-white/5 hover:bg-white/[0.02] transition-colors">
          <td data-label="WAKTU" class="px-5 py-3.5 font-mono text-xs text-[#A0A0A5] whitespace-nowrap">
            ${formatDateTime(log.created_at)}
          </td>
          <td data-label="USER" class="px-5 py-3.5 font-medium text-white text-sm">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px] font-bold">
                ${userDisplay.charAt(0).toUpperCase()}
              </span>
              <span class="truncate max-w-[180px]" title="${escapeHtml(userDisplay)}">${escapeHtml(userDisplay)}</span>
            </div>
          </td>
          <td data-label="AKSI" class="px-5 py-3.5 whitespace-nowrap">
            ${getActionBadge(log.action)}
          </td>
          <td data-label="DETAIL" class="px-5 py-3.5 text-sm text-[#E0E0E0]">
            <span class="font-medium text-white">${escapeHtml(log.target || '-')}</span>
          </td>
          <td data-label="IP ADDRESS" class="px-5 py-3.5 text-[#A0A0A5] font-mono text-xs whitespace-nowrap">
            <span class="bg-black/40 px-2.5 py-1 rounded-lg border border-white/10 text-[11px] text-[#32ADE6] font-mono">${escapeHtml(rawIp)}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderPagination() {
    const pageInfo = document.getElementById('audit-page-info');
    const prevBtn = document.getElementById('audit-prev-page');
    const nextBtn = document.getElementById('audit-next-page');

    if (pageInfo) {
      pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages} (Total ${totalRecords} aktivitas)`;
    }

    if (prevBtn) {
      prevBtn.disabled = currentPage <= 1;
      if (currentPage <= 1) {
        prevBtn.classList.add('opacity-40', 'cursor-not-allowed');
      } else {
        prevBtn.classList.remove('opacity-40', 'cursor-not-allowed');
      }
    }

    if (nextBtn) {
      nextBtn.disabled = currentPage >= totalPages;
      if (currentPage >= totalPages) {
        nextBtn.classList.add('opacity-40', 'cursor-not-allowed');
      } else {
        nextBtn.classList.remove('opacity-40', 'cursor-not-allowed');
      }
    }
  }

  async function updateKPI(items) {
    try {
      const res = await auditApi.getSummary(items);
      if (!res.ok) return;

      const s = res.data || {};
      const elTotal = document.getElementById('kpi-total-logs');
      const elToday = document.getElementById('kpi-today-logs');
      const elMutations = document.getElementById('kpi-mutations');
      const elDelete = document.getElementById('kpi-delete-logs');

      if (elTotal) elTotal.textContent = Number(s.total || totalRecords).toLocaleString('id-ID');
      if (elToday) elToday.textContent = Number(s.todayCount || 0).toLocaleString('id-ID');
      if (elMutations) elMutations.textContent = Number((s.createCount || 0) + (s.updateCount || 0)).toLocaleString('id-ID');
      if (elDelete) elDelete.textContent = Number(s.deleteCount || 0).toLocaleString('id-ID');
    } catch (_) {}
  }

  function exportCSV() {
    if (!currentLogs || currentLogs.length === 0) {
      if (typeof showToast === 'function') {
        showToast('Tidak ada data audit untuk diekspor', 'warning');
      } else {
        alert('Tidak ada data audit untuk diekspor');
      }
      return;
    }

    const headers = ['ID', 'Waktu', 'User Email', 'Aksi', 'Target / Deskripsi', 'IP Address'];
    const rows = currentLogs.map(l => [
      l.id || '',
      formatDateTime(l.created_at),
      l.user_email || '',
      l.action || '',
      (l.target || '').replace(/"/g, '""'),
      l.ip || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof showToast === 'function') {
      showToast('Log audit berhasil diekspor ke CSV', 'success');
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Event Listeners
  let auditEventsSetup = false;
  async function initAudit() {
    applyReadOnlyUI();

    if (auditEventsSetup) {
      await loadAuditLogs();
      return;
    }
    auditEventsSetup = true;

    // 2. Setup Filter Action Buttons
    const filterButtons = document.querySelectorAll('[data-action-filter]');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => {
          b.classList.remove('bg-[#0088CC]', 'text-white', 'border-[#0088CC]');
          b.classList.add('text-[#A0A0A5]', 'bg-[#1C1C1E]', 'border-white/5');
        });
        btn.classList.remove('text-[#A0A0A5]', 'bg-[#1C1C1E]', 'border-white/5');
        btn.classList.add('bg-[#0088CC]', 'text-white', 'border-[#0088CC]');

        currentActionFilter = btn.getAttribute('data-action-filter') || 'ALL';
        currentPage = 1;
        loadAuditLogs();
      });
    });

    // 3. Setup Search Input
    const searchInput = document.getElementById('audit-search-input');
    if (searchInput) {
      let timeout = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          currentSearch = e.target.value.trim();
          currentPage = 1;
          loadAuditLogs();
        }, 350);
      });
    }

    // 4. Setup Refresh Button
    const refreshBtn = document.getElementById('btn-refresh-audit');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadAuditLogs();
      });
    }

    // 5. Setup Export Button
    const exportBtn = document.getElementById('btn-export-audit');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportCSV);
    }

    // 6. Setup Pagination Buttons
    const prevBtn = document.getElementById('audit-prev-page');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          loadAuditLogs();
        }
      });
    }

    const nextBtn = document.getElementById('audit-next-page');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          loadAuditLogs();
        }
      });
    }

    // Initial Load
    await loadAuditLogs();
  }

  if (typeof window !== 'undefined') {
    window.initAudit = initAudit;
    window.loadAuditLogs = loadAuditLogs;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAudit);
  } else {
    initAudit();
  }
})();
