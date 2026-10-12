let suppliersData = [];
let currentFilter = 'all';
let searchQuery = '';
let currentPage = 1;
const pageSize = 10;
let targetDeleteId = null;

async function loadSuppliers() {
  const tbody = document.getElementById('suppliers-table-body');
  try {
    const res = await Api.suppliers.getAll();
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center text-[#FF3B30]">${res.error?.message || 'Gagal memuat supplier'}</td></tr>`;
      return;
    }
    suppliersData = res.data || [];
    updateSupplierMetrics();
    renderSuppliers();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center text-[#FF3B30]">Terjadi kesalahan: ${err.message}</td></tr>`;
  }
}

function updateSupplierMetrics() {
  const total = suppliersData.length;
  const active = suppliersData.filter(s => s.is_active).length;
  const inactive = total - active;

  document.getElementById('metric-total-suppliers').textContent = total;
  document.getElementById('metric-active-suppliers').textContent = active;
  document.getElementById('metric-inactive-suppliers').textContent = inactive;
}

function goToSuppliersPage(page) {
  currentPage = page;
  renderSuppliers();
}

function renderSuppliersPagination(totalFiltered) {
  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalFiltered);

  const infoEl = document.getElementById('suppliers-pagination-info');
  if (infoEl) {
    infoEl.textContent = `Menampilkan ${startIdx}-${endIdx} dari ${totalFiltered} supplier`;
  }

  const btnContainer = document.getElementById('suppliers-pagination-buttons');
  if (!btnContainer) return;
  btnContainer.innerHTML = '';

  // Prev Button
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = `px-3 py-1.5 rounded-lg border text-sm transition flex items-center justify-center ${
    currentPage <= 1
      ? 'bg-[#1C1C1E]/50 border-white/5 text-[#A0A0A5]/40 cursor-not-allowed'
      : 'bg-[#1C1C1E] border-white/5 text-[#A0A0A5] hover:text-white hover:bg-white/5'
  }`;
  prevBtn.setAttribute('aria-label', 'Halaman sebelumnya');
  prevBtn.disabled = currentPage <= 1;
  prevBtn.onclick = () => goToSuppliersPage(currentPage - 1);
  prevBtn.innerHTML = '<i data-lucide="chevron-left" class="w-4 h-4" aria-hidden="true"></i>';
  btnContainer.appendChild(prevBtn);

  // Page Numbers (max 5)
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  for (let p = startPage; p <= endPage; p++) {
    const pageBtn = document.createElement('button');
    pageBtn.type = 'button';
    const isActive = p === currentPage;
    pageBtn.className = `px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
      isActive
        ? 'bg-[#0088CC] text-white shadow-lg shadow-[#0088CC]/20'
        : 'bg-[#1C1C1E] border border-white/5 text-[#A0A0A5] hover:text-white hover:bg-white/5'
    }`;
    pageBtn.textContent = p;
    if (isActive) pageBtn.setAttribute('aria-current', 'page');
    pageBtn.onclick = () => goToSuppliersPage(p);
    btnContainer.appendChild(pageBtn);
  }

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = `px-3 py-1.5 rounded-lg border text-sm transition flex items-center justify-center ${
    currentPage >= totalPages
      ? 'bg-[#1C1C1E]/50 border-white/5 text-[#A0A0A5]/40 cursor-not-allowed'
      : 'bg-[#1C1C1E] border-white/5 text-[#A0A0A5] hover:text-white hover:bg-white/5'
  }`;
  nextBtn.setAttribute('aria-label', 'Halaman berikutnya');
  nextBtn.disabled = currentPage >= totalPages;
  nextBtn.onclick = () => goToSuppliersPage(currentPage + 1);
  nextBtn.innerHTML = '<i data-lucide="chevron-right" class="w-4 h-4" aria-hidden="true"></i>';
  btnContainer.appendChild(nextBtn);

  if (window.lucide) lucide.createIcons();
}

