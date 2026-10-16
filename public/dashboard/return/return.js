/* ═══════════════════════════════════════════════════
   aQuaStock Pro — return.js
   Controller Modul Retur Barang (returns)
   ═══════════════════════════════════════════════════ */

import { returnApi } from '../../assets/js/api/return.js';
import { items as itemsApi } from '../../assets/js/api/items.js';
import { applyReadOnlyUI } from '../../assets/js/utils/rbac-ui.js';
import { getUserRole } from '../../assets/js/utils/rbac.js';

(function () {
  'use strict';

  let currentPage = 1;
  const pageSize = 15;
  let currentTipe = 'ALL';
  let currentStatus = 'ALL';
  let currentPeriod = 'month'; // 'month' | '30d' | 'all'
  let currentSearch = '';
  let totalRecords = 0;
  let totalPages = 1;
  let returnEntries = [];
  let availableProducts = [];
  let productsById = new Map();
  let userRole = 'STAFF';
  let pendingDeleteId = null;
  let deleteTrigger = null;
  let deleteInProgress = false;

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

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  function getProductName(item) {
    return item.produk_nama
      || productsById.get(String(item.produk_id))?.name
      || item.keterangan
      || (item.produk_id ? `Produk #${item.produk_id.slice(0, 8)}` : 'Barang Toko');
  }

  function setProductSelectMessage(message) {
    const select = document.getElementById('return-produk');
    if (!select) return;
    const option = document.createElement('option');
    option.value = '';
    option.textContent = message;
    select.replaceChildren(option);
  }

  async function loadProducts() {
    setProductSelectMessage('Memuat master produk...');
    try {
      const result = await itemsApi.getAll();
      if (!result?.ok) {
        availableProducts = [];
        productsById.clear();
        setProductSelectMessage('Gagal memuat master produk');
        showToast(result?.error?.message || 'Gagal memuat master produk', 'error');
        return false;
      }

      availableProducts = (result.data || []).filter((product) => product?.id && product.name);
      productsById = new Map(availableProducts.map((product) => [String(product.id), product]));

      const select = document.getElementById('return-produk');
      if (select) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = availableProducts.length
          ? 'Pilih barang dari master produk'
          : 'Belum ada barang di master produk';
        select.replaceChildren(placeholder);
        availableProducts.forEach((product) => {
          const option = document.createElement('option');
          option.value = product.id;
          option.textContent = product.sku ? `${product.name} · ${product.sku}` : product.name;
          select.appendChild(option);
        });
      }
      return true;
    } catch (err) {
      console.error('Error loading return products:', err);
      availableProducts = [];
      productsById.clear();
      setProductSelectMessage('Gagal memuat master produk');
      showToast('Gagal memuat master produk', 'error');
      return false;
    }
  }

  function getStatusBadge(status) {
    const s = (status || 'diproses').toLowerCase();
    const map = {
      'diproses': {
        class: 'bg-[#FF9F0A]/15 text-[#FF9F0A] border border-[#FF9F0A]/20',
        label: 'Diproses',
        icon: 'clock'
      },
      'selesai': {
        class: 'bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/20',
        label: 'Selesai',
        icon: 'check-circle'
      },
      'ditolak': {
        class: 'bg-[#FF3B30]/15 text-[#FF3B30] border border-[#FF3B30]/20',
        label: 'Ditolak',
        icon: 'x-circle'
      }
    };

    const cfg = map[s] || map['diproses'];
    return `
      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.class}">
        <i data-lucide="${cfg.icon}" class="w-3 h-3"></i>
        <span>${cfg.label}</span>
      </span>
    `;
  }

  function getTipeBadge(tipe) {
    const t = (tipe || 'ke_supplier').toLowerCase();
    if (t === 'ke_supplier') {
      return `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FF9500]/15 text-[#FF9500] border border-[#FF9500]/20">
          <i data-lucide="undo-2" class="w-3 h-3"></i> Ke Supplier
        </span>
      `;
    }
    return `
      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#AF52DE]/15 text-[#AF52DE] border border-[#AF52DE]/20">
        <i data-lucide="redo-2" class="w-3 h-3"></i> Dari Customer
      </span>
    `;
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

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
      console.error('Toast container is missing');
      return;
    }

    const icons = {
      success: 'check',
      error: 'alert-circle',
      info: 'info',
      warning: 'alert-triangle'
    };
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const iconWrap = document.createElement('span');
    iconWrap.className = 'toast__icon';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', icons[type] || icons.info);
    icon.setAttribute('aria-hidden', 'true');
    iconWrap.appendChild(icon);

    const text = document.createElement('span');
    text.className = 'toast__message';
    text.textContent = message;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'toast__close';
    closeButton.setAttribute('aria-label', 'Tutup notifikasi');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => toast.remove());

    toast.append(iconWrap, text, closeButton);

    container.appendChild(toast);
    if (window.refreshIcons) window.refreshIcons();

    setTimeout(() => {
      toast.classList.add('toast--leaving');
      setTimeout(() => toast.remove(), 250);
    }, 5000);
  }

  async function loadData() {
    const tbody = document.getElementById('return-table-body');
    const emptyState = document.getElementById('return-empty-state');
    const refreshBtn = document.getElementById('btn-refresh-return');

    if (refreshBtn) refreshBtn.classList.add('opacity-50', 'pointer-events-none');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="py-12 text-center text-[#A0A0A5]">
            <div class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#0088CC] border-t-transparent mb-2"></div>
            <p class="text-xs">Memuat data retur...</p>
          </td>
        </tr>
      `;
    }

    try {
      const { startDate, endDate } = getDateFilterRange(currentPeriod);
      const searchTerm = currentSearch.trim().toLocaleLowerCase();
      const matchingProductIds = searchTerm
        ? availableProducts
          .filter((product) => `${product.name} ${product.sku || ''}`.toLocaleLowerCase().includes(searchTerm))
          .map((product) => product.id)
        : [];
      const resList = await returnApi.getAll({
          page: currentPage,
          limit: pageSize,
          tipe: currentTipe,
          status: currentStatus,
          search: currentSearch,
          productIds: matchingProductIds,
          startDate,
          endDate
        });

      returnEntries = resList.data || [];
      totalRecords = resList.meta?.total || returnEntries.length;
      totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

      const resSummary = await returnApi.getSummary(returnEntries);
      renderKPI(resSummary.data || {});
      renderTable(returnEntries);
      renderPagination();
    } catch (err) {
      console.error('Error loading return data:', err);
      showToast('Gagal memuat data retur', 'error');
    } finally {
      if (refreshBtn) refreshBtn.classList.remove('opacity-50', 'pointer-events-none');
    }
  }

  function renderKPI(summary) {
    const elSupplier = document.getElementById('kpi-retur-supplier');
    const elCustomer = document.getElementById('kpi-retur-customer');
    const elNilai = document.getElementById('kpi-nilai-retur');
    const elDiproses = document.getElementById('kpi-diproses');

    if (elSupplier) elSupplier.textContent = `${summary.returKeSupplier || 0} Unit`;
    if (elCustomer) elCustomer.textContent = `${summary.returDariCustomer || 0} Unit`;
    if (elNilai) elNilai.textContent = formatRupiah(summary.nilaiReturBulanIni || 0);
    if (elDiproses) elDiproses.textContent = `${summary.sedangDiproses || 0} Tiket`;
  }

  function renderTable(data) {
    const tbody = document.getElementById('return-table-body');
    const emptyState = document.getElementById('return-empty-state');
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = data.map((item) => {
      const namaBarang = getProductName(item);
      return `
        <tr class="table-row border-b border-white/5 hover:bg-white/[0.02] transition">
          <td class="px-4 py-3.5 font-mono text-xs font-semibold text-[#32ADE6]">
            ${item.no_retur || '-'}
          </td>
          <td class="px-4 py-3.5 text-xs text-[#A0A0A5] whitespace-nowrap">
            ${formatDate(item.tanggal)}
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            ${getTipeBadge(item.tipe)}
          </td>
          <td class="px-4 py-3.5 font-medium text-sm text-white">
            <div>${escapeHtml(namaBarang)}</div>
            ${item.keterangan && item.keterangan !== namaBarang ? `<div class="text-[11px] text-[#A0A0A5] truncate max-w-xs mt-0.5">${escapeHtml(item.keterangan)}</div>` : ''}
          </td>
          <td class="px-4 py-3.5 text-xs text-[#A0A0A5] max-w-xs truncate" title="${item.alasan || ''}">
            ${item.alasan || '-'}
          </td>
          <td class="px-4 py-3.5 text-right font-semibold text-white whitespace-nowrap">
            ${item.qty} unit
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            ${getStatusBadge(item.status)}
          </td>
          <td class="px-4 py-3.5 text-right whitespace-nowrap">
            <div class="flex items-center justify-end gap-1.5">
              ${item.status === 'diproses' ? `
                <button 
                  type="button" 
                  data-action="edit" 
                  class="btn-complete-return p-1.5 rounded-lg text-[#34C759] hover:bg-[#34C759]/15 transition" 
                  data-id="${item.id}"
                  title="Tandai Selesai"
                >
                  <i data-lucide="check" class="w-4 h-4"></i>
                </button>
              ` : ''}

              <button 
                type="button" 
                data-action="delete" 
                class="btn-delete-return p-1.5 rounded-lg text-[#A0A0A5] hover:text-[#FF3B30] hover:bg-[#FF3B30]/15 transition" 
                data-id="${item.id}"
                title="Hapus Catatan Retur"
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
    const elInfo = document.getElementById('return-pagination-info');
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    if (elInfo) {
      if (totalRecords === 0) {
        elInfo.textContent = 'Menampilkan 0 dari 0 retur';
      } else {
        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(currentPage * pageSize, totalRecords);
        elInfo.textContent = `Menampilkan ${start}-${end} dari ${totalRecords} retur`;
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

  async function handleCompleteReturn(id) {
    if (!confirm('Tandai retur ini sebagai selesai? Mutasi stok fisik barang akan otomatis diproses ke inventori.')) {
      return;
    }
    try {
      const res = await returnApi.update(id, { status: 'selesai' });
      if (res.ok) {
        showToast('Retur selesai dan mutasi stok berhasil diproses', 'success');
        await loadData();
      } else {
        showToast(res.error?.message || 'Gagal memperbarui status', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Terjadi kesalahan sistem', 'error');
    }
  }

  async function handleDeleteReturn(id) {
    const button = document.getElementById('btn-confirm-delete-return');
    const cancelButton = document.getElementById('btn-cancel-delete-return');
    const feedback = document.getElementById('delete-return-feedback');
    const originalButtonHtml = button?.innerHTML;
    deleteInProgress = true;
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.innerHTML = '<span>Menghapus...</span>';
    }
    if (cancelButton) cancelButton.disabled = true;
    if (feedback) {
      feedback.textContent = '';
      feedback.classList.add('hidden');
    }

    try {
      const res = await returnApi.delete(id);
      if (res.ok) {
        deleteInProgress = false;
        closeDeleteConfirmation();
        showToast('Catatan retur berhasil dihapus', 'success');
        await loadData();
      } else {
        const message = res.error?.message || 'Gagal menghapus data';
        if (feedback) {
          feedback.textContent = message;
          feedback.classList.remove('hidden');
        }
        showToast(message, 'error');
      }
    } catch (err) {
      console.error(err);
      const message = err.message || 'Terjadi kesalahan sistem saat menghapus catatan retur';
      if (feedback) {
        feedback.textContent = message;
        feedback.classList.remove('hidden');
      }
      showToast(message, 'error');
    } finally {
      deleteInProgress = false;
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.innerHTML = originalButtonHtml;
      }
      if (cancelButton) cancelButton.disabled = false;
      if (window.refreshIcons) window.refreshIcons();
    }
  }

  function openDeleteConfirmation(id, trigger) {
    const modal = document.getElementById('modal-delete-return');
    if (!modal) {
      showToast('Dialog konfirmasi hapus tidak tersedia', 'error');
      return;
    }

    pendingDeleteId = id;
    deleteTrigger = trigger;
    const feedback = document.getElementById('delete-return-feedback');
    if (feedback) {
      feedback.textContent = '';
      feedback.classList.add('hidden');
    }
    document.body.classList.add('modal-open');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('btn-cancel-delete-return')?.focus();
  }

  function closeDeleteConfirmation() {
    if (deleteInProgress) return;
    const modal = document.getElementById('modal-delete-return');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    document.body.classList.remove('modal-open');
    pendingDeleteId = null;
    deleteTrigger?.focus();
    deleteTrigger = null;
  }

  async function confirmDeleteReturn() {
    if (!pendingDeleteId) return;
    await handleDeleteReturn(pendingDeleteId);
  }

  function openModal(defaultTipe = 'ke_supplier') {
    const modal = document.getElementById('modal-return');
    const form = document.getElementById('form-return');
    if (!modal || !form) return;

    form.reset();

    const tipeSelect = document.getElementById('return-tipe');
    if (tipeSelect) tipeSelect.value = defaultTipe;

    const noInput = document.getElementById('return-no');
    if (noInput) noInput.value = returnApi.generateNoRetur(defaultTipe);

    const dateInput = document.getElementById('return-tanggal');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    const qtyInput = document.getElementById('return-qty');
    if (qtyInput) qtyInput.value = '1';

    const statusSelect = document.getElementById('return-status');
    if (statusSelect) statusSelect.value = 'diproses';

    loadProducts();
    document.body.classList.add('modal-open');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) window.lucide.createIcons();
  }

  function closeModal() {
    const modal = document.getElementById('modal-return');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('modal-open');
  }

  async function handleSubmitForm(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-submit-return');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Menyimpan...';
    }

    const no_retur = document.getElementById('return-no')?.value || '';
    const tipe = document.getElementById('return-tipe')?.value || 'ke_supplier';
    const tanggal = document.getElementById('return-tanggal')?.value || new Date().toISOString().slice(0, 10);
    const produk_id = document.getElementById('return-produk')?.value || '';
    const qty = Number(document.getElementById('return-qty')?.value || 1);
    const harga_satuan = Number(document.getElementById('return-harga')?.value || 0);
    const alasan = document.getElementById('return-alasan')?.value || '';
    const status = document.getElementById('return-status')?.value || 'diproses';
    const keterangan = document.getElementById('return-keterangan')?.value || '';

    if (!productsById.has(String(produk_id))) {
      showToast('Pilih barang dari master produk', 'warning');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan';
      }
      return;
    }

    if (!alasan.trim()) {
      showToast('Alasan retur wajib diisi', 'warning');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan';
      }
      return;
    }

    if (qty <= 0) {
      showToast('Jumlah retur minimal 1 unit', 'warning');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan';
      }
      return;
    }

    try {
      const res = await returnApi.create({
        no_retur,
        tanggal,
        tipe,
        produk_id,
        qty,
        harga_satuan,
        alasan,
        status,
        keterangan
      });

      if (res.ok) {
        showToast('Catatan retur berhasil ditambahkan', 'success');
        closeModal();
        await loadData();
      } else {
        showToast(res.error?.message || 'Gagal menyimpan retur', 'error');
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
    if (!returnEntries || returnEntries.length === 0) {
      showToast('Tidak ada data retur untuk diekspor', 'warning');
      return;
    }

    const headers = ['No Retur', 'Tanggal', 'Tipe', 'Barang', 'Alasan', 'Jumlah', 'Status', 'Keterangan'];
    const rows = returnEntries.map(r => [
      r.no_retur,
      r.tanggal || '',
      r.tipe,
      `"${getProductName(r).replace(/"/g, '""')}"`,
      `"${(r.alasan || '').replace(/"/g, '""')}"`,
      r.qty,
      r.status,
      `"${(r.keterangan || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `retur_barang_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Ekspor CSV berhasil diunduh', 'success');
  }

  function setupEvents() {
    // Search
    const searchInput = document.getElementById('return-search');
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

    // Filter Tipe
    const filterTipe = document.getElementById('return-filter-tipe');
    if (filterTipe) {
      filterTipe.addEventListener('change', (e) => {
        currentTipe = e.target.value;
        currentPage = 1;
        loadData();
      });
    }

    // Filter Status
    const filterStatus = document.getElementById('return-filter-status');
    if (filterStatus) {
      filterStatus.addEventListener('change', (e) => {
        currentStatus = e.target.value;
        currentPage = 1;
        loadData();
      });
    }

    // Filter Period
    const filterPeriod = document.getElementById('return-filter-period');
    if (filterPeriod) {
      filterPeriod.addEventListener('change', (e) => {
        currentPeriod = e.target.value;
        currentPage = 1;
        loadData();
      });
    }

    // Refresh
    const refreshBtn = document.getElementById('btn-refresh-return');
    if (refreshBtn) refreshBtn.addEventListener('click', loadData);

    // Export CSV
    const exportBtn = document.getElementById('btn-export-return');
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    // Open Modal
    const addBtn = document.getElementById('btn-open-return-modal');
    if (addBtn) addBtn.addEventListener('click', () => openModal('ke_supplier'));

    const addHeaderBtn = document.getElementById('btn-add-return-header');
    if (addHeaderBtn) addHeaderBtn.addEventListener('click', () => openModal('ke_supplier'));

    // Tipe change in modal generates new No Retur prefix & updates price estimate
    const tipeModalSelect = document.getElementById('return-tipe');
    if (tipeModalSelect) {
      tipeModalSelect.addEventListener('change', (e) => {
        const noInput = document.getElementById('return-no');
        if (noInput) noInput.value = returnApi.generateNoRetur(e.target.value);

        const prodSelect = document.getElementById('return-produk');
        const prod = prodSelect ? productsById.get(String(prodSelect.value)) : null;
        const priceInput = document.getElementById('return-harga');
        if (prod && priceInput) {
          priceInput.value = e.target.value === 'ke_supplier'
            ? (prod.costPrice || prod.cost_price || 0)
            : (prod.sellPrice || prod.sell_price || 0);
        }
      });
    }

    // Product change autofills price based on selected product and return type
    const returnProductSelect = document.getElementById('return-produk');
    if (returnProductSelect) {
      returnProductSelect.addEventListener('change', (e) => {
        const prod = productsById.get(String(e.target.value));
        const priceInput = document.getElementById('return-harga');
        const tipeVal = document.getElementById('return-tipe')?.value || 'ke_supplier';
        if (prod && priceInput) {
          priceInput.value = tipeVal === 'ke_supplier'
            ? (prod.costPrice || prod.cost_price || 0)
            : (prod.sellPrice || prod.sell_price || 0);
        }
      });
    }

    // Close Modal
    const closeModalBtn = document.getElementById('btn-close-return-modal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

    const cancelModalBtn = document.getElementById('btn-cancel-return-modal');
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    const modalBackdrop = document.getElementById('modal-return');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
      });
    }

    // Submit Form
    const form = document.getElementById('form-return');
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
      const completeBtn = e.target.closest('.btn-complete-return');
      if (completeBtn) {
        const id = completeBtn.getAttribute('data-id');
        if (id) handleCompleteReturn(id);
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-return');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        if (id) openDeleteConfirmation(id, deleteBtn);
        return;
      }
    });

    const deleteModal = document.getElementById('modal-delete-return');
    const cancelDeleteBtn = document.getElementById('btn-cancel-delete-return');
    const confirmDeleteBtn = document.getElementById('btn-confirm-delete-return');
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteConfirmation);
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDeleteReturn);
    if (deleteModal) {
      deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteConfirmation();
      });
      deleteModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDeleteConfirmation();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      userRole = await getUserRole();
    } catch (_) {}

    setupEvents();
    await loadProducts();
    await loadData();
  });

})();
