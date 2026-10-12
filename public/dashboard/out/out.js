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

  async function loadDropdowns() {
    try {
      const prodRes = await Api.items.getAll();
      if (prodRes && prodRes.ok) {
        availableProducts = prodRes.data || [];
        const prodSelect = document.getElementById('out-product-id');
        if (prodSelect) {
          prodSelect.innerHTML = '<option value="">-- Pilih Produk --</option>';
          availableProducts.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (Stok: ${p.stock ?? 0})`;
            prodSelect.appendChild(opt);
          });
        }
      }

      const custRes = await Api.customers.getAll();
      if (custRes && custRes.ok) {
        const custSelect = document.getElementById('out-customer-id');
        if (custSelect) {
          custSelect.innerHTML = '<option value="">Umum / Non-Pelanggan</option>';
          (custRes.data || []).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            custSelect.appendChild(opt);
          });
        }
      }
    } catch (err) {
      console.error('Error loading dropdowns:', err);
    }
  }

  function handleOutProductChange() {
    const select = document.getElementById('out-product-id');
    const pId = select.value;
    const prod = availableProducts.find(p => Number(p.id) === Number(pId));
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

    const prod = availableProducts.find(p => Number(p.id) === Number(productId));
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

      const res = await Api.transactions.createOut({
        product_id: Number(productId),
        customer_id: customerId ? Number(customerId) : null,
        channel: channel,
        qty: qty,
        price: price,
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
        const prodName = (tx.products?.name || '').toLowerCase();
        const custName = (tx.customers?.name || 'umum').toLowerCase();
        const channel = (tx.channel || 'offline').toLowerCase();
        const kasir = (tx.created_by || '').toLowerCase();
        const note = (tx.note || '').toLowerCase();

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
      const prodName = tx.products?.name || 'Produk ID #' + tx.product_id;
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
            <button type="button" onclick="openDeleteOutModal(${tx.id})" title="Hapus transaksi" aria-label="Hapus transaksi"
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

  async function handleRefreshOut() {
    const iconToolbar = document.getElementById('icon-refresh-out');
    const headerBtn = document.getElementById('btn-refresh-out-header');
    const iconHeader = headerBtn ? headerBtn.querySelector('svg, i') : null;

    if (iconToolbar) iconToolbar.classList.add('animate-spin');
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
        if (iconToolbar) iconToolbar.classList.remove('animate-spin');
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
  });
