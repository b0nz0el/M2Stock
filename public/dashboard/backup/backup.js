/* ═══════════════════════════════════════════════════
   aQuaStock Pro — backup.js
   Controller Modul Backup & Restore (/dashboard/backup/)
   Riwayat backup dari Supabase backup_logs
   ═══════════════════════════════════════════════════ */

import { backup as backupApi, BACKUP_TABLES } from '../../assets/js/api/backup.js';
import { applyReadOnlyUI } from '../../assets/js/utils/rbac-ui.js';

(function () {
  'use strict';

  let currentPage = 1;
  const pageSize = 10;
  let totalLogs = 0;
  let totalPages = 1;
  let logsList = [];
  let selectedImportFile = null;

  function formatDate(isoStr) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return isoStr;
    }
  }

  function getActionBadge(action) {
    const act = (action || '').toUpperCase();
    if (act === 'EXPORT') {
      return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/20">EXPORT</span>';
    }
    if (act === 'IMPORT') {
      return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0088CC]/15 text-[#32ADE6] border border-[#0088CC]/20">IMPORT</span>';
    }
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white">${act}</span>`;
  }

  function getScopeLabel(scope) {
    if (!scope || scope === 'all') return 'Semua Tabel';
    const found = BACKUP_TABLES.find(t => t.id === scope);
    return found ? found.name : scope;
  }

  async function loadBackupLogs() {
    const tbody = document.getElementById('backup-logs-tbody');
    const emptyState = document.getElementById('backup-empty-state');
    const refreshBtn = document.getElementById('btn-refresh-logs');

    if (refreshBtn) refreshBtn.classList.add('opacity-50', 'pointer-events-none');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-[#A0A0A5]">
            <div class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#0088CC] border-t-transparent mb-2"></div>
            <p class="text-xs">Memuat riwayat backup...</p>
          </td>
        </tr>
      `;
    }

    try {
      const res = await backupApi.getLogs({
        page: currentPage,
        limit: pageSize
      });

      if (!res.ok) {
        throw new Error(res.error?.message || 'Gagal mengambil riwayat backup');
      }

      logsList = res.data || [];
      totalLogs = res.meta?.total || logsList.length;
      totalPages = res.meta?.totalPages || Math.max(1, Math.ceil(totalLogs / pageSize));

      renderLogsTable();
      renderPagination();
      updateKPICards(logsList);
    } catch (err) {
      console.error('Error loadBackupLogs:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="py-8 text-center text-[#FF3B30]">
              <i data-lucide="alert-circle" class="w-6 h-6 mx-auto mb-1"></i>
              <p class="text-xs font-medium">${err.message || 'Gagal memuat riwayat backup'}</p>
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

  function renderLogsTable() {
    const tbody = document.getElementById('backup-logs-tbody');
    const emptyState = document.getElementById('backup-empty-state');
    if (!tbody) return;

    if (!logsList || logsList.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = logsList.map(item => {
      const dateText = formatDate(item.created_at);
      const actionBadge = getActionBadge(item.action);
      const scopeText = getScopeLabel(item.scope);
      const recordsCount = Number(item.records_count || 0).toLocaleString('id-ID');
      const fileName = item.file_name || '-';

      return `
        <tr class="table-row border-b border-white/5 hover:bg-white/[0.02] transition-colors">
          <td class="px-5 py-3.5 text-[#A0A0A5] font-mono text-xs whitespace-nowrap">
            ${dateText}
          </td>
          <td class="px-5 py-3.5 whitespace-nowrap">
            ${actionBadge}
          </td>
          <td class="px-5 py-3.5 text-white font-medium text-sm">
            ${scopeText}
          </td>
          <td class="px-5 py-3.5 text-right font-semibold text-white whitespace-nowrap">
            ${recordsCount} rekaman
          </td>
          <td class="px-5 py-3.5 text-[#A0A0A5] font-mono text-xs truncate max-w-xs" title="${fileName}">
            ${fileName}
          </td>
          <td class="px-5 py-3.5 text-center">
            <span class="inline-flex items-center text-xs text-[#34C759]">
              <i data-lucide="check-circle" class="w-4 h-4 mr-1"></i> Sukses
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderPagination() {
    const pageInfo = document.getElementById('backup-page-info');
    const prevBtn = document.getElementById('backup-prev-page');
    const nextBtn = document.getElementById('backup-next-page');

    if (pageInfo) {
      pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages} (Total ${totalLogs} aktivitas)`;
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

  function updateKPICards(logs) {
    const elTotal = document.getElementById('kpi-total-backups');
    const elLastDate = document.getElementById('kpi-last-backup-date');
    const elExportCount = document.getElementById('kpi-export-count');
    const elImportCount = document.getElementById('kpi-import-count');

    if (elTotal) elTotal.textContent = totalLogs.toString();

    if (logs && logs.length > 0) {
      if (elLastDate) elLastDate.textContent = formatDate(logs[0].created_at);
      const exports = logs.filter(l => (l.action || '').toLowerCase() === 'export').length;
      const imports = logs.filter(l => (l.action || '').toLowerCase() === 'import').length;
      if (elExportCount) elExportCount.textContent = exports.toString();
      if (elImportCount) elImportCount.textContent = imports.toString();
    } else {
      if (elLastDate) elLastDate.textContent = 'Belum pernah';
      if (elExportCount) elExportCount.textContent = '0';
      if (elImportCount) elImportCount.textContent = '0';
    }
  }

  function triggerDownload(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleExportAllJSON() {
    const btn = document.getElementById('btn-export-all-json');
    if (!btn) return;

    btn.disabled = true;
    const originalContent = btn.innerHTML;
    btn.innerHTML = `
      <div class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
      Mengekspor data...
    `;

    try {
      const res = await backupApi.exportAllJSON();
      if (!res.ok) {
        throw new Error(res.error?.message || 'Gagal melakukan export JSON');
      }

      const { payload, fileName, totalRecords } = res.data;
      const jsonString = JSON.stringify(payload, null, 2);

      triggerDownload(jsonString, fileName, 'application/json');

      if (typeof showToast === 'function') {
        showToast(`Berhasil mengekspor ${totalRecords} rekaman ke JSON`, 'success');
      }

      await loadBackupLogs();
    } catch (err) {
      console.error('Export all JSON error:', err);
      alert(err.message || 'Terjadi kesalahan saat mengekspor data.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
      if (typeof window.refreshIcons === 'function') window.refreshIcons(btn);
    }
  }

  async function handleExportTableCSV() {
    const selectEl = document.getElementById('select-export-table');
    const btn = document.getElementById('btn-export-table-csv');
    if (!selectEl || !btn) return;

    const tableId = selectEl.value;
    if (!tableId) {
      alert('Pilih tabel yang ingin diekspor ke CSV.');
      return;
    }

    btn.disabled = true;
    const originalContent = btn.innerHTML;
    btn.innerHTML = `
      <div class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-[#0088CC] border-t-transparent mr-2"></div>
      Mengunduh...
    `;

    try {
      const res = await backupApi.exportTableCSV(tableId);
      if (!res.ok) {
        throw new Error(res.error?.message || 'Gagal melakukan export CSV');
      }

      const { csv, fileName, recordsCount, tableName } = res.data;
      triggerDownload(csv, fileName, 'text/csv;charset=utf-8;');

      if (typeof showToast === 'function') {
        showToast(`Tabel ${tableName} (${recordsCount} baris) berhasil diekspor`, 'success');
      }

      await loadBackupLogs();
    } catch (err) {
      console.error('Export CSV error:', err);
      alert(err.message || 'Gagal mengekspor tabel.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
      if (typeof window.refreshIcons === 'function') window.refreshIcons(btn);
    }
  }

  function handleFileInputChange(e) {
    const file = e.target.files?.[0];
    const previewEl = document.getElementById('import-file-preview');
    const fileNameEl = document.getElementById('import-file-name');
    const fileSizeEl = document.getElementById('import-file-size');
    const restoreBtn = document.getElementById('btn-restore-json');

    if (!file) {
      selectedImportFile = null;
      if (previewEl) previewEl.classList.add('hidden');
      if (restoreBtn) restoreBtn.disabled = true;
      return;
    }

    if (!file.name.endsWith('.json')) {
      alert('Hanya file .json yang didukung untuk Restore.');
      e.target.value = '';
      selectedImportFile = null;
      if (previewEl) previewEl.classList.add('hidden');
      if (restoreBtn) restoreBtn.disabled = true;
      return;
    }

    selectedImportFile = file;
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    if (previewEl) previewEl.classList.remove('hidden');
    if (restoreBtn) restoreBtn.disabled = false;
  }

  async function handleRestoreJSON() {
    if (!selectedImportFile) {
      alert('Silakan pilih file backup (.json) terlebih dahulu.');
      return;
    }

    const confirmed = confirm(
      '⚠️ PERINGATAN KONFIRMASI RESTORE:\n\n' +
      'Data dari file backup akan digabungkan/di-restore ke database Supabase.\n' +
      'Apakah Anda yakin ingin melanjutkan proses restore?'
    );

    if (!confirmed) return;

    const btn = document.getElementById('btn-restore-json');
    if (btn) btn.disabled = true;

    try {
      const fileText = await selectedImportFile.text();
      let parsed = null;
      try {
        parsed = JSON.parse(fileText);
      } catch (parseErr) {
        throw new Error('File tidak dapat dibaca sebagai format JSON yang valid.');
      }

      const res = await backupApi.importJSON(parsed, selectedImportFile.name);
      if (!res.ok) {
        throw new Error(res.error?.message || 'Gagal melakukan restore data');
      }

      const { totalImported } = res.data;

      if (typeof showToast === 'function') {
        showToast(`Restore berhasil! Total ${totalImported} rekaman dipulihkan`, 'success');
      } else {
        alert(`Restore berhasil! Total ${totalImported} rekaman dipulihkan.`);
      }

      // Reset file input
      const fileInput = document.getElementById('backup-file-input');
      if (fileInput) fileInput.value = '';
      selectedImportFile = null;
      const previewEl = document.getElementById('import-file-preview');
      if (previewEl) previewEl.classList.add('hidden');

      await loadBackupLogs();
    } catch (err) {
      console.error('Restore error:', err);
      alert(err.message || 'Terjadi kesalahan saat memulihkan data.');
    } finally {
      if (btn) btn.disabled = !selectedImportFile;
    }
  }

  // Setup Event Listeners
  document.addEventListener('DOMContentLoaded', async () => {
    applyReadOnlyUI();

    // Populate Select Table Dropdown
    const selectEl = document.getElementById('select-export-table');
    if (selectEl) {
      selectEl.innerHTML = BACKUP_TABLES.map(t =>
        `<option value="${t.id}" class="bg-[#1C1C1E] text-white">${t.name} (${t.id})</option>`
      ).join('');
    }

    // Export All JSON Button
    const exportAllBtn = document.getElementById('btn-export-all-json');
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', handleExportAllJSON);
    }

    // Export Table CSV Button
    const exportCsvBtn = document.getElementById('btn-export-table-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', handleExportTableCSV);
    }

    // File Input
    const fileInput = document.getElementById('backup-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', handleFileInputChange);
    }

    // Remove Selected File Button
    const removeFileBtn = document.getElementById('btn-remove-import-file');
    if (removeFileBtn) {
      removeFileBtn.addEventListener('click', () => {
        if (fileInput) fileInput.value = '';
        selectedImportFile = null;
        const previewEl = document.getElementById('import-file-preview');
        if (previewEl) previewEl.classList.add('hidden');
        const restoreBtn = document.getElementById('btn-restore-json');
        if (restoreBtn) restoreBtn.disabled = true;
      });
    }

    // Restore Button
    const restoreBtn = document.getElementById('btn-restore-json');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', handleRestoreJSON);
    }

    // Refresh Button
    const refreshBtn = document.getElementById('btn-refresh-logs');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadBackupLogs();
      });
    }

    // Pagination
    const prevBtn = document.getElementById('backup-prev-page');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          loadBackupLogs();
        }
      });
    }

    const nextBtn = document.getElementById('backup-next-page');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          loadBackupLogs();
        }
      });
    }

    // Initial Load
    await loadBackupLogs();
  });
})();
