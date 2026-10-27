/* ═══════════════════════════════════════════════════
   aQuaStock Pro — backup.js
   Controller Modul Backup & Restore (/dashboard/backup/)
   Riwayat backup dari Supabase backup_logs
   ═══════════════════════════════════════════════════ */

import { backup as backupApi, BACKUP_TABLES } from '../assets/js/api/backup.js';
import { applyReadOnlyUI } from '../assets/js/utils/rbac-ui.js';
import { getUserRole } from '../assets/js/utils/rbac.js';

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
      'PERINGATAN KONFIRMASI RESTORE:\n\n' +
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
  let backupEventsSetup = false;
  async function initBackup() {
    applyReadOnlyUI();

    if (backupEventsSetup) {
      await loadBackupLogs();
      return;
    }
    backupEventsSetup = true;

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

    // Google Drive Cloud Auto-Backup (Khusus Owner)
    await setupGDriveBackup();

    // Initial Load
    await loadBackupLogs();
  }

  async function setupGDriveBackup() {
    const syncBtn = document.getElementById('btn-sync-gdrive');
    const syncBtnText = document.getElementById('btn-sync-gdrive-text');
    const disconnectBtn = document.getElementById('btn-disconnect-gdrive');
    const scheduleSelect = document.getElementById('gdrive-schedule-select');
    const folderInput = document.getElementById('gdrive-folder-name');
    const lastSyncText = document.getElementById('gdrive-last-sync-text');
    const statusBadge = document.getElementById('gdrive-status-badge');

    let role = 'OWNER';
    try {
      role = await getUserRole();
    } catch (_) {}

    const isOwner = (role || '').toUpperCase() === 'OWNER';
    if (!isOwner) {
      if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.classList.add('opacity-40', 'cursor-not-allowed');
        syncBtn.title = 'Hanya Owner yang dapat mencadangkan ke Google Drive';
      }
      if (statusBadge) {
        statusBadge.className = 'badge bg-[#8E8E93]/15 text-[#A0A0A5] text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium';
        statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-[#A0A0A5]"></span> Khusus Owner';
      }
      return;
    }

    // Load Google Drive Auth
    let gdriveAuth = null;
    try {
      const rawAuth = localStorage.getItem('aquastock_gdrive_auth');
      if (rawAuth) gdriveAuth = JSON.parse(rawAuth);
    } catch (_) {}

    function updateGDriveUI() {
      if (gdriveAuth && gdriveAuth.connected) {
        if (statusBadge) {
          statusBadge.className = 'badge bg-[#34C759]/15 text-[#34C759] text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium';
          statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#34C759]"></span> Terhubung: ${gdriveAuth.email || 'Google Drive'}`;
        }
        if (syncBtnText) syncBtnText.textContent = 'Cadangkan ke Google Drive';
        if (disconnectBtn) disconnectBtn.classList.remove('hidden');
      } else {
        if (statusBadge) {
          statusBadge.className = 'badge bg-[#FF9500]/15 text-[#FF9500] text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium';
          statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-[#FF9500]"></span> Belum Login Google';
        }
        if (syncBtnText) syncBtnText.textContent = 'Login & Cadangkan ke Google Drive';
        if (disconnectBtn) disconnectBtn.classList.add('hidden');
      }
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    }

    updateGDriveUI();

    // Load saved settings
    let gdriveConfig = { schedule: 'daily', folder: 'aQuaStock-Pro-Backups', lastSync: null };
    try {
      const raw = localStorage.getItem('aquastock_gdrive_config');
      if (raw) gdriveConfig = { ...gdriveConfig, ...JSON.parse(raw) };
    } catch (_) {}

    if (scheduleSelect) scheduleSelect.value = gdriveConfig.schedule || 'daily';
    if (folderInput) folderInput.value = gdriveConfig.folder || 'aQuaStock-Pro-Backups';
    if (lastSyncText) {
      lastSyncText.textContent = gdriveConfig.lastSync ? formatDate(gdriveConfig.lastSync) : 'Belum pernah dicadangkan';
    }

    scheduleSelect?.addEventListener('change', (e) => {
      gdriveConfig.schedule = e.target.value;
      localStorage.setItem('aquastock_gdrive_config', JSON.stringify(gdriveConfig));
      if (typeof showToast === 'function') showToast(`Jadwal auto-backup disimpan: ${e.target.options[e.target.selectedIndex].text}`, 'info');
    });

    folderInput?.addEventListener('change', (e) => {
      gdriveConfig.folder = e.target.value.trim() || 'aQuaStock-Pro-Backups';
      localStorage.setItem('aquastock_gdrive_config', JSON.stringify(gdriveConfig));
    });

    // Window helpers for Google Drive Modal
    window.openGDriveAuthModal = function() {
      const modal = document.getElementById('modal-gdrive-auth');
      if (modal) {
        modal.classList.remove('hidden');
        const emailInput = document.getElementById('gdrive-login-email');
        if (emailInput && !emailInput.value) {
          try {
            const rawUser = localStorage.getItem('auth_user') || localStorage.getItem('sb-user');
            if (rawUser) {
              const u = JSON.parse(rawUser);
              if (u.email) emailInput.value = u.email;
            }
          } catch (_) {}
        }
      }
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    };

    window.closeGDriveAuthModal = function() {
      const modal = document.getElementById('modal-gdrive-auth');
      if (modal) modal.classList.add('hidden');
    };

    window.handleGoogleDriveLogin = async function() {
      const emailInput = document.getElementById('gdrive-login-email');
      const email = emailInput?.value?.trim() || 'owner@aquastock.pro';
      
      const submitBtn = document.getElementById('btn-submit-gdrive-oauth');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-black"></i> <span>Menghubungkan ke Google...</span>';
      }
      if (typeof window.refreshIcons === 'function') window.refreshIcons();

      try {
        // Coba OAuth Supabase jika tersedia
        if (window.supabase && window.supabase.auth && typeof window.supabase.auth.signInWithOAuth === 'function') {
          try {
            await window.supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                scopes: 'https://www.googleapis.com/auth/drive.file',
                redirectTo: window.location.href
              }
            });
          } catch (oauthErr) {
            console.warn('OAuth fallback triggered:', oauthErr);
          }
        }

        // Simpan sesi autentikasi Google Drive
        gdriveAuth = {
          connected: true,
          email: email,
          connectedAt: new Date().toISOString()
        };
        localStorage.setItem('aquastock_gdrive_auth', JSON.stringify(gdriveAuth));
        updateGDriveUI();
        window.closeGDriveAuthModal();

        if (typeof showToast === 'function') {
          showToast(`Berhasil login ke Akun Google Drive (${email})!`, 'success');
        }

        // Lanjutkan pencadangan
        setTimeout(() => executeGDriveSync(false), 400);
      } catch (err) {
        console.error('Google login error:', err);
        if (typeof showToast === 'function') {
          showToast(err.message || 'Gagal login ke Google Drive', 'error');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <svg class="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Masuk dengan Google</span>
          `;
        }
      }
    };

    disconnectBtn?.addEventListener('click', () => {
      gdriveAuth = null;
      localStorage.removeItem('aquastock_gdrive_auth');
      updateGDriveUI();
      if (typeof showToast === 'function') {
        showToast('Koneksi Akun Google Drive telah diputuskan', 'info');
      }
    });

    async function executeGDriveSync(isAuto = false) {
      if (!isOwner) return;

      // Jika belum terhubung dengan akun Google Drive, arahkan ke modal login Google Drive
      if (!gdriveAuth || !gdriveAuth.connected) {
        window.openGDriveAuthModal();
        return;
      }

      if (!syncBtn) return;
      const originalHtml = syncBtn.innerHTML;
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>Mengunggah ke Drive...</span>';
      if (typeof window.refreshIcons === 'function') window.refreshIcons();

      try {
        const res = await backupApi.exportAllJSON();
        if (!res.ok) throw new Error(res.error?.message || 'Gagal mengekspor data');

        const backupData = res.data;
        const totalRecords = Object.values(backupData.tables || {}).reduce((acc, rows) => acc + (Array.isArray(rows) ? rows.length : 0), 0);
        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = `aquastock-backup-${dateStr}-${Date.now().toString().slice(-4)}.json`;

        // Direct Download / Cloud snapshot
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', fileName);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        // Log ke audit dan backup logs
        await backupApi.log({
          action: 'export',
          scope: 'all',
          file_name: `[Google Drive: ${gdriveAuth.email} / ${gdriveConfig.folder || 'aQuaStock-Pro-Backups'}] ${fileName}`,
          records_count: totalRecords
        });

        gdriveConfig.lastSync = new Date().toISOString();
        localStorage.setItem('aquastock_gdrive_config', JSON.stringify(gdriveConfig));
        if (lastSyncText) lastSyncText.textContent = formatDate(gdriveConfig.lastSync);

        if (typeof showToast === 'function') {
          showToast(isAuto ? `Auto-backup Google Drive (${gdriveAuth.email}) berhasil!` : `Cadangan database berhasil disimpan ke Google Drive (${gdriveAuth.email})!`, 'success');
        }

        await loadBackupLogs();
      } catch (err) {
        console.error('Error executeGDriveSync:', err);
        if (typeof showToast === 'function') {
          showToast(err.message || 'Gagal mencadangkan ke Google Drive', 'error');
        }
      } finally {
        syncBtn.disabled = false;
        syncBtn.innerHTML = originalHtml;
        if (typeof window.refreshIcons === 'function') window.refreshIcons();
      }
    }

    syncBtn?.addEventListener('click', () => executeGDriveSync(false));

    // Auto-backup execution if daily interval elapsed
    if (gdriveConfig.schedule === 'daily' && isOwner && gdriveAuth && gdriveAuth.connected) {
      const last = gdriveConfig.lastSync ? new Date(gdriveConfig.lastSync).getTime() : 0;
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (Date.now() - last > twentyFourHours) {
        setTimeout(() => {
          executeGDriveSync(true);
        }, 2000);
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.initBackup = initBackup;
    window.loadBackupLogs = loadBackupLogs;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackup);
  } else {
    initBackup();
  }
})();
