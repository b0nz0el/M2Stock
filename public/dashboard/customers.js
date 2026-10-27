let customersData = [];
let searchQuery = '';
let currentPage = 1;
const pageSize = 10;
let targetDeleteId = null;

const AVATAR_GRADIENTS = [
  'from-[#0088CC] to-[#32ADE6]',
  'from-[#34C759] to-[#28A745]',
  'from-[#AF52DE] to-[#9B3DC8]',
  'from-[#FF9500] to-[#FF5E3A]',
  'from-[#FF2D55] to-[#D81B60]'
];

function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num || 0);
}

function formatShortRupiah(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) {
    return 'Rp ' + (n / 1000000).toFixed(1).replace('.0', '') + 'jt';
  }
  if (n >= 1000) {
    return 'Rp ' + (n / 1000).toFixed(0) + 'rb';
  }
  return 'Rp ' + n;
}

function formatDateWIB(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short'
  });
}

async function loadCustomers() {
  const tbody = document.getElementById('customers-table-body');
  try {
    const res = await Api.customers.getAll();
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-5 py-8 text-center text-[#FF3B30]">${res.error?.message || 'Gagal memuat customer'}</td></tr>`;
      return;
    }
    customersData = res.data || [];
    updateCustomerMetrics();
    renderCustomers();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-5 py-8 text-center text-[#FF3B30]">Terjadi kesalahan: ${err.message}</td></tr>`;
  }
}

function updateCustomerMetrics() {
  const total = customersData.length;
  const totalSpent = customersData.reduce((acc, c) => acc + (Number(c.total_spent) || 0), 0);
  const totalTx = customersData.reduce((acc, c) => acc + (Number(c.total_transactions) || 0), 0);

  document.getElementById('metric-total-customers').textContent = total;
  document.getElementById('metric-total-spent').textContent = formatRupiah(totalSpent);
  document.getElementById('metric-total-transactions').textContent = totalTx;
  document.getElementById('customers-count-info').textContent = `Total: ${total} pelanggan`;
}

function goToCustomersPage(page) {
  currentPage = page;
  renderCustomers();
}

function renderCustomersPagination(totalFiltered) {
  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalFiltered);

  const infoEl = document.getElementById('customers-pagination-info');
  if (infoEl) {
    infoEl.textContent = `Menampilkan ${startIdx}-${endIdx} dari ${totalFiltered} customer`;
  }

  const btnContainer = document.getElementById('customers-pagination-buttons');
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
  prevBtn.onclick = () => goToCustomersPage(currentPage - 1);
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
    pageBtn.onclick = () => goToCustomersPage(p);
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
  nextBtn.onclick = () => goToCustomersPage(currentPage + 1);
  nextBtn.innerHTML = '<i data-lucide="chevron-right" class="w-4 h-4" aria-hidden="true"></i>';
  btnContainer.appendChild(nextBtn);

  if (window.lucide) lucide.createIcons();
}

