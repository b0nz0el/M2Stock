/* ═══════════════════════════════════════════════════
   Aquastock Pro — cash.js
   Controller Modul Kas & Keuangan (cash_flow)
   ═══════════════════════════════════════════════════ */

import { cash as cashApi } from '../assets/js/api/cash.js';
import { applyReadOnlyUI } from '../assets/js/utils/rbac-ui.js';
import { getUserRole } from '../assets/js/utils/rbac.js';

(function () {
  'use strict';

  let currentPage = 1;
  const pageSize = 15;
  let currentKategori = 'ALL';
  let currentMetode = 'ALL';
  let currentSearch = '';
  let currentPeriod = 'month'; // 'month' | '30d' | 'all'
  let totalRecords = 0;
  let totalPages = 1;
  let cashEntries = [];

  function formatRupiah(num) {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
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

  function getKategoriBadge(kategori) {
    const k = kategori || 'Lainnya';
    const map = {
      'Penjualan': 'bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/20',
      'Pembelian': 'bg-[#FF9500]/15 text-[#FF9500] border border-[#FF9500]/20',
      'Gaji': 'bg-[#AF52DE]/15 text-[#AF52DE] border border-[#AF52DE]/20',
      'Operasional': 'bg-[#0088CC]/15 text-[#32ADE6] border border-[#0088CC]/20',
      'Lainnya': 'bg-white/10 text-[#A0A0A5] border border-white/10'
    };
    const cls = map[k] || map['Lainnya'];
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}">${k}</span>`;
  }

  function getMetodeBadge(metode) {
    const m = metode || 'Cash';
    const map = {
      'Cash': 'bg-[#0088CC]/15 text-[#32ADE6]',
      'Transfer': 'bg-[#34C759]/15 text-[#34C759]',
      'QRIS': 'bg-[#FF9F0A]/15 text-[#FF9F0A]'
    };
    const cls = map[m] || 'bg-white/10 text-white';
    return `<span class="badge ${cls}">${m}</span>`;
  }

  function getDateFilterRange(period) {
    const now = new Date();
    if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      return { startDate: start, endDate: null };
    }
    if (period === '30d') {
      const start = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      return { startDate: start, endDate: null };
    }
    return { startDate: null, endDate: null };
  }

  async function loadCashData() {
    const tbody = document.getElementById('cash-table-body');
    const emptyState = document.getElementById('cash-empty-state');
    const refreshBtn = document.getElementById('btn-refresh-cash');

    if (refreshBtn) refreshBtn.classList.add('opacity-50', 'pointer-events-none');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-[#A0A0A5]">
            <div class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#0088CC] border-t-transparent mb-2"></div>
            <p class="text-xs">Memuat arus kas...</p>
          </td>
        </tr>
      `;
    }

    try {
      const { startDate, endDate } = getDateFilterRange(currentPeriod);
      const res = await cashApi.getAll({
        page: currentPage,
        limit: pageSize,
        kategori: currentKategori,
        metode: currentMetode,
        startDate,
        endDate,
        search: currentSearch
      });

      if (!res.ok) {
        throw new Error(res.error?.message || 'Gagal mengambil data arus kas');
      }

      cashEntries = res.data || [];
      totalRecords = res.meta?.total || cashEntries.length;
      totalPages = res.meta?.totalPages || Math.max(1, Math.ceil(totalRecords / pageSize));

      renderTable();
      renderPagination();
      updateKPI(cashEntries);
    } catch (err) {
      console.error('Error loadCashData:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="py-8 text-center text-[#FF3B30]">
              <i data-lucide="alert-circle" class="w-6 h-6 mx-auto mb-1"></i>
              <p class="text-xs font-medium">${err.message || 'Gagal memuat arus kas'}</p>
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
    const tbody = document.getElementById('cash-table-body');
    const emptyState = document.getElementById('cash-empty-state');
    if (!tbody) return;

    if (!cashEntries || cashEntries.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = cashEntries.map(item => {
      const inVal = Number(item.pemasukan) || 0;
      const outVal = Number(item.pengeluaran) || 0;

      return `
        <tr class="table-row border-b border-white/5 hover:bg-white/[0.02] transition-colors">
          <td class="px-5 py-3.5 text-[#A0A0A5] font-mono text-xs whitespace-nowrap">
            ${formatDate(item.tanggal)}
          </td>
          <td class="px-5 py-3.5 font-medium text-white text-sm">
            ${escapeHtml(item.keterangan || '-')}
          </td>
          <td class="px-5 py-3.5 whitespace-nowrap">
            ${getKategoriBadge(item.kategori)}
          </td>
          <td class="px-5 py-3.5 whitespace-nowrap">
            ${getMetodeBadge(item.metode)}
          </td>
          <td class="px-5 py-3.5 text-right font-semibold whitespace-nowrap ${inVal > 0 ? 'text-[#34C759]' : 'text-[#A0A0A5]'}">
            ${inVal > 0 ? `+${formatRupiah(inVal)}` : '—'}
          </td>
          <td class="px-5 py-3.5 text-right font-semibold whitespace-nowrap ${outVal > 0 ? 'text-[#FF3B30]' : 'text-[#A0A0A5]'}">
            ${outVal > 0 ? `-${formatRupiah(outVal)}` : '—'}
          </td>
          <td class="px-5 py-3.5 text-right whitespace-nowrap">
            <button data-action="delete" data-id="${item.id}" title="Hapus Transaksi" class="p-1.5 rounded-lg text-[#A0A0A5] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach delete listeners
    tbody.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const confirmed = typeof window.showConfirmDialog === 'function'
          ? await window.showConfirmDialog({
              title: 'Hapus Catatan Kas',
              message: 'Yakin ingin menghapus catatan kas ini? Tindakan ini tidak dapat dibatalkan.',
              confirmText: 'Hapus Catatan',
              type: 'danger'
            })
          : confirm('Yakin ingin menghapus catatan kas ini?');
        if (confirmed) {
          await deleteCash(id);
        }
      });
    });
  }

  function renderPagination() {
    const pageInfo = document.getElementById('cash-page-info');
    const prevBtn = document.getElementById('cash-prev-page');
    const nextBtn = document.getElementById('cash-next-page');

    if (pageInfo) {
      pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages} (Total ${totalRecords} transaksi)`;
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
      const res = await cashApi.getSummary({ items });
      if (!res.ok) return;

      const s = res.data || {};
      const elSaldo = document.getElementById('kpi-saldo-kas');
      const elPemasukan = document.getElementById('kpi-pemasukan-bulan');
      const elPengeluaran = document.getElementById('kpi-pengeluaran-bulan');
      const elLaba = document.getElementById('kpi-laba-bersih');

      if (elSaldo) elSaldo.textContent = formatRupiah(s.saldoKas);
      if (elPemasukan) elPemasukan.textContent = formatRupiah(s.pemasukanBulanIni);
      if (elPengeluaran) elPengeluaran.textContent = formatRupiah(s.pengeluaranBulanIni);
      if (elLaba) {
        elLaba.textContent = formatRupiah(s.labaBersihBulanIni);
        if (s.labaBersihBulanIni < 0) {
          elLaba.className = 'text-2xl font-bold text-[#FF3B30] mt-1';
        } else {
          elLaba.className = 'text-2xl font-bold text-[#34C759] mt-1';
        }
      }
    } catch (_) {}
  }

  async function deleteCash(id) {
    try {
      const res = await cashApi.delete(id);
      if (res.ok) {
        if (typeof showToast === 'function') {
          showToast('Transaksi kas berhasil dihapus', 'success');
        }
        await loadCashData();
      } else {
        throw new Error(res.error?.message || 'Gagal menghapus transaksi');
      }
    } catch (err) {
      alert(err.message || 'Gagal menghapus');
    }
  }

  function exportCSV() {
    if (!cashEntries || cashEntries.length === 0) {
      if (typeof showToast === 'function') {
        showToast('Tidak ada data transaksi untuk diekspor', 'warning');
      } else {
        alert('Tidak ada data transaksi untuk diekspor');
      }
      return;
    }

    const headers = ['ID', 'Tanggal', 'Keterangan', 'Kategori', 'Metode', 'Pemasukan', 'Pengeluaran'];
    const rows = cashEntries.map(c => [
      c.id || '',
      c.tanggal || '',
      (c.keterangan || '').replace(/"/g, '""'),
      c.kategori || '',
      c.metode || '',
      Number(c.pemasukan) || 0,
      Number(c.pengeluaran) || 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(col => `"${col}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arus_kas_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof showToast === 'function') {
      showToast('Data arus kas berhasil diekspor', 'success');
    }
  }

  let currentCashAmount = 0;

  function openModal() {
    const modal = document.getElementById('modal-cash');
    if (!modal) return;
    const form = document.getElementById('form-cash');
    if (form) form.reset();

    currentCashAmount = 0;
    const amountInput = document.getElementById('cash-form-amount');
    if (amountInput) amountInput.value = '';

    const typeHidden = document.getElementById('cash-form-type');
    if (typeHidden) typeHidden.value = 'IN';

    const inRadio = form?.querySelector('input[name="cash_type"][value="IN"]');
    if (inRadio) inRadio.checked = true;

    const dateInput = document.getElementById('cash-form-date');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    if (typeof window.refreshNumericClearButtons === 'function') window.refreshNumericClearButtons();
  }

  function closeModal() {
    const modal = document.getElementById('modal-cash');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');

    currentCashAmount = 0;
    const amountInput = document.getElementById('cash-form-amount');
    if (amountInput) amountInput.value = '';
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

  // Setup Event Listeners
  let cashInitialized = false;
  async function initCash() {
    applyReadOnlyUI();

    if (cashInitialized) {
      await loadCashData();
      return;
    }
    cashInitialized = true;

    // Modal Trigger
    const openBtn = document.getElementById('btn-open-cash-modal');
    if (openBtn) openBtn.addEventListener('click', openModal);

    const closeBtn = document.getElementById('btn-close-cash-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    const cancelBtn = document.getElementById('btn-cancel-cash-modal');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Format & Parse Nominal Input
    const amountInput = document.getElementById('cash-form-amount');
    if (amountInput) {
      amountInput.addEventListener('input', (e) => {
        const cleanDigits = e.target.value.replace(/\D/g, '');
        const rawNumber = cleanDigits === '' ? 0 : Number(cleanDigits);
        currentCashAmount = isNaN(rawNumber) ? 0 : rawNumber;
        e.target.value = currentCashAmount > 0
          ? new Intl.NumberFormat('id-ID').format(currentCashAmount)
          : '';
      });
    }

    // Form Submit
    const form = document.getElementById('form-cash');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.getElementById('cash-form-type')?.value || 'IN';
        const amountEl = document.getElementById('cash-form-amount');
        const rawFromInput = Number((amountEl?.value || '').replace(/\D/g, '')) || 0;
        const amount = currentCashAmount || rawFromInput;
        const tanggal = document.getElementById('cash-form-date')?.value || new Date().toISOString().slice(0, 10);
        const keterangan = (document.getElementById('cash-form-desc')?.value || '').trim();
        const kategori = document.getElementById('cash-form-kategori')?.value || 'Lainnya';
        const metode = document.getElementById('cash-form-metode')?.value || 'Cash';

        if (amount <= 0) {
          if (typeof showToast === 'function') {
            showToast('Nominal harus lebih dari 0', 'error');
          } else {
            alert('Nominal harus lebih dari 0');
          }
          if (amountEl) amountEl.focus();
          return;
        }

        const payload = {
          tanggal,
          keterangan,
          kategori,
          metode,
          pemasukan: type === 'IN' ? amount : 0,
          pengeluaran: type === 'OUT' ? amount : 0
        };

        const submitBtn = document.getElementById('btn-submit-cash');
        if (submitBtn) submitBtn.disabled = true;

        try {
          const res = await cashApi.create(payload);
          if (res.ok) {
            closeModal();
            if (typeof showToast === 'function') {
              showToast('Transaksi kas berhasil dicatat', 'success');
            }
            await loadCashData();
          } else {
            throw new Error(res.error?.message || 'Gagal menyimpan transaksi');
          }
        } catch (err) {
          alert(err.message || 'Gagal menyimpan transaksi kas');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    // Filter Kategori
    const selectKategori = document.getElementById('cash-filter-kategori');
    if (selectKategori) {
      selectKategori.addEventListener('change', (e) => {
        currentKategori = e.target.value;
        currentPage = 1;
        loadCashData();
      });
    }

    // Filter Metode
    const selectMetode = document.getElementById('cash-filter-metode');
    if (selectMetode) {
      selectMetode.addEventListener('change', (e) => {
        currentMetode = e.target.value;
        currentPage = 1;
        loadCashData();
      });
    }

    // Filter Periode
    const selectPeriod = document.getElementById('cash-filter-period');
    if (selectPeriod) {
      selectPeriod.addEventListener('change', (e) => {
        currentPeriod = e.target.value;
        currentPage = 1;
        loadCashData();
      });
    }

    // Search Input
    const searchInput = document.getElementById('cash-search-input');
    if (searchInput) {
      let timeout = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          currentSearch = e.target.value.trim();
          currentPage = 1;
          loadCashData();
        }, 350);
      });
    }

    // Refresh Button
    const refreshBtn = document.getElementById('btn-refresh-cash');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadCashData();
      });
    }

    // Export CSV Button
    const exportBtn = document.getElementById('btn-export-cash');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportCSV);
    }

    // Pagination
    const prevBtn = document.getElementById('cash-prev-page');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          loadCashData();
        }
      });
    }

    const nextBtn = document.getElementById('cash-next-page');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          loadCashData();
        }
      });
    }

    // Initial Load
    await loadCashData();
  }

  if (typeof window !== 'undefined') {
    window.initCash = initCash;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCash);
  } else {
    initCash();
  }
})();