function renderSuppliers() {
  const tbody = document.getElementById('suppliers-table-body');
  let filtered = suppliersData;

  // Filter status
  if (currentFilter === 'active') {
    filtered = filtered.filter(s => s.is_active);
  } else if (currentFilter === 'inactive') {
    filtered = filtered.filter(s => !s.is_active);
  }

  // Filter pencarian
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q))
    );
  }

  renderSuppliersPagination(filtered.length);

  const pagWrap = document.getElementById('suppliers-pagination-wrap');
  if (filtered.length === 0) {
    if (pagWrap) pagWrap.classList.add('hidden');
    const emptyText = (searchQuery.trim() || currentFilter !== 'all')
      ? 'Tidak ada supplier yang cocok dengan filter / pencarian'
      : 'Tidak ada data supplier';
    tbody.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="5" class="empty-state-cell px-5 py-12 text-center text-[#A0A0A5]">
          <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-center">
            <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-1">
              <i data-lucide="inbox" class="w-6 h-6 text-[#A0A0A5]/40" aria-hidden="true"></i>
            </div>
            <p class="font-semibold text-white">${emptyText}</p>
            <p class="text-xs text-[#A0A0A5]">Klik tombol Tambah Supplier untuk mendaftarkan mitra baru.</p>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (pagWrap) pagWrap.classList.remove('hidden');

  const startIdx = (currentPage - 1) * pageSize;
  const paged = filtered.slice(startIdx, startIdx + pageSize);

  tbody.innerHTML = paged.map(s => {
    const isActive = !!s.is_active;
    const statusBadge = isActive
      ? `<span class="badge bg-[#34C759]/15 text-[#34C759]">Aktif</span>`
      : `<span class="badge bg-[#8E8E93]/15 text-[#A0A0A5]">Nonaktif</span>`;

    return `
      <tr class="table-row border-b border-white/5 hover:bg-white/[0.02] transition">
        <td class="px-5 py-3.5">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl ${isActive ? 'bg-[#0088CC]/15 text-[#32ADE6]' : 'bg-white/5 text-[#A0A0A5]'} grid place-items-center text-sm font-bold">
              <i data-lucide="factory" class="w-4 h-4" aria-hidden="true"></i>
            </div>
            <div>
              <p class="font-medium text-white">${escapeHtml(s.name)}</p>
              <p class="text-[11px] text-[#A0A0A5] md:hidden">${escapeHtml(s.phone || '-')}</p>
            </div>
          </div>
        </td>
        <td class="px-5 py-3.5 text-[#A0A0A5]">${escapeHtml(s.phone || '-')}</td>
        <td class="px-5 py-3.5 text-[#A0A0A5] max-w-xs truncate">${escapeHtml(s.address || '-')}</td>
        <td class="px-5 py-3.5">${statusBadge}</td>
        <td class="px-5 py-3.5 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="editSupplier(${s.id})" title="Edit" class="p-1.5 hover:bg-white/10 rounded-lg text-[#32ADE6] transition">
              <i data-lucide="pencil" class="w-4 h-4" aria-hidden="true"></i>
            </button>
            <button onclick="confirmDeleteSupplier(${s.id}, '${escapeHtml(s.name)}')" title="Hapus" class="p-1.5 hover:bg-[#FF3B30]/20 rounded-lg text-[#FF3B30] transition">
              <i data-lucide="trash-2" class="w-4 h-4" aria-hidden="true"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.syncTableLabels) window.syncTableLabels();
  if (window.lucide) lucide.createIcons();
}

function filterByStatus(status) {
  currentFilter = status;
  currentPage = 1;
  document.querySelectorAll('.filter-tab-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-[#0088CC]', 'text-white', 'font-semibold');
    btn.classList.add('text-[#A0A0A5]', 'font-medium');
  });
  const activeBtn = document.getElementById(`tab-${status}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-[#A0A0A5]', 'font-medium');
    activeBtn.classList.add('active', 'bg-[#0088CC]', 'text-white', 'font-semibold');
  }
  renderSuppliers();
}

function handleSearch(val) {
  searchQuery = (val || '').trim().toLowerCase();
  const searchInput = document.getElementById('search-suppliers');
  const globalInput = document.getElementById('global-search');
  if (searchInput && searchInput.value !== val) searchInput.value = val || '';
  if (globalInput && globalInput.value !== val) globalInput.value = val || '';
  currentPage = 1;
  renderSuppliers();
}

function setupSearchListeners() {
  const searchInput = document.getElementById('search-suppliers');
  const globalInput = document.getElementById('global-search');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      handleSearch(e.target.value);
    });
  }

  if (globalInput) {
    globalInput.addEventListener('input', (e) => {
      handleSearch(e.target.value);
    });
  }
}

