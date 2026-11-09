/* ═══════════════════════════════════════════════════
   Aquastock Pro — debt.js
   Controller Modul Hutang & Piutang (debts)
   ═══════════════════════════════════════════════════ */

import { debt as debtApi } from '../assets/js/api/debt.js';
import { applyReadOnlyUI } from '../assets/js/utils/rbac-ui.js';
import { getUserRole } from '../assets/js/utils/rbac.js';

(function () {
  'use strict';

  let currentTab = 'all'; // 'all' | 'hutang' | 'piutang' | 'jatuh_tempo' | 'lunas'
  let currentSearch = '';
  let allDebts = [];
  let userRole = 'STAFF';

  function formatRupiah(num) {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Tanpa Batas';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch (_) {
      return dateStr;
    }
  }

  function getDueStatus(dateStr, status) {
    if (status === 'lunas') {
      return { text: 'Lunas', class: 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/20', icon: 'check-circle-2' };
    }
    if (!dateStr) {
      return { text: 'Belum Lunas', class: 'bg-white/10 text-[#A0A0A5] border-white/10', icon: 'clock' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dateStr);
    dueDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Terlewat ${Math.abs(diffDays)} Hari`, class: 'bg-[#FF3B30]/20 text-[#FF453A] border-[#FF3B30]/30 font-bold', icon: 'alert-triangle' };
    } else if (diffDays === 0) {
      return { text: 'Hari Ini!', class: 'bg-[#FF9F0A]/20 text-[#FF9F0A] border-[#FF9F0A]/30 font-bold animate-pulse', icon: 'alert-circle' };
    } else if (diffDays <= 7) {
      return { text: `${diffDays} Hari Lagi`, class: 'bg-[#FF9F0A]/15 text-[#FF9F0A] border-[#FF9F0A]/20', icon: 'clock' };
    } else {
      return { text: 'Belum Lunas', class: 'bg-white/10 text-[#A0A0A5] border-white/10', icon: 'clock' };
    }
  }

  function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    }
  }

  async function loadData() {
    const hutangContainer = document.getElementById('debt-list-hutang');
    const piutangContainer = document.getElementById('debt-list-piutang');
    const loaderHtml = `
      <div class="py-12 text-center text-[#A0A0A5]">
        <div class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#0088CC] border-t-transparent mb-2"></div>
        <p class="text-xs">Memuat data...</p>
      </div>
    `;

    if (hutangContainer) hutangContainer.innerHTML = loaderHtml;
    if (piutangContainer) piutangContainer.innerHTML = loaderHtml;

    try {
      const resList = await debtApi.getAll({ page: 1, limit: 500, search: currentSearch });
      allDebts = resList.data || [];
      const summary = await debtApi.getSummary(allDebts);
      renderKPI(summary.data || {});
      renderLists();
    } catch (err) {
      console.error('Error loading debt data:', err);
      showToast('Gagal memuat data hutang & piutang', 'error');
    }
  }

  function renderKPI(summary) {
    const elHutang = document.getElementById('kpi-total-hutang');
    const elPiutang = document.getElementById('kpi-total-piutang');
    const elJatuhTempo = document.getElementById('kpi-jatuh-tempo');
    const elLunasBulan = document.getElementById('kpi-lunas-bulan');

    if (elHutang) elHutang.textContent = formatRupiah(summary.totalHutang || 0);
    if (elPiutang) elPiutang.textContent = formatRupiah(summary.totalPiutang || 0);
    if (elJatuhTempo) elJatuhTempo.textContent = `${summary.jatuhTempoMingguIni || 0} Tagihan`;
    if (elLunasBulan) elLunasBulan.textContent = `${summary.sudahLunasBulanIni || 0} Transaksi`;
  }

  function filterItems(items, tipe) {
    return items.filter(item => {
      // Filter by type
      if (item.tipe !== tipe) return false;

      // Filter by tab
      if (currentTab === 'hutang' && item.tipe !== 'hutang') return false;
      if (currentTab === 'piutang' && item.tipe !== 'piutang') return false;
      if (currentTab === 'lunas' && item.status !== 'lunas') return false;
      if (currentTab === 'jatuh_tempo') {
        if (item.status === 'lunas') return false;
        if (!item.jatuh_tempo) return false;
        const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        if (item.jatuh_tempo > nextWeek) return false;
      }

      return true;
    });
  }

  function renderCard(item, isHutang) {
    const dueInfo = getDueStatus(item.jatuh_tempo, item.status);
    const accentColor = isHutang ? '#FF3B30' : '#34C759';
    const isLunas = item.status === 'lunas';

    return `
      <div class="card p-4 rounded-xl bg-[#1C1C1E] border border-white/5 hover:border-white/15 transition group flex flex-col justify-between gap-3 ${isLunas ? 'opacity-70 bg-[#1C1C1E]/50' : ''}" data-id="${item.id}">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1 flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-white truncate text-base">${item.pihak || 'Tanpa Nama'}</span>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${dueInfo.class}">
                <i data-lucide="${dueInfo.icon}" class="w-3 h-3"></i>
                ${dueInfo.text}
              </span>
            </div>
            ${item.catatan ? `<p class="text-xs text-[#A0A0A5] line-clamp-2">${item.catatan}</p>` : ''}
          </div>
          <div class="text-right whitespace-nowrap">
            <span class="text-base font-bold" style="color: ${accentColor}">
              ${formatRupiah(item.nominal)}
            </span>
          </div>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-[#A0A0A5]">
          <div class="flex items-center gap-1.5">
            <i data-lucide="calendar" class="w-3.5 h-3.5 text-[#A0A0A5]"></i>
            <span>Jatuh Tempo: <strong class="text-white">${formatDate(item.jatuh_tempo)}</strong></span>
          </div>

          <div class="flex items-center gap-1">
            ${!isLunas ? `
              <button 
                type="button" 
                data-action="edit" 
                class="btn-mark-lunas px-2.5 py-1 rounded-lg bg-[#34C759]/15 hover:bg-[#34C759]/25 text-[#34C759] font-medium flex items-center gap-1 transition text-xs" 
                data-id="${item.id}"
                title="Tandai Sudah Lunas"
              >
                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                <span>Lunas</span>
              </button>
            ` : `
              <span class="text-[11px] text-[#34C759] font-medium flex items-center gap-1 px-2 py-1">
                <i data-lucide="check-check" class="w-3.5 h-3.5"></i> Selesai
              </span>
            `}

            <button 
              type="button" 
              data-action="delete" 
              class="btn-delete-debt p-1.5 rounded-lg text-[#A0A0A5] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition" 
              data-id="${item.id}"
              title="Hapus Catatan"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderLists() {
    const hutangContainer = document.getElementById('debt-list-hutang');
    const piutangContainer = document.getElementById('debt-list-piutang');
    const hutangCountBadge = document.getElementById('count-hutang-badge');
    const piutangCountBadge = document.getElementById('count-piutang-badge');

    const hutangItems = filterItems(allDebts, 'hutang');
    const piutangItems = filterItems(allDebts, 'piutang');

    if (hutangCountBadge) hutangCountBadge.textContent = hutangItems.length;
    if (piutangCountBadge) piutangCountBadge.textContent = piutangItems.length;

    // Render Hutang Column
    if (hutangContainer) {
      if (hutangItems.length === 0) {
        hutangContainer.innerHTML = `
          <div class="py-12 text-center text-[#A0A0A5] border border-dashed border-white/10 rounded-2xl p-6">
            <div class="w-12 h-12 rounded-2xl bg-white/5 text-[#A0A0A5] grid place-items-center mx-auto mb-3">
              <i data-lucide="check-circle" class="w-6 h-6"></i>
            </div>
            <p class="font-semibold text-white text-sm">Tidak ada catatan hutang</p>
            <p class="text-xs text-[#A0A0A5] mt-1">Semua kewajiban supplier dalam kondisi beres.</p>
          </div>
        `;
      } else {
        hutangContainer.innerHTML = hutangItems.map(item => renderCard(item, true)).join('');
      }
    }

    // Render Piutang Column
    if (piutangContainer) {
      if (piutangItems.length === 0) {
        piutangContainer.innerHTML = `
          <div class="py-12 text-center text-[#A0A0A5] border border-dashed border-white/10 rounded-2xl p-6">
            <div class="w-12 h-12 rounded-2xl bg-white/5 text-[#A0A0A5] grid place-items-center mx-auto mb-3">
              <i data-lucide="check-circle" class="w-6 h-6"></i>
            </div>
            <p class="font-semibold text-white text-sm">Tidak ada catatan piutang</p>
            <p class="text-xs text-[#A0A0A5] mt-1">Tidak ada tagihan tertunda dari customer.</p>
          </div>
        `;
      } else {
        piutangContainer.innerHTML = piutangItems.map(item => renderCard(item, false)).join('');
      }
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    } else if (window.refreshIcons && typeof window.refreshIcons === 'function') {
      window.refreshIcons();
    }

    applyReadOnlyUI();
  }

  async function handleMarkLunas(id) {
    try {
      const res = await debtApi.markAsLunas(id);
      if (res.ok) {
        showToast('Tagihan berhasil ditandai lunas', 'success');
        await loadData();
      } else {
        showToast(res.error?.message || 'Gagal mengubah status', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Terjadi kesalahan sistem', 'error');
    }
  }

  async function handleDelete(id) {
    const confirmed = typeof window.showConfirmDialog === 'function'
      ? await window.showConfirmDialog({
          title: 'Hapus Catatan Hutang / Piutang',
          message: 'Yakin ingin menghapus catatan hutang/piutang ini? Tindakan ini tidak dapat dibatalkan.',
          confirmText: 'Hapus Catatan',
          type: 'danger'
        })
      : confirm('Yakin ingin menghapus catatan hutang/piutang ini?');
    if (!confirmed) return;
    try {
      const res = await debtApi.delete(id);
      if (res.ok) {
        showToast('Catatan berhasil dihapus', 'success');
        await loadData();
      } else {
        showToast(res.error?.message || 'Gagal menghapus catatan', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Terjadi kesalahan sistem', 'error');
    }
  }

  function openModal(defaultTipe = 'hutang') {
    const modal = document.getElementById('modal-debt');
    const form = document.getElementById('form-debt');
    if (!modal || !form) return;

    form.reset();
    const tipeSelect = document.getElementById('debt-tipe');
    if (tipeSelect) tipeSelect.value = defaultTipe;

    const statusSelect = document.getElementById('debt-status');
    if (statusSelect) statusSelect.value = 'belum_bayar';

    // Set default jatuh tempo ke 7 hari ke depan
    const dateInput = document.getElementById('debt-jatuh-tempo');
    if (dateInput) {
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      dateInput.value = nextWeek;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) window.lucide.createIcons();
    if (typeof window.refreshNumericClearButtons === 'function') window.refreshNumericClearButtons();
  }

  function closeModal() {
    const modal = document.getElementById('modal-debt');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  async function handleSubmitForm(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-submit-debt');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Menyimpan...';
    }

    const tipe = document.getElementById('debt-tipe')?.value || 'hutang';
    const pihak = document.getElementById('debt-pihak')?.value || '';
    const nominal = Number((document.getElementById('debt-nominal')?.value || '').replace(/\D/g, '')) || 0;
    const jatuh_tempo = document.getElementById('debt-jatuh-tempo')?.value || null;
    const status = document.getElementById('debt-status')?.value || 'belum_bayar';
    const catatan = document.getElementById('debt-catatan')?.value || '';

    if (!pihak.trim()) {
      showToast('Nama pihak (Supplier/Customer) wajib diisi', 'warning');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan';
      }
      return;
    }

    if (nominal <= 0) {
      showToast('Nominal harus lebih besar dari 0', 'warning');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan';
      }
      return;
    }

    try {
      const res = await debtApi.create({
        tipe,
        pihak,
        nominal,
        jatuh_tempo,
        status,
        catatan
      });

      if (res.ok) {
        showToast('Catatan hutang/piutang berhasil ditambahkan', 'success');
        closeModal();
        await loadData();
      } else {
        showToast(res.error?.message || 'Gagal menyimpan data', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Terjadi kesalahan sistem', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan';
      }
    }
  }

  function exportCSV() {
    if (!allDebts || allDebts.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'warning');
      return;
    }

    const headers = ['ID', 'Tipe', 'Pihak', 'Nominal', 'Jatuh Tempo', 'Status', 'Catatan', 'Tanggal Dibuat'];
    const rows = allDebts.map(d => [
      d.id,
      d.tipe,
      `"${(d.pihak || '').replace(/"/g, '""')}"`,
      d.nominal,
      d.jatuh_tempo || '',
      d.status,
      `"${(d.catatan || '').replace(/"/g, '""')}"`,
      d.created_at || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hutang_piutang_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Ekspor CSV berhasil diunduh', 'success');
  }

  function setupEvents() {
    // Search input
    const searchInput = document.getElementById('debt-search');
    let searchTimeout = null;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          currentSearch = e.target.value;
          loadData();
        }, 300);
      });
    }

    // Filter Tabs
    const tabButtons = document.querySelectorAll('[data-debt-tab]');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => {
          b.classList.remove('bg-[#0088CC]', 'text-white', 'border-transparent');
          b.classList.add('bg-[#1C1C1E]', 'text-[#A0A0A5]', 'border-white/10');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('bg-[#0088CC]', 'text-white', 'border-transparent');
        btn.classList.remove('bg-[#1C1C1E]', 'text-[#A0A0A5]', 'border-white/10');
        btn.setAttribute('aria-pressed', 'true');

        currentTab = btn.getAttribute('data-debt-tab') || 'all';
        renderLists();
      });
    });

    // Export CSV button
    const exportBtn = document.getElementById('btn-export-debt');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportCSV);
    }

    // Open Modal buttons
    const addBtn = document.getElementById('btn-open-debt-modal');
    if (addBtn) {
      addBtn.addEventListener('click', () => openModal('hutang'));
    }

    const addHutangQuick = document.getElementById('btn-quick-add-hutang');
    if (addHutangQuick) {
      addHutangQuick.addEventListener('click', () => openModal('hutang'));
    }

    const addPiutangQuick = document.getElementById('btn-quick-add-piutang');
    if (addPiutangQuick) {
      addPiutangQuick.addEventListener('click', () => openModal('piutang'));
    }

    // Close Modal buttons
    const closeModalBtn = document.getElementById('btn-close-debt-modal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

    const cancelModalBtn = document.getElementById('btn-cancel-debt-modal');
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    const modalBackdrop = document.getElementById('modal-debt');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
      });
    }

    // Submit Form
    const form = document.getElementById('form-debt');
    if (form) {
      form.addEventListener('submit', handleSubmitForm);
    }

    // Auto-format nominal with thousand separators
    const nominalInput = document.getElementById('debt-nominal');
    if (nominalInput) {
      nominalInput.addEventListener('input', (e) => {
        const cleanDigits = e.target.value.replace(/\D/g, '');
        const rawNumber = cleanDigits === '' ? 0 : Number(cleanDigits);
        e.target.value = rawNumber > 0 ? new Intl.NumberFormat('id-ID').format(rawNumber) : '';
      });
    }

    // Delegation for Action Buttons in lists (Mark Lunas & Delete)
    document.addEventListener('click', (e) => {
      const lunasBtn = e.target.closest('.btn-mark-lunas');
      if (lunasBtn) {
        const id = lunasBtn.getAttribute('data-id');
        if (id) handleMarkLunas(id);
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-debt');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        if (id) handleDelete(id);
        return;
      }
    });
  }

  async function initDebt() {
    try {
      userRole = await getUserRole();
    } catch (_) {}

    setupEvents();
    await loadData();
  }

  if (typeof window !== 'undefined') {
    window.initDebt = initDebt;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDebt);
  } else {
    initDebt();
  }

})();
