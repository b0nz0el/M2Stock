  let currentItems = [];
  let itemToDeleteId = null;

  async function loadCategories() {
    if (typeof window.supabase === 'undefined') return;
    try {
      const { data } = await window.supabase.from('categories').select('*').order('name');
      categoriesData = data || [];

      // 1. Dropdown Form Tambah/Edit
      const select = document.getElementById('item-category');
      if (select) {
        const currentVal = select.value;
        select.innerHTML = '<option value="">Umum (Tanpa Kategori)</option>';
        if (categoriesData.length > 0) {
          categoriesData.forEach(function (cat) {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            select.appendChild(opt);
          });
        }
        if (currentVal) select.value = currentVal;
      }

      // 2. Dropdown Filter Toolbar
      const filterSelect = document.getElementById('filter-category');
      if (filterSelect) {
        const filterVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="all">Semua Kategori</option>';
        if (categoriesData.length > 0) {
          categoriesData.forEach(function (cat) {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            filterSelect.appendChild(opt);
          });
        }
        if (filterVal) filterSelect.value = filterVal;
      }
    } catch (e) {
      console.warn('Gagal memuat kategori:', e);
    }
  }

  let selectedImageBlob = null;
  let isImageChanged = false;

  function resetImageForm() {
    selectedImageBlob = null;
    isImageChanged = false;
    const fileInput = document.getElementById('item-image-file');
    const urlInput = document.getElementById('item-image-url');
    const previewImg = document.getElementById('item-image-preview');
    const placeholder = document.getElementById('item-image-placeholder');
    const removeBtn = document.getElementById('btn-remove-photo');
    const compInfo = document.getElementById('image-compression-info');

    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (previewImg) {
      previewImg.src = '';
      previewImg.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (removeBtn) removeBtn.classList.add('hidden');
    if (compInfo) compInfo.classList.add('hidden');
  }

  async function handleImageSelection(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      if (typeof ImageUtils === 'undefined') {
        throw new Error('Modul kompresi gambar (ImageUtils) belum siap');
      }

      const compInfo = document.getElementById('image-compression-info');
      const compText = document.getElementById('compression-info-text');
      if (compInfo && compText) {
        compText.textContent = 'Mengompresi ke WebP...';
        compInfo.classList.remove('hidden');
      }

      const result = await ImageUtils.compressImage(file);
      selectedImageBlob = result.blob;
      isImageChanged = true;

      const previewImg = document.getElementById('item-image-preview');
      const placeholder = document.getElementById('item-image-placeholder');
      const removeBtn = document.getElementById('btn-remove-photo');

      if (previewImg) {
        previewImg.src = result.previewUrl;
        previewImg.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (removeBtn) removeBtn.classList.remove('hidden');

      if (compInfo && compText) {
        compText.textContent = `${result.originalSizeText} → ${result.compressedSizeText} (WebP)`;
        compInfo.classList.remove('hidden');
      }

      if (typeof window.refreshIcons === 'function') {
        window.refreshIcons();
      }
    } catch (err) {
      console.error('Image selection error:', err);
      if (typeof showToast === 'function') {
        showToast(err.message || 'Gagal memproses gambar', 'error');
      }
      resetImageForm();
    }
  }

  function removeSelectedPhoto() {
    resetImageForm();
    isImageChanged = true;
    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons();
    }
  }

  function openAddItemModal() {
    const form = document.getElementById('item-form');
    if (form) form.reset();
    resetImageForm();
    document.getElementById('item-id').value = '';
    document.getElementById('modal-item-title').textContent = 'Tambah Barang';
    const submitBtn = document.getElementById('btn-submit-item');
    if (submitBtn) {
      const span = submitBtn.querySelector('span');
      if (span) span.textContent = 'Simpan Produk';
    }
    const modal = document.getElementById('modal-item');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    loadCategories();
    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons();
    }
    setTimeout(function () {
      const skuInput = document.getElementById('item-sku');
      if (skuInput) skuInput.focus();
    }, 50);
  }

  function openEditItemModal(id) {
    const item = currentItems.find(function (i) { return Number(i.id) === Number(id); });
    if (!item) return;

    resetImageForm();
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-sku').value = item.sku || '';
    document.getElementById('item-brand').value = item.brand && item.brand !== '-' ? item.brand : '';
    document.getElementById('item-name').value = item.name || '';
    document.getElementById('item-stock').value = item.stock || 0;
    document.getElementById('item-cost-price').value = item.cost_price || 0;
    document.getElementById('item-sell-price').value = item.sell_price || 0;
    document.getElementById('item-min-stock').value = item.min_stock || 3;

    if (item.image_url) {
      document.getElementById('item-image-url').value = item.image_url;
      const previewImg = document.getElementById('item-image-preview');
      const placeholder = document.getElementById('item-image-placeholder');
      const removeBtn = document.getElementById('btn-remove-photo');
      if (previewImg) {
        previewImg.src = item.image_url;
        previewImg.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (removeBtn) removeBtn.classList.remove('hidden');
    }
    isImageChanged = false;

    document.getElementById('modal-item-title').textContent = 'Edit Barang';
    const submitBtn = document.getElementById('btn-submit-item');
    if (submitBtn) {
      const span = submitBtn.querySelector('span');
      if (span) span.textContent = 'Perbarui Produk';
    }

    loadCategories().then(function () {
      if (item.category_id) {
        document.getElementById('item-category').value = item.category_id;
      }
    });

    const modal = document.getElementById('modal-item');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons();
    }
    setTimeout(function () {
      const nameInput = document.getElementById('item-name');
      if (nameInput) nameInput.focus();
    }, 50);
  }

  function closeItemModal() {
    const modal = document.getElementById('modal-item');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  async function handleItemSubmit(e) {
    e.preventDefault();
    const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
    if (role === 'VIEWER') {
      alert('Anda tidak punya akses untuk mengubah data.');
      return;
    }

    const id = document.getElementById('item-id').value;
    const sku = document.getElementById('item-sku').value.trim();
    const name = document.getElementById('item-name').value.trim();
    const brand = document.getElementById('item-brand').value.trim();
    const category_id = document.getElementById('item-category').value;
    const stock = Number(document.getElementById('item-stock').value);
    const cost_price = Number(document.getElementById('item-cost-price').value);
    const sell_price = Number(document.getElementById('item-sell-price').value);
    const min_stock = Number(document.getElementById('item-min-stock').value);

    if (!name) {
      if (typeof showToast === 'function') showToast('Nama barang tidak boleh kosong', 'error');
      return;
    }
    if (!sku) {
      if (typeof showToast === 'function') showToast('SKU barang wajib diisi', 'error');
      return;
    }
    if (cost_price < 0 || sell_price < 0) {
      if (typeof showToast === 'function') showToast('Harga beli dan harga jual harus >= 0', 'error');
      return;
    }
    if (stock < 0) {
      if (typeof showToast === 'function') showToast('Stok harus >= 0', 'error');
      return;
    }

    const duplicate = currentItems.find(function (i) {
      return i.sku.toLowerCase() === sku.toLowerCase() && (!id || Number(i.id) !== Number(id));
    });
    if (duplicate) {
      if (typeof showToast === 'function') showToast('SKU "' + sku + '" sudah digunakan oleh produk lain', 'error');
      return;
    }

    const btnSubmit = document.getElementById('btn-submit-item');
    const originalBtnContent = btnSubmit.innerHTML;
    btnSubmit.disabled = true;

    try {
      // 1. Upload foto ke Storage jika ada foto baru
      let finalImageUrl = document.getElementById('item-image-url').value || null;

      if (selectedImageBlob) {
        btnSubmit.innerHTML = '<span>Mengunggah Foto...</span>';
        const cleanSku = (sku || 'item').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        const imagePath = `${cleanSku}-${Date.now()}.webp`;

        const uploadRes = await Api.storage.uploadImage(selectedImageBlob, imagePath);
        if (!uploadRes.ok) {
          if (typeof showToast === 'function') {
            showToast(uploadRes.error?.message || 'Gagal mengunggah foto ke storage', 'error');
          }
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = originalBtnContent;
          return;
        }
        finalImageUrl = uploadRes.data.publicUrl;
      } else if (isImageChanged && !selectedImageBlob) {
        finalImageUrl = null;
      }

      btnSubmit.innerHTML = '<span>Menyimpan Produk...</span>';

      const payload = {
        sku: sku,
        name: name,
        brand: brand || null,
        category_id: category_id ? Number(category_id) : null,
        stock: stock,
        cost_price: cost_price,
        sell_price: sell_price,
        min_stock: min_stock,
        image_url: finalImageUrl
      };

      let res;
      if (id) {
        res = await Api.items.update(Number(id), payload);
      } else {
        res = await Api.items.create(payload);
      }

      if (!res.ok) {
        if (typeof showToast === 'function') {
          showToast(res.error?.message || 'Gagal menyimpan data ke Supabase', 'error');
        }
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnContent;
        return;
      }

      closeItemModal();
      if (typeof showToast === 'function') {
        showToast(id ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan', 'success');
      }
      await loadItemsFromBackend();
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast(err.message || 'Terjadi kesalahan sistem', 'error');
      }
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalBtnContent;
    }
  }

  function openDeleteItemModal(id) {
    const item = currentItems.find(function (i) { return Number(i.id) === Number(id); });
    if (!item) return;

    itemToDeleteId = item.id;
    document.getElementById('delete-item-name').textContent = item.name + ' (' + item.sku + ')';
    const modal = document.getElementById('modal-delete');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  function closeDeleteModal() {
    itemToDeleteId = null;
    const modal = document.getElementById('modal-delete');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  async function confirmDeleteItem() {
    if (!itemToDeleteId) return;

    const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
    if (role === 'VIEWER') {
      alert('Anda tidak punya akses untuk mengubah data.');
      return;
    }

    const btn = document.getElementById('btn-confirm-delete');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Menghapus...</span>';

    try {
      const res = await Api.items.delete(itemToDeleteId);
      if (!res.ok) {
        if (typeof showToast === 'function') {
          showToast(res.error?.message || 'Gagal menghapus produk dari Supabase', 'error');
        }
        btn.disabled = false;
        btn.innerHTML = originalContent;
        return;
      }

      closeDeleteModal();
      if (typeof showToast === 'function') {
        showToast('Produk berhasil dihapus', 'success');
      }
      await loadItemsFromBackend();
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast(err.message || 'Gagal menghapus produk', 'error');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  }

  let searchQuery = '';
  let selectedCategory = 'all';
  let selectedStockFilter = 'all';
  let currentPage = 1;
  const pageSize = 10;
  let selectedItemIds = new Set();
  let bulkPriceMode = 'nominal'; // 'nominal' | 'percent'

  function filterItems() {
    return currentItems.filter(function (item) {
      // 1. Search text (name, sku, brand, category)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = (item.name || '').toLowerCase().includes(q);
        const matchSku = (item.sku || '').toLowerCase().includes(q);
        const matchBrand = (item.brand || '').toLowerCase().includes(q);
        const matchCat = (item.category || '').toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchBrand && !matchCat) return false;
      }
      // 2. Kategori filter
      if (selectedCategory && selectedCategory !== 'all') {
        if (String(item.category_id) !== String(selectedCategory)) return false;
      }
      // 3. Stok filter
      if (selectedStockFilter === 'low') {
        const stock = Number(item.stock) || 0;
        const minStock = Number(item.min_stock || item.minStock) || 0;
        if (!(stock > 0 && stock <= minStock)) return false;
      } else if (selectedStockFilter === 'out') {
        const stock = Number(item.stock) || 0;
        if (stock !== 0) return false;
      }
      return true;
    });
  }

  function renderPagination(totalFiltered) {
    const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(currentPage * pageSize, totalFiltered);

    const infoEl = document.getElementById('items-pagination-info');
    if (infoEl) {
      infoEl.textContent = `${startIdx}-${endIdx} dari ${totalFiltered}`;
    }

    const btnContainer = document.getElementById('items-pagination-buttons');
    if (!btnContainer) return;
    btnContainer.innerHTML = '';

    // Tombol Previous
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = `px-3 py-1.5 rounded-lg border text-sm transition flex items-center justify-center ${
      currentPage <= 1
        ? 'bg-[#1C1C1E]/50 border-white/5 text-[#A0A0A5]/40 cursor-not-allowed'
        : 'bg-[#1C1C1E] border-white/5 text-[#A0A0A5] hover:text-white hover:bg-white/5'
    }`;
    prevBtn.setAttribute('aria-label', 'Halaman sebelumnya');
    prevBtn.disabled = currentPage <= 1;
    prevBtn.onclick = () => goToPage(currentPage - 1);
    prevBtn.innerHTML = '<i data-lucide="chevron-left" class="w-4 h-4" aria-hidden="true"></i>';
    btnContainer.appendChild(prevBtn);

    // Nomor Halaman (Maksimal 5 tombol nomor)
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
      pageBtn.onclick = () => goToPage(p);
      btnContainer.appendChild(pageBtn);
    }

    // Tombol Next
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = `px-3 py-1.5 rounded-lg border text-sm transition flex items-center justify-center ${
      currentPage >= totalPages
        ? 'bg-[#1C1C1E]/50 border-white/5 text-[#A0A0A5]/40 cursor-not-allowed'
        : 'bg-[#1C1C1E] border-white/5 text-[#A0A0A5] hover:text-white hover:bg-white/5'
    }`;
    nextBtn.setAttribute('aria-label', 'Halaman berikutnya');
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.onclick = () => goToPage(currentPage + 1);
    nextBtn.innerHTML = '<i data-lucide="chevron-right" class="w-4 h-4" aria-hidden="true"></i>';
    btnContainer.appendChild(nextBtn);
  }

  function renderItemsTable() {
    const tbody = document.getElementById('items-tbody');
    const subtitle = document.getElementById('items-subtitle');
    if (!tbody) return;

    tbody.innerHTML = '';
    const filtered = filterItems();
    const totalFiltered = filtered.length;

    // Metrik total barang
    let totalStock = 0;
    let totalValue = 0;
    currentItems.forEach(function (i) {
      const s = Number(i.stock) || 0;
      const p = Number(i.sell_price || i.sellPrice || i.unitPrice) || 0;
      totalStock += s;
      totalValue += (s * p);
    });
    if (subtitle) {
      const valStr = totalValue >= 1000000 ? (totalValue / 1000000).toFixed(1) + 'jt' : Number(totalValue).toLocaleString('id-ID');
      subtitle.textContent = `${currentItems.length} barang · ${totalStock} total stok · Rp ${valStr} nilai`;
    }

    // 1. Kondisi jika database memang kosong
    if (currentItems.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-state-row"><td colspan="11" class="empty-state-cell text-center py-12 text-[#A0A0A5]">
          <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-center">
            <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-1">
              <i data-lucide="package-open" class="w-6 h-6 text-[#A0A0A5]/40" aria-hidden="true"></i>
            </div>
            <p class="text-sm font-semibold text-white">Belum ada produk</p>
            <p class="text-xs text-[#A0A0A5]">Klik 'Tambah Barang' di atas untuk mulai menambahkan produk.</p>
          </div>
        </td></tr>
      `;
      const pagWrap = document.getElementById('items-pagination-wrap');
      if (pagWrap) pagWrap.classList.add('hidden');
      const bulkBar = document.getElementById('bulk-bar');
      if (bulkBar) {
        bulkBar.classList.add('hidden');
        bulkBar.classList.remove('flex');
      }
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
      return;
    }

    // 2. Kondisi jika search / filter menghasilkan 0 baris (Empty State)
    if (totalFiltered === 0) {
      tbody.innerHTML = `
        <tr class="empty-state-row"><td colspan="11" class="empty-state-cell text-center py-12 text-[#A0A0A5] w-full">
          <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-center">
            <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-1">
              <i data-lucide="search-x" class="w-6 h-6 text-[#A0A0A5]/60" aria-hidden="true"></i>
            </div>
            <p class="text-sm font-semibold text-white">Tidak ada produk yang cocok dengan filter</p>
            <p class="text-xs text-[#A0A0A5]">Coba ubah kata kunci pencarian atau reset kategori dan stok.</p>
            <button type="button" onclick="resetFilters()" class="mt-3 px-4 py-2 rounded-xl bg-[#0088CC]/15 hover:bg-[#0088CC]/25 text-[#32ADE6] text-xs font-semibold transition flex items-center gap-1.5 border border-[#0088CC]/30">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5" aria-hidden="true"></i>
              <span>Reset Filter</span>
            </button>
          </div>
        </td></tr>
      `;
      const pagWrap = document.getElementById('items-pagination-wrap');
      if (pagWrap) pagWrap.classList.add('hidden');
      const bulkBar = document.getElementById('bulk-bar');
      if (bulkBar) {
        bulkBar.classList.add('hidden');
        bulkBar.classList.remove('flex');
      }
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
      return;
    }

    const pagWrap = document.getElementById('items-pagination-wrap');
    if (pagWrap) pagWrap.classList.remove('hidden');

    // 3. Potong data sesuai pagination
    const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * pageSize;
    const pagedItems = filtered.slice(startIdx, startIdx + pageSize);

    pagedItems.forEach(function (item) {
      const stock = Number(item.stock) || 0;
      const minStock = Number(item.min_stock || item.minStock) || 0;
      const costPrice = Number(item.cost_price || item.costPrice) || 0;
      const sellPrice = Number(item.sell_price || item.sellPrice || item.unitPrice) || 0;
      const margin = sellPrice > 0 ? Math.round(((sellPrice - costPrice) / sellPrice) * 100) : 0;
      const isLow = stock <= minStock;
      const isChecked = selectedItemIds.has(item.id);

      const stockDisplay = isLow
        ? `<span class="font-semibold text-[#FF3B30] flex items-center justify-end gap-1">${stock} unit <i data-lucide="alert-triangle" class="w-3.5 h-3.5" aria-hidden="true"></i></span>`
        : `<span class="font-medium">${stock} unit</span>`;

      const formatRupiah = function (num) {
        return 'Rp ' + Number(num).toLocaleString('id-ID');
      };

      const tr = document.createElement('tr');
      tr.className = `table-row border-b border-white/5 transition ${isChecked ? 'bg-[#0088CC]/5' : ''}`;
      tr.innerHTML = `
        <td class="px-4 py-3.5">
          <input type="checkbox" aria-label="Pilih ${item.name}"
                 data-select-row
                 onchange="toggleItemSelect(${item.id}, this.checked)"
                 ${isChecked ? 'checked' : ''}
                 class="item-checkbox accent-[#0088CC] w-4 h-4 cursor-pointer">
        </td>
        <td class="px-4 py-3.5">
          ${item.image_url ? `
            <div class="w-16 h-16 md:w-10 md:h-10 rounded-xl md:rounded-lg overflow-hidden border border-white/10 bg-black/40 flex-shrink-0">
              <img src="${item.image_url}" alt="${item.name}" class="w-full h-full object-cover" loading="lazy">
            </div>
          ` : `
            <div class="w-16 h-16 md:w-10 md:h-10 rounded-xl md:rounded-lg bg-[#0088CC]/15 grid place-items-center flex-shrink-0">
              <i data-lucide="package" class="w-6 h-6 md:w-5 md:h-5 text-[#32ADE6]" aria-hidden="true"></i>
            </div>
          `}
        </td>
        <td class="px-4 py-3.5 font-medium">${item.name}</td>
        <td class="px-4 py-3.5 text-[#A0A0A5]">${item.brand || '-'}</td>
        <td class="px-4 py-3.5 text-[#A0A0A5] font-mono text-xs">${item.sku || '-'}</td>
        <td class="px-4 py-3.5"><span class="badge bg-[#0088CC]/15 text-[#32ADE6]">${item.category || 'Umum'}</span></td>
        <td class="px-4 py-3.5 text-right">${stockDisplay}</td>
        <td class="px-4 py-3.5 text-right">${formatRupiah(costPrice)}</td>
        <td class="px-4 py-3.5 text-right font-semibold">${formatRupiah(sellPrice)}</td>
        <td class="px-4 py-3.5 text-right text-[#34C759] font-semibold">${margin}%</td>
        <td class="px-4 py-3.5">
          <div class="flex gap-1 justify-end">
            <button type="button" data-action="edit" onclick="openEditItemModal(${item.id})" aria-label="Edit" class="p-1.5 hover:bg-white/5 rounded-lg text-[#32ADE6]">
              <i data-lucide="pencil" class="w-4 h-4" aria-hidden="true"></i>
            </button>
            <button type="button" data-action="delete" onclick="openDeleteItemModal(${item.id})" aria-label="Hapus" class="p-1.5 hover:bg-white/5 rounded-lg text-[#FF3B30]">
              <i data-lucide="trash-2" class="w-4 h-4" aria-hidden="true"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    renderPagination(totalFiltered);
    updateBulkBarUI();

    if (typeof window.syncTableLabels === 'function') {
      window.syncTableLabels();
    }
    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons();
    }
  }

  function handleSearchItems(val) {
    searchQuery = (val || '').trim();
    currentPage = 1;
    const pageSearch = document.getElementById('search-items');
    const globalSearch = document.getElementById('global-search');
    if (pageSearch && pageSearch.value !== val) pageSearch.value = val;
    if (globalSearch && globalSearch.value !== val) globalSearch.value = val;
    renderItemsTable();
  }

  function handleCategoryFilter(val) {
    selectedCategory = val;
    currentPage = 1;
    renderItemsTable();
  }

  function handleStockFilter(val) {
    selectedStockFilter = val;
    currentPage = 1;
    renderItemsTable();
  }

  function goToPage(p) {
    currentPage = p;
    renderItemsTable();
    const tableEl = document.querySelector('.card-table-wrap');
    if (tableEl) tableEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function resetFilters() {
    searchQuery = '';
    selectedCategory = 'all';
    selectedStockFilter = 'all';
    currentPage = 1;
    const searchInput = document.getElementById('search-items');
    if (searchInput) searchInput.value = '';
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) globalSearch.value = '';
    const catSelect = document.getElementById('filter-category');
    if (catSelect) catSelect.value = 'all';
    const stockSelect = document.getElementById('filter-stock');
    if (stockSelect) stockSelect.value = 'all';
    renderItemsTable();
  }

  // ═══════════════════════════════════════════════
  // BULK SELECTION (PERSIST ACROSS PAGES)
  // ═══════════════════════════════════════════════
  function toggleItemSelect(id, checked) {
    const numId = Number(id);
    if (checked) {
      selectedItemIds.add(numId);
    } else {
      selectedItemIds.delete(numId);
    }
    updateBulkBarUI();
  }

  function toggleSelectAllPage(checked) {
    const filtered = filterItems();
    const startIdx = (currentPage - 1) * pageSize;
    const pagedItems = filtered.slice(startIdx, startIdx + pageSize);

    pagedItems.forEach(item => {
      if (checked) {
        selectedItemIds.add(item.id);
      } else {
        selectedItemIds.delete(item.id);
      }
    });
    renderItemsTable();
  }

  function clearSelection() {
    selectedItemIds.clear();
    const headerCb = document.getElementById('select-all-header');
    if (headerCb) headerCb.checked = false;
    const bottomCb = document.getElementById('select-all-items');
    if (bottomCb) bottomCb.checked = false;
    renderItemsTable();
  }

  function updateBulkBarUI() {
    const count = selectedItemIds.size;
    const bulkBar = document.getElementById('bulk-bar');
    const bulkCountText = document.getElementById('bulk-count');
    const btnBulkPrice = document.getElementById('btn-bulk-price');
    const btnBulkDelete = document.getElementById('btn-bulk-delete');

    const filtered = filterItems();
    if (bulkBar && bulkCountText) {
      if (count > 0 && filtered.length > 0) {
        bulkBar.classList.remove('hidden');
        bulkBar.classList.add('flex');
        bulkCountText.textContent = `${count} dipilih`;
      } else {
        bulkBar.classList.add('hidden');
        bulkBar.classList.remove('flex');
        bulkCountText.textContent = `${count} dipilih`;
      }
    }

    if (btnBulkPrice) btnBulkPrice.disabled = count === 0;
    if (btnBulkDelete) btnBulkDelete.disabled = count === 0;

    // Periksa status centang select-all di halaman aktif
    const startIdx = (currentPage - 1) * pageSize;
    const pagedItems = filtered.slice(startIdx, startIdx + pageSize);
    const allPageSelected = pagedItems.length > 0 && pagedItems.every(i => selectedItemIds.has(i.id));

    const headerCb = document.getElementById('select-all-header');
    if (headerCb) headerCb.checked = allPageSelected;
    const bottomCb = document.getElementById('select-all-items');
    if (bottomCb) bottomCb.checked = allPageSelected;
  }

  // ═══════════════════════════════════════════════
  // BULK DELETE
  // ═══════════════════════════════════════════════
  async function openBulkDeleteModal() {
    if (selectedItemIds.size === 0) {
      if (typeof showToast === 'function') showToast('Pilih minimal 1 produk terlebih dahulu', 'info');
      return;
    }

    const modal = document.getElementById('modal-bulk-delete');
    const summaryEl = document.getElementById('bulk-delete-summary');
    const btnConfirm = document.getElementById('btn-confirm-bulk-delete');
    if (!modal || !summaryEl) return;

    summaryEl.innerHTML = '<div class="py-4 text-center text-[#A0A0A5]">Memeriksa keterkaitan transaksi...</div>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    try {
      const ids = Array.from(selectedItemIds);
      const checkRes = await Api.items.checkDeletable(ids);
      const { deletableIds, skippedIds } = checkRes.data || { deletableIds: [], skippedIds: [] };

      // Ambil nama barang yang dilewati
      const skippedItems = currentItems.filter(i => skippedIds.includes(i.id));

      let html = '';
      if (deletableIds.length > 0) {
        html += `<p class="text-white font-medium"><span class="text-[#FF3B30] font-bold">${deletableIds.length}</span> produk akan dihapus secara permanen.</p>`;
      }

      if (skippedIds.length > 0) {
        html += `
          <div class="p-3 rounded-xl bg-[#FF9500]/10 border border-[#FF9500]/20 text-[#FF9500] text-xs space-y-1 mt-2">
            <p class="font-bold flex items-center gap-1.5"><i data-lucide="alert-circle" class="w-4 h-4"></i> ${skippedIds.length} produk akan dilewati (memiliki riwayat transaksi):</p>
            <ul class="list-disc list-inside text-[11px] text-[#A0A0A5] pl-1 space-y-0.5 max-h-24 overflow-y-auto">
              ${skippedItems.map(i => `<li>${i.name} (${i.sku})</li>`).join('')}
            </ul>
          </div>
        `;
        console.warn('Produk yang dilewati saat Hapus Massal (berelasi ke transaksi):', skippedItems);
      }

      if (deletableIds.length === 0) {
        html = `
          <div class="p-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs">
            <p class="font-bold">Semua ${ids.length} produk yang dipilih memiliki transaksi dan tidak dapat dihapus.</p>
          </div>
        `;
        if (btnConfirm) btnConfirm.disabled = true;
      } else {
        if (btnConfirm) btnConfirm.disabled = false;
      }

      summaryEl.innerHTML = html;
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    } catch (e) {
      summaryEl.innerHTML = `<p class="text-[#FF3B30]">Gagal memeriksa transaksi: ${e.message}</p>`;
    }
  }

  function closeBulkDeleteModal() {
    const modal = document.getElementById('modal-bulk-delete');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  async function executeBulkDelete() {
    const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
    if (role === 'VIEWER') {
      alert('Anda tidak punya akses untuk mengubah data.');
      return;
    }

    const btn = document.getElementById('btn-confirm-bulk-delete');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Menghapus...</span>';

    try {
      const ids = Array.from(selectedItemIds);
      const res = await Api.items.bulkDelete(ids);

      if (!res.ok) {
        if (typeof showToast === 'function') showToast(res.error?.message || 'Gagal menghapus massal', 'error');
        return;
      }

      const { deletedCount, skippedCount, skippedIds } = res.data;
      if (skippedCount > 0) {
        console.warn('Produk dilewati karena FK transactions:', skippedIds);
        if (typeof showToast === 'function') {
          showToast(`${deletedCount} berhasil, ${skippedCount} dilewati (memiliki transaksi)`, 'info');
        }
      } else {
        if (typeof showToast === 'function') {
          showToast(`${deletedCount} produk berhasil dihapus`, 'success');
        }
      }

      closeBulkDeleteModal();
      clearSelection();
      await loadItemsFromBackend();
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  }

  // ═══════════════════════════════════════════════
  // BULK EDIT HARGA
  // ═══════════════════════════════════════════════
  function openBulkPriceModal() {
    if (selectedItemIds.size === 0) {
      if (typeof showToast === 'function') showToast('Pilih minimal 1 produk terlebih dahulu', 'info');
      return;
    }

    const modal = document.getElementById('modal-bulk-price');
    if (!modal) return;

    bulkPriceMode = 'nominal';
    switchBulkPriceTab('nominal');
    document.getElementById('bulk-price-nominal-input').value = '';
    document.getElementById('bulk-price-percent-input').value = '';

    updateBulkPricePreview();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function closeBulkPriceModal() {
    const modal = document.getElementById('modal-bulk-price');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function switchBulkPriceTab(mode) {
    bulkPriceMode = mode;
    const tabNominal = document.getElementById('tab-bulk-nominal');
    const tabPercent = document.getElementById('tab-bulk-percent');
    const secNominal = document.getElementById('bulk-price-nominal-section');
    const secPercent = document.getElementById('bulk-price-percent-section');

    if (mode === 'nominal') {
      tabNominal.className = 'flex-1 py-2 text-xs font-semibold rounded-lg bg-[#0088CC] text-white transition';
      tabPercent.className = 'flex-1 py-2 text-xs font-medium rounded-lg text-[#A0A0A5] hover:text-white transition';
      secNominal.classList.remove('hidden');
      secPercent.classList.add('hidden');
    } else {
      tabPercent.className = 'flex-1 py-2 text-xs font-semibold rounded-lg bg-[#0088CC] text-white transition';
      tabNominal.className = 'flex-1 py-2 text-xs font-medium rounded-lg text-[#A0A0A5] hover:text-white transition';
      secPercent.classList.remove('hidden');
      secNominal.classList.add('hidden');
    }
    updateBulkPricePreview();
  }

  function updateBulkPricePreview() {
    const tbody = document.getElementById('bulk-price-preview-body');
    if (!tbody) return;

    const selectedItems = currentItems.filter(i => selectedItemIds.has(i.id));
    const nominalVal = Number(document.getElementById('bulk-price-nominal-input')?.value);
    const percentVal = Number(document.getElementById('bulk-price-percent-input')?.value);

    tbody.innerHTML = selectedItems.map(item => {
      const oldPrice = Number(item.sell_price || item.sellPrice || item.unitPrice) || 0;
      let newPrice = oldPrice;

      if (bulkPriceMode === 'nominal') {
        if (!isNaN(nominalVal) && nominalVal > 0) {
          newPrice = nominalVal;
        }
      } else {
        if (!isNaN(percentVal) && percentVal !== 0) {
          newPrice = Math.max(0, Math.round(oldPrice * (1 + (percentVal / 100))));
        }
      }

      const formatRp = n => 'Rp ' + Number(n).toLocaleString('id-ID');
      const isChanged = newPrice !== oldPrice;

      return `
        <tr class="hover:bg-white/[0.02]">
          <td class="py-2 px-2 text-white font-medium">${item.name}</td>
          <td class="py-2 px-2 text-right text-[#A0A0A5]">${formatRp(oldPrice)}</td>
          <td class="py-2 px-2 text-center text-[#A0A0A5]">&rarr;</td>
          <td class="py-2 px-2 text-right font-bold ${isChanged ? 'text-[#34C759]' : 'text-white'}">
            ${formatRp(newPrice)}
          </td>
        </tr>
      `;
    }).join('');
  }

  async function executeBulkPriceUpdate() {
    const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
    if (role === 'VIEWER') {
      alert('Anda tidak punya akses untuk mengubah data.');
      return;
    }

    const selectedItems = currentItems.filter(i => selectedItemIds.has(i.id));
    if (selectedItems.length === 0) return;

    const nominalVal = Number(document.getElementById('bulk-price-nominal-input')?.value);
    const percentVal = Number(document.getElementById('bulk-price-percent-input')?.value);

    const updates = [];
    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      const oldPrice = Number(item.sell_price || item.sellPrice || item.unitPrice) || 0;
      let newPrice = oldPrice;

      if (bulkPriceMode === 'nominal') {
        if (isNaN(nominalVal) || nominalVal < 0) {
          if (typeof showToast === 'function') showToast('Harga jual harus berupa angka >= 0', 'error');
          return;
        }
        newPrice = nominalVal;
      } else {
        if (isNaN(percentVal)) {
          if (typeof showToast === 'function') showToast('Persentase tidak valid', 'error');
          return;
        }
        newPrice = Math.max(0, Math.round(oldPrice * (1 + (percentVal / 100))));
      }

      if (newPrice < 0) {
        if (typeof showToast === 'function') showToast('Harga baru tidak boleh kurang dari 0', 'error');
        return;
      }
      updates.push({ id: item.id, sell_price: newPrice });
    }

    const btn = document.getElementById('btn-save-bulk-price');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Menyimpan...</span>';

    try {
      const res = await Api.items.bulkUpdatePrice(updates);
      if (!res.ok) {
        if (typeof showToast === 'function') showToast(res.error?.message || 'Gagal memperbarui harga massal', 'error');
        return;
      }

      if (typeof showToast === 'function') {
        showToast(`${res.data.updatedCount} produk berhasil diperbarui harganya`, 'success');
      }
      closeBulkPriceModal();
      clearSelection();
      await loadItemsFromBackend();
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  }

  // ═══════════════════════════════════════════════
  // REFRESH & EXPORT CSV
  // ═══════════════════════════════════════════════
  async function handleRefreshItems() {
    const btn1 = document.getElementById('btn-refresh-items');
    const btn2 = document.getElementById('btn-refresh-items-toolbar');
    const icon1 = btn1 ? btn1.querySelector('i') : null;
    const icon2 = btn2 ? btn2.querySelector('i') : null;
    if (icon1) icon1.classList.add('animate-spin');
    if (icon2) icon2.classList.add('animate-spin');

    try {
      await loadItemsFromBackend();
      if (typeof showToast === 'function') showToast('Data berhasil di-refresh', 'success');
    } catch (err) {
      console.error('Refresh items error:', err);
      if (typeof showToast === 'function') showToast('Gagal memuat ulang data', 'error');
    } finally {
      if (icon1) icon1.classList.remove('animate-spin');
      if (icon2) icon2.classList.remove('animate-spin');
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    }
  }

  function handleExportItems() {
    const filtered = filterItems();
    if (!filtered || filtered.length === 0) {
      if (typeof showToast === 'function') showToast('Tidak ada data produk untuk diekspor', 'info');
      return;
    }

    const headers = ['ID', 'SKU', 'Nama Barang', 'Brand', 'Kategori', 'Stok', 'Min Stok', 'Harga Beli (Rp)', 'Harga Jual (Rp)', 'Margin (%)'];
    const rows = filtered.map(item => {
      const s = Number(item.stock) || 0;
      const min = Number(item.min_stock || item.minStock) || 0;
      const c = Number(item.cost_price || item.costPrice) || 0;
      const p = Number(item.sell_price || item.sellPrice || item.unitPrice) || 0;
      const m = p > 0 ? Math.round(((p - c) / p) * 100) : 0;
      return [item.id, item.sku || '-', item.name, item.brand || '-', item.category || 'Umum', s, min, c, p, m];
    });

    const filename = `items-${new Date().toISOString().slice(0, 10)}.csv`;
    if (typeof exportToCSV === 'function') {
      exportToCSV(filename, rows, headers);
    }
  }

  // ═══════════════════════════════════════════════
  // LOAD FROM BACKEND
  // ═══════════════════════════════════════════════
  async function loadItemsFromBackend() {
    if (typeof Api === 'undefined') return;

    try {
      const res = await Api.items.getAll();
      if (!res.ok) {
        console.error('Gagal mengambil data produk:', res.error);
        if (typeof showToast === 'function') {
          showToast(res.error?.message || 'Gagal mengambil data produk dari database', 'error');
        }
        return;
      }

      currentItems = res.data || [];

      // Update badge di sidebar
      const badge = document.querySelector('.menu-item[data-page="items"] span');
      if (badge) {
        badge.textContent = currentItems.length;
      }

      // Bersihkan ID terpilih yang sudah tidak ada di data
      const existingIdSet = new Set(currentItems.map(i => i.id));
      selectedItemIds.forEach(id => {
        if (!existingIdSet.has(id)) selectedItemIds.delete(id);
      });

      renderItemsTable();
    } catch (err) {
      console.error('Error saat memuat produk:', err);
    }
  }

  // Ekspos fungsi ke global window
  window.openAddItemModal = openAddItemModal;
  window.openEditItemModal = openEditItemModal;
  window.closeItemModal = closeItemModal;
  window.handleItemSubmit = handleItemSubmit;
  window.handleImageSelection = handleImageSelection;
  window.removeSelectedPhoto = removeSelectedPhoto;
  window.openDeleteItemModal = openDeleteItemModal;
  window.closeDeleteModal = closeDeleteModal;
  window.confirmDeleteItem = confirmDeleteItem;
  window.loadItemsFromBackend = loadItemsFromBackend;

  // Fitur Fase 4.8
  window.handleSearchItems = handleSearchItems;
  window.handleCategoryFilter = handleCategoryFilter;
  window.handleStockFilter = handleStockFilter;
  window.goToPage = goToPage;
  window.resetFilters = resetFilters;
  window.toggleItemSelect = toggleItemSelect;
  window.toggleSelectAllPage = toggleSelectAllPage;
  window.clearSelection = clearSelection;
  window.openBulkDeleteModal = openBulkDeleteModal;
  window.closeBulkDeleteModal = closeBulkDeleteModal;
  window.executeBulkDelete = executeBulkDelete;
  window.openBulkPriceModal = openBulkPriceModal;
  window.closeBulkPriceModal = closeBulkPriceModal;
  window.switchBulkPriceTab = switchBulkPriceTab;
  window.updateBulkPricePreview = updateBulkPricePreview;
  window.executeBulkPriceUpdate = executeBulkPriceUpdate;
  window.handleRefreshItems = handleRefreshItems;
  window.handleExportItems = handleExportItems;

  // Tutup modal saat klik pada backdrop atau tekan Escape
  window.addEventListener('click', function (e) {
    const modalItem = document.getElementById('modal-item');
    const modalDelete = document.getElementById('modal-delete');
    const modalBulkDel = document.getElementById('modal-bulk-delete');
    const modalBulkPrice = document.getElementById('modal-bulk-price');
    if (e.target === modalItem) closeItemModal();
    if (e.target === modalDelete) closeDeleteModal();
    if (e.target === modalBulkDel) closeBulkDeleteModal();
    if (e.target === modalBulkPrice) closeBulkPriceModal();
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeItemModal();
      closeDeleteModal();
      closeBulkDeleteModal();
      closeBulkPriceModal();
    }
  });

  function setupSearchListeners() {
    const pageSearch = document.getElementById('search-items');
    const globalSearch = document.getElementById('global-search');

    if (pageSearch) {
      pageSearch.addEventListener('input', function (e) {
        handleSearchItems(e.target.value);
      });
    }
    if (globalSearch) {
      globalSearch.addEventListener('input', function (e) {
        handleSearchItems(e.target.value);
      });
    }
  }

  async function initItems() {
    setupSearchListeners();
    let retries = 0;
    while (typeof window.supabase === 'undefined' && retries < 20) {
      await new Promise(r => setTimeout(r, 50));
      retries++;
    }
    await loadCategories();
    await loadItemsFromBackend();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initItems);
  } else {
    initItems();
  }