async function handleRefreshSuppliers() {
  const iconToolbar = document.getElementById('icon-refresh-suppliers');
  const headerBtn = document.getElementById('btn-refresh-suppliers-header');
  const iconHeader = headerBtn ? headerBtn.querySelector('svg, i') : null;

  if (iconToolbar) iconToolbar.classList.add('animate-spin');
  if (iconHeader) iconHeader.classList.add('animate-spin');

  try {
    await loadSuppliers();
    if (typeof showToast === 'function') {
      showToast('Data berhasil di-refresh', 'success');
    }
  } catch (err) {
    console.error('Refresh suppliers error:', err);
    if (typeof showToast === 'function') {
      showToast('Gagal memuat ulang data', 'error');
    }
  } finally {
    setTimeout(() => {
      if (iconToolbar) iconToolbar.classList.remove('animate-spin');
      if (iconHeader) iconHeader.classList.remove('animate-spin');
    }, 500);
  }
}

function handleExportSuppliers() {
  if (!suppliersData || suppliersData.length === 0) {
    if (typeof showToast === 'function') showToast('Tidak ada data supplier untuk diexport', 'warning');
    return;
  }

  const headers = ['Nama Supplier', 'Telepon', 'Alamat', 'Status'];
  const rows = suppliersData.map(s => {
    return [s.name || '', s.phone || '', s.address || '', s.is_active ? 'Aktif' : 'Nonaktif'];
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const filename = `suppliers-${todayStr}.csv`;
  if (typeof exportToCSV === 'function') {
    exportToCSV(filename, rows, headers);
    if (typeof showToast === 'function') showToast(`Berhasil export ${rows.length} supplier`, 'success');
  }
}

function openSupplierModal(supplier = null) {
  const modal = document.getElementById('modal-supplier');
  const title = document.getElementById('modal-supplier-title');
  const form = document.getElementById('form-supplier');

  form.reset();
  if (supplier) {
    title.textContent = 'Edit Supplier';
    document.getElementById('supplier-id').value = supplier.id;
    document.getElementById('supplier-name').value = supplier.name || '';
    document.getElementById('supplier-phone').value = supplier.phone || '';
    document.getElementById('supplier-address').value = supplier.address || '';
    document.getElementById('supplier-status').value = supplier.is_active ? 'true' : 'false';
  } else {
    title.textContent = 'Tambah Supplier';
    document.getElementById('supplier-id').value = '';
    document.getElementById('supplier-status').value = 'true';
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => document.getElementById('supplier-name').focus(), 50);
}

function closeSupplierModal() {
  const modal = document.getElementById('modal-supplier');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function editSupplier(id) {
  const s = suppliersData.find(item => item.id === id);
  if (s) openSupplierModal(s);
}

async function handleSupplierSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('supplier-id').value;
  const name = document.getElementById('supplier-name').value.trim();
  const phone = document.getElementById('supplier-phone').value.trim();
  const address = document.getElementById('supplier-address').value.trim();
  const isActive = document.getElementById('supplier-status').value === 'true';

  if (!name) {
    showToast('Nama supplier wajib diisi', 'error');
    return;
  }

  const btn = document.getElementById('btn-save-supplier');
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Menyimpan...`;

  try {
    let res;
    if (id) {
      res = await Api.suppliers.update(id, { name, phone, address, is_active: isActive });
    } else {
      res = await Api.suppliers.create({ name, phone, address, is_active: isActive });
    }

    if (!res.ok) {
      showToast(res.error?.message || 'Gagal menyimpan supplier', 'error');
      return;
    }

    showToast(id ? 'Supplier berhasil diperbarui' : 'Supplier berhasil ditambahkan', 'success');
    closeSupplierModal();
    await loadSuppliers();
  } catch (err) {
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Simpan Supplier`;
    if (window.lucide) lucide.createIcons();
  }
}

function confirmDeleteSupplier(id, name) {
  targetDeleteId = id;
  document.getElementById('delete-supplier-name').textContent = name;
  const modal = document.getElementById('modal-delete-supplier');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeDeleteSupplierModal() {
  targetDeleteId = null;
  const modal = document.getElementById('modal-delete-supplier');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function executeDeleteSupplier() {
  if (!targetDeleteId) return;
  const btn = document.getElementById('btn-confirm-delete-supplier');
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Menghapus...`;

  try {
    const res = await Api.suppliers.delete(targetDeleteId);
    if (!res.ok) {
      showToast(res.error?.message || 'Gagal menghapus supplier', 'error');
      return;
    }
    showToast('Supplier berhasil dihapus', 'success');
    closeDeleteSupplierModal();
    await loadSuppliers();
  } catch (err) {
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="trash-2" class="w-4 h-4"></i> Hapus`;
    if (window.lucide) lucide.createIcons();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  setupSearchListeners();
  loadSuppliers();
});