function renderCustomers() {
  const tbody = document.getElementById('customers-table-body');
  let filtered = customersData;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.city && c.city.toLowerCase().includes(q))
    );
  }

  renderCustomersPagination(filtered.length);

  const pagWrap = document.getElementById('customers-pagination-wrap');
  if (filtered.length === 0) {
    if (pagWrap) pagWrap.classList.add('hidden');
    const emptyText = searchQuery.trim()
      ? 'Tidak ada data customer yang cocok dengan pencarian'
      : 'Tidak ada data customer';
    tbody.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="8" class="empty-state-cell px-5 py-12 text-center text-[#A0A0A5]">
          <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-center">
            <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-1">
              <i data-lucide="users" class="w-6 h-6 text-[#A0A0A5]/40" aria-hidden="true"></i>
            </div>
            <p class="font-semibold text-white">${emptyText}</p>
            <p class="text-xs text-[#A0A0A5]">Klik tombol Tambah Customer untuk mencatat pelanggan baru.</p>
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

  tbody.innerHTML = paged.map((c, idx) => {
    const initial = (c.name || 'C').charAt(0).toUpperCase();
    const grad = AVATAR_GRADIENTS[(startIdx + idx) % AVATAR_GRADIENTS.length];
    const totalSpentText = formatShortRupiah(c.total_spent);
    const txCount = c.total_transactions || 0;
    const lastDate = formatDateWIB(c.last_transaction_at);

    return `
      <tr class="table-row border-b border-white/5 hover:bg-white/[0.02] transition">
        <td class="px-5 py-3.5">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br ${grad} grid place-items-center text-xs font-bold text-white shadow-sm">
              ${initial}
            </div>
            <div>
              <span class="font-medium text-white">${escapeHtml(c.name)}</span>
            </div>
          </div>
        </td>
        <td class="px-5 py-3.5 text-[#A0A0A5]">${escapeHtml(c.phone || '-')}</td>
        <td class="px-5 py-3.5 text-[#A0A0A5]">${escapeHtml(c.email || '-')}</td>
        <td class="px-5 py-3.5 text-[#A0A0A5]">${escapeHtml(c.city || '-')}</td>
        <td class="px-5 py-3.5 text-right font-semibold text-white">${totalSpentText}</td>
        <td class="px-5 py-3.5 text-right font-medium text-white">${txCount}</td>
        <td class="px-5 py-3.5 text-[#A0A0A5]">${lastDate}</td>
        <td class="px-5 py-3.5 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button data-action="edit" onclick="editCustomer(${c.id})" title="Edit" class="p-1.5 hover:bg-white/10 rounded-lg text-[#32ADE6] transition">
              <i data-lucide="pencil" class="w-4 h-4" aria-hidden="true"></i>
            </button>
            <button data-action="delete" onclick="confirmDeleteCustomer(${c.id}, '${escapeHtml(c.name)}')" title="Hapus" class="p-1.5 hover:bg-[#FF3B30]/20 rounded-lg text-[#FF3B30] transition">
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

function handleSearch(val) {
  searchQuery = (val || '').trim().toLowerCase();
  const searchInput = document.getElementById('search-customers');
  const globalInput = document.getElementById('global-search');
  if (searchInput && searchInput.value !== val) searchInput.value = val || '';
  if (globalInput && globalInput.value !== val) globalInput.value = val || '';
  currentPage = 1;
  renderCustomers();
}

function setupSearchListeners() {
  const searchInput = document.getElementById('search-customers');
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

async function handleRefreshCustomers() {
  const headerBtn = document.getElementById('btn-refresh-customers-header');
  const iconHeader = headerBtn ? headerBtn.querySelector('svg, i') : null;

  if (iconHeader) iconHeader.classList.add('animate-spin');

  try {
    await loadCustomers();
    if (typeof showToast === 'function') {
      showToast('Data berhasil di-refresh', 'success');
    }
  } catch (err) {
    console.error('Refresh customers error:', err);
    if (typeof showToast === 'function') {
      showToast('Gagal memuat ulang data', 'error');
    }
  } finally {
    setTimeout(() => {
      if (iconHeader) iconHeader.classList.remove('animate-spin');
    }, 500);
  }
}

function handleExportCustomers() {
  if (!customersData || customersData.length === 0) {
    if (typeof showToast === 'function') showToast('Tidak ada data customer untuk diexport', 'warning');
    return;
  }

  const headers = ['Nama Customer', 'Telepon', 'Email', 'Kota', 'Total Beli (Rp)', 'Jumlah Transaksi', 'Transaksi Terakhir'];
  const rows = customersData.map(c => {
    return [
      c.name || '',
      c.phone || '',
      c.email || '',
      c.city || '',
      c.total_spent || 0,
      c.total_transactions || 0,
      formatDateWIB(c.last_transaction_at)
    ];
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const filename = `customers-${todayStr}.csv`;
  if (typeof exportToCSV === 'function') {
    exportToCSV(filename, rows, headers);
    if (typeof showToast === 'function') showToast(`Berhasil export ${rows.length} customer`, 'success');
  }
}

function openCustomerModal(customer = null) {
  const modal = document.getElementById('modal-customer');
  const title = document.getElementById('modal-customer-title');
  const form = document.getElementById('form-customer');

  form.reset();
  if (customer) {
    title.textContent = 'Edit Customer';
    document.getElementById('customer-id').value = customer.id;
    document.getElementById('customer-name').value = customer.name || '';
    document.getElementById('customer-phone').value = customer.phone || '';
    document.getElementById('customer-email').value = customer.email || '';
    document.getElementById('customer-city').value = customer.city || '';
  } else {
    title.textContent = 'Tambah Customer';
    document.getElementById('customer-id').value = '';
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => document.getElementById('customer-name').focus(), 50);
}

function closeCustomerModal() {
  const modal = document.getElementById('modal-customer');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function editCustomer(id) {
  const c = customersData.find(item => item.id === id);
  if (c) openCustomerModal(c);
}

async function handleCustomerSubmit(e) {
  e.preventDefault();
  const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
  if (role === 'VIEWER') {
    alert('Anda tidak punya akses untuk mengubah data.');
    return;
  }
  const id = document.getElementById('customer-id').value;
  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const email = document.getElementById('customer-email').value.trim();
  const city = document.getElementById('customer-city').value.trim();

  if (!name) {
    showToast('Nama customer wajib diisi', 'error');
    return;
  }

  const btn = document.getElementById('btn-save-customer');
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Menyimpan...`;

  try {
    let res;
    if (id) {
      res = await Api.customers.update(id, { name, phone, email, city });
    } else {
      res = await Api.customers.create({ name, phone, email, city });
    }

    if (!res.ok) {
      showToast(res.error?.message || 'Gagal menyimpan customer', 'error');
      return;
    }

    showToast(id ? 'Customer berhasil diperbarui' : 'Customer berhasil ditambahkan', 'success');
    closeCustomerModal();
    await loadCustomers();
  } catch (err) {
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Simpan Customer`;
    if (window.lucide) lucide.createIcons();
  }
}

function confirmDeleteCustomer(id, name) {
  targetDeleteId = id;
  document.getElementById('delete-customer-name').textContent = name;
  const modal = document.getElementById('modal-delete-customer');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeDeleteCustomerModal() {
  targetDeleteId = null;
  const modal = document.getElementById('modal-delete-customer');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function executeDeleteCustomer() {
  if (!targetDeleteId) return;
  const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
  if (role === 'VIEWER') {
    alert('Anda tidak punya akses untuk mengubah data.');
    return;
  }
  const btn = document.getElementById('btn-confirm-delete-customer');
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Menghapus...`;

  try {
    const res = await Api.customers.delete(targetDeleteId);
    if (!res.ok) {
      showToast(res.error?.message || 'Gagal menghapus customer', 'error');
      return;
    }
    showToast('Customer berhasil dihapus', 'success');
    closeDeleteCustomerModal();
    await loadCustomers();
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

function initCustomers() {
  setupSearchListeners();
  loadCustomers();
}

if (typeof window !== 'undefined') {
  window.loadCustomers = loadCustomers;
  window.initCustomers = initCustomers;
  window.updateCustomerMetrics = updateCustomerMetrics;
  window.goToCustomersPage = goToCustomersPage;
  window.renderCustomersPagination = renderCustomersPagination;
  window.renderCustomers = renderCustomers;
  window.handleSearch = handleSearch;
  window.handleSearchCustomers = handleSearch;
  window.setupSearchListeners = setupSearchListeners;
  window.handleRefreshCustomers = handleRefreshCustomers;
  window.handleExportCustomers = handleExportCustomers;
  window.openCustomerModal = openCustomerModal;
  window.closeCustomerModal = closeCustomerModal;
  window.editCustomer = editCustomer;
  window.handleCustomerSubmit = handleCustomerSubmit;
  window.confirmDeleteCustomer = confirmDeleteCustomer;
  window.closeDeleteCustomerModal = closeDeleteCustomerModal;
  window.executeDeleteCustomer = executeDeleteCustomer;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCustomers);
} else {
  initCustomers();
}
