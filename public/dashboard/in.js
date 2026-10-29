  let allInTransactions = [];
  let availableProducts = [];
  let productsLoaded = false;
  let currentFilterPeriod = 'today';
  let searchQuery = '';
  let currentPage = 1;
  const pageSize = 10;
  let deleteInId = null;
  let isSubmittingIn = false;

  function parseNumericValue(value) {
    if (value === null || value === undefined) return 0;
    const digitsOnly = String(value).replace(/\D+/g, '');
    return digitsOnly ? Number(digitsOnly) : 0;
  }

  function formatNumberInput(value) {
    const num = parseNumericValue(value);
    return num > 0 ? new Intl.NumberFormat('id-ID').format(num) : '0';
  }

  function normalizeNumericInputValue(value) {
    if (value === null || value === undefined) return '0';
    const digitsOnly = String(value).replace(/\D+/g, '');
    if (!digitsOnly) return '0';
    const normalized = digitsOnly.replace(/^0+(?=\d)/, '');
    return normalized || '0';
  }

  function sanitizeNumericInputElement(input) {
    if (!input) return;
    if (input.matches('#in-price, #in-sell-price')) {
      const cleanDigits = String(input.value).replace(/\D/g, '');
      const num = cleanDigits === '' ? 0 : Number(cleanDigits);
      input.value = num > 0 ? new Intl.NumberFormat('id-ID').format(num) : (input.value === '' ? '' : '0');
    } else {
      input.value = normalizeNumericInputValue(input.value);
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('input', (event) => {
      const target = event.target;
      if (!target || typeof target.matches !== 'function') return;
      if (target.matches('#in-price, #in-sell-price, #in-qty')) {
        sanitizeNumericInputElement(target);
      }
      if (target.matches('#in-price')) {
        selectedPriceManuallyChanged = true;
      }
    }, true);

    document.addEventListener('blur', (event) => {
      const target = event.target;
      if (!target || typeof target.matches !== 'function') return;
      if (target.matches('#in-price, #in-sell-price, #in-qty')) {
        sanitizeNumericInputElement(target);
      }
    }, true);

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!target || typeof target.matches !== 'function') return;
      if (target.matches('#in-supplier-id')) {
        selectedSupplierManuallyChanged = true;
      }
      if (target.matches('#in-price')) {
        selectedPriceManuallyChanged = true;
      }
    }, true);
  }

  function applyProductDefaultSupplier(supplierId) {
    const supplierSelect = document.getElementById('in-supplier-id');
    if (!supplierSelect) return;
    const value = supplierId == null ? '' : String(supplierId);
    supplierSelect.value = Array.from(supplierSelect.options).some(option => option.value === value) ? value : '';
  }

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
  let selectedProductRefreshId = 0;
  let isRefreshingSelectedProduct = false;
  let selectedProductPriceError = null;
  let selectedSupplierManuallyChanged = false;
  let selectedPriceManuallyChanged = false;
  let loadDropdownsPromise = null;
  let inReferencesLoaded = false;

  // Manajemen Galeri Foto Produk Baru di Barang Masuk
  let inProductPhotos = [];
  const MAX_IN_PRODUCT_PHOTOS = 6;

  function renderInPhotoGallery() {
    const container = document.getElementById('in-gallery-container');
    const badge = document.getElementById('in-photo-count-badge');
    if (badge) {
      badge.textContent = `(${inProductPhotos.length}/${MAX_IN_PRODUCT_PHOTOS})`;
    }

    if (!container) return;

    if (inProductPhotos.length === 0) {
      container.innerHTML = `
        <div class="w-full flex flex-col items-center justify-center p-3 border border-dashed border-white/15 rounded-xl text-center bg-black/20">
          <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#A0A0A5] mb-1">
            <i data-lucide="image" class="w-4 h-4 opacity-60"></i>
          </div>
          <p class="text-xs font-medium text-white/80">Belum ada foto produk</p>
          <p class="text-[11px] text-[#A0A0A5] mt-0.5">Ambil kamera atau pilih hingga ${MAX_IN_PRODUCT_PHOTOS} foto</p>
        </div>
      `;
    } else {
      let cardsHtml = inProductPhotos.map((photo, idx) => {
        const isPrimary = idx === 0;
        return `
          <div class="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-black/40 border ${isPrimary ? 'border-[#0088CC] shadow-[0_0_12px_rgba(0,136,204,0.35)]' : 'border-white/10'} flex items-center justify-center overflow-hidden flex-shrink-0 group">
            <img src="${escapeHtml(photo.previewUrl)}" alt="Foto ${idx + 1}" class="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-200" title="Klik untuk lihat ukuran penuh" onclick="previewInGalleryPhoto(${idx})">
            
            ${isPrimary ? `
              <span class="absolute top-1 left-1 bg-[#0088CC] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow pointer-events-none">
                <i data-lucide="star" class="w-2.5 h-2.5 fill-current"></i> Utama
              </span>
            ` : `
              <button type="button" onclick="setInPhotoAsPrimary(${idx})" title="Jadikan Foto Utama" class="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-1 left-1 bg-black/80 hover:bg-[#0088CC] text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 transition shadow cursor-pointer">
                <i data-lucide="star" class="w-2.5 h-2.5"></i> Utama
              </button>
            `}

            <button type="button" onclick="removeInPhotoByIndex(${idx})" title="Hapus foto ini" aria-label="Hapus foto ${idx + 1}" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/80 hover:bg-[#FF3B30] text-white flex items-center justify-center transition shadow opacity-90 hover:opacity-100 z-10 cursor-pointer">
              <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>

            <span class="absolute bottom-1 right-1 bg-black/75 text-white/80 text-[9px] px-1.5 py-0.2 rounded font-mono pointer-events-none">
              ${idx + 1}
            </span>
          </div>
        `;
      }).join('');

      if (inProductPhotos.length < MAX_IN_PRODUCT_PHOTOS) {
        cardsHtml += `
          <div onclick="document.getElementById('in-image-file').click()" class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-dashed border-white/20 hover:border-[#0088CC]/60 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-1 cursor-pointer transition active:scale-95 flex-shrink-0 group" title="Tambah foto lagi">
            <i data-lucide="plus" class="w-4 h-4 text-[#32ADE6] group-hover:scale-110 transition"></i>
            <span class="text-[10px] text-white/70 font-medium">+ Foto</span>
          </div>
        `;
      }

      container.innerHTML = cardsHtml;
    }

    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons(container);
    }
  }

  function setInPhotoAsPrimary(index) {
    if (index > 0 && index < inProductPhotos.length) {
      const [photo] = inProductPhotos.splice(index, 1);
      inProductPhotos.unshift(photo);
      renderInPhotoGallery();
      if (typeof showToast === 'function') {
        showToast('Foto utama berhasil diubah', 'info');
      }
    }
  }

  function removeInPhotoByIndex(index) {
    if (index >= 0 && index < inProductPhotos.length) {
      inProductPhotos.splice(index, 1);
      renderInPhotoGallery();
    }
  }

  function previewInGalleryPhoto(index) {
    const urls = inProductPhotos.map(p => p.previewUrl);
    const name = document.getElementById('in-product-search')?.value || 'Foto Produk Baru';
    const sku = document.getElementById('in-sku')?.value || '';
    if (typeof window.openImageViewer === 'function') {
      window.openImageViewer(urls, name, sku, index);
    }
  }

  function resetInImageForm() {
    inProductPhotos = [];
    const fileInput = document.getElementById('in-image-file');
    const camInput = document.getElementById('in-image-camera');
    const compInfo = document.getElementById('in-compression-info');

    if (fileInput) fileInput.value = '';
    if (camInput) camInput.value = '';
    if (compInfo) compInfo.classList.add('hidden');
    renderInPhotoGallery();
  }

  async function handleInImageSelection(e) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    if (typeof ImageUtils === 'undefined') {
      if (typeof showToast === 'function') showToast('Modul kompresi gambar (ImageUtils) belum siap', 'error');
      return;
    }

    const availableSlots = MAX_IN_PRODUCT_PHOTOS - inProductPhotos.length;
    if (availableSlots <= 0) {
      if (typeof showToast === 'function') {
        showToast(`Maksimal ${MAX_IN_PRODUCT_PHOTOS} foto produk telah tercapai`, 'warning');
      }
      e.target.value = '';
      return;
    }

    const filesToProcess = files.slice(0, availableSlots);
    if (files.length > availableSlots && typeof showToast === 'function') {
      showToast(`Hanya ${availableSlots} foto yang ditambahkan (batas maksimal ${MAX_IN_PRODUCT_PHOTOS} foto)`, 'info');
    }

    const compInfo = document.getElementById('in-compression-info');
    const compText = document.getElementById('in-compression-info-text');
    if (compInfo && compText) {
      compText.textContent = filesToProcess.length > 1 
        ? `Mengompresi ${filesToProcess.length} foto ke WebP...` 
        : 'Mengompresi ke WebP...';
      compInfo.classList.remove('hidden');
    }

    let successCount = 0;
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      try {
        if (compText && filesToProcess.length > 1) {
          compText.textContent = `Mengompresi foto ${i + 1}/${filesToProcess.length}...`;
        }
        const result = await ImageUtils.compressImage(file);
        inProductPhotos.push({
          id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          blob: result.blob,
          previewUrl: result.previewUrl,
          sizeText: `${result.originalSizeText} → ${result.compressedSizeText}`
        });
        successCount++;
      } catch (err) {
        console.error('Compress error for file:', file.name, err);
        if (typeof showToast === 'function') {
          showToast(`Gagal memproses ${file.name}: ${err.message}`, 'error');
        }
      }
    }

    if (compInfo && compText) {
      if (successCount > 0) {
        const lastPhoto = inProductPhotos[inProductPhotos.length - 1];
        compText.textContent = successCount > 1 
          ? `${successCount} foto siap diunggah (WebP ≤ 1 MB)` 
          : `${lastPhoto.sizeText} (WebP)`;
        compInfo.classList.remove('hidden');
      } else {
        compInfo.classList.add('hidden');
      }
    }

    e.target.value = '';
    renderInPhotoGallery();
  }

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
    if (loadDropdownsPromise) return loadDropdownsPromise;

    loadDropdownsPromise = (async () => {
      inReferencesLoaded = false;
      productsLoaded = false;
      try {
        const prodRes = await Api.items.getAll();
        if (!prodRes?.ok) {
          throw new Error(prodRes?.error?.message || 'Gagal memuat daftar produk.');
        }
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

        const supRes = await Api.suppliers.getAll();
        if (!supRes?.ok) {
          throw new Error(supRes?.error?.message || 'Gagal memuat daftar supplier.');
        }
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
          if (selectedExistingProduct && !selectedSupplierManuallyChanged) {
            applyProductDefaultSupplier(selectedExistingProduct.supplier_id);
          } else if (currentSupVal) {
            supSelect.value = currentSupVal;
          }
        }
        inReferencesLoaded = true;

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
        return true;
      } catch (err) {
        console.error('Error loading dropdowns:', err);
        if (typeof showToast === 'function') {
          showToast(`Data Barang Masuk gagal diperbarui: ${err.message || 'Kesalahan saat memuat produk/supplier.'}`, 'error');
        }
        return false;
      }
    })().finally(() => {
      loadDropdownsPromise = null;
    });

    return loadDropdownsPromise;
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
        <button type="button" class="w-full text-left px-3.5 py-2.5 hover:bg-white/10 flex items-center justify-between text-sm transition" onclick="selectInProduct('${escapeHtml(String(p.id))}')">
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

  let inCurrentMode = 'existing';

  function switchInMode(mode) {
    inCurrentMode = mode || 'existing';
    const tabExisting = document.getElementById('tab-in-existing');
    const tabNew = document.getElementById('tab-in-new');
    const searchInput = document.getElementById('in-product-search');
    const searchLabel = document.getElementById('in-product-label');
    const badge = document.getElementById('in-product-badge');
    const newFields = document.getElementById('in-new-product-fields');
    const clearBtn = document.getElementById('in-clear-product');
    const barcodeWrap = document.getElementById('in-barcode-wrap');
    const suggestionsEl = document.getElementById('in-product-suggestions');

    if (suggestionsEl) {
      suggestionsEl.classList.add('hidden');
      suggestionsEl.innerHTML = '';
    }

    if (mode === 'new') {
      if (tabNew) {
        tabNew.className = 'py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition bg-[#0088CC] text-white shadow-sm border border-transparent';
      }
      if (tabExisting) {
        tabExisting.className = 'py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent';
      }
      selectedExistingProduct = null;
      selectedProductRefreshId += 1;
      isRefreshingSelectedProduct = false;
      selectedProductPriceError = null;
      resetInImageForm();
      const prodId = document.getElementById('in-product-id');
      if (prodId) prodId.value = '';

      if (searchLabel) searchLabel.innerHTML = 'Nama Produk Baru <span class="text-[#FF3B30]">*</span>';
      if (searchInput) {
        searchInput.placeholder = 'Ketik nama lengkap produk baru...';
        searchInput.readOnly = false;
      }
      if (badge) {
        badge.textContent = 'Masuk Master Barang';
        badge.className = 'text-[11px] font-medium text-[#32ADE6]';
      }
      if (newFields) newFields.classList.remove('hidden');
      if (clearBtn) clearBtn.classList.add('hidden');
      if (barcodeWrap) barcodeWrap.classList.add('hidden');

      autoUpdateInSkuPlaceholder();
      renderInPhotoGallery();
      calculateInTotal();
      setTimeout(() => searchInput?.focus(), 50);
    } else {
      if (tabExisting) {
        tabExisting.className = 'py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition bg-[#0088CC] text-white shadow-sm border border-transparent';
      }
      if (tabNew) {
        tabNew.className = 'py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent';
      }
      if (searchLabel) searchLabel.innerHTML = 'Nama Produk <span class="text-[#FF3B30]">*</span>';
      if (searchInput) {
        searchInput.placeholder = 'Ketik nama barang lama atau ketik barcode...';
        searchInput.readOnly = false;
      }
      if (barcodeWrap) barcodeWrap.classList.remove('hidden');
      clearInProductSelection();
      setTimeout(() => searchInput?.focus(), 50);
    }
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  async function selectInProduct(productId) {
    if (loadDropdownsPromise) {
      await loadDropdownsPromise;
    }

    const prod = availableProducts.find(p => String(p.id) === String(productId));
    if (!prod) return;

    inCurrentMode = 'existing';
    const tabExisting = document.getElementById('tab-in-existing');
    const tabNew = document.getElementById('tab-in-new');
    if (tabExisting) {
      tabExisting.className = 'py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition bg-[#0088CC] text-white shadow-sm border border-transparent';
    }
    if (tabNew) {
      tabNew.className = 'py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent';
    }
    const searchLabel = document.getElementById('in-product-label');
    if (searchLabel) searchLabel.innerHTML = 'Nama Produk <span class="text-[#FF3B30]">*</span>';
    const barcodeWrap = document.getElementById('in-barcode-wrap');
    if (barcodeWrap) barcodeWrap.classList.remove('hidden');

    selectedExistingProduct = prod;
    if (!selectedSupplierManuallyChanged) {
      applyProductDefaultSupplier(prod.supplier_id);
    }
    selectedProductPriceError = null;
    resetInImageForm();
    const prodInput = document.getElementById('in-product-id');
    if (prodInput) {
      if (prodInput.tagName === 'SELECT' && !prodInput.querySelector(`option[value="${prod.id}"]`)) {
        const opt = document.createElement('option');
        opt.value = prod.id;
        opt.textContent = prod.name;
        prodInput.appendChild(opt);
      }
      prodInput.value = String(prod.id);
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
    if (priceInput && !selectedPriceManuallyChanged) {
      priceInput.value = formatNumberInput(prod.cost_price);
      if (typeof window.updateNumericClearButton === 'function') {
        window.updateNumericClearButton(priceInput);
      }
    }

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
    await refreshSelectedProductPrice(prod.id);
    document.getElementById('in-qty')?.focus();
  }

  async function refreshSelectedProductPrice(productId) {
    const requestId = ++selectedProductRefreshId;
    isRefreshingSelectedProduct = true;
    selectedProductPriceError = null;
    try {
      const result = await Api.items.getById(productId);
      if (requestId !== selectedProductRefreshId
        || String(document.getElementById('in-product-id')?.value) !== String(productId)) return false;
      if (!result?.ok || !result.data) {
        throw new Error(result?.error?.message || 'Gagal memuat harga beli terbaru produk.');
      }

      const freshProduct = result.data;
      availableProducts = availableProducts.map(product =>
        String(product.id) === String(freshProduct.id) ? freshProduct : product
      );
      selectedExistingProduct = freshProduct;
      if (!selectedSupplierManuallyChanged) {
        applyProductDefaultSupplier(freshProduct.supplier_id);
      }
      const priceInput = document.getElementById('in-price');
      if (priceInput && !selectedPriceManuallyChanged) {
        priceInput.value = formatNumberInput(freshProduct.cost_price);
      }

      const badge = document.getElementById('in-product-badge');
      if (badge) {
        badge.textContent = `✓ Terdaftar (Stok: ${freshProduct.stock ?? 0} ${freshProduct.unit || 'pcs'})`;
      }
      calculateInTotal();
      return true;
    } catch (error) {
      if (requestId === selectedProductRefreshId) {
        selectedProductPriceError = error.message || 'Gagal memuat harga beli terbaru produk.';
        if (typeof showToast === 'function') {
          showToast(`Harga beli terbaru gagal dimuat: ${selectedProductPriceError}`, 'error');
        }
      }
      return false;
    } finally {
      if (requestId === selectedProductRefreshId) isRefreshingSelectedProduct = false;
    }
  }

  function handleInProductChange() {
    const select = document.getElementById('in-product-id');
    const pId = select?.value;
    const prod = availableProducts.find(p => String(p.id) === String(pId));
    const priceInput = document.getElementById('in-price');
    if (prod && priceInput) {
      if (!selectedPriceManuallyChanged) {
        priceInput.value = formatNumberInput(prod.cost_price);
      }
      selectedExistingProduct = prod;
      if (!selectedSupplierManuallyChanged) {
        applyProductDefaultSupplier(prod.supplier_id);
      }
      selectedProductPriceError = null;
      refreshSelectedProductPrice(prod.id);
    } else {
      selectedProductRefreshId += 1;
      isRefreshingSelectedProduct = false;
      selectedProductPriceError = null;
    }
    calculateInTotal();
  }

  function selectNewProduct(name) {
    switchInMode('new');
    const searchInput = document.getElementById('in-product-search');
    if (searchInput && name) {
      searchInput.value = name;
    }
  }

  function clearInProductSelection() {
    selectedExistingProduct = null;
    selectedProductPriceError = null;
    selectedProductRefreshId += 1;
    isRefreshingSelectedProduct = false;
    selectedPriceManuallyChanged = false;
    selectedSupplierManuallyChanged = false;
    const priceInput = document.getElementById('in-price');
    if (priceInput) priceInput.value = '0';
    const supSelect = document.getElementById('in-supplier-id');
    if (supSelect) supSelect.value = '';
    resetInImageForm();
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
      if (inCurrentMode === 'new') {
        badge.textContent = 'Masuk Master Barang';
        badge.className = 'text-[11px] font-medium text-[#32ADE6]';
      } else {
        badge.textContent = '';
        badge.className = 'text-[11px] font-medium text-[#A0A0A5]';
      }
    }

    const brandInput = document.getElementById('in-brand');
    if (brandInput) brandInput.value = '';
    const skuInput = document.getElementById('in-sku');
    if (skuInput) {
      skuInput.value = '';
      skuInput.placeholder = 'Otomatis jika kosong';
    }

    const newFields = document.getElementById('in-new-product-fields');
    if (newFields && inCurrentMode !== 'new') {
      newFields.classList.add('hidden');
    }

    const suggestionsEl = document.getElementById('in-product-suggestions');
    if (suggestionsEl) {
      suggestionsEl.classList.add('hidden');
      suggestionsEl.innerHTML = '';
    }

    updateInStockPreview();
    calculateInTotal();
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
    if (!inReferencesLoaded && !await loadDropdowns()) return;

    const normalizedBarcode = barcode.toLowerCase();
    const product = availableProducts.find(p =>
      String(p.barcode || '').trim().toLowerCase() === normalizedBarcode
      || String(p.sku || '').trim().toLowerCase() === normalizedBarcode
    );
    if (!product) {
      if (select) {
        select.value = '';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const priceInput = document.getElementById('in-price');
      if (priceInput) {
        priceInput.value = '0';
        sanitizeNumericInputElement(priceInput);
      }
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

    await selectInProduct(product.id);
    if (status) status.textContent = `Produk dipilih: ${product.name}`;
    if (typeof showToast === 'function') showToast(`Produk "${product.name}" berhasil dipilih`, 'success');
    document.getElementById('in-qty')?.focus();
  }

  function updateInStockPreview() {
    const previewBox = document.getElementById('in-stock-preview');
    const previewText = document.getElementById('in-stock-preview-text');
    if (!previewBox || !previewText) return;

    if (selectedExistingProduct) {
      const curStock = Number(selectedExistingProduct.stock || 0);
      const qty = parseNumericValue(document.getElementById('in-qty')?.value);
      const unit = selectedExistingProduct.unit || 'pcs';
      const totalNew = curStock + qty;
      let text = `Stok Saat Ini: ${curStock} + Masuk: ${qty} = Total Baru: ${totalNew} ${unit}`;
      if (curStock > 0 && qty > 0) {
        text += ` • Pastikan bukan faktur yang sudah dicatat saat daftar barang`;
      }
      previewText.textContent = text;
      previewBox.classList.remove('hidden');
    } else {
      previewBox.classList.add('hidden');
    }
  }

  function calculateInTotal() {
    const qty = parseNumericValue(document.getElementById('in-qty')?.value);
    const price = parseNumericValue(document.getElementById('in-price')?.value);
    const total = qty * price;
    const preview = document.getElementById('in-total-preview');
    if (preview) {
      preview.textContent = formatRupiahVal(total);
    }
    updateInStockPreview();
  }

  function openAddInModal() {
    const form = document.getElementById('form-in');
    if (form) form.reset();
    selectedSupplierManuallyChanged = false;
    selectedPriceManuallyChanged = false;
    clearInProductSelection();
    switchInMode('existing');
    calculateInTotal();
    loadDropdowns();
    const modal = document.getElementById('modal-in');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    if (typeof window.refreshNumericClearButtons === 'function') window.refreshNumericClearButtons();
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
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (isSubmittingIn) return;
    isSubmittingIn = true;

    const submitBtn = document.getElementById('btn-submit-in');
    const originalHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Menyimpan...</span>';
    }

    try {
      if (!inReferencesLoaded && !await loadDropdowns()) {
        return;
      }
      if (isRefreshingSelectedProduct) {
        if (typeof showToast === 'function') {
          showToast('Sedang memuat harga beli terbaru. Tunggu sebentar lalu simpan kembali.', 'warning');
        }
        return;
      }
      if (selectedExistingProduct && selectedProductPriceError) {
        const refreshed = await refreshSelectedProductPrice(selectedExistingProduct.id);
        if (!refreshed) {
          if (typeof showToast === 'function') {
            showToast('Barang masuk dibatalkan karena harga beli terbaru belum berhasil dimuat.', 'error');
          }
          return;
        }
      }

      const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
      if (role === 'VIEWER') {
        alert('Anda tidak punya akses untuk mengubah data.');
        return;
      }
      let productId = document.getElementById('in-product-id')?.value || '';
      const productName = document.getElementById('in-product-search')?.value.trim() || '';
      const supplierId = document.getElementById('in-supplier-id')?.value || '';
      const qty = parseNumericValue(document.getElementById('in-qty')?.value);
      const price = parseNumericValue(document.getElementById('in-price')?.value);
      const note = document.getElementById('in-note')?.value?.trim() || '';

      if (!productName) {
        if (typeof showToast === 'function') showToast('Masukkan nama produk terlebih dahulu', 'error');
        document.getElementById('in-product-search')?.focus();
        return;
      }
      if (!qty || qty <= 0) {
        if (typeof showToast === 'function') showToast('Jumlah masuk harus lebih dari 0', 'error');
        return;
      }

      // Validasi anti-duplikasi cerdas (GS1 Barcode, SKU, dan Nama Produk)
      if (!productId) {
        const barcodeVal = document.getElementById('in-barcode')?.value.trim() || null;
        const skuVal = document.getElementById('in-sku')?.value.trim() || null;
        const trimmedNameLower = productName.toLowerCase();

        let existingProd = null;
        if (barcodeVal) {
          existingProd = availableProducts.find(p => (p.barcode || '').trim().toLowerCase() === barcodeVal.toLowerCase());
        }
        if (!existingProd && skuVal) {
          existingProd = availableProducts.find(p => (p.sku || '').trim().toLowerCase() === skuVal.toLowerCase());
        }
        if (!existingProd) {
          existingProd = availableProducts.find(p => (p.name || '').trim().toLowerCase() === trimmedNameLower);
        }

        if (existingProd) {
          if (typeof showToast === 'function') {
            showToast(`Produk "${existingProd.name}" sudah terdaftar (SKU: ${existingProd.sku || '-'}). Dialihkan ke Barang Lama agar tidak terjadi duplikasi katalog.`, 'warning');
          }
          await selectInProduct(existingProd.id);
          return;
        }
      }

      let currentUserId = null;
      if (typeof window.Auth !== 'undefined') {
        const user = await window.Auth.getCurrentUser();
        currentUserId = user?.id || null;
      }

      let isNewProductCreated = false;

      // Jika belum ada productId, berarti ini PRODUK BARU!
      if (!productId) {
        const categoryId = document.getElementById('in-category-id')?.value || null;
        const unitId = document.getElementById('in-unit-id')?.value || 1;
        const sellPrice = parseNumericValue(document.getElementById('in-sell-price')?.value);
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

        // Upload foto jika ada
        let finalImageUrl = null;
        const finalUrls = [];
        if (inProductPhotos.length > 0 && typeof Api.storage?.uploadImage === 'function') {
          for (let i = 0; i < inProductPhotos.length; i++) {
            const photo = inProductPhotos[i];
            if (submitBtn) submitBtn.innerHTML = `<span>Mengunggah Foto (${i + 1}/${inProductPhotos.length})...</span>`;
            const cleanSku = (skuVal || productName || 'item').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
            const imagePath = `${cleanSku}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.webp`;
            try {
              const uploadRes = await Api.storage.uploadImage(photo.blob, imagePath);
              if (uploadRes && uploadRes.ok && uploadRes.data?.publicUrl) {
                finalUrls.push(uploadRes.data.publicUrl);
              }
            } catch (upErr) {
              console.warn('Gagal upload foto produk masuk:', upErr);
            }
          }
        }
        if (finalUrls.length === 1) {
          finalImageUrl = finalUrls[0];
        } else if (finalUrls.length > 1) {
          finalImageUrl = JSON.stringify(finalUrls);
        }

        if (submitBtn) submitBtn.innerHTML = '<span>Mendaftarkan Produk...</span>';

        const createRes = await Api.items.create({
          name: productName,
          brand: brandVal,
          sku: skuVal,
          barcode: barcodeVal,
          category_id: categoryId ? Number(categoryId) : null,
          unit_id: Number(unitId),
          supplier_id: supplierId || null,
          cost_price: price,
          sell_price: sellPrice,
          stock: 0,
          min_stock: 3,
          image_url: finalImageUrl,
          images: finalUrls
        });

        if (!createRes.ok || !createRes.data) {
          throw new Error(createRes.error?.message || 'Gagal mendaftarkan produk baru');
        }

        productId = createRes.data.id;
        isNewProductCreated = true;
      }

      let res;
      try {
        res = await Api.transactions.createIn({
          product_id: productId,
          supplier_id: supplierId || null,
          qty: qty,
          price: price,
          cost_price: price,
          note: note || null,
          created_by: currentUserId
        });

        if (!res.ok) {
          throw new Error(res.error?.message || 'Gagal menyimpan barang masuk');
        }
      } catch (inTxErr) {
        // Rollback kompensasi: jika produk baru dibuat tapi transaksi masuk gagal, bersihkan master yatim piatu
        if (isNewProductCreated && productId) {
          try {
            await Api.items.delete(productId);
          } catch (cleanErr) {
            console.warn('Gagal membersihkan produk baru setelah transaksi masuk gagal:', cleanErr);
          }
        }
        throw inTxErr;
      }

      if (typeof showToast === 'function') {
        showToast('Barang masuk berhasil dicatat! Stok diperbarui.', 'success');
      }
      resetInImageForm();
      closeInModal();
      await loadInTransactions();
      await loadDropdowns();
    } catch (err) {
      console.error('Submit in error:', err);
      if (typeof showToast === 'function') {
        showToast(err.message || 'Terjadi kesalahan saat menyimpan', 'error');
      }
    } finally {
      isSubmittingIn = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
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
        : (tx.created_by && !tx.created_by.includes('-') ? tx.created_by : 'David');
      const qty = tx.qty || 0;
      const price = tx.price || 0;
      const total = qty * price;

      return `
        <tr class="table-row border-b border-white/5">
          <td class="px-4 py-3.5 font-mono text-xs text-[#A0A0A5]">${code}</td>
          <td class="px-4 py-3.5 text-[#A0A0A5]">${dateStr}</td>
          <td class="px-4 py-3.5 font-medium">${prodName}</td>
          <td class="px-4 py-3.5 text-[#A0A0A5]">${supName}</td>
          <td class="px-4 py-3.5 text-[#A0A0A5]" data-label="KASIR" data-cashier-id="${escapeHtml(tx.created_by || '')}">${escapeHtml(kasir)}</td>
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
        : (tx.created_by && !tx.created_by.includes('-') ? tx.created_by : 'David');
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
  window.handleInBarcodeDetected = handleInBarcodeLookup;
  window.handleProductSearchInput = handleProductSearchInput;
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
  window.switchInMode = switchInMode;
  window.autoUpdateInSkuPlaceholder = autoUpdateInSkuPlaceholder;
  window.applyInAutoSku = applyInAutoSku;
  window.getLastProductSequence = getLastProductSequence;
  window.setInPhotoAsPrimary = setInPhotoAsPrimary;
  window.removeInPhotoByIndex = removeInPhotoByIndex;
  window.previewInGalleryPhoto = previewInGalleryPhoto;
  window.handleInImageSelection = handleInImageSelection;
  window.resetInImageForm = resetInImageForm;
  window.applyProductDefaultSupplier = applyProductDefaultSupplier;
  window.refreshSelectedProductPrice = refreshSelectedProductPrice;
  window._getSelectedExistingProduct = () => selectedExistingProduct;
  window._getSelectedSupplierManuallyChanged = () => selectedSupplierManuallyChanged;
  window._getSelectedPriceManuallyChanged = () => selectedPriceManuallyChanged;
  window._setSelectedSupplierManuallyChanged = (val) => { selectedSupplierManuallyChanged = val; };
  window._setSelectedPriceManuallyChanged = (val) => { selectedPriceManuallyChanged = val; };

  if (typeof window !== 'undefined') {
    window.addEventListener('aquastock:products-updated', () => {
      loadDropdowns().catch(console.error);
    });
  }

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
