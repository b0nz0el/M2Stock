/* ═══════════════════════════════════════════════════
   aQuaStock Pro — po.js
   Controller Modul Purchase Order & PO Items
   ═══════════════════════════════════════════════════ */

import { po as poApi } from '../../assets/js/api/po.js';
import { applyReadOnlyUI } from '../../assets/js/utils/rbac-ui.js';
import { getUserRole } from '../../assets/js/utils/rbac.js';

(function () {
  'use strict';

  let currentPage = 1;
  const pageSize = 15;
  let currentStatus = 'all'; // 'all' | 'draft' | 'dikirim' | 'diterima' | 'dibatalkan'
  let currentSearch = '';
  let totalRecords = 0;
  let totalPages = 1;
  let poEntries = [];
  let userRole = 'STAFF';

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

  function getStatusBadge(status) {
    const s = (status || 'draft').toLowerCase();
    const map = {
      'draft': {
        class: 'bg-[#8E8E93]/15 text-[#A0A0A5] border border-[#8E8E93]/20',
        label: 'Draft',
        icon: 'file-text'
      },
      'dikirim': {
        class: 'bg-[#0088CC]/15 text-[#32ADE6] border border-[#0088CC]/20',
        label: 'Dikirim',
        icon: 'send'
      },
      'diterima': {
        class: 'bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/20',
        label: 'Diterima',
        icon: 'check-circle-2'
      },
      'dibatalkan': {
        class: 'bg-[#FF3B30]/15 text-[#FF3B30] border border-[#FF3B30]/20',
        label: 'Dibatalkan',
        icon: 'x-circle'
      }
    };

    const cfg = map[s] || map['draft'];
    return `
      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.class}">
        <i data-lucide="${cfg.icon}" class="w-3 h-3"></i>
        <span>${cfg.label}</span>
      </span>
    `;
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const colors = {
      success: 'bg-[#34C759] text-black',
      error: 'bg-[#FF3B30] text-white',
      info: 'bg-[#0088CC] text-white',
      warning: 'bg-[#FF9F0A] text-black'
    };

    const toast = document.createElement('div');
    toast.className = `${colors[type] || colors.info} px-4 py-3 rounded-xl shadow-lg flex items-center justify-between gap-3 text-sm font-semibold pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0`;
    toast.innerHTML = `
      <span>${message}</span>
      <button class="opacity-70 hover:opacity-100">&times;</button>
    `;

    toast.querySelector('button').onclick = () => {
      toast.remove();
    };

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  async function loadData() {
    const tbody = document.getElementById('po-table-body');
    const emptyState = document.getElementById('po-empty-state');
    const refreshBtn = document.getElementById('btn-refresh-po');

    if (refreshBtn) refreshBtn.classList.add('opacity-50', 'pointer-events-none');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-[#A0A0A5]">
            <div class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#0088CC] border-t-transparent mb-2"></div>
            <p class="text-xs">Memuat data Purchase Order...</p>
          </td>
        </tr>
      `;
    }

    try {
      const resList = await poApi.getAll({
        page: currentPage,
        limit: pageSize,
        status: currentStatus === 'all' ? null : currentStatus,
        search: currentSearch
      });

      poEntries = resList.data || [];
      totalRecords = resList.meta?.total || poEntries.length;
      totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

      const resSummary = await poApi.getSummary(poEntries);
      renderKPI(resSummary.data || {});
      renderTable(poEntries);
      renderPagination();
    } catch (err) {
      console.error('Error loading PO data:', err);
      showToast('Gagal memuat data Purchase Order', 'error');
    } finally {
      if (refreshBtn) refreshBtn.classList.remove('opacity-50', 'pointer-events-none');
    }
  }

  function renderKPI(summary) {
    const elTotal = document.getElementById('kpi-total-po');
    const elDraft = document.getElementById('kpi-draft-po');
    const elDikirim = document.getElementById('kpi-dikirim-po');
    const elNilai = document.getElementById('kpi-nilai-po');

    if (elTotal) elTotal.textContent = `${summary.totalPOBulanIni || 0} PO`;
    if (elDraft) elDraft.textContent = `${summary.draftPO || 0} Draft`;
    if (elDikirim) elDikirim.textContent = `${summary.dikirim || 0} Dikirim`;
    if (elNilai) elNilai.textContent = formatRupiah(summary.totalNilaiPOBulanIni || 0);
  }

  function renderTable(data) {
    const tbody = document.getElementById('po-table-body');
    const emptyState = document.getElementById('po-empty-state');
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = data.map((item) => {
      const itemCount = (item.items && item.items.length) || (item.purchase_order_items && item.purchase_order_items.length) || 1;
      const supplierName = item.supplier_nama || item.catatan?.replace('Supplier: ', '') || 'Supplier Mitra';
      return `
        <tr class="table-row border-b border-white/5 hover:bg-white/[0.02] transition">
          <td class="px-4 py-3.5 font-mono text-xs font-semibold text-[#32ADE6]">
            ${item.no_po || '-'}
          </td>
          <td class="px-4 py-3.5 text-xs text-[#A0A0A5] whitespace-nowrap">
            ${formatDate(item.tanggal)}
          </td>
          <td class="px-4 py-3.5 font-medium text-sm text-white">
            <div>${supplierName}</div>
            ${item.catatan && !item.catatan.startsWith('Supplier:') ? `<div class="text-[11px] text-[#A0A0A5] truncate max-w-xs mt-0.5">${item.catatan}</div>` : ''}
          </td>
          <td class="px-4 py-3.5 text-xs text-[#A0A0A5] whitespace-nowrap">
            ${itemCount} item
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            ${getStatusBadge(item.status)}
          </td>
          <td class="px-4 py-3.5 text-right font-bold text-white whitespace-nowrap">
            ${formatRupiah(item.total)}
          </td>
          <td class="px-4 py-3.5 text-right whitespace-nowrap">
            <div class="flex items-center justify-end gap-1.5">
              ${item.status === 'draft' ? `
                <button 
                  type="button" 
                  data-action="edit" 
                  class="btn-send-po p-1.5 rounded-lg text-[#32ADE6] hover:bg-[#32ADE6]/15 transition" 
                  data-id="${item.id}"
                  title="Kirim ke Supplier"
                >
                  <i data-lucide="send" class="w-4 h-4"></i>
                </button>
              ` : ''}

              ${item.status === 'dikirim' ? `
                <button 
                  type="button" 
                  data-action="edit" 
                  class="btn-receive-po p-1.5 rounded-lg text-[#34C759] hover:bg-[#34C759]/15 transition" 
                  data-id="${item.id}"
                  title="Tandai Diterima"
                >
                  <i data-lucide="package-check" class="w-4 h-4"></i>
                </button>
              ` : ''}

              <button 
                type="button" 
                data-action="delete" 
                class="btn-delete-po p-1.5 rounded-lg text-[#A0A0A5] hover:text-[#FF3B30] hover:bg-[#FF3B30]/15 transition" 
                data-id="${item.id}"
                title="Hapus PO"
              >
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    } else if (window.refreshIcons && typeof window.refreshIcons === 'function') {
      window.refreshIcons();
    }

    applyReadOnlyUI();
  }

  function renderPagination() {
    const elInfo = document.getElementById('po-pagination-info');
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    if (elInfo) {
      if (totalRecords === 0) {
        elInfo.textContent = 'Menampilkan 0 dari 0 PO';
      } else {
        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(currentPage * pageSize, totalRecords);
        elInfo.textContent = `Menampilkan ${start}-${end} dari ${totalRecords} PO`;
      }
    }

    if (btnPrev) {
      btnPrev.disabled = currentPage <= 1;
      btnPrev.classList.toggle('opacity-50', currentPage <= 1);
      btnPrev.classList.toggle('cursor-not-allowed', currentPage <= 1);
    }

    if (btnNext) {
      btnNext.disabled = currentPage >= totalPages;
      btnNext.classList.toggle('opacity-50', currentPage >= totalPages);
      btnNext.classList.toggle('cursor-not-allowed', currentPage >= totalPages);
    }
  }

  async function handleUpdateStatus(id, newStatus, successMsg) {
    try {
      const res = await poApi.updateStatus(id, newStatus);
      if (res.ok) {
        showToast(successMsg, 'success');
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
    if (!confirm('Yakin ingin menghapus Purchase Order ini? Seluruh rincian item akan ikut terhapus.')) return;
    try {
      const res = await poApi.delete(id);
      if (res.ok) {
        showToast('Purchase Order berhasil dihapus', 'success');
        await loadData();
      } else {
        showToast(res.error?.message || 'Gagal menghapus PO', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Terjadi kesalahan sistem', 'error');
    }
  }

  // Dynamic Item Rows in Modal
  function createItemRow(nama = '', qty = 1, harga = 0) {
    const row = document.createElement('div');
    row.className = 'po-item-row grid grid-cols-12 gap-2 items-center bg-black/30 p-2.5 rounded-xl border border-white/5';
    row.innerHTML = `
      <div class="col-span-5">
        <input type="text" required placeholder="Nama Barang..." value="${nama}"
               class="item-nama w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0088CC]">
      </div>
      <div class="col-span-2">
        <input type="number" required min="1" step="1" value="${qty}" placeholder="Qty"
               class="item-qty w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white text-center focus:outline-none focus:border-[#0088CC]">
      </div>
      <div class="col-span-2">
        <input type="number" required min="0" step="1000" value="${harga}" placeholder="Harga"
               class="item-harga w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0088CC]">
      </div>
      <div class="col-span-2 text-right">
        <span class="item-subtotal text-xs font-semibold text-[#34C759]">Rp 0</span>
      </div>
      <div class="col-span-1 text-center">
        <button type="button" class="btn-remove-item text-[#A0A0A5] hover:text-[#FF3B30] p-1 transition" title="Hapus Baris">
          <i data-lucide="trash" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    const qtyInput = row.querySelector('.item-qty');
    const hargaInput = row.querySelector('.item-harga');
    const removeBtn = row.querySelector('.btn-remove-item');

    function updateRowSubtotal() {
      const q = Math.max(1, Number(qtyInput.value) || 1);
      const h = Math.max(0, Number(hargaInput.value) || 0);
      const sub = q * h;
      row.querySelector('.item-subtotal').textContent = formatRupiah(sub);
      calculateGrandTotal();
    }

    qtyInput.addEventListener('input', updateRowSubtotal);
    hargaInput.addEventListener('input', updateRowSubtotal);

    removeBtn.addEventListener('click', () => {
      const allRows = document.querySelectorAll('.po-item-row');
      if (allRows.length <= 1) {
        showToast('Minimal harus ada 1 item barang dalam PO', 'warning');
        return;
      }
      row.remove();
      calculateGrandTotal();
    });

    updateRowSubtotal();
    return row;
  }

  function calculateGrandTotal() {
    let grand = 0;
    document.querySelectorAll('.po-item-row').forEach(row => {
      const q = Math.max(1, Number(row.querySelector('.item-qty')?.value) || 1);
      const h = Math.max(0, Number(row.querySelector('.item-harga')?.value) || 0);
      grand += (q * h);
    });

    const grandEl = document.getElementById('po-modal-grand-total');
    if (grandEl) grandEl.textContent = formatRupiah(grand);
  }

  function openModal() {
    const modal = document.getElementById('modal-po');
    const form = document.getElementById('form-po');
    const itemsContainer = document.getElementById('po-items-container');
    if (!modal || !form || !itemsContainer) return;

    form.reset();

    const noInput = document.getElementById('po-no');
    if (noInput) noInput.value = poApi.generateNoPO();

    const dateInput = document.getElementById('po-tanggal');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    const statusSelect = document.getElementById('po-status');
    if (statusSelect) statusSelect.value = 'draft';

    itemsContainer.innerHTML = '';
    // Tambah 2 baris item awal secara default
    itemsContainer.appendChild(createItemRow('Filter Canister HW-3000', 2, 1250000));
    itemsContainer.appendChild(createItemRow('Lampu LED Chihiros 60cm', 1, 1000000));

    calculateGrandTotal();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) window.lucide.createIcons();
  }

  function closeModal() {
    const modal = document.getElementById('modal-po');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  async function handleSubmitForm(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-submit-po');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Menyimpan...';
    }

    const no_po = document.getElementById('po-no')?.value || '';
    const tanggal = document.getElementById('po-tanggal')?.value || new Date().toISOString().slice(0, 10);
    const supplier_nama = document.getElementById('po-supplier')?.value || '';
    const status = document.getElementById('po-status')?.value || 'draft';
    const catatan = document.getElementById('po-catatan')?.value || '';

    if (!supplier_nama.trim()) {
      showToast('Nama supplier wajib diisi', 'warning');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan PO';
      }
      return;
    }

    const items = [];
    document.querySelectorAll('.po-item-row').forEach(row => {
      const nama = row.querySelector('.item-nama')?.value?.trim();
      const qty = Number(row.querySelector('.item-qty')?.value || 1);
      const harga = Number(row.querySelector('.item-harga')?.value || 0);
      if (nama) {
        items.push({
          product_nama: nama,
          qty,
          harga
        });
      }
    });

    if (items.length === 0) {
      showToast('Minimal masukkan 1 rincian item barang', 'warning');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan PO';
      }
      return;
    }

    try {
      const res = await poApi.create({
        no_po,
        tanggal,
        supplier_nama,
        status,
        catatan,
        items
      });

      if (res.ok) {
        showToast('Purchase Order berhasil dibuat', 'success');
        closeModal();
        await loadData();
      } else {
        showToast(res.error?.message || 'Gagal menyimpan PO', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Terjadi kesalahan sistem', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan PO';
      }
    }
  }

  function exportCSV() {
    if (!poEntries || poEntries.length === 0) {
      showToast('Tidak ada data PO untuk diekspor', 'warning');
      return;
    }

    const headers = ['No PO', 'Tanggal', 'Supplier', 'Item Count', 'Status', 'Total', 'Catatan'];
    const rows = poEntries.map(p => [
      p.no_po,
      p.tanggal || '',
      `"${(p.supplier_nama || p.catatan || '').replace(/"/g, '""')}"`,
      (p.items && p.items.length) || (p.purchase_order_items && p.purchase_order_items.length) || 1,
      p.status,
      p.total,
      `"${(p.catatan || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `purchase_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Ekspor CSV berhasil diunduh', 'success');
  }

  function setupEvents() {
    // Search
    const searchInput = document.getElementById('po-search');
    let searchTimeout = null;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          currentSearch = e.target.value;
          currentPage = 1;
          loadData();
        }, 300);
      });
    }

    // Filter Tabs
    const tabButtons = document.querySelectorAll('[data-po-tab]');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => {
          b.classList.remove('bg-[#0088CC]', 'text-white', 'border-transparent');
          b.classList.add('bg-[#1C1C1E]', 'text-[#A0A0A5]', 'border-white/10');
        });
        btn.classList.add('bg-[#0088CC]', 'text-white', 'border-transparent');
        btn.classList.remove('bg-[#1C1C1E]', 'text-[#A0A0A5]', 'border-white/10');

        currentStatus = btn.getAttribute('data-po-tab') || 'all';
        currentPage = 1;
        loadData();
      });
    });

    // Refresh
    const refreshBtn = document.getElementById('btn-refresh-po');
    if (refreshBtn) refreshBtn.addEventListener('click', loadData);

    // Export CSV
    const exportBtn = document.getElementById('btn-export-po');
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    // Open Modal
    const addBtn = document.getElementById('btn-open-po-modal');
    if (addBtn) addBtn.addEventListener('click', openModal);

    const addHeaderBtn = document.getElementById('btn-add-po-header');
    if (addHeaderBtn) addHeaderBtn.addEventListener('click', openModal);

    // Add item row in modal
    const addItemBtn = document.getElementById('btn-add-item-row');
    if (addItemBtn) {
      addItemBtn.addEventListener('click', () => {
        const container = document.getElementById('po-items-container');
        if (container) {
          container.appendChild(createItemRow());
          if (window.lucide) window.lucide.createIcons();
        }
      });
    }

    // Close Modal
    const closeModalBtn = document.getElementById('btn-close-po-modal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

    const cancelModalBtn = document.getElementById('btn-cancel-po-modal');
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    const modalBackdrop = document.getElementById('modal-po');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
      });
    }

    // Submit Form
    const form = document.getElementById('form-po');
    if (form) form.addEventListener('submit', handleSubmitForm);

    // Pagination buttons
    const btnPrev = document.getElementById('btn-prev-page');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          loadData();
        }
      });
    }

    const btnNext = document.getElementById('btn-next-page');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          loadData();
        }
      });
    }

    // Action button delegations
    document.addEventListener('click', (e) => {
      const sendBtn = e.target.closest('.btn-send-po');
      if (sendBtn) {
        const id = sendBtn.getAttribute('data-id');
        if (id) handleUpdateStatus(id, 'dikirim', 'Status PO diubah ke Dikirim');
        return;
      }

      const receiveBtn = e.target.closest('.btn-receive-po');
      if (receiveBtn) {
        const id = receiveBtn.getAttribute('data-id');
        if (id) handleUpdateStatus(id, 'diterima', 'Barang PO telah diterima lengkap');
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-po');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        if (id) handleDelete(id);
        return;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      userRole = await getUserRole();
    } catch (_) {}

    setupEvents();
    await loadData();
  });

})();
