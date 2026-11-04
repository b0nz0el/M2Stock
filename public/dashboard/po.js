/* ═══════════════════════════════════════════════════
   Aquastock Pro — po.js
   Controller Modul Purchase Order & PO Items
   ═══════════════════════════════════════════════════ */

import { po as poApi } from '../assets/js/api/po.js';
import { suppliers as suppliersApi } from '../assets/js/api/suppliers.js';
import { items as itemsApi } from '../assets/js/api/items.js';
import { settings as settingsApi } from '../assets/js/api/settings.js';
import { applyReadOnlyUI } from '../assets/js/utils/rbac-ui.js';
import { getUserRole } from '../assets/js/utils/rbac.js';

(function () {
  'use strict';

  let currentPage = 1;
  const pageSize = 15;
  const RESTOCK_ASSISTANT_LABEL = 'Restock otomatis dari daftar stok menipis (Restock Assistant)';
  let currentStatus = 'all'; // 'all' | 'draft' | 'dikirim' | 'diterima' | 'dibatalkan'
  let currentSearch = '';
  let totalRecords = 0;
  let totalPages = 1;
  let poEntries = [];
  let userRole = 'STAFF';
  let pendingDeleteId = null;
  let deleteTrigger = null;
  let deleteInProgress = false;
  let isGeneratingAutoPo = false;
  let eventsSetup = false;
  let availableSuppliers = [];
  let availableProducts = [];

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

  function formatPoNote(note) {
    if (!note) return '';
    if (note.includes('Restock otomatis') || note.includes('Restock Assistant')) {
      return 'Restock Otomatis';
    }
    return note;
  }

  function isAutomaticRestockPO(item) {
    const supplierName = item.supplier_nama || item.suppliers?.name || '';
    const supplierNameLower = supplierName.toLowerCase();
    const hasLinkedSupplier = item.supplier_id != null || item.suppliers?.id != null;
    const isAutoRestock = /restock (otomatis|assistant|stok kritis)/i.test(
      `${item.catatan || ''} ${supplierName}`
    ) || /supplier restock/i.test(supplierName);
    const isGenericRestockName = [
      'restock stok kritis',
      'supplier restock',
      'restock otomatis',
      'restock assistant'
    ].includes(supplierNameLower);

    return isAutoRestock && (!supplierName || (!hasLinkedSupplier && isGenericRestockName));
  }

  function resolvePoSupplierName(item) {
    if (isAutomaticRestockPO(item)) return RESTOCK_ASSISTANT_LABEL;
    const supplierName = item.supplier_nama || item.suppliers?.name || '';
    return supplierName || item.catatan?.replace('Supplier: ', '') || 'Supplier Mitra';
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
    const tbody = document.getElementById('po-table-body');
    const emptyState = document.getElementById('po-empty-state');

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
      const supplierName = resolvePoSupplierName(item);
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
            ${item.catatan && !item.catatan.startsWith('Supplier:') ? `<div class="text-[11px] text-[#A0A0A5] truncate max-w-xs mt-0.5">${formatPoNote(item.catatan)}</div>` : ''}
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
                data-action="print" 
                class="btn-print-po p-1.5 rounded-lg text-[#A0A0A5] hover:text-[#32ADE6] hover:bg-[#32ADE6]/15 transition" 
                data-id="${item.id}"
                title="Cetak Surat Pesanan PO"
              >
                <i data-lucide="printer" class="w-4 h-4"></i>
              </button>

              <button 
                type="button" 
                data-action="share-wa" 
                class="btn-wa-po p-1.5 rounded-lg text-[#A0A0A5] hover:text-[#25D366] hover:bg-[#25D366]/15 transition" 
                data-id="${item.id}"
                title="Kirim via WhatsApp"
              >
                <i data-lucide="share-2" class="w-4 h-4"></i>
              </button>

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

    if (typeof window.syncTableLabels === 'function') {
      window.syncTableLabels();
    }

    applyReadOnlyUI();
  }

  function renderPagination() {
    const elInfo = document.getElementById('po-pagination-info');
    const btnPrev = document.querySelector('#page-po #btn-prev-page') || document.getElementById('btn-prev-page');
    const btnNext = document.querySelector('#page-po #btn-next-page') || document.getElementById('btn-next-page');

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

  async function handleUpdateStatus(id, newStatus, successMsg, paymentMethod = 'Cash') {
    try {
      const res = await poApi.updateStatus(id, newStatus, paymentMethod);
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

  function openDeleteConfirmation(id, trigger) {
    const modal = document.getElementById('modal-delete-po');
    if (!modal) {
      showToast('Dialog konfirmasi hapus tidak tersedia', 'error');
      return;
    }

    pendingDeleteId = id;
    deleteTrigger = trigger;
    const feedback = document.getElementById('delete-po-feedback');
    if (feedback) {
      feedback.textContent = '';
      feedback.classList.add('hidden');
    }
    document.body.classList.add('modal-open');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('btn-cancel-delete-po')?.focus();
  }

  function closeDeleteConfirmation() {
    if (deleteInProgress) return;
    const modal = document.getElementById('modal-delete-po');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }

    document.body.classList.remove('modal-open');
    pendingDeleteId = null;
    deleteTrigger?.focus();
    deleteTrigger = null;
  }

  async function handleDelete(id) {
    const button = document.getElementById('btn-confirm-delete-po');
    const cancelButton = document.getElementById('btn-cancel-delete-po');
    const feedback = document.getElementById('delete-po-feedback');
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
      const res = await poApi.delete(id);
      if (res.ok) {
        deleteInProgress = false;
        closeDeleteConfirmation();
        showToast('Purchase Order berhasil dihapus', 'success');
        await loadData();
      } else {
        const message = res.error?.message || 'Gagal menghapus PO';
        if (feedback) {
          feedback.textContent = message;
          feedback.classList.remove('hidden');
        }
        showToast(message, 'error');
      }
    } catch (err) {
      console.error(err);
      const message = err.message || 'Terjadi kesalahan sistem saat menghapus Purchase Order';
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

  let activePrintPO = null;
  let activeStoreInfo = null;

  function resolveItemProductName(it) {
    if (!it) return 'Produk';
    if (it.product_name && String(it.product_name).trim() !== '') return String(it.product_name).trim();
    if (it.products?.name && String(it.products.name).trim() !== '') return String(it.products.name).trim();
    const pid = String(it.product_id || '');
    if (pid && Array.isArray(availableProducts) && availableProducts.length > 0) {
      const found = availableProducts.find(p => String(p.id) === pid);
      if (found && found.name) return found.name;
    }
    return it.product_id ? ('Produk #' + it.product_id) : 'Produk';
  }

  async function openPrintPOModal(poId) {
    const item = poEntries.find(p => String(p.id) === String(poId));
    if (!item) {
      showToast('Data Purchase Order tidak ditemukan', 'error');
      return;
    }
    activePrintPO = item;

    if (!availableProducts || availableProducts.length === 0) {
      await loadMasterData();
    }

    const noPO = item.no_po || '-';
    const tanggalPO = formatDate(item.tanggal);
    const supplierName = resolvePoSupplierName(item);
    const status = (item.status || 'draft').toUpperCase();
    const notes = formatPoNote(item.catatan) || 'Mohon konfirmasi ketersediaan stok sebelum pengiriman barang.';
    const total = formatRupiah(item.total || 0);

    const docNo = document.getElementById('doc-po-no');
    const docSupplier = document.getElementById('doc-po-supplier');
    const docSupplierSubtitle = document.getElementById('doc-po-supplier-subtitle');
    const docSupplierNotes = document.getElementById('doc-po-supplier-notes');
    const docDate = document.getElementById('doc-po-date');
    const docStatus = document.getElementById('doc-po-status');
    const docNotes = document.getElementById('doc-po-notes');
    const docTotal = document.getElementById('doc-po-total');
    const tbody = document.getElementById('doc-po-items-tbody');

    if (docNo) docNo.textContent = noPO;
    if (docSupplier) {
      docSupplier.textContent = isAutomaticRestockPO(item)
        ? 'Restock otomatis dari daftar stok menipis'
        : supplierName;
    }
    if (docSupplierSubtitle) {
      docSupplierSubtitle.textContent = '(Restock Assistant)';
      docSupplierSubtitle.classList.toggle('hidden', !isAutomaticRestockPO(item));
    }
    if (docSupplierNotes) docSupplierNotes.textContent = item.supplier_kontak || item.suppliers?.phone || 'Pemasok Terdaftar';
    if (docDate) docDate.textContent = tanggalPO;
    if (docStatus) docStatus.textContent = status;
    if (docNotes) docNotes.textContent = notes;
    if (docTotal) docTotal.textContent = total;

    // Sinkronkan data profil toko dinamis ke dokumen PO
    try {
      let storeInfo = null;
      if (settingsApi && typeof settingsApi.getStoreInfo === 'function') {
        storeInfo = await settingsApi.getStoreInfo();
      } else if (typeof window !== 'undefined' && window.Api?.settings?.getStoreInfo) {
        storeInfo = await window.Api.settings.getStoreInfo();
      }
      if (!storeInfo && typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem('aquastock_store_info');
        if (cached) {
          try { storeInfo = JSON.parse(cached); } catch (_) {}
        }
      }
      if (storeInfo) {
        activeStoreInfo = storeInfo;
        const docStoreName = document.getElementById('doc-po-store-name');
        const docStoreSlogan = document.getElementById('doc-po-store-slogan');
        const docStoreAddress = document.getElementById('doc-po-store-address');
        const docStoreContact = document.getElementById('doc-po-store-contact');
        if (docStoreName && storeInfo.name) docStoreName.textContent = storeInfo.name;
        if (docStoreSlogan && storeInfo.slogan) docStoreSlogan.textContent = storeInfo.slogan;
        if (docStoreAddress && storeInfo.address) docStoreAddress.textContent = storeInfo.address;
        if (docStoreContact) {
          const parts = [];
          if (storeInfo.phone) parts.push(`WA: ${storeInfo.phone}`);
          if (storeInfo.email) parts.push(`Email: ${storeInfo.email}`);
          docStoreContact.textContent = parts.join(' | ') || '-';
        }
        const docStoreSign = document.getElementById('doc-po-sign-name');
        if (docStoreSign && storeInfo.name) docStoreSign.textContent = storeInfo.name;
        const docStoreLogo = document.querySelector('.po-document-logo');
        if (docStoreLogo && storeInfo.logo_url) {
          docStoreLogo.src = storeInfo.logo_url;
        }
      }
    } catch (_) {}

    const items = item.items || item.purchase_order_items || [];
    if (tbody) {
      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-500">Rincian produk tidak tersedia</td></tr>`;
      } else {
        tbody.innerHTML = items.map((it, idx) => {
          const pName = resolveItemProductName(it);
          const qty = it.qty || 1;
          const harga = it.harga || it.unit_price || 0;
          const subtotal = qty * harga;
          return `
            <tr class="border-b border-gray-100">
              <td class="py-2 px-2 text-center text-gray-600">${idx + 1}</td>
              <td class="py-2 px-2 font-medium text-black">${pName}</td>
              <td class="py-2 px-2 text-center font-bold text-black">${qty} unit</td>
              <td class="py-2 px-2 text-right text-gray-700">${formatRupiah(harga)}</td>
              <td class="py-2 px-2 text-right font-semibold text-black">${formatRupiah(subtotal)}</td>
            </tr>
          `;
        }).join('');
      }
    }

    const modal = document.getElementById('modal-print-po');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function closePrintPOModal() {
    activePrintPO = null;
    const modal = document.getElementById('modal-print-po');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function generatePOWhatsAppText(item, overrideStoreInfo = null) {
    if (!item) return '';
    const supplierName = resolvePoSupplierName(item);
    const noPO = item.no_po || '-';
    const tanggalPO = formatDate(item.tanggal);
    const total = formatRupiah(item.total || 0);
    const items = item.items || item.purchase_order_items || [];

    let storeName = 'JTMaquarium';
    let storeSlogan = 'Perlengkapan Aksesoris Aquarium';
    const info = overrideStoreInfo || activeStoreInfo;
    if (info && info.name) {
      storeName = info.name;
      if (info.slogan) storeSlogan = info.slogan;
    } else {
      try {
        const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('aquastock_store_info') : null;
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.name) storeName = parsed.name;
          if (parsed.slogan) storeSlogan = parsed.slogan;
        }
      } catch (_) {}
    }

    let text = `*SURAT PESANAN PEMBELIAN BARANG (PURCHASE ORDER)*\n`;
    text += `*Toko ${storeName} - ${storeSlogan}*\n`;
    text += `-----------------------------------------------\n`;
    text += `*No. PO:* ${noPO}\n`;
    text += `*Tanggal:* ${tanggalPO}\n`;
    text += `*Kepada:* ${supplierName}\n`;
    text += `*Status:* ${(item.status || 'draft').toUpperCase()}\n\n`;
    text += `*Rincian Pesanan:*\n`;

    if (items.length === 0) {
      text += `- (Pesanan inventori standar)\n`;
    } else {
      items.forEach((it, idx) => {
        const pName = resolveItemProductName(it);
        const qty = it.qty || 1;
        const harga = it.harga || it.unit_price || 0;
        const subtotal = qty * harga;
        text += `${idx + 1}. ${pName} (${qty} unit) @ ${formatRupiah(harga)} = ${formatRupiah(subtotal)}\n`;
      });
    }

    text += `\n*TOTAL NILAI PO:* ${total}\n`;
    if (item.catatan) {
      text += `*Catatan:* ${formatPoNote(item.catatan)}\n`;
    }
    text += `-----------------------------------------------\n`;
    text += `Mohon konfirmasi ketersediaan barang. Terima kasih! 🙏`;

    return text;
  }

  async function sharePOWhatsApp(poId) {
    const item = poEntries.find(p => String(p.id) === String(poId));
    if (!item) {
      showToast('Data PO tidak ditemukan', 'error');
      return;
    }
    if (!availableProducts || availableProducts.length === 0) {
      await loadMasterData();
    }
    if (!activeStoreInfo) {
      try {
        if (settingsApi && typeof settingsApi.getStoreInfo === 'function') {
          activeStoreInfo = await settingsApi.getStoreInfo();
        }
      } catch (_) {}
    }
    const msg = generatePOWhatsAppText(item, activeStoreInfo);
    const encoded = encodeURIComponent(msg);
    const supObj = availableSuppliers.find(s => String(s.id) === String(item.supplier_id)) || item.suppliers;
    const phone = supObj?.phone ? supObj.phone.replace(/[^0-9]/g, '') : '';
    const targetUrl = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(targetUrl, '_blank');
  }

  function printPODocument() {
    const paper = document.getElementById('po-document-paper');
    if (!paper) {
      showToast('Dokumen PO tidak siap untuk dicetak', 'error');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Izinkan pop-up untuk mencetak atau menyimpan PDF PO', 'error');
      return;
    }

    const itemCount = paper.querySelectorAll('tbody tr').length;
    const printDensity = itemCount > 35 ? 'po-print-dense' : itemCount > 25 ? 'po-print-compact' : '';
    const printDocument = printWindow.document;
    printDocument.open();
    printDocument.write(`<!doctype html>
      <html lang="id">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Purchase Order</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            *, *::before, *::after { box-sizing: border-box; }
            html, body { width: 100%; min-height: 0; margin: 0; background: #fff; }
            h2, p { margin: 0; }
            .hidden { display: none !important; }
            body { color: #172033; font: 9pt/1.3 Arial, Helvetica, sans-serif; }
            .po-print-sheet { width: 190mm; max-width: 100%; margin: 0 auto; padding: 0; background: #fff; }
            #po-document-paper { width: 100%; max-width: 100%; margin: 0; padding: 0; background: #fff; color: #172033; font: 9pt/1.3 Arial, Helvetica, sans-serif; }
            .po-document-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8mm; padding: 0 0 5mm; margin: 0 0 5mm; border-bottom: 1.2pt solid #174c89; }
            .po-document-brand { display: flex; align-items: flex-start; gap: 5mm; min-width: 0; }
            .po-document-logo { display: block; width: 36mm; height: auto; object-fit: contain; }
            .po-document-identity { min-width: 0; }
            .po-document-issuer-label, .po-document-field-label { color: #174c89; font-size: 7pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
            .po-document-issuer-label { margin: 0 0 1mm; }
            .po-document-store-name { margin: 0; color: #172033; font-size: 13pt; font-weight: 700; }
            .po-document-store-slogan, .po-document-contact { margin: 1mm 0 0; color: #475467; font-size: 8pt; line-height: 1.25; overflow-wrap: anywhere; }
            .po-document-number { flex: 0 0 auto; min-width: 43mm; text-align: right; }
            .po-document-badge { display: inline-block; padding: 2mm 3mm; border-radius: 1mm; background: #174c89; color: #fff; font-size: 8pt; font-weight: 700; letter-spacing: .1em; }
            .po-document-number-label { margin: 2mm 0 .5mm; color: #667085; font-size: 7pt; letter-spacing: .08em; text-transform: uppercase; }
            .po-document-no { margin: 0; color: #172033; font: 700 10pt/1.2 Arial, Helvetica, sans-serif; overflow-wrap: anywhere; }
            .po-document-info { display: grid; grid-template-columns: 1.1fr .9fr; gap: 8mm; padding: 0 0 4mm; margin: 0 0 4mm; border-bottom: .6pt solid #d0d5dd; }
            .po-document-supplier-name { margin: 1mm 0 0; color: #172033; font-size: 10pt; font-weight: 700; }
            .po-document-supplier-subtitle { margin: .5mm 0 0; color: #475467; font-size: 8pt; font-weight: 600; }
            .po-document-supplier-contact { margin: 0; color: #475467; font-size: 8pt; }
            .po-document-order-meta { text-align: right; }
            .po-document-order-meta > div + div { margin-top: 1.5mm; }
            .po-document-meta-label { color: #667085; font-size: 8pt; }
            .po-document-meta-value, .po-document-status { color: #172033; font-size: 8pt; font-weight: 600; }
            .po-document-status { color: #174c89; font-weight: 700; text-transform: uppercase; }
            .po-document-table { width: 100%; margin: 0 0 4mm; border-collapse: collapse; table-layout: fixed; }
            .po-document-table th, .po-document-table td { padding: 1.35mm 1.5mm; border-bottom: .5pt solid #d0d5dd; color: #172033; font-size: 8pt; line-height: 1.2; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
            .po-document-table th { background: #eaf1f8; color: #173b63; font-weight: 700; }
            .po-print-compact .po-document-table th, .po-print-compact .po-document-table td { padding: .65mm 1.2mm; font-size: 7.5pt; line-height: 1.15; }
            .po-print-dense .po-document-table th, .po-print-dense .po-document-table td { padding: .35mm 1mm; font-size: 7pt; line-height: 1.05; }
            .po-document-table th:first-child, .po-document-table td:first-child { width: 8%; text-align: center; }
            .po-document-table th:nth-child(2), .po-document-table td:nth-child(2) { width: 40%; }
            .po-document-table th:nth-child(3), .po-document-table td:nth-child(3) { width: 13%; text-align: center; }
            .po-document-table th:nth-child(4), .po-document-table td:nth-child(4) { width: 19%; text-align: right; }
            .po-document-table th:nth-child(5), .po-document-table td:nth-child(5) { width: 20%; text-align: right; }
            .po-document-table tbody tr, .po-document-table thead { break-inside: avoid; page-break-inside: avoid; }
            .po-document-total-row td { border-top: 1pt solid #174c89; border-bottom: 0; background: #f3f7fb; font-weight: 700; }
            .po-document-total-row td:first-child { text-align: right; }
            .po-document-table .po-document-total-row td:last-child { text-align: right; }
            .po-document-total { color: #173b63 !important; }
            .po-document-notes { margin: 0 0 5mm; padding: 2.5mm 3mm; border-left: 1.2pt solid #174c89; background: #f7f9fc; color: #475467; font-size: 8pt; }
            .po-document-notes-label { color: #173b63; font-weight: 700; }
            .po-document-notes p { margin: 1mm 0 0; }
            .po-signatures-grid { display: flex; align-items: flex-start; justify-content: space-between; gap: 5mm; width: 100%; padding-top: 2mm; break-inside: auto; page-break-inside: auto; }
            .po-signatures-grid > div { flex: 1 1 0; min-width: 0; color: #344054; font-size: 7.5pt; text-align: center; }
            .po-signatures-grid p { margin: 0 0 9mm; }
            .po-signatures-grid p:last-child { margin: 0; padding-top: 1.5mm; border-top: .6pt solid #98a2b3; color: #172033; font-weight: 700; }
            @media screen {
              body { padding: 12mm; background: #f2f4f7; }
              .po-print-sheet { min-height: 277mm; padding: 10mm; box-shadow: 0 2mm 8mm rgba(16, 24, 40, .15); }
            }
            @media print {
              html, body { width: auto; height: auto; overflow: visible; }
              body { padding: 0; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              .po-print-sheet { width: 190mm; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
            }
          </style>
        </head>
        <body><main class="po-print-sheet ${printDensity}" data-item-count="${itemCount}">${paper.outerHTML}</main></body>
      </html>`);
    printDocument.close();

    const openPrintDialog = async () => {
      try {
        await printDocument.fonts.ready;
        await Promise.all(Array.from(printDocument.images, image => {
          if (image.complete) return Promise.resolve();
          return new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
          });
        }));
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        console.error('Gagal menyiapkan cetak PO:', error);
        showToast('Gagal menyiapkan dokumen cetak PO', 'error');
      }
    };

    if (printDocument.readyState === 'complete') {
      openPrintDialog();
    } else {
      printWindow.addEventListener('load', openPrintDialog, { once: true });
    }
  }

  // Master Data Loader & Select Populator
  async function loadMasterData() {
    try {
      const [supRes, prodRes] = await Promise.all([
        suppliersApi.getAll({ status: 'active' }).catch(() => ({ ok: false, data: [] })),
        itemsApi.getAll().catch(() => ({ ok: false, data: [] }))
      ]);

      if (supRes.ok && Array.isArray(supRes.data)) {
        availableSuppliers = supRes.data;
      }
      if (prodRes.ok && Array.isArray(prodRes.data)) {
        availableProducts = prodRes.data;
      }
    } catch (err) {
      console.warn('Gagal memuat master data supplier/produk untuk PO:', err);
    }
  }

  function populateSupplierSelect(selectedId = '') {
    const select = document.getElementById('po-supplier');
    if (!select) return;
    if (availableSuppliers.length === 0) {
      select.innerHTML = '<option value="">-- Belum Ada Supplier Aktif --</option>';
      return;
    }
    select.innerHTML = '<option value="">-- Pilih Supplier --</option>' +
      availableSuppliers.map(s => {
        const isSel = s.id === selectedId;
        return `<option value="${s.id}" data-name="${s.name}" ${isSel ? 'selected' : ''}>${s.name}</option>`;
      }).join('');
  }

  // Global floating dropdown element for PO item combobox (Standar UI Internasional)
  let activeComboboxRow = null;
  let poDropdownEl = null;

  function getPoDropdown() {
    if (!poDropdownEl) {
      poDropdownEl = document.createElement('div');
      poDropdownEl.id = 'po-floating-search-dropdown';
      poDropdownEl.className = 'fixed z-[9999] hidden bg-[#18181B]/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl text-xs overflow-hidden';
      document.body.appendChild(poDropdownEl);

      // Tutup jika klik di luar
      document.addEventListener('pointerdown', (e) => {
        if (!poDropdownEl || poDropdownEl.classList.contains('hidden')) return;
        if (poDropdownEl.contains(e.target)) return;
        if (activeComboboxRow && activeComboboxRow.contains(e.target)) return;
        closePoDropdown();
      });

      // Update posisi saat scroll modal atau window resize
      const modalEl = document.getElementById('modal-po');
      const itemsContainer = document.getElementById('po-items-container');
      const handleScroll = () => {
        if (activeComboboxRow && !poDropdownEl.classList.contains('hidden')) {
          repositionPoDropdown();
        }
      };
      if (modalEl) modalEl.addEventListener('scroll', handleScroll, { passive: true });
      if (itemsContainer) itemsContainer.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleScroll, { passive: true });
    }
    return poDropdownEl;
  }

  function repositionPoDropdown() {
    if (!activeComboboxRow || !poDropdownEl) return;
    const anchorEl = activeComboboxRow.querySelector('.po-search-state') || activeComboboxRow.querySelector('.item-search-input');
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      closePoDropdown();
      return;
    }

    const popoverWidth = Math.min(480, window.innerWidth - 32);
    const spaceBelow = window.innerHeight - rect.bottom;
    const popoverHeight = 360;

    if (spaceBelow < 280 && rect.top > 300) {
      poDropdownEl.style.top = `${Math.max(16, rect.top - popoverHeight - 6)}px`;
    } else {
      poDropdownEl.style.top = `${rect.bottom + 6}px`;
    }

    let leftPos = rect.left;
    if (leftPos + popoverWidth > window.innerWidth - 16) {
      leftPos = window.innerWidth - popoverWidth - 16;
    }
    if (leftPos < 16) leftPos = 16;

    poDropdownEl.style.left = `${leftPos}px`;
    poDropdownEl.style.width = `${popoverWidth}px`;
  }

  function closePoDropdown() {
    if (poDropdownEl) {
      poDropdownEl.classList.add('hidden');
      poDropdownEl.innerHTML = '';
    }
    activeComboboxRow = null;
  }

  function selectProductInRow(row, prod) {
    const searchWrap = row.querySelector('.po-search-state');
    const selectedWrap = row.querySelector('.po-selected-state');
    const searchInput = row.querySelector('.item-search-input');
    const selectEl = row.querySelector('.item-select');
    const hargaInput = row.querySelector('.item-harga');
    const qtyInput = row.querySelector('.item-qty');

    if (!prod) {
      if (searchWrap) searchWrap.classList.remove('hidden');
      if (selectedWrap) selectedWrap.classList.add('hidden');
      if (searchInput) searchInput.value = '';
      if (selectEl) {
        selectEl.value = '';
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (row._updateRowSubtotal) row._updateRowSubtotal();
      return;
    }

    if (searchWrap) searchWrap.classList.add('hidden');
    if (selectedWrap) {
      selectedWrap.classList.remove('hidden');
      const nameEl = selectedWrap.querySelector('.selected-item-name');
      if (nameEl) nameEl.textContent = prod.name;
      const skuEl = selectedWrap.querySelector('.selected-item-sku');
      if (skuEl) {
        skuEl.textContent = prod.sku || '-';
        skuEl.classList.toggle('hidden', !prod.sku);
      }
      const stockEl = selectedWrap.querySelector('.selected-item-stock');
      if (stockEl) {
        const s = Number(prod.stock) || 0;
        stockEl.textContent = `Sisa Stok: ${s}`;
      }
    }

    if (selectEl) {
      let opt = Array.from(selectEl.options).find(o => String(o.value) === String(prod.id));
      const cost = prod.costPrice || prod.cost_price || 0;
      if (!opt) {
        opt = document.createElement('option');
        opt.value = prod.id;
        opt.dataset.name = prod.name;
        opt.dataset.price = cost;
        opt.textContent = `${prod.name} (Stok: ${prod.stock || 0})`;
        selectEl.appendChild(opt);
      }
      selectEl.value = prod.id;
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const cost = prod.costPrice || prod.cost_price || 0;
    if (hargaInput && (!hargaInput.value || Number(hargaInput.value) === 0)) {
      hargaInput.value = cost;
    }

    if (row._updateRowSubtotal) {
      row._updateRowSubtotal();
    }

    if (qtyInput) {
      qtyInput.focus();
      qtyInput.select();
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: row });
    }
  }

  function openPoDropdown(row, query = '') {
    activeComboboxRow = row;
    const dropdown = getPoDropdown();
    const selectEl = row.querySelector('.item-select');

    repositionPoDropdown();

    let filtered = [];
    if (!query) {
      filtered = availableProducts.slice(0, 35);
    } else {
      const scored = [];
      for (const p of availableProducts) {
        const targetText = [p.name, p.sku, p.barcode, p.brand, p.category].filter(Boolean).join(' ');
        const score = typeof fuzzyScore === 'function'
          ? fuzzyScore(query, targetText)
          : (targetText.toLowerCase().includes(query.toLowerCase()) ? 1000 : 0);
        if (score > 0) {
          scored.push({ product: p, score });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      filtered = scored.slice(0, 35).map(s => s.product);
    }

    const headerHtml = `
      <div class="px-3.5 py-2.5 bg-black/40 border-b border-white/5 flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider">
          <i data-lucide="sparkles" class="w-3.5 h-3.5 text-[#0088CC]"></i>
          <span>Katalog Master Barang</span>
        </div>
        <span class="text-[10px] font-semibold text-[#0088CC] bg-[#0088CC]/10 px-2.5 py-0.5 rounded-full border border-[#0088CC]/20">
          ${filtered.length} barang ${query ? 'cocok' : 'tersedia'}
        </span>
      </div>
    `;

    const footerHtml = `
      <div class="px-3.5 py-2 bg-black/50 border-t border-white/5 flex items-center justify-between text-[10px] text-[#A0A0A5] rounded-b-2xl">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1"><kbd class="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[9px] border border-white/10">↑↓</kbd> Navigasi</span>
          <span class="flex items-center gap-1"><kbd class="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[9px] border border-white/10">↵</kbd> Pilih</span>
          <span class="flex items-center gap-1"><kbd class="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[9px] border border-white/10">Esc</kbd> Tutup</span>
        </div>
        <span class="text-[#A0A0A5]/60 font-medium">Aquastock Engine</span>
      </div>
    `;

    if (filtered.length === 0) {
      dropdown.innerHTML = `
        ${headerHtml}
        <div class="p-6 text-center text-[#A0A0A5]">
          <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center mx-auto mb-2 text-[#A0A0A5]">
            <i data-lucide="search-x" class="w-5 h-5"></i>
          </div>
          <p class="font-semibold text-white text-xs">Tidak ada barang yang cocok</p>
          <p class="text-[11px] text-[#A0A0A5]/70 mt-1">Coba gunakan kata kunci nama, SKU, atau merk yang berbeda</p>
        </div>
        ${footerHtml}
      `;
      dropdown.classList.remove('hidden');
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: dropdown });
      }
      return;
    }

    const itemsHtml = filtered.map((p, idx) => {
      const cost = p.costPrice || p.cost_price || 0;
      const stock = Number(p.stock) || 0;
      const isSelected = String(p.id) === String(selectEl?.value);
      const stockBadge = stock <= 0
        ? '<span class="inline-flex items-center gap-1 text-[#FF3B30] font-semibold text-[10px] bg-[#FF3B30]/15 border border-[#FF3B30]/20 px-2 py-0.5 rounded-full"><span class="w-1.5 h-1.5 rounded-full bg-[#FF3B30]"></span> Habis</span>'
        : (stock <= 5
          ? `<span class="inline-flex items-center gap-1 text-[#FF9500] font-semibold text-[10px] bg-[#FF9500]/15 border border-[#FF9500]/20 px-2 py-0.5 rounded-full"><span class="w-1.5 h-1.5 rounded-full bg-[#FF9500]"></span> ${stock} unit</span>`
          : `<span class="inline-flex items-center gap-1 text-[#34C759] font-medium text-[10px] bg-[#34C759]/15 border border-[#34C759]/20 px-2 py-0.5 rounded-full"><span class="w-1.5 h-1.5 rounded-full bg-[#34C759]"></span> ${stock} unit</span>`);

      return `
        <div class="po-dropdown-item group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.08] active:scale-[0.99] ${idx === 0 ? 'is-highlighted' : ''} ${isSelected ? 'bg-[#0088CC]/15 border border-[#0088CC]/40' : 'border border-transparent'}"
             data-id="${escapeHtml(String(p.id))}"
             data-index="${idx}">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 text-[#0088CC] group-hover:bg-[#0088CC]/20 group-hover:border-[#0088CC]/40 transition">
              <i data-lucide="package" class="w-4 h-4"></i>
            </div>
            <div class="min-w-0 flex-1 pr-2">
              <div class="text-xs font-semibold text-white truncate group-hover:text-[#32ADE6] transition">
                ${escapeHtml(p.name)}
              </div>
              <div class="flex items-center gap-2 mt-1 text-[11px] text-[#A0A0A5] flex-wrap">
                ${p.sku ? `<span class="font-mono bg-white/5 px-1.5 py-0.5 rounded text-[10px] text-gray-300 border border-white/5">${escapeHtml(p.sku)}</span>` : ''}
                ${p.brand ? `<span>${escapeHtml(p.brand)}</span> • ` : ''}
                <span>Modal: <b class="text-white font-medium">${formatRupiah(cost)}</b></span>
              </div>
            </div>
          </div>
          <div class="shrink-0 text-right">
            ${stockBadge}
          </div>
        </div>
      `;
    }).join('');

    dropdown.innerHTML = `
      ${headerHtml}
      <div class="max-h-72 overflow-y-auto p-1.5 space-y-1">
        ${itemsHtml}
      </div>
      ${footerHtml}
    `;

    dropdown.querySelectorAll('.po-dropdown-item').forEach(itemEl => {
      itemEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const prodId = itemEl.getAttribute('data-id');
        const prod = availableProducts.find(p => String(p.id) === String(prodId));
        if (prod) {
          selectProductInRow(row, prod);
        }
        closePoDropdown();
      });
    });

    dropdown.classList.remove('hidden');
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: dropdown });
    }
  }

  // Dynamic Item Rows in Modal dengan Search Engine Dual-State (International Standard)
  function createItemRow(selectedProductId = '', qty = 1, harga = 0) {
    const row = document.createElement('div');
    row.className = 'po-item-row items-center bg-black/30 p-2.5 rounded-xl border border-white/5';

    const productOptions = availableProducts.map(p => {
      const cost = p.costPrice || p.cost_price || 0;
      const isSel = p.id === selectedProductId;
      return `<option value="${p.id}" data-price="${cost}" data-name="${p.name}" ${isSel ? 'selected' : ''}>${p.name} (Stok: ${p.stock})</option>`;
    }).join('');

    row.innerHTML = `
      <div class="po-item-name relative">
        <!-- State 1: Search Input (saat belum memilih barang) -->
        <div class="po-search-state relative flex items-center">
          <i data-lucide="search" class="w-3.5 h-3.5 text-[#A0A0A5] absolute left-3 pointer-events-none"></i>
          <input type="text"
                 class="item-search-input w-full bg-black/60 border border-white/15 hover:border-white/25 focus:border-[#0088CC] rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder:text-[#A0A0A5]/60 focus:outline-none focus:ring-2 focus:ring-[#0088CC]/20 transition-all shadow-inner"
                 placeholder="Cari nama, SKU, atau barcode..."
                 autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
          <i data-lucide="chevrons-up-down" class="w-3.5 h-3.5 text-[#A0A0A5]/50 absolute right-2.5 pointer-events-none"></i>
        </div>

        <!-- State 2: Selected Product Card (saat produk sudah dipilih) -->
        <div class="po-selected-state hidden flex items-center justify-between gap-2 p-1.5 bg-white/[0.04] border border-white/10 rounded-xl hover:border-white/20 transition-all">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <div class="w-7 h-7 rounded-lg bg-[#0088CC]/15 border border-[#0088CC]/30 flex items-center justify-center shrink-0 text-[#0088CC]">
              <i data-lucide="package" class="w-3.5 h-3.5"></i>
            </div>
            <div class="min-w-0 flex-1">
              <div class="selected-item-name text-xs font-semibold text-white truncate leading-tight"></div>
              <div class="flex items-center gap-1.5 text-[10px] text-[#A0A0A5] mt-0.5">
                <span class="selected-item-sku font-mono bg-white/5 px-1 rounded text-[9px] text-gray-300"></span>
                <span class="selected-item-stock text-[#34C759]"></span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" class="btn-change-item text-[#A0A0A5] hover:text-[#0088CC] p-1 rounded-lg hover:bg-white/5 transition" title="Ganti barang">
              <i data-lucide="pencil" class="w-3 h-3"></i>
            </button>
            <button type="button" class="btn-clear-selection text-[#A0A0A5] hover:text-[#FF3B30] p-1 rounded-lg hover:bg-white/5 transition" title="Kosongkan barang">
              <i data-lucide="x" class="w-3 h-3"></i>
            </button>
          </div>
        </div>

        <!-- Hidden native select untuk integritas form submit -->
        <select required class="item-select hidden" tabindex="-1" aria-hidden="true">
          <option value="">-- Pilih Barang --</option>
          ${productOptions}
        </select>
      </div>
      <div class="po-item-qty">
        <input type="number" required min="1" step="1" inputmode="numeric" value="${qty}" placeholder="Qty"
               class="item-qty w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white text-center focus:outline-none focus:border-[#0088CC]">
      </div>
      <div class="po-item-price">
        <input type="number" required min="0" step="1000" value="${harga}" placeholder="Harga"
               class="item-harga w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0088CC]">
      </div>
      <div class="po-item-subtotal text-right">
        <span class="item-subtotal text-xs font-semibold text-[#34C759]">Rp 0</span>
      </div>
      <div class="po-item-remove text-center">
        <button type="button" class="btn-remove-item text-[#A0A0A5] hover:text-[#FF3B30] p-1 transition" title="Hapus Baris">
          <i data-lucide="trash" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    const searchInput = row.querySelector('.item-search-input');
    const selectEl = row.querySelector('.item-select');
    const qtyInput = row.querySelector('.item-qty');
    const hargaInput = row.querySelector('.item-harga');
    const removeBtn = row.querySelector('.btn-remove-item');
    const changeBtn = row.querySelector('.btn-change-item');
    const clearSelectionBtn = row.querySelector('.btn-clear-selection');

    function updateRowSubtotal() {
      const q = Math.max(1, Number(qtyInput.value) || 1);
      const h = Math.max(0, Number(hargaInput.value) || 0);
      const sub = q * h;
      row.querySelector('.item-subtotal').textContent = formatRupiah(sub);
      calculateGrandTotal();
    }
    row._updateRowSubtotal = updateRowSubtotal;

    selectEl.addEventListener('change', () => {
      const opt = selectEl.selectedOptions[0];
      if (opt && opt.dataset.price) {
        hargaInput.value = opt.dataset.price;
      }
      updateRowSubtotal();
    });

    qtyInput.addEventListener('input', updateRowSubtotal);
    hargaInput.addEventListener('input', updateRowSubtotal);

    // Event input & dropdown combobox
    searchInput.addEventListener('focus', () => {
      openPoDropdown(row, searchInput.value.trim());
    });

    searchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (!val) {
        selectEl.value = '';
      }
      openPoDropdown(row, val);
    });

    searchInput.addEventListener('keydown', (e) => {
      const dropdown = poDropdownEl;
      if (!dropdown || dropdown.classList.contains('hidden')) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          openPoDropdown(row, searchInput.value.trim());
          e.preventDefault();
        }
        return;
      }

      const items = Array.from(dropdown.querySelectorAll('.po-dropdown-item'));
      if (items.length === 0) return;

      let currentIndex = items.findIndex(el => el.classList.contains('is-highlighted'));

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIndex < items.length - 1) {
          if (currentIndex >= 0) items[currentIndex].classList.remove('is-highlighted');
          currentIndex++;
          items[currentIndex].classList.add('is-highlighted');
          items[currentIndex].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIndex > 0) {
          items[currentIndex].classList.remove('is-highlighted');
          currentIndex--;
          items[currentIndex].classList.add('is-highlighted');
          items[currentIndex].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = currentIndex >= 0 ? items[currentIndex] : items[0];
        if (target) {
          const prodId = target.getAttribute('data-id');
          const prod = availableProducts.find(p => String(p.id) === String(prodId));
          if (prod) {
            selectProductInRow(row, prod);
          }
          closePoDropdown();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closePoDropdown();
      }
    });

    if (changeBtn) {
      changeBtn.addEventListener('click', () => {
        const searchWrap = row.querySelector('.po-search-state');
        const selectedWrap = row.querySelector('.po-selected-state');
        if (selectedWrap) selectedWrap.classList.add('hidden');
        if (searchWrap) searchWrap.classList.remove('hidden');
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
          openPoDropdown(row, '');
        }
      });
    }

    if (clearSelectionBtn) {
      clearSelectionBtn.addEventListener('click', () => {
        selectProductInRow(row, null);
        if (searchInput) {
          searchInput.focus();
          openPoDropdown(row, '');
        }
      });
    }

    removeBtn.addEventListener('click', () => {
      const allRows = document.querySelectorAll('.po-item-row');
      if (allRows.length <= 1) {
        showToast('Minimal harus ada 1 item barang dalam PO', 'warning');
        return;
      }
      if (activeComboboxRow === row) {
        closePoDropdown();
      }
      row.remove();
      calculateGrandTotal();
    });

    // Inisialisasi jika ada selectedProductId
    if (selectedProductId) {
      const prod = availableProducts.find(p => String(p.id) === String(selectedProductId));
      if (prod) {
        selectProductInRow(row, prod);
      }
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: row });
    }

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

  async function openModal() {
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

    if (availableSuppliers.length === 0 || availableProducts.length === 0) {
      await loadMasterData();
    }
    populateSupplierSelect();

    itemsContainer.innerHTML = '';
    itemsContainer.appendChild(createItemRow());

    calculateGrandTotal();

    document.body.classList.add('modal-open');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) window.lucide.createIcons();
  }

  function closeModal() {
    closePoDropdown();
    const modal = document.getElementById('modal-po');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('modal-open');
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
    const supplierSelect = document.getElementById('po-supplier');
    const supplier_id = supplierSelect?.value || null;
    const supplier_nama = supplierSelect?.selectedOptions[0]?.dataset?.name || supplierSelect?.selectedOptions[0]?.text || '';
    const status = document.getElementById('po-status')?.value || 'draft';
    const catatan = document.getElementById('po-catatan')?.value || '';

    if (!supplier_id) {
      showToast('Pilih supplier tujuan pesanan', 'warning');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan PO';
      }
      return;
    }

    const items = [];
    let hasInvalid = false;
    document.querySelectorAll('.po-item-row').forEach(row => {
      const selectEl = row.querySelector('.item-select');
      const prodId = selectEl?.value;
      const prodName = selectEl?.selectedOptions[0]?.dataset?.name || '';
      const qty = Number(row.querySelector('.item-qty')?.value || 1);
      const harga = Number(row.querySelector('.item-harga')?.value || 0);
      if (!prodId) {
        hasInvalid = true;
      } else {
        items.push({
          product_id: prodId,
          product_name: prodName,
          qty,
          harga
        });
      }
    });

    if (hasInvalid || items.length === 0) {
      showToast('Pilih produk dari master barang untuk seluruh rincian item', 'warning');
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
        supplier_id,
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

  function exportPDF() {
    if (!poEntries || poEntries.length === 0) {
      showToast('Tidak ada data PO untuk diekspor', 'warning');
      return;
    }

    const title = `Laporan Purchase Order (${currentStatus.toUpperCase()})`;
    const today = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    const rowsHtml = poEntries.map((p, idx) => {
      const itemsCount = (p.items && p.items.length) || (p.purchase_order_items && p.purchase_order_items.length) || 1;
      const supplierName = resolvePoSupplierName(p) || '-';
      return `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${p.no_po || '-'}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${formatDate(p.tanggal)}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${supplierName}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${itemsCount}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center; text-transform: uppercase;">${p.status || '-'}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${formatRupiah(p.total || 0)}</td>
        </tr>
      `;
    }).join('');

    const grandTotal = poEntries.reduce((sum, p) => sum + (Number(p.total) || 0), 0);

    const printWin = window.open('', '_blank');
    if (!printWin) {
      window.print();
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #111; }
          h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
          p { margin: 0 0 16px; color: #666; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
          th { background: #f3f4f6; border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: 600; }
          .total-row td { background: #fafafa; font-weight: bold; border-top: 2px solid #333; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h2>Aquastock Pro — ${title}</h2>
        <p>Dicetak pada: ${today} | Total: ${poEntries.length} Dokumen PO</p>
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">No</th>
              <th>No. PO</th>
              <th>Tanggal</th>
              <th>Supplier</th>
              <th style="text-align: center;">Item</th>
              <th style="text-align: center;">Status</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="6" style="padding: 10px; text-align: right;">TOTAL KESELURUHAN:</td>
              <td style="padding: 10px; text-align: right;">${formatRupiah(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 250);
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
      `"${(resolvePoSupplierName(p) || p.catatan || '').replace(/"/g, '""')}"`,
      (p.items && p.items.length) || (p.purchase_order_items && p.purchase_order_items.length) || 1,
      p.status,
      p.total,
      `"${(formatPoNote(p.catatan) || '').replace(/"/g, '""')}"`
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
    if (eventsSetup) return;
    eventsSetup = true;

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

    // Export PDF
    const exportBtn = document.getElementById('btn-export-po');
    if (exportBtn) exportBtn.addEventListener('click', exportPDF);

    // Restock Assistant (Stok Kritis)
    const autoRestockBtn = document.getElementById('btn-auto-restock-po');
    const autoRestockEmptyBtn = document.getElementById('btn-auto-restock-empty');

    if (autoRestockBtn) {
      autoRestockBtn.addEventListener('click', async () => {
        if (isGeneratingAutoPo) return;
        isGeneratingAutoPo = true;
        autoRestockBtn.disabled = true;
        autoRestockBtn.classList.add('opacity-50');
        showToast('Memindai stok menipis dan membuat draft PO...', 'info');
        try {
          const res = await poApi.generateFromLowStock();
          if (res.ok && res.data) {
            if (res.data.created) {
              showToast(`Draft PO ${res.data.no_po} berhasil dibuat (${res.data.item_count} item)!`, 'success');
              currentPage = 1;
              currentStatus = 'all';
              await loadData();
              checkAutoPoConfigAndStock();
            } else {
              showToast(res.data.message || 'Semua barang dalam batas stok aman', 'info');
            }
          } else {
            showToast(res.error?.message || 'Gagal membuat draft PO otomatis', 'error');
          }
        } catch (err) {
          showToast('Terjadi kesalahan saat memproses restock', 'error');
        } finally {
          isGeneratingAutoPo = false;
          autoRestockBtn.disabled = false;
          autoRestockBtn.classList.remove('opacity-50');
        }
      });
    }

    if (autoRestockEmptyBtn) {
      autoRestockEmptyBtn.addEventListener('click', () => {
        if (autoRestockBtn) autoRestockBtn.click();
      });
    }

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
    const btnPrev = document.querySelector('#page-po #btn-prev-page') || document.getElementById('btn-prev-page');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          loadData();
        }
      });
    }

    const btnNext = document.querySelector('#page-po #btn-next-page') || document.getElementById('btn-next-page');
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
        if (id) {
          const payChoice = prompt(
            'Konfirmasi Penerimaan PO:\nItem produk akan otomatis masuk ke stok gudang.\n\nPilih metode pembayaran ke supplier:\n1. Cash (Tunai)\n2. Transfer (Bank)\n3. Tempo (Hutang Dagang)\n\nKetik 1, 2, atau 3 (Default: 1):',
            '1'
          );
          if (payChoice === null) return;

          let paymentMethod = 'Cash';
          const trimmed = payChoice.trim().toLowerCase();
          if (trimmed === '2' || trimmed.includes('transfer')) {
            paymentMethod = 'Transfer';
          } else if (trimmed === '3' || trimmed.includes('tempo') || trimmed.includes('hutang')) {
            paymentMethod = 'Tempo';
          }

          receiveBtn.disabled = true;
          handleUpdateStatus(id, 'diterima', `Barang PO diterima (${paymentMethod}) & stok inventori berhasil bertambah`, paymentMethod);
        }
        return;
      }

      const printBtn = e.target.closest('.btn-print-po');
      if (printBtn) {
        const id = printBtn.getAttribute('data-id');
        if (id) openPrintPOModal(id);
        return;
      }

      const waBtn = e.target.closest('.btn-wa-po');
      if (waBtn) {
        const id = waBtn.getAttribute('data-id');
        if (id) sharePOWhatsApp(id);
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-po');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        if (id) openDeleteConfirmation(id, deleteBtn);
        return;
      }
    });

    const deleteModal = document.getElementById('modal-delete-po');
    const cancelDeleteBtn = document.getElementById('btn-cancel-delete-po');
    const confirmDeleteBtn = document.getElementById('btn-confirm-delete-po');
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteConfirmation);
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener('click', () => {
        if (deleteInProgress || !pendingDeleteId) return;
        handleDelete(pendingDeleteId);
      });
    }
    if (deleteModal) {
      deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteConfirmation();
      });
      deleteModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDeleteConfirmation();
      });
    }

    // Print PO Modal events
    const closePrintBtn = document.getElementById('btn-close-print-po');
    const cancelPrintBtn = document.getElementById('btn-cancel-print-po');
    const docShareWaBtn = document.getElementById('btn-doc-share-wa');
    const docPrintActionBtn = document.getElementById('btn-doc-print-action');

    if (closePrintBtn) closePrintBtn.addEventListener('click', closePrintPOModal);
    if (cancelPrintBtn) cancelPrintBtn.addEventListener('click', closePrintPOModal);
    if (docShareWaBtn) {
      docShareWaBtn.addEventListener('click', () => {
        if (activePrintPO && activePrintPO.id) sharePOWhatsApp(activePrintPO.id);
      });
    }
    if (docPrintActionBtn) docPrintActionBtn.addEventListener('click', printPODocument);

    const printPoModal = document.getElementById('modal-print-po');
    if (printPoModal) {
      printPoModal.addEventListener('click', (e) => {
        if (e.target === printPoModal) closePrintPOModal();
      });
      printPoModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePrintPOModal();
      });
    }
  }

  async function checkAutoPoConfigAndStock() {
    try {
      if (settingsApi && typeof settingsApi.get === 'function') {
        const res = await settingsApi.get('stock_config');
        const isAutoPoEnabled = Boolean(res?.ok && res?.data?.auto_po_enabled);
        const indicator = document.getElementById('po-auto-status-indicator');
        if (indicator) {
          if (isAutoPoEnabled) {
            indicator.classList.remove('hidden');
            indicator.classList.add('flex');
          } else {
            indicator.classList.add('hidden');
            indicator.classList.remove('flex');
          }
        }
      }

      if (availableProducts && availableProducts.length > 0) {
        const lowStockCount = availableProducts.filter(p => {
          const s = Number(p.stock) || 0;
          const min = Number(p.min_stock) || 0;
          return s <= min;
        }).length;

        const restockCount = document.getElementById('auto-restock-po-count');
        if (restockCount) {
          restockCount.textContent = String(lowStockCount);
          restockCount.classList.toggle('hidden', lowStockCount === 0);
        }
      }
    } catch (_) {}
  }

  async function initPo() {
    try {
      userRole = await getUserRole();
    } catch (_) {}

    setupEvents();
    await Promise.all([
      loadMasterData(),
      loadData()
    ]);
    await checkAutoPoConfigAndStock();
  }

  if (typeof window !== 'undefined') {
    window.initPo = initPo;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPo);
  } else {
    initPo();
  }

})();
