  let allInTransactions = [];
  let availableProducts = [];
  let productsLoaded = false;
  let currentFilterPeriod = 'today';
  let searchQuery = '';
  let currentPage = 1;
  const pageSize = 10;
  let deleteInId = null;

  function formatRupiahVal(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  }

  function formatShortRupiah(val) {
    if (!val || val === 0) return 'Rp 0';
    if (val >= 1000000) return 'Rp ' + (val / 1000000).toFixed(1).replace('.0', '') + 'jt';
    if (val >= 1000) return 'Rp ' + (val / 1000).toFixed(0) + 'rb';
    return 'Rp ' + val;
  }

  function formatTxDate(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    const day = d.getDate();
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const m = months[d.getMonth()];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${m} ${hh}:${mm}`;
  }

  function resolveProductName(tx) {
    if (tx.products && tx.products.name) return tx.products.name;
    if (availableProducts && availableProducts.length > 0) {
      const found = availableProducts.find(p => String(p.id) === String(tx.product_id));
      if (found && found.name) return found.name;
    }
    return 'Produk #' + (tx.product_id || '-');
  }

  let categoriesData = [];
  let unitsData = [];
  let selectedExistingProduct = null;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function loadDropdowns() {
    try {
      const prodRes = await Api.items.getAll();
      if (prodRes && prodRes.ok) {
        availableProducts = prodRes.data || [];
        productsLoaded = true;
        const prodSelect = document.getElementById('in-product-id');
        if (prodSelect && prodSelect.tagName === 'SELECT') {
          prodSelect.innerHTML = '<option value="">Pilih Produk</option>';
          availableProducts.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            prodSelect.appendChild(opt);
          });
        }
      }

      const supRes = await Api.suppliers.getAll();
      if (supRes && supRes.ok) {
        const supSelect = document.getElementById('in-supplier-id');
        if (supSelect) {
          const currentSupVal = supSelect.value;
          supSelect.innerHTML = '<option value="">Umum / Tanpa Supplier</option>';
          (supRes.data || []).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            supSelect.appendChild(opt);
          });
          if (currentSupVal) supSelect.value = currentSupVal;
        }
      }

      // Load categories & units for new product registration
      if (typeof window.supabase !== 'undefined') {
        const [catRes, unitRes] = await Promise.all([
          window.supabase.from('categories').select('id, name').order('name'),
          window.supabase.from('units').select('id, name').order('name')
        ]);
        if (catRes.data) {
          categoriesData = catRes.data;
          const catSel = document.getElementById('in-category-id');
          if (catSel) {
            catSel.innerHTML = '<option value="">Umum (Tanpa Kategori)</option>';
            categoriesData.forEach(c => {
              const opt = document.createElement('option');
              opt.value = c.id;
              opt.textContent = c.name;
              catSel.appendChild(opt);
            });
          }
        }
        if (unitRes.data) {
          unitsData = unitRes.data;
          const unitSel = document.getElementById('in-unit-id');
          if (unitSel) {
            unitSel.innerHTML = '';
            unitsData.forEach(u => {
              const opt = document.createElement('option');
              opt.value = u.id;
              opt.textContent = u.name;
              unitSel.appendChild(opt);
            });
          }
        }
      }
    } catch (err) {
      console.error('Error loading dropdowns:', err);
    }
  }

  function handleProductSearchInput(e) {
    const query = (e.target.value || '').trim();
    const suggestionsEl = document.getElementById('in-product-suggestions');
    if (!suggestionsEl) return;

    if (!query) {
      suggestionsEl.classList.add('hidden');
      suggestionsEl.innerHTML = '';
      return;
    }

    const q = query.toLowerCase();
    const matches = availableProducts.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 8);

    let html = '';
    matches.forEach(p => {
      html += `
        <button type="button" class="w-full text-left px-3.5 py-2.5 hover:bg-white/10 flex items-center justify-between text-sm transition" onclick="selectInProduct(${p.id})">
          <div>
            <div class="font-medium text-white">${escapeHtml(p.name)}</div>
            <div class="text-xs text-[#A0A0A5]">${p.sku ? escapeHtml(p.sku) + ' • ' : ''}${escapeHtml(p.category || 'Umum')}</div>
          </div>
          <div class="text-right">
            <div class="text-xs font-semibold text-[#34C759]">Stok: ${p.stock ?? 0} ${escapeHtml(p.unit || 'pcs')}</div>
            <div class="text-[11px] text-[#A0A0A5]">${formatRupiahVal(p.cost_price || 0)}</div>
          </div>
        </button>
      `;
    });

    html += `
      <button type="button" class="w-full text-left px-3.5 py-2.5 bg-[#0088CC]/10 hover:bg-[#0088CC]/20 text-[#32ADE6] text-xs font-semibold flex items-center gap-2 transition" onclick="selectNewProduct('${escapeHtml(query)}')">
        <i data-lucide="plus-circle" class="w-4 h-4"></i>
        <span>Daftarkan "<strong>${escapeHtml(query)}</strong>" sebagai produk baru</span>
      </button>
    `;

    suggestionsEl.innerHTML = html;
    suggestionsEl.classList.remove('hidden');
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function selectInProduct(productId) {
    const prod = availableProducts.find(p => String(p.id) === String(productId));
    if (!prod) return;

    selectedExistingProduct = prod;
    const prodInput = document.getElementById('in-product-id');
    if (prodInput) {
      if (prodInput.tagName === 'SELECT' && !prodInput.querySelector(`option[value="${prod.id}"]`)) {
        const opt = document.createElement('option');
        opt.value = prod.id;
        opt.textContent = prod.name;
        prodInput.appendChild(opt);
      }
      prodInput.value = String(prod.id);
      prodInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const searchInput = document.getElementById('in-product-search');
    if (searchInput) {
      searchInput.value = prod.name;
      searchInput.readOnly = true;
    }
    const clearBtn = document.getElementById('in-clear-product');
    if (clearBtn) clearBtn.classList.remove('hidden');

    const badge = document.getElementById('in-product-badge');
    if (badge) {
      badge.textContent = `✓ Terdaftar (Stok: ${prod.stock ?? 0} ${prod.unit || 'pcs'})`;
      badge.className = 'text-[11px] font-medium text-[#34C759]';
    }

    const priceInput = document.getElementById('in-price');
    if (priceInput) priceInput.value = String(prod.cost_price || 0);

    const barcodeInput = document.getElementById('in-barcode');
    if (barcodeInput && prod.barcode) barcodeInput.value = prod.barcode;

    const newFields = document.getElementById('in-new-product-fields');
    if (newFields) newFields.classList.add('hidden');

    const suggestionsEl = document.getElementById('in-product-suggestions');
    if (suggestionsEl) {
      suggestionsEl.classList.add('hidden');
      suggestionsEl.innerHTML = '';
    }

    calculateInTotal();
    document.getElementById('in-qty')?.focus();
  }

  function handleInProductChange() {
    const select = document.getElementById('in-product-id');
    const pId = select?.value;
    const prod = availableProducts.find(p => String(p.id) === String(pId));
    const priceInput = document.getElementById('in-price');
    if (prod && priceInput) {
      priceInput.value = String(prod.cost_price || 0);
    }
    calculateInTotal();
  }

  function selectNewProduct(name) {
    selectedExistingProduct = null;
    const prodInput = document.getElementById('in-product-id');
    if (prodInput) {
      prodInput.value = '';
      prodInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const searchInput = document.getElementById('in-product-search');
    if (searchInput) {
      searchInput.value = name || searchInput.value;
      searchInput.readOnly = false;
    }
    const clearBtn = document.getElementById('in-clear-product');
    if (clearBtn) clearBtn.classList.remove('hidden');

    const badge = document.getElementById('in-product-badge');
    if (badge) {
      badge.textContent = '✨ Produk Baru (Akan didaftarkan)';
      badge.className = 'text-[11px] font-medium text-[#32ADE6]';
    }

    const newFields = document.getElementById('in-new-product-fields');
    if (newFields) newFields.classList.remove('hidden');

    const suggestionsEl = document.getElementById('in-product-suggestions');
    if (suggestionsEl) {
      suggestionsEl.classList.add('hidden');
      suggestionsEl.innerHTML = '';
    }

    autoUpdateInSkuPlaceholder();
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    document.getElementById('in-price')?.focus();
  }

  function clearInProductSelection() {
    selectedExistingProduct = null;
    const prodInput = document.getElementById('in-product-id');
    if (prodInput) {
      prodInput.value = '';
      prodInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const searchInput = document.getElementById('in-product-search');
    if (searchInput) {
      searchInput.value = '';
      searchInput.readOnly = false;
      searchInput.focus();
    }
    const clearBtn = document.getElementById('in-clear-product');
    if (clearBtn) clearBtn.classList.add('hidden');

    const badge = document.getElementById('in-product-badge');
    if (badge) {
      badge.textContent = '';
      badge.className = 'text-[11px] font-medium text-[#A0A0A5]';
    }

    const brandInput = document.getElementById('in-brand');
    if (brandInput) brandInput.value = '';
    const skuInput = document.getElementById('in-sku');
    if (skuInput) {
      skuInput.value = '';
      skuInput.placeholder = 'Otomatis jika kosong';
    }

    const newFields = document.getElementById('in-new-product-fields');
    if (newFields) newFields.classList.add('hidden');

    const suggestionsEl = document.getElementById('in-product-suggestions');
    if (suggestionsEl) {
      suggestionsEl.classList.add('hidden');
      suggestionsEl.innerHTML = '';
    }
  }

  function getLastProductSequence() {
    let maxSeq = 0;
    if (Array.isArray(availableProducts)) {
      for (const p of availableProducts) {
        if (p.id && Number(p.id) > maxSeq) {
          maxSeq = Number(p.id);
        }
        if (p.sku) {
          const match = String(p.sku).match(/(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        }
      }
    }
    return maxSeq;
  }

  function getInGeneratedSku() {
    const catSelect = document.getElementById('in-category-id');
    const catName = catSelect && catSelect.selectedIndex >= 0 && catSelect.value ? catSelect.options[catSelect.selectedIndex].text : '';
    const brand = document.getElementById('in-brand')?.value.trim() || '';
    const lastId = getLastProductSequence();
    if (typeof generateSKU === 'function') {
      return generateSKU(catName, brand, lastId);
    } else if (typeof window.generateSKU === 'function') {
      return window.generateSKU(catName, brand, lastId);
    }
    return '';
  }

  function autoUpdateInSkuPlaceholder() {
    const skuInput = document.getElementById('in-sku');
    if (!skuInput) return;
    const genSku = getInGeneratedSku();
    if (genSku) {
      skuInput.placeholder = `Otomatis: ${genSku}`;
    } else {
      skuInput.placeholder = 'Otomatis jika kosong';
    }
  }

  function applyInAutoSku() {
    const skuInput = document.getElementById('in-sku');
    if (!skuInput) return;
    const genSku = getInGeneratedSku();
    if (genSku) {
      skuInput.value = genSku;
    }
  }

  async function handleInBarcodeLookup(scannedBarcode) {
    const input = document.getElementById('in-barcode');
    const status = document.getElementById('in-barcode-status');
    const select = document.getElementById('in-product-id');
    const barcode = String(scannedBarcode ?? input?.value ?? '').trim();
    if (!input) return;
    if (!barcode) {
      if (status) status.textContent = '';
      return;
    }

    input.value = barcode;
    if (!productsLoaded) await loadDropdowns();

    const product = availableProducts.find(p => String(p.barcode || '').trim() === barcode);
    if (!product) {
      if (select) {
        select.value = '';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const priceInput = document.getElementById('in-price');
      if (priceInput) priceInput.value = '0';
      calculateInTotal();

      const searchInput = document.getElementById('in-product-search');
      if (searchInput) {
        selectNewProduct('');
      }

      if (status) status.textContent = 'Barcode tidak ditemukan. Pastikan produk dan barcode sudah terdaftar.';
      if (typeof showToast === 'function') {
        showToast('Produk dengan barcode tersebut tidak ditemukan', 'error');
      }
      return;
    }

    selectInProduct(product.id);
    if (status) status.textContent = `Produk dipilih: ${product.name}`;
    if (typeof showToast === 'function') showToast(`Produk "${product.name}" berhasil dipilih`, 'success');
    document.getElementById('in-qty')?.focus();
  }

  function calculateInTotal() {
    const qty = Number(document.getElementById('in-qty')?.value || 0);
    const price = Number(document.getElementById('in-price')?.value || 0);
    const total = qty * price;
    const preview = document.getElementById('in-total-preview');
    if (preview) {
      preview.textContent = formatRupiahVal(total);
    }
  }

  function openAddInModal() {
    const form = document.getElementById('form-in');
    if (form) form.reset();
    clearInProductSelection();
    calculateInTotal();
    loadDropdowns();
    const modal = document.getElementById('modal-in');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    setTimeout(() => {
      document.getElementById('in-product-search')?.focus();
    }, 50);
  }

  function closeInModal() {
    clearInProductSelection();
    const modal = document.getElementById('modal-in');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function openDeleteInModal(id) {
    deleteInId = id;
    const modal = document.getElementById('modal-delete-in');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function closeDeleteInModal() {
    deleteInId = null;
    const modal = document.getElementById('modal-delete-in');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  async function handleInSubmit(e) {
    e.preventDefault();
    const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
    if (role === 'VIEWER') {
      alert('Anda tidak punya akses untuk mengubah data.');
      return;
    }
    let productId = document.getElementById('in-product-id').value;
    const productName = document.getElementById('in-product-search')?.value.trim() || '';
    const supplierId = document.getElementById('in-supplier-id').value;
    const qty = Number(document.getElementById('in-qty').value);
    const price = Number(document.getElementById('in-price').value);
    const note = document.getElementById('in-note').value.trim();

    if (!productName) {
      if (typeof showToast === 'function') showToast('Masukkan nama produk terlebih dahulu', 'error');
      document.getElementById('in-product-search')?.focus();
      return;
    }
    if (!qty || qty <= 0) {
      if (typeof showToast === 'function') showToast('Jumlah masuk harus lebih dari 0', 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-in');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Menyimpan...</span>';

    try {
      let currentUserId = null;
      if (typeof window.Auth !== 'undefined') {
        const user = await window.Auth.getCurrentUser();
        currentUserId = user?.id || null;
      }

      // Jika belum ada productId, berarti ini PRODUK BARU!
      if (!productId) {
        const categoryId = document.getElementById('in-category-id')?.value || null;
        const unitId = document.getElementById('in-unit-id')?.value || 1;
        const sellPrice = Number(document.getElementById('in-sell-price')?.value || 0);
        const barcodeVal = document.getElementById('in-barcode')?.value.trim() || null;
        const brandVal = document.getElementById('in-brand')?.value.trim() || 'Lokal';
        let skuVal = document.getElementById('in-sku')?.value.trim();
        if (!skuVal) {
          const catSelect = document.getElementById('in-category-id');
          const categoryName = (catSelect && catSelect.selectedIndex >= 0 && catSelect.value) ? catSelect.options[catSelect.selectedIndex].text : '';
          const lastId = getLastProductSequence();
          if (typeof generateSKU === 'function') {
            skuVal = generateSKU(categoryName, brandVal, lastId);
          } else if (typeof window.generateSKU === 'function') {
            skuVal = window.generateSKU(categoryName, brandVal, lastId);
          } else {
            skuVal = 'PRD-' + Date.now().toString().slice(-6);
          }
        }

        const createRes = await Api.items.create({
          name: productName,
          brand: brandVal,
          sku: skuVal,
          barcode: barcodeVal,
          category_id: categoryId ? Number(categoryId) : null,
          unit_id: Number(unitId),
          cost_price: price,
          sell_price: sellPrice,
          stock: 0,
          min_stock: 3
        });

        if (!createRes.ok || !createRes.data) {
          throw new Error(createRes.error?.message || 'Gagal mendaftarkan produk baru');
        }

        productId = createRes.data.id;
      }

      const res = await Api.transactions.createIn({
        product_id: productId,
        supplier_id: supplierId || null,
        qty: qty,
        price: price,
        note: note || null,
        created_by: currentUserId
      });

      if (!res.ok) {
        throw new Error(res.error?.message || 'Gagal menyimpan barang masuk');
      }

      if (typeof showToast === 'function') {
        showToast('Barang masuk berhasil dicatat! Stok diperbarui.', 'success');
      }
      closeInModal();
      await loadInTransactions();
      await loadDropdowns();
    } catch (err) {
      console.error('Submit in error:', err);
      if (typeof showToast === 'function') {
        showToast(err.message || 'Terjadi kesalahan saat menyimpan', 'error');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    }
  }

  async function confirmDeleteIn() {
    if (!deleteInId) return;
    const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
    if (role === 'VIEWER') {
      alert('Anda tidak punya akses untuk mengubah data.');
      return;
    }
    const btn = document.getElementById('btn-confirm-delete-in');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Menghapus...</span>';

    try {
      const res = await Api.transactions.delete(deleteInId);
      if (!res.ok) {
        throw new Error(res.error?.message || 'Gagal menghapus transaksi');
      }
      if (typeof showToast === 'function') {
        showToast('Transaksi berhasil dihapus & stok disesuaikan', 'success');
      }
      closeDeleteInModal();
      await loadInTransactions();
      await loadDropdowns();
    } catch (err) {
      console.error('Delete error:', err);
      if (typeof showToast === 'function') {
        showToast(err.message || 'Gagal menghapus transaksi', 'error');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    }
  }

  function updateMetrics(list) {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    let todayCount = 0, todayAmount = 0;
    let sevenCount = 0, sevenAmount = 0;
    let thirtyCount = 0, thirtyAmount = 0;
    let totalCount = 0, totalAmount = 0;

    list.forEach(tx => {
      const tTime = new Date(tx.created_at).getTime();
      const qty = tx.qty || 0;
      const amount = (tx.qty || 0) * (tx.price || 0);

      totalCount += qty;
      totalAmount += amount;

      if (tTime >= startToday) {
        todayCount += qty;
        todayAmount += amount;
      }
      if (tTime >= sevenDaysAgo) {
        sevenCount += qty;
        sevenAmount += amount;
      }
      if (tTime >= thirtyDaysAgo) {
        thirtyCount += qty;
        thirtyAmount += amount;
      }
    });

    const elTodayCount = document.getElementById('stat-in-today-count');
    const elTodayAmount = document.getElementById('stat-in-today-amount');
    const el7dCount = document.getElementById('stat-in-7d-count');
    const el7dAmount = document.getElementById('stat-in-7d-amount');
    const el30dCount = document.getElementById('stat-in-30d-count');
    const el30dAmount = document.getElementById('stat-in-30d-amount');
    const elTotalCount = document.getElementById('stat-in-total-count');
    const elTotalAmount = document.getElementById('stat-in-total-amount');

    if (elTodayCount) elTodayCount.textContent = `+${todayCount}`;
    if (elTodayAmount) elTodayAmount.textContent = formatShortRupiah(todayAmount);
    if (el7dCount) el7dCount.textContent = `+${sevenCount}`;
    if (el7dAmount) el7dAmount.textContent = formatShortRupiah(sevenAmount);
    if (el30dCount) el30dCount.textContent = `+${thirtyCount}`;
    if (el30dAmount) el30dAmount.textContent = formatShortRupiah(thirtyAmount);
    if (elTotalCount) elTotalCount.textContent = `${totalCount}`;
    if (elTotalAmount) elTotalAmount.textContent = formatShortRupiah(totalAmount);
  }

  function filterInPeriod(period) {
    currentFilterPeriod = period;
    currentPage = 1;
    const buttons = document.querySelectorAll('.in-period-btn');
    buttons.forEach(btn => {
      if (btn.getAttribute('data-period') === period) {
        btn.classList.add('active', 'bg-[#0088CC]', 'text-white');
        btn.classList.remove('bg-[#1C1C1E]', 'border', 'border-white/5');
      } else {
        btn.classList.remove('active', 'bg-[#0088CC]', 'text-white');
        btn.classList.add('bg-[#1C1C1E]', 'border', 'border-white/5');
      }
    });
    renderInTable();
  }

  function handleSearchIn(val) {
    searchQuery = (val || '').trim().toLowerCase();
    currentPage = 1;
    const pageSearch = document.getElementById('search-in');
    const globalSearch = document.getElementById('global-search');
    if (pageSearch && pageSearch.value !== val) pageSearch.value = val;
    if (globalSearch && globalSearch.value !== val) globalSearch.value = val;
    renderInTable();
  }

  function goToInPage(page) {
    currentPage = page;
    renderInTable();
  }

  function renderInPagination(totalFiltered) {
    const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(currentPage * pageSize, totalFiltered);

    const infoEl = document.getElementById('in-pagination-info');
    if (infoEl) {
      infoEl.textContent = `Menampilkan ${startIdx}-${endIdx} dari ${totalFiltered} data`;
    }

    const btnContainer = document.getElementById('in-pagination-buttons');
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
    prevBtn.onclick = () => goToInPage(currentPage - 1);
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
      pageBtn.onclick = () => goToInPage(p);
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
    nextBtn.onclick = () => goToInPage(currentPage + 1);
    nextBtn.innerHTML = '<i data-lucide="chevron-right" class="w-4 h-4" aria-hidden="true"></i>';
    btnContainer.appendChild(nextBtn);

    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function renderInTable() {
    const tbody = document.getElementById('in-tbody');
    if (!tbody) return;

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const filtered = allInTransactions.filter(tx => {
      const tTime = new Date(tx.created_at).getTime();
      if (currentFilterPeriod === 'today' && tTime < startToday) return false;
      if (currentFilterPeriod === '7d' && tTime < sevenDaysAgo) return false;
      if (currentFilterPeriod === '30d' && tTime < thirtyDaysAgo) return false;

      if (searchQuery) {
        const code = `IN-${String(tx.id).padStart(6, '0')}`.toLowerCase();
        const prodName = resolveProductName(tx).toLowerCase();
        const supName = (tx.suppliers?.name || 'umum').toLowerCase();
        const kasir = (tx.created_by || '').toLowerCase();
        const note = (tx.note || tx.notes || '').toLowerCase();
        if (!code.includes(searchQuery) &&
            !prodName.includes(searchQuery) &&
            !supName.includes(searchQuery) &&
            !kasir.includes(searchQuery) &&
            !note.includes(searchQuery)) {
          return false;
        }
      }
      return true;
    });

    renderInPagination(filtered.length);

    const pagWrap = document.getElementById('in-pagination-wrap');
    if (filtered.length === 0) {
      if (pagWrap) pagWrap.classList.add('hidden');
      const emptyText = searchQuery
        ? 'Tidak ada data barang masuk yang cocok dengan pencarian / filter'
        : (currentFilterPeriod === 'today' && allInTransactions.length > 0)
          ? `Belum ada transaksi barang masuk hari ini (Ada ${allInTransactions.length} transaksi di periode lainnya. Klik tab filter 'Semua' untuk melihat).`
          : 'Belum ada transaksi barang masuk pada periode ini';
      tbody.innerHTML = `
        <tr class="empty-state-row table-row">
          <td colspan="9" class="empty-state-cell px-4 py-12 text-center text-[#A0A0A5]">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-center">
              <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-1">
                <i data-lucide="package-search" class="w-6 h-6 text-[#A0A0A5]/60"></i>
              </div>
              <p class="text-sm font-semibold text-white">${emptyText}</p>
            </div>
          </td>
        </tr>
      `;
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
      if (typeof window.syncTableLabels === 'function') window.syncTableLabels();
      return;
    }

    if (pagWrap) pagWrap.classList.remove('hidden');

    const startIdx = (currentPage - 1) * pageSize;
    const paged = filtered.slice(startIdx, startIdx + pageSize);

    tbody.innerHTML = paged.map(tx => {
      const code = `IN-${String(tx.id).padStart(6, '0')}`;
      const dateStr = formatTxDate(tx.created_at);
      const prodName = resolveProductName(tx);
      const supName = tx.suppliers?.name || 'Umum';
      const kasir = (typeof window.resolveUserName === 'function')
        ? window.resolveUserName(tx.created_by)
        : (tx.created_by && !tx.created_by.includes('-') ? tx.created_by : 'Kasir');
      const qty = tx.qty || 0;
      const price = tx.price || 0;
      const total = qty * price;

      return `
        <tr class="table-row border-b border-white/5">
          <td class="px-4 py-3.5 font-mono text-xs text-[#A0A0A5]">${code}</td>
          <td class="px-4 py-3.5 text-[#A0A0A5]">${dateStr}</td>
          <td class="px-4 py-3.5 font-medium">${prodName}</td>
          <td class="px-4 py-3.5 text-[#A0A0A5]">${supName}</td>
          <td class="px-4 py-3.5 text-[#A0A0A5]">${kasir}</td>
          <td class="px-4 py-3.5 text-right text-[#34C759] font-semibold">+${qty}</td>
          <td class="px-4 py-3.5 text-right text-[#A0A0A5]">${formatRupiahVal(price)}</td>
          <td class="px-4 py-3.5 text-right font-semibold text-white">${formatRupiahVal(total)}</td>
          <td class="px-4 py-3.5 text-right">
            <button type="button" data-action="delete" data-transaction-id="${tx.id}" title="Hapus transaksi" aria-label="Hapus transaksi"
                    class="p-1.5 hover:bg-white/5 rounded-lg text-[#FF3B30] transition">
              <i data-lucide="trash-2" class="w-4 h-4" aria-hidden="true"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    if (typeof window.syncTableLabels === 'function') window.syncTableLabels();
  }

  async function handleRefreshIn() {
    const headerBtn = document.getElementById('btn-refresh-in-header');
    const headerIcon = headerBtn ? headerBtn.querySelector('i') : null;
    if (headerIcon) headerIcon.classList.add('animate-spin');

    try {
      await loadInTransactions();
      await loadDropdowns();
      if (typeof showToast === 'function') {
        showToast('Data berhasil di-refresh', 'success');
      }
    } catch (err) {
      console.error('Refresh in error:', err);
      if (typeof showToast === 'function') {
        showToast('Gagal memuat ulang data', 'error');
      }
    } finally {
      setTimeout(() => {
        if (headerIcon) headerIcon.classList.remove('animate-spin');
        if (typeof window.refreshIcons === 'function') window.refreshIcons();
      }, 400);
    }
  }

  function handleExportIn() {
    if (!allInTransactions || allInTransactions.length === 0) {
      if (typeof showToast === 'function') showToast('Tidak ada data barang masuk untuk diexport', 'warning');
      return;
    }

    const headers = ['No. Transaksi', 'Tanggal', 'Nama Barang', 'Supplier', 'Kasir', 'Jumlah', 'Harga (Rp)', 'Total (Rp)', 'Catatan'];
    const rows = allInTransactions.map(tx => {
      const code = `IN-${String(tx.id).padStart(6, '0')}`;
      const dateStr = formatTxDate(tx.created_at);
      const prodName = tx.products?.name || ('Produk #' + tx.product_id);
      const supName = tx.suppliers?.name || 'Umum';
      const kasir = (typeof window.resolveUserName === 'function')
        ? window.resolveUserName(tx.created_by)
        : (tx.created_by && !tx.created_by.includes('-') ? tx.created_by : 'Kasir');
      const qty = tx.qty || 0;
      const price = tx.price || 0;
      const total = qty * price;
      const note = tx.note || '';

      return [code, dateStr, prodName, supName, kasir, qty, price, total, note];
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const filename = `barang-masuk-${todayStr}.csv`;
    if (typeof exportToCSV === 'function') {
      exportToCSV(filename, rows, headers);
      if (typeof showToast === 'function') showToast(`Berhasil export ${rows.length} transaksi barang masuk`, 'success');
    }
  }

  async function loadInTransactions() {
    try {
      const res = await Api.transactions.getByType('in');
      if (res && res.ok) {
        allInTransactions = res.data || [];
        updateMetrics(allInTransactions);
        renderInTable();
      }
    } catch (err) {
      console.error('Error loading in transactions:', err);
    }
  }

  function setupSearchListeners() {
    const pageSearch = document.getElementById('search-in');
    const globalSearch = document.getElementById('global-search');

    if (pageSearch) {
      pageSearch.addEventListener('input', function (e) {
        handleSearchIn(e.target.value);
      });
    }
    if (globalSearch) {
      globalSearch.addEventListener('input', function (e) {
        handleSearchIn(e.target.value);
      });
    }
  }

  // Window exports for product selection, modal management, filtering, and testing
  window.filterInPeriod = filterInPeriod;
  window.handleSearchIn = handleSearchIn;
  window.goToInPage = goToInPage;
  window.loadInTransactions = loadInTransactions;
  window.handleExportIn = handleExportIn;
  window.loadDropdowns = loadDropdowns;
  window.handleInBarcodeLookup = handleInBarcodeLookup;
  window.handleInProductChange = handleInProductChange;
  window.handleInSubmit = handleInSubmit;
  window.openAddInModal = openAddInModal;
  window.closeInModal = closeInModal;
  window.openDeleteInModal = openDeleteInModal;
  window.closeDeleteInModal = closeDeleteInModal;
  window.confirmDeleteIn = confirmDeleteIn;
  window.calculateInTotal = calculateInTotal;
  window.selectInProduct = selectInProduct;
  window.selectNewProduct = selectNewProduct;
  window.clearInProductSelection = clearInProductSelection;
  window.autoUpdateInSkuPlaceholder = autoUpdateInSkuPlaceholder;
  window.applyInAutoSku = applyInAutoSku;
  window.getLastProductSequence = getLastProductSequence;

  document.addEventListener('DOMContentLoaded', function () {
    setupSearchListeners();
    loadInTransactions();
    loadDropdowns();

    const searchInput = document.getElementById('in-product-search');
    searchInput?.addEventListener('input', handleProductSearchInput);

    document.addEventListener('click', function (e) {
      const suggestionsEl = document.getElementById('in-product-suggestions');
      const input = document.getElementById('in-product-search');
      if (suggestionsEl && !suggestionsEl.contains(e.target) && e.target !== input) {
        suggestionsEl.classList.add('hidden');
      }
    });

    document.getElementById('in-tbody')?.addEventListener('click', function (event) {
      const button = event.target.closest('[data-transaction-id]');
      if (button) openDeleteInModal(button.dataset.transactionId);
    });

    const scanButton = document.getElementById('btn-scan-in-barcode');
    scanButton?.addEventListener('click', function () {
      if (typeof window.openItemBarcodeScanner !== 'function') {
        showToast('Pemindai barcode belum siap. Muat ulang halaman dan coba lagi.', 'error');
        return;
      }

      window.openItemBarcodeScanner(handleInBarcodeLookup);
    });

    document.getElementById('btn-import-in')?.addEventListener('click', function () {
      if (typeof window.startCsvImport !== 'function') {
        showToast('Fitur import belum siap. Muat ulang halaman dan coba lagi.', 'error');
        return;
      }

      const headers = ['SKU', 'Barcode', 'Jumlah', 'Harga Satuan (Rp)', 'Supplier', 'Tanggal (YYYY-MM-DD)', 'Catatan'];
      window.startCsvImport({
        title: 'Barang Masuk',
        templateName: 'template-barang-masuk.csv',
        headers,
        requiredHeaders: ['SKU', 'Jumlah', 'Harga Satuan (Rp)', 'Supplier', 'Tanggal (YYYY-MM-DD)'],
        templateRows: [
          ['PAK-LOK-001', '8991234567890', '20', '15000', 'Distributor Pakan Jaya', '2026-10-16', 'Restock stok mingguan'],
          ['POM-RES-002', '', '10', '45000', 'Mitra Aquarium Mandiri', '2026-10-16', 'Faktur No. INV-1029'],
          ['MED-BLU-003', '', '15', '8000', 'Distributor Pakan Jaya', '2026-10-16', 'Bonus promo supplier']
        ],
        instructions: [
          'SKU atau Barcode harus cocok dengan salah satu produk yang sudah terdaftar di Master Barang.',
          'Barcode bersifat opsional (dapat dikosongkan jika produk tidak memiliki barcode fisik).',
          'Jumlah harus berupa bilangan bulat positif lebih dari 0.',
          'Harga Satuan berupa angka harga beli modal per unit barang.',
          'Supplier: jika diisi, harus sesuai nama supplier yang sudah terdaftar.',
          'Tanggal wajib berformat YYYY-MM-DD (contoh: 2026-10-16).',
          'Catatan bersifat opsional (keterangan tambahan/nomor faktur).'
        ],
        preventReimport: true,
        validate: async function (records) {
          const [productsResult, suppliersResult] = await Promise.all([
            Api.items.getAll(),
            Api.suppliers.getAll()
          ]);
          if (!productsResult?.ok) throw new Error(productsResult?.error?.message || 'Gagal memuat produk.');
          if (!suppliersResult?.ok) throw new Error(suppliersResult?.error?.message || 'Gagal memuat supplier.');

          const products = productsResult.data || [];
          const suppliers = new Set((suppliersResult.data || []).map(supplier => String(supplier.name).trim().toLowerCase()));
          const rows = [];
          const errors = [];
          records.forEach((record, index) => {
            const rowNumber = index + 2;
            const sku = (record['SKU'] || '').trim();
            const barcode = (record['Barcode'] || '').trim();
            const quantityText = (record['Jumlah'] || '').trim();
            const priceText = (record['Harga Satuan (Rp)'] || '').trim();
            const supplier = (record['Supplier'] || '').trim();
            const date = (record['Tanggal (YYYY-MM-DD)'] || '').trim();
            const notes = (record['Catatan'] || '').trim();
            const rowErrorsBefore = errors.length;

            if (!sku && !barcode) errors.push({ row: rowNumber, message: 'SKU atau barcode wajib diisi.' });
            const matches = products.filter(product =>
              (sku && String(product.sku || '').trim() === sku)
              || (barcode && String(product.barcode || '').trim() === barcode));
            if (matches.length !== 1) {
              errors.push({ row: rowNumber, message: 'Produk tidak ditemukan atau SKU dan barcode menunjuk ke produk berbeda.' });
            }
            if (!/^\d+$/.test(quantityText) || Number(quantityText) <= 0) {
              errors.push({ row: rowNumber, message: 'Jumlah harus bilangan bulat lebih dari nol.' });
            }
            if (!/^\d+(\.\d+)?$/.test(priceText)) {
              errors.push({ row: rowNumber, message: 'Harga satuan harus berupa angka nol atau lebih.' });
            }
            if (supplier && !suppliers.has(supplier.toLowerCase())) {
              errors.push({ row: rowNumber, message: `Supplier "${supplier}" tidak ditemukan.` });
            }
            if (date && !window.isValidCsvImportDate(date)) {
              errors.push({ row: rowNumber, message: 'Tanggal harus berformat YYYY-MM-DD.' });
            }
            if (errors.length !== rowErrorsBefore) return;
            rows.push({
              sku,
              barcode,
              quantity: Number(quantityText),
              unit_price: Number(priceText),
              supplier,
              customer: '',
              channel: 'Offline',
              date,
              notes
            });
          });
          return { rows, errors };
        },
        commit: async function (rows, fileHash) {
          const { data, error } = await window.supabase.rpc('import_inventory_transactions', {
            p_type: 'in',
            p_rows: rows,
            p_file_hash: fileHash
          });
          return error ? { ok: false, error } : { ok: true, data };
        },
        onComplete: loadInTransactions
      });
    });
  });
