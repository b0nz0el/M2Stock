  let allOutTransactions = [];
  let availableProducts = [];
  let currentFilterPeriod = 'today';
  let searchQuery = '';
  let currentPage = 1;
  const pageSize = 10;
  let deleteOutId = null;

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

  function getChannelBadge(channel) {
    const ch = (channel || 'Offline').toLowerCase();
    if (ch.includes('shopee')) return `<span class="badge bg-[#EE4D2D]/15 text-[#EE4D2D]">Shopee</span>`;
    if (ch.includes('tokopedia')) return `<span class="badge bg-[#42B549]/15 text-[#42B549]">Tokopedia</span>`;
    if (ch.includes('tiktok')) return `<span class="badge bg-[#00F2FE]/15 text-[#00F2FE]">TikTok</span>`;
    if (ch.includes('lazada')) return `<span class="badge bg-[#0F146D]/20 text-[#32ADE6]">Lazada</span>`;
    if (ch.includes('wa') || ch.includes('whatsapp')) return `<span class="badge bg-[#25D366]/15 text-[#25D366]">WhatsApp</span>`;
    return `<span class="badge bg-[#0088CC]/15 text-[#32ADE6]">Offline</span>`;
  }

  function resolveProductName(tx) {
    if (tx.products && tx.products.name) return tx.products.name;
    if (availableProducts && availableProducts.length > 0) {
      const found = availableProducts.find(p => String(p.id) === String(tx.product_id));
      if (found && found.name) return found.name;
    }
    return 'Produk #' + (tx.product_id || '-');
  }

  async function loadDropdowns() {
    try {
      const prodRes = await Api.items.getAll();
      if (prodRes && prodRes.ok) {
        availableProducts = prodRes.data || [];
        const prodSelect = document.getElementById('out-product-id');
        if (prodSelect) {
          const currentVal = prodSelect.value;
          prodSelect.innerHTML = '<option value="">-- Pilih Produk --</option>';
          availableProducts.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (Stok: ${p.stock ?? 0})`;
            prodSelect.appendChild(opt);
          });
          if (currentVal) prodSelect.value = currentVal;
        }
      }

      const custRes = await Api.customers.getAll();
      if (custRes && custRes.ok) {
        const custSelect = document.getElementById('out-customer-id');
        if (custSelect) {
          const currentCustVal = custSelect.value;
          custSelect.innerHTML = '<option value="">Umum / Non-Pelanggan</option>';
          (custRes.data || []).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            custSelect.appendChild(opt);
          });
          if (currentCustVal) custSelect.value = currentCustVal;
        }
      }
    } catch (err) {
      console.error('Error loading dropdowns:', err);
    }
  }

  function handleOutProductChange() {
    const select = document.getElementById('out-product-id');
    const pId = select.value;
    const prod = availableProducts.find(p => String(p.id) === String(pId));
    const priceInput = document.getElementById('out-price');
    const stockInfo = document.getElementById('out-stock-info');
    const qtyInput = document.getElementById('out-qty');

    if (prod) {
      if (priceInput) priceInput.value = prod.sell_price || 0;
      if (stockInfo) {
        const stock = prod.stock ?? 0;
        stockInfo.textContent = `Sisa stok tersedia: ${stock} unit`;
        stockInfo.className = `text-[11px] mt-1 ${stock > 0 ? 'text-[#34C759]' : 'text-[#FF3B30] font-semibold'}`;
        stockInfo.classList.remove('hidden');
      }
      if (qtyInput) {
        qtyInput.max = prod.stock ?? 0;
      }
    } else {
      if (stockInfo) stockInfo.classList.add('hidden');
    }
    calculateOutTotal();
  }

  function calculateOutTotal() {
    const qty = Number(document.getElementById('out-qty')?.value || 0);
    const price = Number(document.getElementById('out-price')?.value || 0);
    const total = qty * price;
    const preview = document.getElementById('out-total-preview');
    if (preview) {
      preview.textContent = formatRupiahVal(total);
    }
  }

  function openAddOutModal() {
    const form = document.getElementById('form-out');
    if (form) form.reset();
    const photoData = document.getElementById('out-photo-data');
    if (photoData) photoData.value = '';
    const photoPreview = document.getElementById('photo-preview');
    if (photoPreview) photoPreview.classList.add('hidden');
    const photoImg = document.getElementById('photo-preview-img');
    if (photoImg) photoImg.src = '';
    const stockInfo = document.getElementById('out-stock-info');
    if (stockInfo) stockInfo.classList.add('hidden');
    calculateOutTotal();
    loadDropdowns();
    const modal = document.getElementById('modal-out');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function closeOutModal() {
    const photoData = document.getElementById('out-photo-data');
    if (photoData) photoData.value = '';
    const photoPreview = document.getElementById('photo-preview');
    if (photoPreview) photoPreview.classList.add('hidden');
    const photoImg = document.getElementById('photo-preview-img');
    if (photoImg) photoImg.src = '';
    const modal = document.getElementById('modal-out');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function openDeleteOutModal(id) {
    deleteOutId = id;
    const modal = document.getElementById('modal-delete-out');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function closeDeleteOutModal() {
    deleteOutId = null;
    const modal = document.getElementById('modal-delete-out');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  async function handleOutSubmit(e) {
    e.preventDefault();
    const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
    if (role === 'VIEWER') {
      alert('Anda tidak punya akses untuk mengubah data.');
      return;
    }
    const productId = document.getElementById('out-product-id').value;
    const customerId = document.getElementById('out-customer-id').value;
    const channel = document.getElementById('out-channel').value;
    const qty = Number(document.getElementById('out-qty').value);
    const price = Number(document.getElementById('out-price').value);
    const note = document.getElementById('out-note').value.trim();

    if (!productId) {
      if (typeof showToast === 'function') showToast('Pilih produk terlebih dahulu', 'error');
      return;
    }
    if (!qty || qty <= 0) {
      if (typeof showToast === 'function') showToast('Jumlah keluar harus lebih dari 0', 'error');
      return;
    }

    const prod = availableProducts.find(p => String(p.id) === String(productId));
    if (prod && qty > (prod.stock ?? 0)) {
      if (typeof showToast === 'function') {
        showToast(`Stok tidak mencukupi! Tersedia hanya ${prod.stock ?? 0} unit`, 'error');
      }
      return;
    }

    const submitBtn = document.getElementById('btn-submit-out');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Menyimpan...</span>';

    try {
      let currentUserId = null;
      if (typeof window.Auth !== 'undefined') {
        const user = await window.Auth.getCurrentUser();
        currentUserId = user?.id || null;
      }
      const paymentMethod = document.getElementById('out-payment-method')?.value || 'Cash';
      const paymentStatus = paymentMethod === 'Tempo' ? 'Belum Lunas' : 'Lunas';

      const res = await Api.transactions.createOut({
        product_id: productId,
        customer_id: customerId || null,
        channel: channel,
        qty: qty,
        price: price,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        note: note || null,
        created_by: currentUserId
      });

      if (!res.ok) {
        throw new Error(res.error?.message || 'Gagal menyimpan barang keluar');
      }

      if (typeof showToast === 'function') {
        showToast('Barang keluar berhasil dicatat! Stok berkurang.', 'success');
      }
      closeOutModal();
      await loadOutTransactions();
      await loadDropdowns();
      if (res.data && res.data.id) {
        openThermalReceiptModal(res.data.id);
      }
    } catch (err) {
      console.error('Submit out error:', err);
      if (typeof showToast === 'function') {
        showToast(err.message || 'Terjadi kesalahan saat menyimpan', 'error');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    }
  }

  async function confirmDeleteOut() {
    if (!deleteOutId) return;
    const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
    if (role === 'VIEWER') {
      alert('Anda tidak punya akses untuk mengubah data.');
      return;
    }
    const btn = document.getElementById('btn-confirm-delete-out');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Menghapus...</span>';

    try {
      const res = await Api.transactions.delete(deleteOutId);
      if (!res.ok) {
        throw new Error(res.error?.message || 'Gagal menghapus transaksi');
      }
      if (typeof showToast === 'function') {
        showToast('Transaksi berhasil dihapus & stok dikembalikan', 'success');
      }
      closeDeleteOutModal();
      await loadOutTransactions();
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
    let thirtyRevenue = 0, thirtyCost = 0;

    list.forEach(tx => {
      const tTime = new Date(tx.created_at).getTime();
      const qty = tx.qty || 0;
      const sellPrice = tx.price || 0;
      const costPrice = tx.products?.cost_price || 0;
      const amount = qty * sellPrice;

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
        thirtyRevenue += amount;
        thirtyCost += qty * costPrice;
      }
    });

    const thirtyProfit = Math.max(0, thirtyRevenue - thirtyCost);
    const marginPct = thirtyRevenue > 0 ? Math.round((thirtyProfit / thirtyRevenue) * 100) : 0;

    const elTodayCount = document.getElementById('stat-out-today-count');
    const elTodayAmount = document.getElementById('stat-out-today-amount');
    const el7dCount = document.getElementById('stat-out-7d-count');
    const el7dAmount = document.getElementById('stat-out-7d-amount');
    const el30dCount = document.getElementById('stat-out-30d-count');
    const el30dAmount = document.getElementById('stat-out-30d-amount');
    const elProfit = document.getElementById('stat-out-profit-amount');
    const elMargin = document.getElementById('stat-out-margin-text');

    if (elTodayCount) elTodayCount.textContent = `-${todayCount}`;
    if (elTodayAmount) elTodayAmount.textContent = formatShortRupiah(todayAmount);
    if (el7dCount) el7dCount.textContent = `-${sevenCount}`;
    if (el7dAmount) el7dAmount.textContent = formatShortRupiah(sevenAmount);
    if (el30dCount) el30dCount.textContent = `-${thirtyCount}`;
    if (el30dAmount) el30dAmount.textContent = formatShortRupiah(thirtyAmount);
    if (elProfit) elProfit.textContent = formatShortRupiah(thirtyProfit);
    if (elMargin) elMargin.textContent = `Margin ${marginPct}%`;
  }

  function filterOutPeriod(period) {
    currentFilterPeriod = period;
    currentPage = 1;
    const buttons = document.querySelectorAll('.out-period-btn');
    buttons.forEach(btn => {
      if (btn.getAttribute('data-period') === period) {
        btn.classList.add('active', 'bg-[#0088CC]', 'text-white');
        btn.classList.remove('bg-[#1C1C1E]', 'border', 'border-white/5');
      } else {
        btn.classList.remove('active', 'bg-[#0088CC]', 'text-white');
        btn.classList.add('bg-[#1C1C1E]', 'border', 'border-white/5');
      }
    });
    renderOutTable();
  }

  function handleSearchOut(val) {
    searchQuery = (val || '').trim().toLowerCase();
    const searchInput = document.getElementById('search-out');
    const globalInput = document.getElementById('global-search');
    if (searchInput && searchInput.value !== val) searchInput.value = val || '';
    if (globalInput && globalInput.value !== val) globalInput.value = val || '';
    currentPage = 1;
    renderOutTable();
  }

  function goToOutPage(page) {
    currentPage = page;
    renderOutTable();
  }

  function renderOutPagination(totalFiltered) {
    const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(currentPage * pageSize, totalFiltered);

    const infoEl = document.getElementById('out-pagination-info');
    if (infoEl) {
      infoEl.textContent = `Menampilkan ${startIdx}-${endIdx} dari ${totalFiltered} data`;
    }

    const btnContainer = document.getElementById('out-pagination-buttons');
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
    prevBtn.onclick = () => goToOutPage(currentPage - 1);
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
      pageBtn.onclick = () => goToOutPage(p);
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
    nextBtn.onclick = () => goToOutPage(currentPage + 1);
    nextBtn.innerHTML = '<i data-lucide="chevron-right" class="w-4 h-4" aria-hidden="true"></i>';
    btnContainer.appendChild(nextBtn);

    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function renderOutTable() {
    const tbody = document.getElementById('out-tbody');
    if (!tbody) return;

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const filtered = allOutTransactions.filter(tx => {
      const tTime = new Date(tx.created_at).getTime();
      if (currentFilterPeriod === 'today' && tTime < startToday) return false;
      if (currentFilterPeriod === '7d' && tTime < sevenDaysAgo) return false;
      if (currentFilterPeriod === '30d' && tTime < thirtyDaysAgo) return false;

      if (searchQuery) {
        const code = (tx.note && (tx.note.includes('SPX-') || tx.note.includes('INV-') || tx.note.includes('TKP-'))
          ? tx.note.split(' ')[0]
          : `OUT-${String(tx.id).padStart(6, '0')}`).toLowerCase();
        const prodName = resolveProductName(tx).toLowerCase();
        const custName = (tx.customers?.name || 'umum').toLowerCase();
        const channel = (tx.channel || 'offline').toLowerCase();
        const kasir = (tx.created_by || '').toLowerCase();
        const note = (tx.note || tx.notes || '').toLowerCase();

        if (!code.includes(searchQuery) &&
            !prodName.includes(searchQuery) &&
            !custName.includes(searchQuery) &&
            !channel.includes(searchQuery) &&
            !kasir.includes(searchQuery) &&
            !note.includes(searchQuery)) {
          return false;
        }
      }
      return true;
    });

    renderOutPagination(filtered.length);

    const pagWrap = document.getElementById('out-pagination-wrap');
    if (filtered.length === 0) {
      if (pagWrap) pagWrap.classList.add('hidden');
      const emptyText = searchQuery
        ? 'Tidak ada data barang keluar yang cocok dengan pencarian / filter'
        : (currentFilterPeriod === 'today' && allOutTransactions.length > 0)
          ? `Belum ada transaksi barang keluar hari ini (Ada ${allOutTransactions.length} transaksi di periode lainnya. Klik tab filter 'Semua' untuk melihat).`
          : 'Belum ada transaksi barang keluar pada periode ini';
      tbody.innerHTML = `
        <tr class="empty-state-row table-row">
          <td colspan="10" class="empty-state-cell px-4 py-12 text-center text-[#A0A0A5]">
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
      const code = tx.note && (tx.note.includes('SPX-') || tx.note.includes('INV-') || tx.note.includes('TKP-'))
        ? tx.note.split(' ')[0]
        : `OUT-${String(tx.id).padStart(6, '0')}`;
      const dateStr = formatTxDate(tx.created_at);
      const prodName = resolveProductName(tx);
      const channelBadge = getChannelBadge(tx.channel);
      const custName = tx.customers?.name || 'Umum';
      const kasir = tx.created_by ? (tx.created_by.slice(0, 8) + '...') : 'Admin';
      const qty = tx.qty || 0;
      const price = tx.price || 0;
      const total = qty * price;

      return `
        <tr class="table-row border-b border-white/5">
          <td class="px-4 py-3.5 font-mono text-xs text-[#A0A0A5]">${code}</td>
          <td class="px-4 py-3.5 text-[#A0A0A5]">${dateStr}</td>
          <td class="px-4 py-3.5 font-medium">${prodName}</td>
          <td class="px-4 py-3.5">${channelBadge}</td>
          <td class="px-4 py-3.5 text-[#A0A0A5]">${custName}</td>
          <td class="px-4 py-3.5 text-[#A0A0A5]">${kasir}</td>
          <td class="px-4 py-3.5 text-right text-[#FF3B30] font-semibold">-${qty}</td>
          <td class="px-4 py-3.5 text-right text-[#A0A0A5]">${formatRupiahVal(price)}</td>
          <td class="px-4 py-3.5 text-right font-semibold text-white">${formatRupiahVal(total)}</td>
          <td class="px-4 py-3.5 text-right">
            <div class="flex items-center justify-end gap-1">
              <button type="button" data-action="print-receipt" data-transaction-id="${tx.id}" title="Cetak Struk Kasir" aria-label="Cetak Struk Kasir"
                      class="p-1.5 hover:bg-white/5 rounded-lg text-[#32ADE6] hover:text-white transition">
                <i data-lucide="receipt" class="w-4 h-4" aria-hidden="true"></i>
              </button>
              <button type="button" data-action="delete" data-transaction-id="${tx.id}" title="Hapus transaksi" aria-label="Hapus transaksi"
                      class="p-1.5 hover:bg-white/5 rounded-lg text-[#FF3B30] transition">
                <i data-lucide="trash-2" class="w-4 h-4" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    if (typeof window.syncTableLabels === 'function') window.syncTableLabels();
  }

  function openPackingListModal() {
    const modal = document.getElementById('modal-packing-list');
    const tbody = document.getElementById('packing-list-tbody');
    const mobileList = document.getElementById('packing-list-mobile-list');
    const dateText = document.getElementById('packing-date-text');
    const countBadge = document.getElementById('packing-total-orders');

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Ambil transaksi keluar hari ini (atau fallback 10 transaksi terakhir)
    let todaysOut = allOutTransactions.filter(tx => new Date(tx.created_at).getTime() >= startToday);
    if (todaysOut.length === 0) {
      todaysOut = allOutTransactions.slice(0, 10);
    }

    const dStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (dateText) dateText.textContent = `Tanggal: ${dStr}`;
    if (countBadge) countBadge.textContent = `${todaysOut.length} Pesanan`;

    if (tbody) {
      if (todaysOut.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-[#A0A0A5]">Belum ada pesanan keluar hari ini</td></tr>`;
      } else {
        tbody.innerHTML = todaysOut.map(tx => {
          const code = tx.note && (tx.note.includes('SPX-') || tx.note.includes('INV-') || tx.note.includes('TKP-'))
            ? tx.note.split(' ')[0]
            : `OUT-${String(tx.id).padStart(6, '0')}`;
          const prodName = tx.products?.name || ('Produk #' + tx.product_id);
          const channel = tx.channel || 'Offline';
          const cust = tx.customers?.name || 'Umum';
          const qty = tx.qty || 0;

          return `
            <tr class="border-b border-white/5 print:border-gray-200">
              <td class="py-2.5 px-2 font-mono text-xs whitespace-nowrap">${code}</td>
              <td class="py-2.5 px-2 font-medium">${prodName}</td>
              <td class="py-2.5 px-2 text-center font-bold text-white print:text-black whitespace-nowrap">${qty}</td>
              <td class="py-2.5 px-2 whitespace-nowrap">${channel}</td>
              <td class="py-2.5 px-2 text-[#A0A0A5] print:text-gray-700">${cust}</td>
              <td class="py-2.5 px-2 text-center">
                <div class="w-4 h-4 border border-white/20 print:border-black rounded mx-auto inline-block"></div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    if (mobileList) {
      if (todaysOut.length === 0) {
        mobileList.innerHTML = `<div class="text-center py-6 text-sm text-[#A0A0A5]">Belum ada pesanan keluar hari ini</div>`;
      } else {
        mobileList.innerHTML = todaysOut.map(tx => {
          const code = tx.note && (tx.note.includes('SPX-') || tx.note.includes('INV-') || tx.note.includes('TKP-'))
            ? tx.note.split(' ')[0]
            : `OUT-${String(tx.id).padStart(6, '0')}`;
          const prodName = tx.products?.name || ('Produk #' + tx.product_id);
          const channel = tx.channel || 'Offline';
          const cust = tx.customers?.name || 'Umum';
          const qty = tx.qty || 0;

          return `
            <div class="p-3 bg-white/[0.03] border border-white/10 rounded-xl space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="font-mono text-[#32ADE6] bg-[#0088CC]/10 px-2 py-0.5 rounded font-semibold">${code}</span>
                <span class="bg-white/5 px-2 py-0.5 rounded text-[#A0A0A5] font-medium">${channel}</span>
              </div>
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-sm text-white truncate">${prodName}</p>
                  <p class="text-xs text-[#A0A0A5] mt-0.5">Customer: <span class="text-white">${cust}</span></p>
                </div>
                <div class="text-right flex-shrink-0">
                  <span class="text-[10px] uppercase tracking-wider text-[#A0A0A5] block">Qty</span>
                  <p class="text-base font-bold text-white">${qty}</p>
                </div>
              </div>
              <div class="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-[#A0A0A5]">
                <span>Pengecekan Barang</span>
                <label class="flex items-center gap-1.5 cursor-pointer text-white hover:text-[#32ADE6]">
                  <input type="checkbox" class="w-4 h-4 rounded border-white/20 accent-[#0088CC] cursor-pointer">
                  <span class="text-xs select-none">Siap Kirim</span>
                </label>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function closePackingListModal() {
    const modal = document.getElementById('modal-packing-list');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  let activeReceiptTx = null;

  async function openThermalReceiptModal(txId) {
    const tx = allOutTransactions.find(t => String(t.id) === String(txId));
    if (!tx) {
      if (typeof showToast === 'function') showToast('Transaksi tidak ditemukan', 'error');
      return;
    }
    activeReceiptTx = tx;

    const code = tx.note && (tx.note.includes('SPX-') || tx.note.includes('INV-') || tx.note.includes('TKP-'))
      ? tx.note.split(' ')[0]
      : `OUT-${String(tx.id).padStart(6, '0')}`;
    const dateStr = formatTxDate(tx.created_at);
    const prodName = tx.products?.name || ('Produk #' + tx.product_id);
    const custName = tx.customers?.name || 'Umum';
    const kasir = tx.created_by ? (tx.created_by.slice(0, 8) + '...') : 'Admin';
    const qty = tx.qty || 0;
    const price = tx.price || 0;
    const total = qty * price;
    const method = tx.payment_method || 'Cash';
    const status = (tx.payment_status || 'Lunas').toUpperCase();

    const elCode = document.getElementById('receipt-meta-code');
    const elDate = document.getElementById('receipt-meta-date');
    const elCashier = document.getElementById('receipt-meta-cashier');
    const elCustomer = document.getElementById('receipt-meta-customer');
    const elMethod = document.getElementById('receipt-meta-method');
    const elItems = document.getElementById('receipt-items-list');
    const elTotal = document.getElementById('receipt-calc-total');
    const elPaid = document.getElementById('receipt-calc-paid');
    const elChange = document.getElementById('receipt-calc-change');
    const elStatus = document.getElementById('receipt-calc-status');
    const inputBayar = document.getElementById('receipt-input-bayar');

    if (elCode) elCode.textContent = code;
    if (elDate) elDate.textContent = dateStr;
    if (elCashier) elCashier.textContent = kasir;
    if (elCustomer) elCustomer.textContent = custName;
    if (elMethod) elMethod.textContent = method;
    if (elStatus) elStatus.textContent = status;

    // Sinkronkan profil toko dinamis ke struk kasir
    try {
      let storeInfo = (typeof window !== 'undefined' && window.Api?.settings?.getStoreInfo)
        ? await window.Api.settings.getStoreInfo()
        : null;
      if (!storeInfo && typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem('aquastock_store_info');
        if (cached) {
          try { storeInfo = JSON.parse(cached); } catch (_) {}
        }
      }
      if (storeInfo) {
        const elStoreName = document.getElementById('receipt-store-name');
        const elStoreSlogan = document.getElementById('receipt-store-slogan');
        const elStoreAddress = document.getElementById('receipt-store-address');
        const elStorePhone = document.getElementById('receipt-store-phone');
        if (elStoreName && storeInfo.name) elStoreName.textContent = storeInfo.name;
        if (elStoreSlogan && storeInfo.slogan) elStoreSlogan.textContent = storeInfo.slogan;
        if (elStoreAddress && storeInfo.address) elStoreAddress.textContent = storeInfo.address;
        if (elStorePhone && storeInfo.phone) elStorePhone.textContent = `WA: ${storeInfo.phone}`;
      }
    } catch (_) {}

    if (elItems) {
      elItems.innerHTML = `
        <div class="space-y-0.5">
          <p class="font-bold text-black">${prodName}</p>
          <div class="flex justify-between text-gray-700">
            <span>${qty} x ${formatRupiahVal(price)}</span>
            <span class="font-bold text-black">${formatRupiahVal(total)}</span>
          </div>
        </div>
      `;
    }

    if (elTotal) elTotal.textContent = formatRupiahVal(total);
    if (inputBayar) inputBayar.value = total;
    if (elPaid) elPaid.textContent = formatRupiahVal(total);
    if (elChange) elChange.textContent = formatRupiahVal(0);

    const modal = document.getElementById('modal-thermal-receipt');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function closeThermalReceiptModal() {
    activeReceiptTx = null;
    const modal = document.getElementById('modal-thermal-receipt');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function setReceiptPaperWidth(size) {
    const paper = document.getElementById('receipt-paper');
    const btn58 = document.getElementById('btn-paper-58mm');
    const btn80 = document.getElementById('btn-paper-80mm');

    if (size === '80mm') {
      if (paper) {
        paper.classList.remove('w-[58mm]');
        paper.classList.add('w-[80mm]');
      }
      if (btn80) {
        btn80.classList.remove('bg-[#1C1C1E]', 'text-[#A0A0A5]');
        btn80.classList.add('bg-[#0088CC]', 'text-white');
      }
      if (btn58) {
        btn58.classList.remove('bg-[#0088CC]', 'text-white');
        btn58.classList.add('bg-[#1C1C1E]', 'text-[#A0A0A5]');
      }
    } else {
      if (paper) {
        paper.classList.remove('w-[80mm]');
        paper.classList.add('w-[58mm]');
      }
      if (btn58) {
        btn58.classList.remove('bg-[#1C1C1E]', 'text-[#A0A0A5]');
        btn58.classList.add('bg-[#0088CC]', 'text-white');
      }
      if (btn80) {
        btn80.classList.remove('bg-[#0088CC]', 'text-white');
        btn80.classList.add('bg-[#1C1C1E]', 'text-[#A0A0A5]');
      }
    }
  }

  function calculateReceiptChange() {
    if (!activeReceiptTx) return;
    const total = (activeReceiptTx.qty || 0) * (activeReceiptTx.price || 0);
    const inputVal = Number(document.getElementById('receipt-input-bayar')?.value || 0);
    const change = Math.max(0, inputVal - total);

    const elPaid = document.getElementById('receipt-calc-paid');
    const elChange = document.getElementById('receipt-calc-change');
    if (elPaid) elPaid.textContent = formatRupiahVal(inputVal);
    if (elChange) elChange.textContent = formatRupiahVal(change);
  }

  function executeReceiptPrint() {
    document.body.classList.remove('print-mode-packing');
    document.body.classList.add('print-mode-receipt');
    window.print();
  }

  function executePackingListPrint() {
    document.body.classList.remove('print-mode-receipt');
    document.body.classList.add('print-mode-packing');
    window.print();
  }

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('print-mode-receipt', 'print-mode-packing');
  });

  window.openThermalReceiptModal = openThermalReceiptModal;
  window.closeThermalReceiptModal = closeThermalReceiptModal;
  window.setReceiptPaperWidth = setReceiptPaperWidth;
  window.calculateReceiptChange = calculateReceiptChange;
  window.executeReceiptPrint = executeReceiptPrint;
  window.executePackingListPrint = executePackingListPrint;

  async function handleRefreshOut() {
    const headerBtn = document.getElementById('btn-refresh-out-header');
    const iconHeader = headerBtn ? headerBtn.querySelector('svg, i') : null;

    if (iconHeader) iconHeader.classList.add('animate-spin');

    try {
      await loadOutTransactions();
      await loadDropdowns();
      if (typeof showToast === 'function') {
        showToast('Data berhasil di-refresh', 'success');
      }
    } catch (err) {
      console.error('Refresh out error:', err);
      if (typeof showToast === 'function') {
        showToast('Gagal memuat ulang data', 'error');
      }
    } finally {
      setTimeout(() => {
        if (iconHeader) iconHeader.classList.remove('animate-spin');
      }, 500);
    }
  }

  function setupSearchListeners() {
    const searchInput = document.getElementById('search-out');
    const globalInput = document.getElementById('global-search');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        handleSearchOut(e.target.value);
      });
    }

    if (globalInput) {
      globalInput.addEventListener('input', (e) => {
        handleSearchOut(e.target.value);
      });
    }
  }

  function handleExportOut() {
    if (!allOutTransactions || allOutTransactions.length === 0) {
      if (typeof showToast === 'function') showToast('Tidak ada data barang keluar untuk diexport', 'warning');
      return;
    }

    const headers = ['No. Transaksi / Resi', 'Tanggal', 'Nama Barang', 'Channel', 'Customer', 'Kasir', 'Jumlah', 'Harga Jual (Rp)', 'Total (Rp)', 'Catatan'];
    const rows = allOutTransactions.map(tx => {
      const code = tx.note && (tx.note.includes('SPX-') || tx.note.includes('INV-') || tx.note.includes('TKP-'))
        ? tx.note.split(' ')[0]
        : `OUT-${String(tx.id).padStart(6, '0')}`;
      const dateStr = formatTxDate(tx.created_at);
      const prodName = tx.products?.name || ('Produk #' + tx.product_id);
      const channel = tx.channel || 'Offline';
      const custName = tx.customers?.name || 'Umum';
      const kasir = tx.created_by ? (tx.created_by.slice(0, 8) + '...') : 'Admin';
      const qty = tx.qty || 0;
      const price = tx.price || 0;
      const total = qty * price;
      const note = tx.note || '';

      return [code, dateStr, prodName, channel, custName, kasir, qty, price, total, note];
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const filename = `barang-keluar-${todayStr}.csv`;
    if (typeof exportToCSV === 'function') {
      exportToCSV(filename, rows, headers);
      if (typeof showToast === 'function') showToast(`Berhasil export ${rows.length} transaksi barang keluar`, 'success');
    }
  }

  async function loadOutTransactions() {
    try {
      const res = await Api.transactions.getByType('out');
      if (res && res.ok) {
        allOutTransactions = res.data || [];
        updateMetrics(allOutTransactions);
        renderOutTable();
      }
    } catch (err) {
      console.error('Error loading out transactions:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupSearchListeners();
    loadOutTransactions();
    loadDropdowns();
    document.getElementById('out-tbody')?.addEventListener('click', function (event) {
      const printBtn = event.target.closest('[data-action="print-receipt"]');
      if (printBtn) {
        event.stopPropagation();
        openThermalReceiptModal(printBtn.dataset.transactionId);
        return;
      }
      const deleteBtn = event.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        openDeleteOutModal(deleteBtn.dataset.transactionId);
        return;
      }
      const button = event.target.closest('[data-transaction-id]');
      if (button) openDeleteOutModal(button.dataset.transactionId);
    });

    document.getElementById('btn-import-out')?.addEventListener('click', function () {
      if (typeof window.startCsvImport !== 'function') {
        showToast('Fitur import belum siap. Muat ulang halaman dan coba lagi.', 'error');
        return;
      }

      const headers = ['SKU', 'Barcode', 'Jumlah', 'Harga Satuan (Rp)', 'Customer', 'Channel', 'Tanggal (YYYY-MM-DD)', 'Catatan'];
      window.startCsvImport({
        title: 'Barang Keluar',
        templateName: 'template-barang-keluar.csv',
        headers,
        requiredHeaders: headers,
        templateRows: [],
        preventReimport: true,
        validate: async function (records) {
          const [productsResult, customersResult] = await Promise.all([
            Api.items.getAll(),
            Api.customers.getAll()
          ]);
          if (!productsResult?.ok) throw new Error(productsResult?.error?.message || 'Gagal memuat produk.');
          if (!customersResult?.ok) throw new Error(customersResult?.error?.message || 'Gagal memuat customer.');

          const products = productsResult.data || [];
          const customers = new Set((customersResult.data || []).map(customer => String(customer.name).trim().toLowerCase()));
          const remainingStock = new Map(products.map(product => [String(product.id), Number(product.stock) || 0]));
          const rows = [];
          const errors = [];
          records.forEach((record, index) => {
            const rowNumber = index + 2;
            const sku = record['SKU'].trim();
            const barcode = record['Barcode'].trim();
            const quantityText = record['Jumlah'].trim();
            const priceText = record['Harga Satuan (Rp)'].trim();
            const customer = record['Customer'].trim();
            const channel = record['Channel'].trim() || 'Offline';
            const date = record['Tanggal (YYYY-MM-DD)'].trim();
            const rowErrorsBefore = errors.length;

            if (!sku && !barcode) errors.push({ row: rowNumber, message: 'SKU atau barcode wajib diisi.' });
            const matches = products.filter(product =>
              (sku && String(product.sku || '').trim() === sku)
              || (barcode && String(product.barcode || '').trim() === barcode));
            const product = matches.length === 1 ? matches[0] : null;
            if (!product) {
              errors.push({ row: rowNumber, message: 'Produk tidak ditemukan atau SKU dan barcode menunjuk ke produk berbeda.' });
            }
            if (!/^\d+$/.test(quantityText) || Number(quantityText) <= 0) {
              errors.push({ row: rowNumber, message: 'Jumlah harus bilangan bulat lebih dari nol.' });
            }
            if (!/^\d+(\.\d+)?$/.test(priceText)) {
              errors.push({ row: rowNumber, message: 'Harga satuan harus berupa angka nol atau lebih.' });
            }
            if (customer && !customers.has(customer.toLowerCase())) {
              errors.push({ row: rowNumber, message: `Customer "${customer}" tidak ditemukan.` });
            }
            if (date && !window.isValidCsvImportDate(date)) {
              errors.push({ row: rowNumber, message: 'Tanggal harus berformat YYYY-MM-DD.' });
            }
            if (errors.length === rowErrorsBefore && product && /^\d+$/.test(quantityText)) {
              const available = remainingStock.get(String(product.id)) || 0;
              if (Number(quantityText) > available) {
                errors.push({ row: rowNumber, message: `Stok ${product.name} tidak cukup pada baris ini (tersedia ${available}).` });
              } else {
                remainingStock.set(String(product.id), available - Number(quantityText));
              }
            }
            if (errors.length !== rowErrorsBefore) return;
            rows.push({
              sku,
              barcode,
              quantity: Number(quantityText),
              unit_price: Number(priceText),
              supplier: '',
              customer,
              channel,
              date,
              notes: record['Catatan'].trim()
            });
          });
          return { rows, errors };
        },
        commit: async function (rows, fileHash) {
          const { data, error } = await window.supabase.rpc('import_inventory_transactions', {
            p_type: 'out',
            p_rows: rows,
            p_file_hash: fileHash
          });
          return error ? { ok: false, error } : { ok: true, data };
        },
        onComplete: loadOutTransactions
      });
    });
  });

/* ==========================================================
 * WEB BARCODE SCANNER + PHOTO CAPTURE
 * Hybrid: BarcodeDetector native → fallback html5-qrcode
 * Hardened: Race-condition free, memory leak-free, zero-resurrection RAF
 * ========================================================== */

let _scanStream = null;
let _scanRAF = null;
let _scanDetector = null;
let _scanDebounce = false;
let _html5Scanner = null;
let _isStartingScan = false;
let _scannerEscHandler = null;

let _photoStream = null;
let _isStartingPhoto = false;
let _photoEscHandler = null;

const SCAN_FORMATS = ['code_128', 'qr_code', 'ean_13', 'code_39', 'code_93'];

function isSecureContext() {
  return window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

function hasNativeBarcodeDetector() {
  return typeof window.BarcodeDetector === 'function';
}

function triggerScanFeedback() {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate([80]);
    }
  } catch (_) {}
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  } catch (_) {}
}

async function startWebBarcodeScan() {
  if (_isStartingScan || _scanStream || _html5Scanner) return;
  if (!isSecureContext()) {
    showToast('Fitur kamera butuh HTTPS. Hubungi admin.', 'error');
    return;
  }
  _isStartingScan = true;

  if (hasNativeBarcodeDetector()) {
    await startNativeScanner();
    return;
  }
  await startFallbackScanner();
}

async function startNativeScanner() {
  try {
    const supported = typeof BarcodeDetector.getSupportedFormats === 'function'
      ? await BarcodeDetector.getSupportedFormats()
      : [];
    const formats = SCAN_FORMATS.filter((f) => supported.includes(f));
    if (formats.length === 0) {
      // BarcodeDetector exists but does not support our formats, use fallback
      await startFallbackScanner();
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      audio: false,
    });
    _scanStream = stream;

    const modal = createScannerModal();
    const video = modal.querySelector('#scanner-video');
    video.srcObject = stream;
    await video.play();

    _scanDetector = new BarcodeDetector({ formats });

    let lastScan = 0;
    const tick = async (now) => {
      if (!_scanStream || !_scanDetector) return;
      if (now - lastScan > 100) {
        lastScan = now;
        try {
          const codes = await _scanDetector.detect(video);
          if (!_scanStream || !_scanDetector) return; // guard against in-flight teardown
          if (codes.length > 0 && !_scanDebounce) {
            _scanDebounce = true;
            handleScanSuccess(codes[0].rawValue);
            return;
          }
        } catch (_) {}
      }
      if (_scanStream && _scanDetector) {
        _scanRAF = requestAnimationFrame(tick);
      }
    };
    _scanRAF = requestAnimationFrame(tick);

    bindScannerControls(modal);
    window.refreshIcons?.();
  } catch (err) {
    handleScannerError(err);
  } finally {
    _isStartingScan = false;
  }
}

async function startFallbackScanner() {
  const modal = createScannerModal({ hideVideo: true });
  const container = modal.querySelector('#scanner-fallback-container');

  try {
    if (typeof Html5Qrcode === 'undefined') {
      throw new Error('Library html5-qrcode belum selesai dimuat. Coba lagi beberapa saat.');
    }
    _html5Scanner = new Html5Qrcode(container.id, { verbose: false });
    await _html5Scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        if (_scanDebounce) return;
        _scanDebounce = true;
        handleScanSuccess(decodedText);
      },
      () => {}
    );
    bindScannerControls(modal);
    window.refreshIcons?.();
  } catch (err) {
    handleScannerError(err);
  } finally {
    _isStartingScan = false;
  }
}

function createScannerModal({ hideVideo = false } = {}) {
  document.getElementById('scanner-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'scanner-modal';
  modal.className = 'fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="relative w-full max-w-md bg-[#1C1C1E] rounded-2xl border border-white/10 overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h3 class="text-sm font-semibold text-white">Scan Barcode</h3>
        <div class="flex gap-2">
          <button id="btn-toggle-torch" class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center transition" title="Flash">
            <i data-lucide="flashlight" class="w-4 h-4"></i>
          </button>
          <button id="btn-close-scanner" class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center transition" title="Tutup">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
      <div class="relative bg-black aspect-square overflow-hidden">
        <video id="scanner-video" autoplay playsinline muted class="w-full h-full object-cover ${hideVideo ? 'hidden' : ''}"></video>
        <div id="scanner-fallback-container" class="w-full h-full"></div>
        <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div class="w-64 h-64 border-2 border-[#0088CC] rounded-lg relative">
            <div class="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#0088CC] rounded-tl"></div>
            <div class="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#0088CC] rounded-tr"></div>
            <div class="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#0088CC] rounded-bl"></div>
            <div class="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#0088CC] rounded-br"></div>
          </div>
        </div>
      </div>
      <div class="px-4 py-3 text-center">
        <p class="text-xs text-white/50">Arahkan kamera ke barcode resi</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeWebBarcodeScan();
  });
  return modal;
}

function bindScannerControls(modal) {
  modal.querySelector('#btn-close-scanner')?.addEventListener('click', closeWebBarcodeScan);

  const torchBtn = modal.querySelector('#btn-toggle-torch');
  if (torchBtn && _scanStream) {
    const track = _scanStream.getVideoTracks()[0];
    const caps = track?.getCapabilities?.() || {};
    if (!caps.torch) {
      torchBtn.style.display = 'none';
    } else {
      let torchOn = false;
      torchBtn.addEventListener('click', async () => {
        try {
          torchOn = !torchOn;
          await track.applyConstraints({ advanced: [{ torch: torchOn }] });
          torchBtn.classList.toggle('bg-[#0088CC]/30', torchOn);
          torchBtn.classList.toggle('text-[#0088CC]', torchOn);
        } catch (_) {}
      });
    }
  } else if (torchBtn) {
    torchBtn.style.display = 'none';
  }

  if (_scannerEscHandler) {
    document.removeEventListener('keydown', _scannerEscHandler);
  }
  _scannerEscHandler = (e) => {
    if (e.key === 'Escape') {
      closeWebBarcodeScan();
    }
  };
  document.addEventListener('keydown', _scannerEscHandler);
}

function handleScanSuccess(decodedText) {
  triggerScanFeedback();
  const input = document.getElementById('out-note');
  if (input) {
    input.value = decodedText;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  showToast(`Barcode terbaca: ${decodedText.slice(0, 30)}...`, 'success');
  setTimeout(closeWebBarcodeScan, 300);
}

function closeWebBarcodeScan() {
  if (_scannerEscHandler) {
    document.removeEventListener('keydown', _scannerEscHandler);
    _scannerEscHandler = null;
  }
  if (_scanRAF) {
    cancelAnimationFrame(_scanRAF);
    _scanRAF = null;
  }
  if (_html5Scanner) {
    const scanner = _html5Scanner;
    _html5Scanner = null;
    try {
      scanner.stop().catch(() => {}).finally(() => {
        try { scanner.clear(); } catch (_) {}
      });
    } catch (_) {}
  }
  const video = document.getElementById('scanner-video');
  if (video) {
    video.srcObject = null;
  }
  if (_scanStream) {
    _scanStream.getTracks().forEach((t) => t.stop());
    _scanStream = null;
  }
  _scanDetector = null;
  _scanDebounce = false;
  _isStartingScan = false;
  document.getElementById('scanner-modal')?.remove();
}

function handleScannerError(err) {
  closeWebBarcodeScan();
  const name = err?.name || '';
  const map = {
    NotAllowedError: 'Izin kamera ditolak. Aktifkan di pengaturan browser.',
    NotFoundError: 'Tidak ada kamera terdeteksi di perangkat ini.',
    NotReadableError: 'Kamera sedang dipakai aplikasi lain.',
    OverconstrainedError: 'Kamera tidak mendukung mode ini.',
    SecurityError: 'Kamera butuh HTTPS.',
  };
  showToast(map[name] || `Gagal buka kamera: ${err?.message || 'unknown'}`, 'error');
}

async function takePhotoCapture() {
  if (_isStartingPhoto || _photoStream) return;
  if (!isSecureContext()) {
    showToast('Fitur kamera butuh HTTPS.', 'error');
    return;
  }
  _isStartingPhoto = true;

  let stream = null;
  let modal = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
      audio: false,
    });
    _photoStream = stream;

    document.getElementById('photo-modal')?.remove();

    modal = document.createElement('div');
    modal.id = 'photo-modal';
    modal.className = 'fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="relative w-full max-w-md bg-[#1C1C1E] rounded-2xl border border-white/10 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 class="text-sm font-semibold text-white">Ambil Foto Bukti</h3>
          <button id="photo-close" class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center transition">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <video id="photo-video" autoplay playsinline muted class="w-full aspect-square object-cover bg-black"></video>
        <div class="p-4 flex gap-2">
          <button id="photo-cancel" class="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium transition">Batal</button>
          <button id="photo-capture" class="flex-1 py-2 rounded-lg bg-[#0088CC] hover:bg-[#0088CC]/80 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-[#0088CC]/20 transition">
            <i data-lucide="camera" class="w-4 h-4"></i> Ambil
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    window.refreshIcons?.();

    const video = modal.querySelector('#photo-video');
    video.srcObject = stream;
    await video.play();

    const cleanup = () => {
      if (_photoEscHandler) {
        document.removeEventListener('keydown', _photoEscHandler);
        _photoEscHandler = null;
      }
      if (video) video.srcObject = null;
      if (_photoStream) {
        _photoStream.getTracks().forEach((t) => t.stop());
        _photoStream = null;
      }
      modal?.remove();
      _isStartingPhoto = false;
    };

    modal.addEventListener('click', (e) => {
      if (e.target === modal) cleanup();
    });

    _photoEscHandler = (e) => {
      if (e.key === 'Escape') cleanup();
    };
    document.addEventListener('keydown', _photoEscHandler);

    modal.querySelector('#photo-close').onclick = cleanup;
    modal.querySelector('#photo-cancel').onclick = cleanup;
    modal.querySelector('#photo-capture').onclick = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      const photoInput = document.getElementById('out-photo-data');
      if (photoInput) photoInput.value = dataUrl;

      const previewImg = document.getElementById('photo-preview-img');
      if (previewImg) previewImg.src = dataUrl;

      const previewContainer = document.getElementById('photo-preview');
      if (previewContainer) previewContainer.classList.remove('hidden');

      cleanup();
      showToast('Foto tersimpan', 'success');
    };
  } catch (err) {
    if (_photoEscHandler) {
      document.removeEventListener('keydown', _photoEscHandler);
      _photoEscHandler = null;
    }
    if (_photoStream) {
      _photoStream.getTracks().forEach((t) => t.stop());
      _photoStream = null;
    }
    modal?.remove();
    _isStartingPhoto = false;
    handleScannerError(err);
  }
}

// Auto close camera streams when tab is hidden to save battery & release device hardware
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    closeWebBarcodeScan();
    if (_photoStream) {
      if (_photoEscHandler) {
        document.removeEventListener('keydown', _photoEscHandler);
        _photoEscHandler = null;
      }
      _photoStream.getTracks().forEach((t) => t.stop());
      _photoStream = null;
      _isStartingPhoto = false;
      document.getElementById('photo-modal')?.remove();
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-scan-barcode')?.addEventListener('click', startWebBarcodeScan);
  document.getElementById('btn-take-photo')?.addEventListener('click', takePhotoCapture);
  document.getElementById('btn-remove-photo')?.addEventListener('click', () => {
    const photoInput = document.getElementById('out-photo-data');
    if (photoInput) photoInput.value = '';
    const previewImg = document.getElementById('photo-preview-img');
    if (previewImg) previewImg.src = '';
    document.getElementById('photo-preview')?.classList.add('hidden');
  });
  window.refreshIcons?.();
});

/* ==========================================================
 * END OF WEB BARCODE SCANNER MODULE
 * ========================================================== */
