  let allOutTransactions = [];
  let availableProducts = [];
  let availableCustomers = [];
  let currentFilterPeriod = 'today';
  let currentFilterChannel = 'all';
  let currentPackingFilterChannel = 'all';
  let searchQuery = '';
  let currentPage = 1;
  const pageSize = 10;
  let deleteOutId = null;

  function detectCourierFromTracking(trackingNumber) {
    const tn = String(trackingNumber || '').trim().toUpperCase();
    if (!tn) return null;

    if (tn.startsWith('SPX') || tn.startsWith('NLID') || /^ID\d{10,}/.test(tn)) {
      return {
        code: 'SPX',
        name: 'Shopee Express (SPX)',
        badgeClass: 'bg-[#EE4D2D]/20 text-[#EE4D2D] border border-[#EE4D2D]/40',
        icon: 'truck'
      };
    }
    if (tn.startsWith('TJNT') || tn.startsWith('JP') || tn.startsWith('JX') || tn.startsWith('JD')) {
      return {
        code: 'J&T',
        name: 'J&T Express',
        badgeClass: 'bg-[#E31E24]/20 text-[#E31E24] border border-[#E31E24]/40',
        icon: 'truck'
      };
    }
    if (tn.startsWith('TKP') || tn.startsWith('INV/') || tn.startsWith('MP-TKP')) {
      return {
        code: 'TOKOPEDIA',
        name: 'Tokopedia Order',
        badgeClass: 'bg-[#00AA5B]/20 text-[#00AA5B] border border-[#00AA5B]/40',
        icon: 'shopping-bag'
      };
    }
    if (tn.startsWith('TTS') || tn.startsWith('TT-') || tn.startsWith('TIKTOK')) {
      return {
        code: 'TIKTOK',
        name: 'TikTok Shop',
        badgeClass: 'bg-black/50 text-white border border-white/30',
        icon: 'shopping-bag'
      };
    }
    if (tn.startsWith('00') || tn.startsWith('SIP')) {
      return {
        code: 'SICEPAT',
        name: 'SiCepat Ekspres',
        badgeClass: 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40',
        icon: 'truck'
      };
    }
    if (tn.startsWith('JNE') || /^(SOC|CGK|BDG|SUB|SRG|MDN|PLM|BPN|MKS|DPS)[A-Z0-9]{7,}/.test(tn)) {
      return {
        code: 'JNE',
        name: 'JNE Express',
        badgeClass: 'bg-[#0088CC]/20 text-[#32ADE6] border border-[#0088CC]/40',
        icon: 'truck'
      };
    }
    if (tn.startsWith('ANTR') || /^1000\d{8,}/.test(tn)) {
      return {
        code: 'ANTERAJA',
        name: 'Anteraja',
        badgeClass: 'bg-[#9C27B0]/20 text-[#BA68C8] border border-[#9C27B0]/40',
        icon: 'truck'
      };
    }
    if (tn.startsWith('NINJA') || tn.startsWith('NVNID')) {
      return {
        code: 'NINJA',
        name: 'Ninja Xpress',
        badgeClass: 'bg-[#C41230]/20 text-[#FF453A] border border-[#C41230]/40',
        icon: 'truck'
      };
    }
    return null;
  }

  function terbilang(n) {
    const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n === 0) return 'Nol';
    if (n < 12) return bilangan[n];
    if (n < 20) return terbilang(n - 10) + ' Belas';
    if (n < 100) return terbilang(Math.floor(n / 10)) + ' Puluh' + (n % 10 ? ' ' + terbilang(n % 10) : '');
    if (n < 200) return 'Seratus' + (n - 100 ? ' ' + terbilang(n - 100) : '');
    if (n < 1000) return terbilang(Math.floor(n / 100)) + ' Ratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
    if (n < 2000) return 'Seribu' + (n - 1000 ? ' ' + terbilang(n - 1000) : '');
    if (n < 1000000) return terbilang(Math.floor(n / 1000)) + ' Ribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
    if (n < 1000000000) return terbilang(Math.floor(n / 1000000)) + ' Juta' + (n % 1000000 ? ' ' + terbilang(n % 1000000) : '');
    if (n < 1000000000000) return terbilang(Math.floor(n / 1000000000)) + ' Miliar' + (n % 1000000000 ? ' ' + terbilang(n % 1000000000) : '');
    return terbilang(Math.floor(n / 1000000000000)) + ' Triliun' + (n % 1000000000000 ? ' ' + terbilang(n % 1000000000000) : '');
  }

  function formatRupiahVal(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  }

  function getTransactionOutQty(txOrQty) {
    const qty = Math.abs(Number(typeof txOrQty === 'object' ? txOrQty?.qty : txOrQty) || 0);
    return qty;
  }

  function parsePosReceiptMeta(note) {
    const text = String(note || '');
    const read = (key) => {
      const match = text.match(new RegExp(`(?:^|\\|)${key}=(-?[0-9]+(?:\\.[0-9]+)?)(?:\\||$)`));
      return match ? Number(match[1]) : null;
    };
    return {
      discount: Math.max(0, read('AQ_DISCOUNT') || 0),
      tax: Math.max(0, read('AQ_TAX') || 0),
      total: read('AQ_TOTAL')
    };
  }

  function cleanPosTrackingNote(note) {
    return String(note || '')
      .replace(/\[(?:INV-[^\]]+)\]\s*/i, '')
      .replace(/\|AQ_(?:DISCOUNT|TAX|TOTAL)=[^|]*/g, '')
      .trim();
  }

  function getTransactionCode(tx) {
    if (!tx) return '-';
    if (tx.invoice_no) return tx.invoice_no;
    const note = String(tx.note || tx.notes || '');
    const invMatch = note.match(/\[(INV-[^\]]+)\]/i);
    if (invMatch) return invMatch[1];
    const spxMatch = note.match(/\[(SPX-[^\]]+)\]/i);
    if (spxMatch) return spxMatch[1];
    const tkpMatch = note.match(/\[(TKP-[^\]]+)\]/i);
    if (tkpMatch) return tkpMatch[1];
    if (note && (note.includes('SPX-') || note.includes('INV-') || note.includes('TKP-'))) {
      const firstWord = note.split(' ')[0].replace(/^[\[\(]+|[\]\)]+$/g, '');
      if (firstWord) return firstWord;
    }
    const rawId = String(tx.id || '').trim();
    if (rawId.includes('-')) {
      return `OUT-${rawId.split('-')[0].toUpperCase()}`;
    }
    return `OUT-${rawId.padStart(6, '0')}`;
  }

  function getTransactionNetTotal(tx, list = allOutTransactions) {
    const qty = getTransactionOutQty(tx);
    const gross = qty * (Number(tx.price) || 0);
    const meta = parsePosReceiptMeta(tx.note);
    if (meta.total === null || meta.total === undefined) {
      return gross;
    }
    const invCode = getTransactionCode(tx);
    const siblings = (Array.isArray(list) && list.length > 0)
      ? list.filter(t => getTransactionCode(t) === invCode)
      : [tx];
    const totalGross = siblings.reduce((sum, t) => sum + (getTransactionOutQty(t) * (Number(t.price) || 0)), 0);
    if (totalGross <= 0) return meta.total;
    const ratio = gross / totalGross;
    return Math.round(meta.total * ratio);
  }

  function getTransactionItemDiscount(tx, list = allOutTransactions) {
    const qty = getTransactionOutQty(tx);
    const gross = qty * (Number(tx.price) || 0);
    const meta = parsePosReceiptMeta(tx.note);
    if (!meta.discount) return 0;
    const invCode = getTransactionCode(tx);
    const siblings = (Array.isArray(list) && list.length > 0)
      ? list.filter(t => getTransactionCode(t) === invCode)
      : [tx];
    const totalGross = siblings.reduce((sum, t) => sum + (getTransactionOutQty(t) * (Number(t.price) || 0)), 0);
    if (totalGross <= 0) return meta.discount;
    const ratio = gross / totalGross;
    return Math.round(meta.discount * ratio);
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

  async function loadChannelDropdown() {
    const channelSelect = document.getElementById('out-channel');
    if (!channelSelect) return;
    try {
      let channels = [];
      if (typeof window !== 'undefined' && window.Api?.settings?.getChannels) {
        channels = await window.Api.settings.getChannels();
      } else {
        const cached = localStorage.getItem('aquastock_channels');
        if (cached) channels = JSON.parse(cached);
      }
      if (!Array.isArray(channels) || channels.length === 0) {
        channels = ['Offline', 'Shopee', 'Tokopedia', 'TikTok', 'Lazada', 'WhatsApp'];
      }

      const currentVal = channelSelect.value || 'Offline';
      channelSelect.innerHTML = '';
      channels.forEach(ch => {
        const name = typeof ch === 'string' ? ch : ch.name;
        if (!name) return;
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        channelSelect.appendChild(opt);
      });

      if (currentVal && Array.from(channelSelect.options).some(o => o.value === currentVal)) {
        channelSelect.value = currentVal;
      } else if (channelSelect.options.length > 0) {
        channelSelect.selectedIndex = 0;
      }
    } catch (err) {
      console.warn('Error loading channels in POS:', err);
    }
  }

  async function loadDropdowns() {
    try {
      await loadChannelDropdown();

      const prodRes = await Api.items.getAll();
      if (prodRes && prodRes.ok) {
        availableProducts = prodRes.data || [];
        renderPosCatalogGrid();
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
        availableCustomers = custRes.data || [];
        const custSelect = document.getElementById('out-customer-id');
        if (custSelect) {
          const currentCustVal = custSelect.value;
          custSelect.innerHTML = '<option value="">Umum</option>';
          availableCustomers.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.phone ? `${c.name} (${c.phone})` : c.name;
            custSelect.appendChild(opt);
          });
          if (currentCustVal) custSelect.value = currentCustVal;
        }

      }
    } catch (err) {
      console.error('Error loading dropdowns:', err);
    }
  }

  const handleProductsUpdatedOut = () => {
    loadDropdowns().catch(console.error);
  };
  window.addEventListener('m2stock:products-updated', handleProductsUpdatedOut);
  window.addEventListener('aquastock:products-updated', handleProductsUpdatedOut);

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ═══════════════════════════════════════════════
  // KASIR POS (MULTI-ITEM CART) STATE & HANDLERS
  // ═══════════════════════════════════════════════
  let posCart = [];

  function resolvePosProductPrice(prod, channel) {
    if (!prod) return 0;
    const selectedChannel = String(channel || document.getElementById('out-channel')?.value || 'Offline');
    const isOnlineChannel = selectedChannel.toLowerCase() !== 'offline';
    const offlinePrice = Number(prod.sell_price ?? prod.sellPrice ?? prod.unitPrice ?? 0);

    if (!isOnlineChannel) return Number.isFinite(offlinePrice) ? Math.max(0, offlinePrice) : 0;

    const onlineValue = prod.online_sell_price ?? prod.onlineSellPrice;
    const onlinePrice = onlineValue === null || onlineValue === undefined || onlineValue === ''
      ? NaN
      : Number(onlineValue);
    return Number.isFinite(onlinePrice) && onlinePrice >= 0
      ? onlinePrice
      : (Number.isFinite(offlinePrice) ? Math.max(0, offlinePrice) : 0);
  }

  function syncPosCartToChannel() {
    const channel = document.getElementById('out-channel')?.value || 'Offline';
    posCart.forEach(item => {
      const product = (availableProducts || []).find(p => String(p.id) === String(item.product_id));
      if (product) item.price = resolvePosProductPrice(product, channel);
    });
    renderPosCart();
    renderPosCatalogGrid();
  }

  function handlePosChannelChange() {
    const channelSelect = document.getElementById('out-channel');
    const channel = channelSelect?.value || 'Offline';
    const noteInput = document.getElementById('out-note');
    const noteLabel = document.querySelector('label[for="out-note"]');
    const payMethodSelect = document.getElementById('out-payment-method');
    const isMarketplace = ['Shopee', 'Tokopedia', 'TikTok', 'Lazada'].includes(channel);

    if (isMarketplace) {
      if (noteLabel) noteLabel.innerHTML = `No. Resi Kurir / Pesanan <span class="text-[#0088CC] font-normal">(${channel})</span> <span class="text-[#FF3B30]">*</span>`;
      if (noteInput) {
        noteInput.placeholder = `Scan resi SPX, J&T, SiCepat, JNE untuk ${channel}...`;
        noteInput.setAttribute('aria-label', `Nomor resi pengiriman ${channel}`);
      }
      if (payMethodSelect && payMethodSelect.value === 'Cash') {
        payMethodSelect.value = 'Transfer';
        handlePosPaymentMethodChange();
      }
      const escrowNotice = document.getElementById('pos-marketplace-escrow-notice');
      if (escrowNotice) {
        escrowNotice.innerHTML = `<i data-lucide="shield-check" class="w-4 h-4 shrink-0 text-[#32ADE6]"></i><span>Pesanan <b>${channel}</b> ditagih via Escrow Marketplace. Status otomatis LUNAS.</span>`;
        escrowNotice.classList.remove('hidden');
        escrowNotice.classList.add('flex');
        if (typeof window.refreshIcons === 'function') window.refreshIcons(escrowNotice);
      }
    } else {
      if (noteLabel) noteLabel.textContent = 'No. Resi';
      if (noteInput) {
        noteInput.placeholder = 'Scan atau ketik nomor resi...';
        noteInput.setAttribute('aria-label', 'Nomor resi');
      }
      const escrowNotice = document.getElementById('pos-marketplace-escrow-notice');
      if (escrowNotice) {
        escrowNotice.classList.add('hidden');
        escrowNotice.classList.remove('flex');
      }
    }

    handlePosTrackingInputChange();
    syncPosCartToChannel();
  }

  function handlePosTrackingInputChange() {
    const noteInput = document.getElementById('out-note');
    const detectedDiv = document.getElementById('pos-courier-detected');
    if (!noteInput || !detectedDiv) return;

    const val = noteInput.value.trim();
    const courier = detectCourierFromTracking(val);
    if (courier) {
      detectedDiv.innerHTML = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${courier.badgeClass}"><i data-lucide="${courier.icon}" class="w-3.5 h-3.5"></i> Kurir: ${courier.name}</span>`;
      detectedDiv.classList.remove('hidden');
      detectedDiv.classList.add('flex');
      if (typeof window.refreshIcons === 'function') window.refreshIcons(detectedDiv);
    } else {
      detectedDiv.innerHTML = '';
      detectedDiv.classList.add('hidden');
      detectedDiv.classList.remove('flex');
    }
  }

  function renderPosCart() {
    const tbody = document.getElementById('pos-cart-tbody');
    const submitBtn = document.getElementById('btn-submit-out');
    if (!tbody) return;

    if (posCart.length === 0) {
      tbody.innerHTML = `
        <tr id="pos-cart-empty">
          <td colspan="5" class="py-10 text-center text-[#A0A0A5]">
            <i data-lucide="shopping-cart" class="w-7 h-7 mx-auto mb-1.5 opacity-30 text-[#0088CC]" aria-hidden="true"></i>
            <p class="text-xs font-medium text-white/80">Keranjang masih kosong</p>
            <p class="text-[11px] text-[#A0A0A5]/60 mt-0.5">Ketik nama produk atau scan barcode di atas</p>
          </td>
        </tr>
      `;
      if (submitBtn) submitBtn.disabled = true;
      calculatePosTotal();
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
      return;
    }

    if (submitBtn) submitBtn.disabled = false;

    tbody.innerHTML = posCart.map((item, idx) => {
      const subtotal = item.qty * item.price;
      const isMax = item.stock !== undefined && item.qty >= item.stock;
      return `
        <tr class="table-row hover:bg-white/[0.02] transition">
          <td class="px-3 py-2.5">
            <div class="font-medium text-white">${escapeHtml(item.name)}</div>
            <div class="text-[10px] text-[#A0A0A5] flex items-center gap-1.5 mt-0.5">
              <span>${item.sku ? escapeHtml(item.sku) + ' • ' : ''}${escapeHtml(item.unit || 'pcs')}</span>
              <span class="text-[9px] px-1.5 py-0.2 rounded font-semibold ${item.stock > 0 ? 'bg-[#34C759]/15 text-[#34C759]' : 'bg-[#FF3B30]/15 text-[#FF3B30]'}">
                Stok: ${item.stock ?? 0}
              </span>
            </div>
          </td>
          <td class="px-2 py-2.5 text-right font-medium text-white/90">
            ${formatRupiahVal(item.price)}
          </td>
          <td class="px-2 py-2.5 text-center">
            <div class="inline-flex items-center border border-white/10 rounded-lg bg-black/40 overflow-hidden">
              <button type="button" onclick="updatePosCartQty(${idx}, ${item.qty - 1})"
                      class="px-2 py-1 text-white hover:bg-white/10 text-xs transition font-bold" title="Kurang 1">−</button>
              <input type="number" min="1" max="${item.stock ?? 999999}" step="1" inputmode="numeric" value="${item.qty}"
                     onchange="updatePosCartQty(${idx}, this.value)"
                     class="w-12 text-center bg-transparent text-xs text-white focus:outline-none py-1 font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
              <button type="button" onclick="updatePosCartQty(${idx}, ${item.qty + 1})"
                      ${isMax ? 'disabled' : ''}
                      class="px-2 py-1 text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs transition font-bold" title="Tambah 1">+</button>
            </div>
          </td>
          <td class="px-3 py-2.5 text-right font-bold text-[#34C759]">
            ${formatRupiahVal(subtotal)}
          </td>
          <td class="px-2 py-2.5 text-center">
            <button type="button" onclick="removeFromPosCart(${idx})" title="Hapus dari keranjang"
                    class="p-1 hover:bg-white/10 rounded-lg text-[#FF3B30] transition">
              <i data-lucide="trash-2" class="w-3.5 h-3.5" aria-hidden="true"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    calculatePosTotal();
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function addToPosCart(prod, qty = 1) {
    if (!prod) return;
    const stock = Number(prod.stock ?? 0);
    const channel = document.getElementById('out-channel')?.value || 'Offline';
    const resolvedPrice = resolvePosProductPrice(prod, channel);
    const existingIdx = posCart.findIndex(it => String(it.product_id) === String(prod.id));

    if (existingIdx >= 0) {
      const current = posCart[existingIdx];
      current.price = resolvedPrice;
      const targetQty = current.qty + qty;
      if (stock > 0 && targetQty > stock) {
        current.qty = stock;
        if (typeof showToast === 'function') {
          showToast(`Stok ${prod.name} terbatas: tersisa ${stock} unit`, 'warning');
        }
      } else {
        current.qty = targetQty;
        if (typeof showToast === 'function') {
          showToast(`${prod.name} (+${qty})`, 'info');
        }
      }
    } else {
      if (stock <= 0) {
        if (typeof showToast === 'function') {
          showToast(`Perhatian: Stok ${prod.name} kosong (${stock})`, 'warning');
        }
      }
      const initialQty = stock > 0 ? Math.min(qty, stock) : qty;
      posCart.push({
        product_id: prod.id,
        name: prod.name,
        sku: prod.sku || '',
        unit: prod.unit || 'pcs',
        price: resolvedPrice,
        cost_price: Number(prod.cost_price || 0),
        stock: stock,
        qty: Math.max(1, initialQty)
      });
      if (typeof showToast === 'function') {
        showToast(`✓ ${prod.name} masuk ke keranjang`, 'success');
      }
    }

    renderPosCart();

    const searchInput = document.getElementById('out-product-search');
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    const suggestionsEl = document.getElementById('out-product-suggestions');
    if (suggestionsEl) {
      suggestionsEl.classList.add('hidden');
      suggestionsEl.innerHTML = '';
    }
  }

  function updatePosCartQty(index, newQty) {
    const item = posCart[index];
    if (!item) return;

    const num = Number(newQty);
    let target = isNaN(num) ? 1 : num;
    if (target <= 0) {
      removeFromPosCart(index);
      return;
    }

    if (item.stock > 0 && target > item.stock) {
      target = item.stock;
      if (typeof showToast === 'function') {
        showToast(`Maksimal stok ${item.name} adalah ${item.stock} unit`, 'warning');
      }
    }

    item.qty = target;
    renderPosCart();
  }

  function removeFromPosCart(index) {
    if (index >= 0 && index < posCart.length) {
      const removed = posCart.splice(index, 1);
      if (typeof showToast === 'function' && removed[0]) {
        showToast(`${removed[0].name} dihapus dari keranjang`, 'info');
      }
      renderPosCart();
    }
  }

  function clearPosCart() {
    posCart = [];
    renderPosCart();
  }

  let posCurrentCategory = 'all';

  function filterPosCategory(category) {
    posCurrentCategory = category;
    document.querySelectorAll('.pos-category-chip').forEach(btn => {
      if (btn.getAttribute('data-category') === category) {
        btn.classList.add('bg-[#0088CC]', 'text-white', 'border-[#0088CC]');
        btn.classList.remove('bg-white/5', 'text-[#A0A0A5]', 'border-white/10');
      } else {
        btn.classList.remove('bg-[#0088CC]', 'text-white', 'border-[#0088CC]');
        btn.classList.add('bg-white/5', 'text-[#A0A0A5]', 'border-white/10');
      }
    });
    renderPosCatalogGrid();
  }

  function renderPosCatalogGrid() {
    const gridEl = document.getElementById('pos-catalog-grid');
    if (!gridEl) return;

    let prods = availableProducts || [];
    if (posCurrentCategory !== 'all') {
      prods = prods.filter(p => {
        const cat = (p.categories?.name || p.category_name || p.category || '').toLowerCase();
        return cat.includes(posCurrentCategory.toLowerCase());
      });
    }

    if (prods.length === 0) {
      gridEl.innerHTML = `
        <div class="col-span-full py-6 text-center text-[#A0A0A5] text-xs">
          Tidak ada produk dalam kategori ini.
        </div>
      `;
      return;
    }

    const channel = document.getElementById('out-channel')?.value || 'Offline';
    gridEl.innerHTML = prods.slice(0, 36).map(p => {
      const stock = Number(p.stock ?? 0);
      const isOutOfStock = stock <= 0;
      const displayPrice = resolvePosProductPrice(p, channel);
      return `
        <button type="button" data-pos-product-id="${escapeHtml(String(p.id))}" onclick="addPosCatalogProduct(this.dataset.posProductId)"
                class="group text-left p-2 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-[#0088CC]/50 transition flex flex-col justify-between h-20 relative overflow-hidden focus:outline-none focus:ring-1 focus:ring-[#0088CC]">
          <div>
            <div class="font-semibold text-xs text-white group-hover:text-[#32ADE6] line-clamp-1 leading-tight transition">${escapeHtml(p.name)}</div>
            <div class="text-[10px] text-[#A0A0A5] mt-0.5 truncate">${escapeHtml(p.sku || '')}</div>
          </div>
          <div class="flex items-center justify-between mt-1">
            <span class="text-xs font-bold text-[#34C759]">${formatRupiahVal(displayPrice)}</span>
            <span class="text-[9px] px-1.5 py-0.2 rounded font-semibold ${!isOutOfStock ? 'bg-[#34C759]/15 text-[#34C759]' : 'bg-[#FF3B30]/15 text-[#FF3B30]'}">
              ${stock} ${escapeHtml(p.unit || 'pcs')}
            </span>
          </div>
        </button>
      `;
    }).join('');
  }

  function addPosCatalogProduct(productId) {
    const product = (availableProducts || []).find(p => String(p.id) === String(productId));
    addToPosCart(product);
  }

  function parseNumericValue(val) {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const digits = String(val).replace(/\D/g, '');
    return digits === '' ? 0 : (Number(digits) || 0);
  }

  function formatNumberInput(num) {
    if (!num || num === 0) return '';
    return new Intl.NumberFormat('id-ID').format(num);
  }

  function calculatePosCheckoutAmount(cartItems = posCart) {
    const subtotal = cartItems.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    const discountInput = document.getElementById('pos-discount-input');
    const discount = Math.min(subtotal, Math.max(0, parseNumericValue(discountInput?.value)));
    const taxEnabled = document.getElementById('pos-tax-toggle')?.checked === true;
    const discountedSubtotal = Math.max(0, subtotal - discount);
    const tax = taxEnabled ? Math.round(discountedSubtotal * 0.11) : 0;
    return {
      subtotal,
      discount,
      tax,
      total: discountedSubtotal + tax
    };
  }

  function clearPosDiscount() {
    const input = document.getElementById('pos-discount-input');
    if (input) {
      input.value = '';
      calculatePosTotal();
      input.focus();
    }
  }

  function clearPosCash() {
    const input = document.getElementById('pos-cash-input');
    if (input) {
      input.value = '';
      calculatePosChange();
      input.focus();
    }
  }

  function calculatePosTotal() {
    const rawSubtotal = posCart.reduce((sum, it) => sum + (it.qty * it.price), 0);
    const totalUnits = posCart.reduce((sum, it) => sum + it.qty, 0);

    const discountInput = document.getElementById('pos-discount-input');
    const discountVal = discountInput ? Math.max(0, parseNumericValue(discountInput.value)) : 0;

    const clearDiscountBtn = document.getElementById('btn-clear-pos-discount');
    if (clearDiscountBtn) {
      if (discountVal > 0) {
        clearDiscountBtn.classList.remove('hidden');
      } else {
        clearDiscountBtn.classList.add('hidden');
      }
    }

    const taxToggle = document.getElementById('pos-tax-toggle');
    const hasTax = taxToggle ? taxToggle.checked : false;

    const afterDiscount = Math.max(0, rawSubtotal - discountVal);
    const taxAmount = hasTax ? Math.round(afterDiscount * 0.11) : 0;
    const finalTotal = afterDiscount + taxAmount;

    const preview = document.getElementById('out-total-preview');
    if (preview) preview.textContent = formatRupiahVal(finalTotal);

    const badge = document.getElementById('pos-items-count-badge');
    if (badge) badge.textContent = `${posCart.length} Item (${totalUnits} Unit)`;

    // Keep hidden inputs in sync for backward compatibility
    const hiddenPrice = document.getElementById('out-price');
    if (hiddenPrice) hiddenPrice.value = finalTotal;
    const hiddenQty = document.getElementById('out-qty');
    if (hiddenQty) hiddenQty.value = totalUnits;
    if (posCart.length > 0) {
      const hiddenPid = document.getElementById('out-product-id');
      if (hiddenPid) hiddenPid.value = posCart[0].product_id;
    }

    calculatePosChange();
  }

  function handlePosPaymentMethodChange() {
    const method = document.getElementById('out-payment-method')?.value || 'Cash';
    const cashCalc = document.getElementById('pos-cash-calculator');
    if (cashCalc) {
      if (method === 'Cash') {
        cashCalc.classList.remove('hidden');
      } else {
        cashCalc.classList.add('hidden');
      }
    }
    calculatePosChange();
  }

  function calculatePosChange() {
    const rawSubtotal = posCart.reduce((sum, it) => sum + (it.qty * it.price), 0);
    const discountInput = document.getElementById('pos-discount-input');
    const discountVal = discountInput ? Math.max(0, parseNumericValue(discountInput.value)) : 0;
    const taxToggle = document.getElementById('pos-tax-toggle');
    const hasTax = taxToggle ? taxToggle.checked : false;
    const afterDiscount = Math.max(0, rawSubtotal - discountVal);
    const taxAmount = hasTax ? Math.round(afterDiscount * 0.11) : 0;
    const totalAmount = afterDiscount + taxAmount;

    const method = document.getElementById('out-payment-method')?.value || 'Cash';
    const cashInput = document.getElementById('pos-cash-input');
    const preview = document.getElementById('pos-change-preview');

    const inputVal = parseNumericValue(cashInput?.value);

    const clearCashBtn = document.getElementById('btn-clear-pos-cash');
    if (clearCashBtn) {
      if (inputVal > 0) {
        clearCashBtn.classList.remove('hidden');
      } else {
        clearCashBtn.classList.add('hidden');
      }
    }

    if (!preview) return;

    if (method !== 'Cash') {
      preview.textContent = 'Rp 0 (Non-Tunai)';
      preview.className = 'font-bold font-mono text-base text-[#32ADE6]';
      return;
    }

    if (!inputVal || inputVal === 0) {
      preview.textContent = 'Rp 0';
      preview.className = 'font-extrabold font-mono text-base text-[#A0A0A5]';
      return;
    }

    const diff = inputVal - totalAmount;
    if (diff >= 0) {
      preview.textContent = formatRupiahVal(diff);
      preview.className = 'font-extrabold font-mono text-base text-[#34C759]';
    } else {
      preview.textContent = `Kurang ${formatRupiahVal(Math.abs(diff))}`;
      preview.className = 'font-extrabold font-mono text-base text-[#FF3B30]';
    }
  }

  function quickSetPosCash(typeOrAmount) {
    const rawSubtotal = posCart.reduce((sum, it) => sum + (it.qty * it.price), 0);
    const discountInput = document.getElementById('pos-discount-input');
    const discountVal = discountInput ? Math.max(0, parseNumericValue(discountInput.value)) : 0;
    const taxToggle = document.getElementById('pos-tax-toggle');
    const hasTax = taxToggle ? taxToggle.checked : false;
    const afterDiscount = Math.max(0, rawSubtotal - discountVal);
    const taxAmount = hasTax ? Math.round(afterDiscount * 0.11) : 0;
    const totalAmount = afterDiscount + taxAmount;

    const cashInput = document.getElementById('pos-cash-input');
    if (!cashInput) return;

    if (typeOrAmount === 'exact') {
      cashInput.value = totalAmount > 0 ? formatNumberInput(totalAmount) : '';
    } else if (typeof typeOrAmount === 'number') {
      const current = parseNumericValue(cashInput.value);
      const nextVal = current + typeOrAmount;
      cashInput.value = nextVal > 0 ? formatNumberInput(nextVal) : '';
    }
    calculatePosChange();
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function handleOutProductSearchInput(e) {
    const query = (e.target.value || '').trim();
    const suggestionsEl = document.getElementById('out-product-suggestions');
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

    if (matches.length === 0) {
      suggestionsEl.innerHTML = `
        <div class="px-3.5 py-3 text-xs text-[#A0A0A5] text-center">
          Produk tidak ditemukan di katalog
        </div>
      `;
      suggestionsEl.classList.remove('hidden');
      return;
    }

    let html = '';
    matches.forEach(p => {
      const stock = p.stock ?? 0;
      html += `
        <button type="button" class="w-full text-left px-3.5 py-2.5 hover:bg-white/10 flex items-center justify-between text-sm transition" onclick="selectOutProduct(${p.id})">
          <div>
            <div class="font-medium text-white">${escapeHtml(p.name)}</div>
            <div class="text-xs text-[#A0A0A5]">${p.sku ? escapeHtml(p.sku) + ' • ' : ''}${escapeHtml(p.category || 'Umum')}</div>
          </div>
          <div class="text-right">
            <div class="text-xs font-semibold ${stock > 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}">Stok: ${stock} ${escapeHtml(p.unit || 'pcs')}</div>
            <div class="text-[11px] text-[#A0A0A5]">${formatRupiahVal(p.sell_price || 0)}</div>
          </div>
        </button>
      `;
    });

    suggestionsEl.innerHTML = html;
    suggestionsEl.classList.remove('hidden');
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function selectOutProduct(productId) {
    const prod = availableProducts.find(p => String(p.id) === String(productId));
    if (!prod) return;
    addToPosCart(prod, 1);
  }

  function clearOutProductSelection() {
    clearPosCart();
  }

  function handleOutProductChange() {
    const pId = document.getElementById('out-product-id')?.value;
    if (pId) selectOutProduct(pId);
  }

  function calculateOutTotal() {
    calculatePosTotal();
  }

  function openAddOutModal() {
    const form = document.getElementById('form-out');
    if (form) form.reset();
    clearPosCart();

    const photoData = document.getElementById('out-photo-data');
    if (photoData) photoData.value = '';
    const photoPreview = document.getElementById('photo-preview');
    if (photoPreview) photoPreview.classList.add('hidden');
    const photoImg = document.getElementById('photo-preview-img');
    if (photoImg) photoImg.src = '';

    const cashInput = document.getElementById('pos-cash-input');
    if (cashInput) cashInput.value = '';
    const discountInput = document.getElementById('pos-discount-input');
    if (discountInput) discountInput.value = '';
    document.getElementById('btn-clear-pos-cash')?.classList.add('hidden');
    document.getElementById('btn-clear-pos-discount')?.classList.add('hidden');

    handlePosPaymentMethodChange();
    calculatePosTotal();
    loadDropdowns();
    renderPosCatalogGrid();

    const modal = document.getElementById('modal-out');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    setTimeout(() => {
      document.getElementById('out-product-search')?.focus();
    }, 60);
  }

  function closeOutModal() {
    clearPosCart();
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

    if (posCart.length === 0) {
      if (typeof showToast === 'function') showToast('Tambahkan minimal 1 produk ke keranjang belanja', 'error');
      document.getElementById('out-product-search')?.focus();
      return;
    }

    const customerId = document.getElementById('out-customer-id')?.value || null;
    const channel = document.getElementById('out-channel')?.value || 'Offline';
    const paymentMethod = document.getElementById('out-payment-method')?.value || 'Cash';
    const paymentStatus = paymentMethod === 'Tempo' ? 'Belum Lunas' : 'Lunas';
    const note = document.getElementById('out-note')?.value.trim() || '';
    const checkoutAmount = calculatePosCheckoutAmount(posCart);
    const totalAmount = checkoutAmount.total;
    const cashInput = document.getElementById('pos-cash-input');
    const paidAmount = paymentMethod === 'Cash'
      ? (parseNumericValue(cashInput?.value) || totalAmount)
      : (paymentMethod === 'Tempo' ? 0 : totalAmount);

    const submitBtn = document.getElementById('btn-submit-out');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Menyimpan Kasir...</span>';

    try {
      let currentUserId = null;
      if (typeof window.Auth !== 'undefined') {
        const user = await window.Auth.getCurrentUser();
        currentUserId = user?.id || null;
      }

      const cartSnapshot = posCart.map(it => ({ ...it }));

      const res = await Api.transactions.createBatchOut(posCart, {
        channel: channel,
        customer_id: customerId,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        note: note,
        discount_amount: checkoutAmount.discount,
        tax_amount: checkoutAmount.tax,
        created_by: currentUserId
      });

      if (!res.ok) {
        throw new Error(res.error?.message || 'Gagal menyimpan transaksi kasir');
      }

      if (typeof showToast === 'function') {
        showToast(`Penjualan berhasil disimpan! (${res.data?.invoice_no || 'Lunas'})`, 'success');
      }

      closeOutModal();
      await loadOutTransactions();
      await loadDropdowns();

      // Dapatkan nama & nomor HP pelanggan untuk struk / WhatsApp
      let customerName = 'Umum';
      let customerPhone = '';
      if (customerId) {
        const custObj = availableCustomers.find(c => String(c.id) === String(customerId));
        if (custObj) {
          customerName = custObj.name || 'Umum';
          customerPhone = custObj.phone || '';
        } else {
          const custSelect = document.getElementById('out-customer-id');
          const selectedOpt = custSelect?.querySelector(`option[value="${customerId}"]`);
          if (selectedOpt) customerName = selectedOpt.textContent;
        }
      }

      // Langsung buka Struk Kasir Thermal dengan semua item keranjang
      openThermalReceiptModal({
        invoice_no: res.data?.invoice_no,
        note: note,
        channel: channel,
        date: new Date().toISOString(),
        customer: customerName,
        customer_phone: customerPhone,
        cashier: (typeof window !== 'undefined' && window.Auth?.getUserEmail) ? window.Auth.getUserEmail() : 'Admin',
        method: paymentMethod,
        status: paymentStatus,
        items: cartSnapshot,
        total: totalAmount,
        discount: checkoutAmount.discount,
        tax: checkoutAmount.tax,
        subtotal: checkoutAmount.subtotal,
        paid: paidAmount,
        change: Math.max(0, paidAmount - totalAmount)
      });
    } catch (err) {
      console.error('Submit out error:', err);
      if (typeof showToast === 'function') {
        showToast(err.message || 'Terjadi kesalahan sistem saat menyimpan penjualan', 'error');
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
      const qty = getTransactionOutQty(tx);
      // Prioritaskan snapshot modal saat transaksi terjadi (IAS 2: Historical Costing)
      const costPrice = Number(tx.cost_price ?? tx.products?.cost_price ?? 0);
      const amount = getTransactionNetTotal(tx, list);

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

    if (elTodayCount) elTodayCount.textContent = `${todayCount}`;
    if (elTodayAmount) elTodayAmount.textContent = formatShortRupiah(todayAmount);
    if (el7dCount) el7dCount.textContent = `${sevenCount}`;
    if (el7dAmount) el7dAmount.textContent = formatShortRupiah(sevenAmount);
    if (el30dCount) el30dCount.textContent = `${thirtyCount}`;
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

  function formatCashierName(userId) {
    if (typeof window !== 'undefined' && typeof window.resolveUserName === 'function') {
      return window.resolveUserName(userId);
    }
    if (!userId) return 'David';
    if (typeof userId === 'string' && userId.length > 20 && userId.includes('-')) {
      try {
        const rawAuth = localStorage.getItem('auth_user') || localStorage.getItem('sb-user');
        if (rawAuth) {
          const u = JSON.parse(rawAuth);
          if (u.id === userId || u.sub === userId) {
            return u.full_name || u.name || u.email?.split('@')[0] || 'David';
          }
        }
      } catch (_) {}
      return 'David';
    }
    return userId;
  }

  function filterOutChannel(channel) {
    currentFilterChannel = channel || 'all';
    currentPage = 1;
    const select = document.getElementById('filter-out-channel');
    if (select && select.value !== currentFilterChannel) {
      select.value = currentFilterChannel;
    }
    renderOutTable();
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

      if (currentFilterChannel !== 'all') {
        const txChannel = (tx.channel || 'Offline').toLowerCase();
        if (currentFilterChannel.toLowerCase() === 'offline') {
          if (txChannel !== 'offline') return false;
        } else if (!txChannel.includes(currentFilterChannel.toLowerCase())) {
          return false;
        }
      }

      if (searchQuery) {
        const code = getTransactionCode(tx).toLowerCase();
        const prodName = resolveProductName(tx).toLowerCase();
        const custName = (tx.customers?.name || 'umum').toLowerCase();
        const channel = (tx.channel || 'offline').toLowerCase();
        const kasir = (formatCashierName(tx.created_by) || '').toLowerCase();
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
      const code = getTransactionCode(tx);
      const dateStr = formatTxDate(tx.created_at);
      const prodName = resolveProductName(tx);
      const channelBadge = getChannelBadge(tx.channel);
      const custName = tx.customers?.name || 'Umum';
      const kasir = formatCashierName(tx.created_by);
      const qty = getTransactionOutQty(tx);
      const price = tx.price || 0;
      const netTotal = getTransactionNetTotal(tx, allOutTransactions);
      const discountVal = getTransactionItemDiscount(tx, allOutTransactions);

      return `
        <tr class="table-row border-b border-white/5">
          <td class="px-4 py-3.5 font-mono text-xs text-[#A0A0A5] whitespace-nowrap" title="ID: ${escapeHtml(String(tx.id))}">${code}</td>
          <td class="px-4 py-3.5 text-[#A0A0A5] whitespace-nowrap">${dateStr}</td>
          <td class="px-4 py-3.5 font-medium text-white max-w-[220px] truncate" title="${escapeHtml(prodName)}">${prodName}</td>
          <td class="px-4 py-3.5 whitespace-nowrap">${channelBadge}</td>
          <td class="px-4 py-3.5 text-[#A0A0A5] whitespace-nowrap">${custName}</td>
          <td class="px-4 py-3.5 text-[#A0A0A5] whitespace-nowrap" data-label="KASIR" data-cashier-id="${escapeHtml(tx.created_by || '')}">${escapeHtml(kasir)}</td>
          <td class="px-4 py-3.5 text-right text-[#FF3B30] whitespace-nowrap font-semibold">${qty}</td>
          <td class="px-4 py-3.5 text-right text-[#A0A0A5] whitespace-nowrap">${formatRupiahVal(price)}</td>
          <td class="px-4 py-3.5 text-right font-semibold text-white whitespace-nowrap">
            ${formatRupiahVal(netTotal)}
            ${discountVal > 0 ? `<div class="text-[10px] text-[#34C759] font-normal leading-tight">Diskon ${formatRupiahVal(discountVal)}</div>` : ''}
          </td>
          <td class="px-4 py-3.5 text-right whitespace-nowrap">
            <div class="flex items-center justify-end gap-1">
              <button type="button" data-action="print-receipt" data-transaction-id="${tx.id}" title="Cetak Struk Kasir" aria-label="Cetak Struk Kasir"
                      class="p-1.5 hover:bg-white/5 rounded-lg text-[#32ADE6] hover:text-white transition">
                <i data-lucide="receipt" class="w-4 h-4" aria-hidden="true"></i>
              </button>
              <button type="button" data-action="print-invoice" data-transaction-id="${tx.id}" title="Cetak Invoice Formal A4 / PDF" aria-label="Cetak Invoice Formal A4 / PDF"
                      class="p-1.5 hover:bg-white/5 rounded-lg text-[#34C759] hover:text-white transition">
                <i data-lucide="file-text" class="w-4 h-4" aria-hidden="true"></i>
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

  function filterPackingChannel(channel) {
    currentPackingFilterChannel = channel || 'all';
    const tabs = document.querySelectorAll('#packing-channel-tabs .packing-tab-btn');
    tabs.forEach(btn => {
      const isTarget = btn.getAttribute('onclick')?.includes(`'${channel}'`);
      if (isTarget) {
        btn.classList.add('active', 'bg-[#0088CC]', 'text-white');
        btn.classList.remove('bg-[#1C1C1E]', 'text-[#A0A0A5]');
      } else {
        btn.classList.remove('active', 'bg-[#0088CC]', 'text-white');
        btn.classList.add('bg-[#1C1C1E]', 'text-[#A0A0A5]');
      }
    });
    openPackingListModal();
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

    // Filter per channel pesanan jika user memilih tab filter packing
    if (currentPackingFilterChannel !== 'all') {
      todaysOut = todaysOut.filter(tx => {
        const ch = (tx.channel || 'Offline').toLowerCase();
        if (currentPackingFilterChannel.toLowerCase() === 'offline') return ch === 'offline';
        return ch.includes(currentPackingFilterChannel.toLowerCase());
      });
    }

    const dStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (dateText) dateText.textContent = `Tanggal: ${dStr}`;
    if (countBadge) countBadge.textContent = `${todaysOut.length} Pesanan`;

    if (tbody) {
      if (todaysOut.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-[#A0A0A5]">Belum ada pesanan keluar untuk channel ini</td></tr>`;
      } else {
        tbody.innerHTML = todaysOut.map(tx => {
          const code = getTransactionCode(tx);
          const prodName = tx.products?.name || ('Produk #' + tx.product_id);
          const channel = tx.channel || 'Offline';
          const cust = tx.customers?.name || 'Umum';
          const qty = getTransactionOutQty(tx);
          const courier = detectCourierFromTracking(code) || detectCourierFromTracking(tx.note);
          const courierBadge = courier
            ? `<span class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${courier.badgeClass}">${courier.code}</span>`
            : '';

          return `
            <tr class="border-b border-white/5 print:border-gray-200">
              <td class="py-2.5 px-2 font-mono text-xs whitespace-nowrap">
                <span>${code}</span>
                ${courierBadge}
              </td>
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
        mobileList.innerHTML = `<div class="text-center py-6 text-sm text-[#A0A0A5]">Belum ada pesanan keluar untuk channel ini</div>`;
      } else {
        mobileList.innerHTML = todaysOut.map(tx => {
          const code = getTransactionCode(tx);
          const prodName = tx.products?.name || ('Produk #' + tx.product_id);
          const channel = tx.channel || 'Offline';
          const cust = tx.customers?.name || 'Umum';
          const qty = getTransactionOutQty(tx);
          const courier = detectCourierFromTracking(code) || detectCourierFromTracking(tx.note);

          return `
            <div class="p-3 bg-white/[0.03] border border-white/10 rounded-xl space-y-2">
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-1 font-mono text-[#32ADE6] bg-[#0088CC]/10 px-2 py-0.5 rounded font-semibold">
                  <span>${code}</span>
                  ${courier ? `<span class="text-[10px] px-1 rounded ${courier.badgeClass}">${courier.code}</span>` : ''}
                </div>
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
  window.closePackingListModal = closePackingListModal;

  let activeReceiptTx = null;

  async function openThermalReceiptModal(txIdOrBatch) {
    let invoiceNo = '';
    let trackingNote = '';
    let dateStr = '';
    let customerName = 'Umum';
    let cashierName = 'Admin';
    let method = 'Cash';
    let status = 'LUNAS';
    let items = [];
    let total = 0;
    let initialPaid = 0;
    let initialChange = 0;
    let checkoutSubtotal = 0;
    let checkoutDiscount = 0;
    let checkoutTax = 0;

    if (txIdOrBatch && typeof txIdOrBatch === 'object') {
      // Direct batch payload from POS checkout
      invoiceNo = txIdOrBatch.invoice_no || `INV-${Date.now()}`;
      trackingNote = String(txIdOrBatch.note || txIdOrBatch.tracking_number || '').trim();
      dateStr = formatTxDate(txIdOrBatch.date || new Date().toISOString());
      customerName = txIdOrBatch.customer || 'Umum';
      cashierName = txIdOrBatch.cashier || 'Admin';
      method = txIdOrBatch.method || 'Cash';
      status = (txIdOrBatch.status || 'Lunas').toUpperCase();
      items = (txIdOrBatch.items || []).map(it => ({
        name: it.name || ('Produk #' + it.product_id),
        qty: getTransactionOutQty(it),
        price: it.price || 0,
        total: getTransactionOutQty(it) * (it.price || 0)
      }));
      total = txIdOrBatch.total !== undefined ? txIdOrBatch.total : items.reduce((s, it) => s + it.total, 0);
      const isBatchUnpaid = method === 'Tempo' || status === 'BELUM LUNAS';
      initialPaid = isBatchUnpaid ? 0 : (txIdOrBatch.paid !== undefined ? txIdOrBatch.paid : total);
      initialChange = isBatchUnpaid ? 0 : (txIdOrBatch.change !== undefined ? txIdOrBatch.change : Math.max(0, initialPaid - total));
      checkoutSubtotal = txIdOrBatch.subtotal !== undefined ? Number(txIdOrBatch.subtotal) : items.reduce((s, it) => s + it.total, 0);
      checkoutDiscount = Number(txIdOrBatch.discount || 0);
      checkoutTax = Number(txIdOrBatch.tax || 0);

      activeReceiptTx = {
        invoice_no: invoiceNo,
        tracking: trackingNote,
        date: dateStr,
        customer: customerName,
        customer_phone: txIdOrBatch.customer_phone || (availableCustomers.find(c => c.name === customerName)?.phone) || '',
        cashier: cashierName,
        method: method,
        status: status,
        channel: txIdOrBatch.channel || 'Offline',
        total: total,
        paid: initialPaid,
        change: initialChange,
        items: items,
        subtotal: checkoutSubtotal || (total + checkoutDiscount - checkoutTax),
        discount: checkoutDiscount,
        tax: checkoutTax
      };
    } else {
      // From transaction table row click
      const tx = allOutTransactions.find(t => String(t.id) === String(txIdOrBatch));
      if (!tx) {
        if (typeof showToast === 'function') showToast('Transaksi tidak ditemukan', 'error');
        return;
      }

      // Check if this transaction belongs to an invoice batch [INV-...]
      const invMatch = tx.note ? tx.note.match(/\[(INV-[^\]]+)\]/) : null;
      const invCode = invMatch ? invMatch[1] : null;
      trackingNote = String(tx.note || tx.notes || '')
        .replace(/\[(?:INV-[^\]]+)\]\s*/, '')
        .replace(/\|AQ_(?:DISCOUNT|TAX|TOTAL)=[^|]*/g, '')
        .trim();

      if (invCode) {
        const siblingTxs = allOutTransactions.filter(t => t.note && t.note.includes(`[${invCode}]`));
        invoiceNo = invCode;
        dateStr = formatTxDate(tx.created_at);
        customerName = tx.customers?.name || 'Umum';
        cashierName = formatCashierName(tx.created_by);
        method = tx.payment_method || 'Cash';
        status = (tx.payment_status || 'Lunas').toUpperCase();
        items = siblingTxs.map(t => ({
          name: t.products?.name || ('Produk #' + t.product_id),
          qty: getTransactionOutQty(t),
          price: t.price || 0,
          total: getTransactionOutQty(t) * (t.price || 0)
        }));
        total = items.reduce((s, it) => s + it.total, 0);
        const receiptMeta = parsePosReceiptMeta(siblingTxs[0]?.note);
        checkoutSubtotal = total;
        checkoutDiscount = receiptMeta.discount;
        checkoutTax = receiptMeta.tax;
        if (receiptMeta.total !== null) total = receiptMeta.total;
      } else {
        invoiceNo = getTransactionCode(tx);
        dateStr = formatTxDate(tx.created_at);
        customerName = tx.customers?.name || 'Umum';
        cashierName = formatCashierName(tx.created_by);
        method = tx.payment_method || 'Cash';
        status = (tx.payment_status || 'Lunas').toUpperCase();
        const qty = getTransactionOutQty(tx);
        const price = tx.price || 0;
        items = [{
          name: tx.products?.name || ('Produk #' + tx.product_id),
          qty: qty,
          price: price,
          total: qty * price
        }];
        total = qty * price;
        const receiptMeta = parsePosReceiptMeta(tx.note);
        checkoutSubtotal = total;
        checkoutDiscount = receiptMeta.discount;
        checkoutTax = receiptMeta.tax;
        if (receiptMeta.total !== null) total = receiptMeta.total;
      }

      const isSingleUnpaid = method === 'Tempo' || status === 'BELUM LUNAS';
      initialPaid = isSingleUnpaid ? 0 : total;
      initialChange = 0;

      const custObj = availableCustomers.find(c => String(c.id) === String(tx.customer_id));
      const customerPhone = tx.customers?.phone || custObj?.phone || '';

      activeReceiptTx = {
        invoice_no: invoiceNo,
        tracking: trackingNote,
        date: dateStr,
        customer: customerName,
        customer_phone: customerPhone,
        cashier: cashierName,
        method: method,
        status: status,
        channel: tx.channel || 'Offline',
        total: total,
        paid: initialPaid,
        change: initialChange,
        items: items,
        subtotal: checkoutSubtotal || (total + checkoutDiscount - checkoutTax),
        discount: checkoutDiscount,
        tax: checkoutTax
      };
    }

    const elCode = document.getElementById('receipt-meta-code');
    const elDate = document.getElementById('receipt-meta-date');
    const elCashier = document.getElementById('receipt-meta-cashier');
    const elCustomer = document.getElementById('receipt-meta-customer');
    const elMethod = document.getElementById('receipt-meta-method');
    const elTracking = document.getElementById('receipt-meta-tracking');
    const elItems = document.getElementById('receipt-items-list');
    const elTotal = document.getElementById('receipt-calc-total');
    const elPaid = document.getElementById('receipt-calc-paid');
    const elChange = document.getElementById('receipt-calc-change');
    const elStatus = document.getElementById('receipt-calc-status');
    const elSubtotal = document.getElementById('receipt-calc-subtotal');
    const elDiscount = document.getElementById('receipt-calc-discount');
    const elTax = document.getElementById('receipt-calc-tax');
    const inputBayar = document.getElementById('receipt-input-bayar');

    if (elCode) elCode.textContent = invoiceNo;
    if (elDate) elDate.textContent = dateStr;
    if (elCashier) elCashier.textContent = cashierName;
    if (elCustomer) elCustomer.textContent = customerName;
    if (elMethod) elMethod.textContent = method;
    if (elTracking) {
      const courier = detectCourierFromTracking(trackingNote);
      elTracking.textContent = courier ? `${trackingNote} (${courier.name})` : (trackingNote || '-');
      elTracking.closest('[data-receipt-tracking]')?.classList.toggle('hidden', !trackingNote);
    }
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
      elItems.innerHTML = items.map(it => `
        <div class="space-y-0.5 border-b border-dashed border-gray-200 pb-1.5 last:border-0 last:pb-0">
          <p class="font-bold text-black">${it.name}</p>
          <div class="flex justify-between text-gray-700">
            <span>${it.qty} x ${formatRupiahVal(it.price)}</span>
            <span class="font-bold text-black">${formatRupiahVal(it.total)}</span>
          </div>
        </div>
      `).join('');
    }

    if (elTotal) elTotal.textContent = formatRupiahVal(total);
    if (elSubtotal) elSubtotal.textContent = formatRupiahVal(checkoutSubtotal || total + checkoutDiscount - checkoutTax);
    if (elDiscount) elDiscount.textContent = formatRupiahVal(checkoutDiscount);
    if (elTax) elTax.textContent = formatRupiahVal(checkoutTax);
    if (inputBayar) inputBayar.value = initialPaid;
    if (elPaid) elPaid.textContent = formatRupiahVal(initialPaid);
    if (elChange) elChange.textContent = formatRupiahVal(initialChange);

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
    const total = Number(activeReceiptTx.total || 0);
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

  function generateInvoicePrintHTML(inv) {
    const store = inv.storeInfo || {
      name: 'Hasanah Pancing',
      slogan: 'Perlengkapan Memancing & Akuarium',
      address: 'Jl. Mangga No. 67, Pondok Gede, Kota Bekasi',
      phone: '0812-9662-8052',
      logo_url: '/assets/images/hasanah-pancing-logo.png'
    };
    const storeLogo = (store.logo_url && !String(store.logo_url).includes('habitic-logo'))
      ? store.logo_url
      : '/assets/images/hasanah-pancing-logo.png';

    const isPaid = (inv.status || 'LUNAS').toUpperCase() === 'LUNAS';
    const terbilangStr = terbilang(inv.total) + ' Rupiah';

    const itemRows = (inv.items || []).map((it, idx) => `
      <tr>
        <td class="text-center" style="width: 35px;">${idx + 1}</td>
        <td>
          <div style="font-weight: 600; color: #111827;">${escapeHtml(it.name)}</div>
        </td>
        <td class="text-center" style="width: 60px; font-weight: 600;">${it.qty}</td>
        <td class="text-right" style="width: 110px;">${formatRupiahVal(it.price)}</td>
        <td class="text-right" style="width: 120px; font-weight: 700;">${formatRupiahVal(it.total)}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${escapeHtml(inv.invoice_no || 'INV')}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm 15mm 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #1f2937; margin: 0; padding: 20px; background: #fff; }
    .invoice-card { max-width: 800px; margin: 0 auto; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #0088CC; padding-bottom: 12px; }
    .store-name { font-size: 20px; font-weight: 800; color: #0088CC; text-transform: uppercase; letter-spacing: 0.5px; }
    .store-info { font-size: 10px; color: #4b5563; line-height: 1.35; margin-top: 3px; }
    .inv-title { font-size: 22px; font-weight: 900; text-align: right; color: #111827; letter-spacing: 0.5px; }
    .inv-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-top: 4px; }
    .inv-badge-paid { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .inv-badge-unpaid { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    
    .meta-box { width: 100%; border-collapse: collapse; margin-bottom: 18px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; }
    .meta-box td { padding: 9px 12px; vertical-align: top; width: 50%; font-size: 10.5px; }
    .meta-box td.right-col { border-left: 1px solid #e5e7eb; }
    .meta-label { color: #6b7280; font-weight: 600; font-size: 10px; text-transform: uppercase; margin-bottom: 2px; }
    .meta-val { color: #111827; font-weight: 600; }
    
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .items-table th { background: #0088CC; color: #ffffff; font-weight: 700; font-size: 10px; text-transform: uppercase; padding: 8px 10px; text-align: left; }
    .items-table td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 10.5px; color: #1f2937; }
    .items-table tr:nth-child(even) td { background: #fafafa; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    
    .summary-grid { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .terbilang-box { background: #f3f4f6; border-left: 3px solid #0088CC; padding: 8px 12px; font-style: italic; font-size: 10.5px; color: #374151; border-radius: 0 4px 4px 0; margin-top: 6px; }
    .totals-box { width: 280px; margin-left: auto; border-collapse: collapse; }
    .totals-box td { padding: 4px 8px; font-size: 10.5px; }
    .totals-box tr.grand-total td { font-size: 13px; font-weight: 800; color: #0088CC; border-top: 2px solid #0088CC; border-bottom: 2px solid #0088CC; padding: 6px 8px; }
    
    .signature-grid { width: 100%; border-collapse: collapse; margin-top: 35px; }
    .signature-grid td { width: 50%; text-align: center; vertical-align: top; font-size: 10.5px; }
    .sig-space { height: 60px; }
    .sig-name { font-weight: 700; text-decoration: underline; color: #111827; }
    .footer-notes { margin-top: 25px; padding-top: 10px; border-top: 1px dashed #d1d5db; font-size: 9.5px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <img src="${escapeHtml(storeLogo)}" alt="${escapeHtml(store.name || 'Hasanah Pancing')}" style="height: 50px; max-width: 140px; object-fit: contain;" onerror="this.style.display='none'">
            <div>
              <div class="store-name">${escapeHtml(store.name || 'Hasanah Pancing')}</div>
              <div class="store-info">${escapeHtml(store.slogan || 'Perlengkapan Memancing & Akuarium')}</div>
              <div class="store-info">${escapeHtml(store.address || '')}</div>
              <div class="store-info">WhatsApp / Telp: ${escapeHtml(store.phone || '')}</div>
            </div>
          </div>
        </td>
        <td style="vertical-align: top; text-align: right;">
          <div class="inv-title">INVOICE PENJUALAN</div>
          <div class="inv-badge ${isPaid ? 'inv-badge-paid' : 'inv-badge-unpaid'}">${isPaid ? 'LUNAS' : 'BELUM LUNAS'}</div>
          <div style="font-size: 10px; color: #6b7280; margin-top: 6px;">Metode: <b>${escapeHtml(inv.method || 'Cash')}</b></div>
        </td>
      </tr>
    </table>

    <table class="meta-box">
      <tr>
        <td>
          <div class="meta-label">Ditagihkan Kepada:</div>
          <div class="meta-val" style="font-size: 12px;">${escapeHtml(inv.customer || 'Umum')}</div>
          ${inv.customer_phone ? `<div style="color: #4b5563; font-size: 10px; margin-top: 2px;">Telp: ${escapeHtml(inv.customer_phone)}</div>` : ''}
          <div style="color: #6b7280; font-size: 10px; margin-top: 3px;">Channel Penjualan: <b>${escapeHtml(inv.channel || 'Offline')}</b></div>
        </td>
        <td class="right-col">
          <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
            <tr><td class="meta-label" style="width: 90px;">No. Invoice</td><td class="meta-val">: ${escapeHtml(inv.invoice_no || '-')}</td></tr>
            <tr><td class="meta-label">Tanggal</td><td class="meta-val">: ${escapeHtml(inv.date || '-')}</td></tr>
            <tr><td class="meta-label">Kasir</td><td class="meta-val">: ${escapeHtml(inv.cashier || 'Admin')}</td></tr>
            ${inv.tracking && inv.tracking !== '-' ? `<tr><td class="meta-label">No. Resi</td><td class="meta-val">: ${escapeHtml(inv.tracking)}</td></tr>` : ''}
          </table>
        </td>
      </tr>
    </table>

    <table class="items-table">
      <thead>
        <tr>
          <th class="text-center">No</th>
          <th>Nama Barang / Produk</th>
          <th class="text-center">Qty</th>
          <th class="text-right">Harga Satuan</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <table class="summary-grid">
      <tr>
        <td style="vertical-align: top; width: 55%; padding-right: 15px;">
          <div class="meta-label">Terbilang:</div>
          <div class="terbilang-box">"${escapeHtml(terbilangStr)}"</div>
          <div style="margin-top: 14px; font-size: 10px; color: #4b5563; line-height: 1.4;">
            <b>Catatan &amp; Ketentuan:</b><br>
            • Barang yang sudah dibeli dapat ditukar maksimal 2 hari setelah transaksi dengan menyertakan invoice ini.<br>
            • Garansi perlengkapan elektrik (pompa/lampu) mengikuti kebijakan distributor resmi.
          </div>
        </td>
        <td style="vertical-align: top; width: 45%;">
          <table class="totals-box">
            <tr>
              <td class="meta-label">Subtotal</td>
              <td class="text-right">${formatRupiahVal(inv.subtotal || inv.total)}</td>
            </tr>
            ${inv.discount > 0 ? `
            <tr>
              <td class="meta-label" style="color: #16a34a;">Diskon Nota</td>
              <td class="text-right" style="color: #16a34a;">-${formatRupiahVal(inv.discount)}</td>
            </tr>` : ''}
            ${inv.tax > 0 ? `
            <tr>
              <td class="meta-label">PPN (11%)</td>
              <td class="text-right">+${formatRupiahVal(inv.tax)}</td>
            </tr>` : ''}
            <tr class="grand-total">
              <td>TOTAL AKHIR</td>
              <td class="text-right">${formatRupiahVal(inv.total)}</td>
            </tr>
            ${inv.paid > 0 ? `
            <tr>
              <td class="meta-label">Bayar Diterima</td>
              <td class="text-right font-semibold">${formatRupiahVal(inv.paid)}</td>
            </tr>
            <tr>
              <td class="meta-label">Kembalian</td>
              <td class="text-right font-semibold">${formatRupiahVal(inv.change || 0)}</td>
            </tr>` : ''}
          </table>
        </td>
      </tr>
    </table>

    <table class="signature-grid">
      <tr>
        <td>
          <div>Tanda Terima / Pelanggan,</div>
          <div class="sig-space"></div>
          <div class="sig-name">( ${escapeHtml(inv.customer || '........................')} )</div>
        </td>
        <td>
          <div>Hormat Kami,</div>
          <div class="sig-space"></div>
          <div class="sig-name">( ${escapeHtml(store.name || 'Habitic Store')} )</div>
        </td>
      </tr>
    </table>

    <div class="footer-notes">
      Terima kasih telah mempercayakan kebutuhan akuarium Anda kepada ${escapeHtml(store.name || 'Habitic')}.
    </div>
  </div>
</body>
</html>`;
  }

  async function printInvoicePDF(txIdOrBatch) {
    let invData = null;

    if (txIdOrBatch && typeof txIdOrBatch === 'object' && txIdOrBatch.items) {
      invData = { ...txIdOrBatch };
    } else if (txIdOrBatch) {
      const tx = allOutTransactions.find(t => String(t.id) === String(txIdOrBatch));
      if (!tx) {
        if (typeof showToast === 'function') showToast('Transaksi tidak ditemukan', 'error');
        return;
      }

      const invCode = tx.invoice_no || (tx.note ? (tx.note.match(/\[(INV-[^\]]+)\]/i)?.[1]) : null);
      let siblingTxs = [];
      if (invCode) {
        siblingTxs = allOutTransactions.filter(t => t.invoice_no === invCode || (t.note && t.note.includes(`[${invCode}]`)));
      }
      if (siblingTxs.length === 0) siblingTxs = [tx];

      const items = siblingTxs.map(t => ({
        name: t.products?.name || ('Produk #' + t.product_id),
        qty: getTransactionOutQty(t),
        price: t.price || 0,
        total: getTransactionOutQty(t) * (t.price || 0)
      }));

      const rawTotal = items.reduce((s, it) => s + it.total, 0);
      const receiptMeta = parsePosReceiptMeta(siblingTxs[0]?.note);
      const discount = Number(siblingTxs[0]?.discount_amount !== undefined ? siblingTxs[0].discount_amount : receiptMeta.discount);
      const tax = Number(siblingTxs[0]?.tax_amount !== undefined ? siblingTxs[0].tax_amount : receiptMeta.tax);
      const finalTotal = Number(siblingTxs[0]?.final_total !== undefined ? siblingTxs[0].final_total : (receiptMeta.total !== null ? receiptMeta.total : rawTotal));

      const custObj = availableCustomers.find(c => String(c.id) === String(tx.customer_id));
      const customerPhone = tx.customers?.phone || custObj?.phone || '';

      invData = {
        invoice_no: invCode || getTransactionCode(tx),
        date: formatTxDate(tx.created_at),
        customer: tx.customers?.name || custObj?.name || 'Umum',
        customer_phone: customerPhone,
        cashier: formatCashierName(tx.created_by),
        channel: tx.channel || 'Offline',
        method: tx.payment_method || 'Cash',
        status: (tx.payment_status || 'Lunas').toUpperCase(),
        tracking: cleanPosTrackingNote(tx.note) || '',
        items: items,
        subtotal: rawTotal,
        discount: discount,
        tax: tax,
        total: finalTotal,
        paid: finalTotal,
        change: 0
      };
    } else if (activeReceiptTx) {
      invData = { ...activeReceiptTx };
    }

    if (!invData) {
      if (typeof showToast === 'function') showToast('Data invoice tidak ditemukan untuk dicetak', 'error');
      return;
    }

    // Ambil info profil toko
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
      if (storeInfo) invData.storeInfo = storeInfo;
    } catch (_) {}

    const htmlContent = generateInvoicePrintHTML(invData);

    // Buka dedicated print window atau hidden iframe fallback
    let printWindow = null;
    try {
      printWindow = window.open('', '_blank');
    } catch (_) {}

    if (printWindow) {
      try {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          try { printWindow.print(); } catch (_) {}
        }, 250);
        return;
      } catch (err) {
        console.warn('Fallback ke iframe untuk invoice PDF print:', err);
      }
    }

    // Hidden iframe fallback
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow ? (iframe.contentWindow.document || iframe.contentDocument) : null;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();
      }
      setTimeout(() => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }
        } catch (_) {}
        setTimeout(() => { try { iframe.remove(); } catch (_) {} }, 2000);
      }, 350);
    } catch (fallbackErr) {
      console.error('Gagal cetak invoice:', fallbackErr);
      if (typeof showToast === 'function') {
        showToast('Gagal membuka dialog cetak invoice: ' + fallbackErr.message, 'error');
      }
    }
  }

  function printCurrentReceiptAsInvoicePDF() {
    if (!activeReceiptTx) {
      if (typeof showToast === 'function') showToast('Tidak ada data struk aktif', 'error');
      return;
    }
    printInvoicePDF(activeReceiptTx);
  }

  function shareReceiptViaWhatsApp() {
    if (!activeReceiptTx) {
      if (typeof showToast === 'function') showToast('Tidak ada data struk aktif', 'error');
      return;
    }

    let phone = activeReceiptTx.customer_phone || '';
    if (!phone) {
      const inputPhone = prompt(`Masukkan nomor WhatsApp pelanggan (${activeReceiptTx.customer || 'Umum'}):`, '');
      if (inputPhone === null) return;
      phone = inputPhone.trim();
    }

    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    }

    const storeName = document.getElementById('receipt-store-name')?.textContent || 'Habitic';
    const storeAddress = document.getElementById('receipt-store-address')?.textContent || '';
    const storePhone = document.getElementById('receipt-store-phone')?.textContent || '';

    let msg = `🧾 *NOTA PENJUALAN - ${storeName.toUpperCase()}*\n`;
    if (storeAddress) msg += `📍 ${storeAddress}\n`;
    if (storePhone) msg += `📞 ${storePhone}\n`;
    msg += `────────────────────────────\n`;
    msg += `No. Nota   : *${activeReceiptTx.invoice_no || '-'}*\n`;
    msg += `Tanggal    : ${activeReceiptTx.date || '-'}\n`;
    msg += `Kasir      : ${activeReceiptTx.cashier || 'Admin'}\n`;
    msg += `Pelanggan  : ${activeReceiptTx.customer || 'Umum'}\n`;
    if (activeReceiptTx.channel && activeReceiptTx.channel !== 'Offline') {
      msg += `Channel    : ${activeReceiptTx.channel}\n`;
    }
    if (activeReceiptTx.tracking && activeReceiptTx.tracking !== '-') {
      msg += `No. Resi   : ${activeReceiptTx.tracking}\n`;
    }
    msg += `Metode     : ${activeReceiptTx.method || 'Cash'}\n`;
    msg += `────────────────────────────\n`;
    msg += `📦 *RINCIAN PEMBELIAN:*\n`;

    (activeReceiptTx.items || []).forEach((it, idx) => {
      msg += `${idx + 1}. *${it.name}*\n`;
      msg += `   ${it.qty} x ${formatRupiahVal(it.price)} = *${formatRupiahVal(it.total)}*\n`;
    });

    msg += `────────────────────────────\n`;
    const subtotal = activeReceiptTx.subtotal || activeReceiptTx.total;
    msg += `Subtotal   : ${formatRupiahVal(subtotal)}\n`;
    if (activeReceiptTx.discount > 0) {
      msg += `Diskon     : -${formatRupiahVal(activeReceiptTx.discount)}\n`;
    }
    if (activeReceiptTx.tax > 0) {
      msg += `PPN (11%)  : +${formatRupiahVal(activeReceiptTx.tax)}\n`;
    }
    msg += `*TOTAL     : ${formatRupiahVal(activeReceiptTx.total)}*\n`;
    if (activeReceiptTx.paid > 0) {
      msg += `Bayar      : ${formatRupiahVal(activeReceiptTx.paid)}\n`;
      msg += `Kembali    : ${formatRupiahVal(activeReceiptTx.change || 0)}\n`;
    }
    msg += `Status     : *${activeReceiptTx.status || 'LUNAS'}*\n`;
    msg += `────────────────────────────\n`;
    msg += `Terima kasih atas kunjungan Anda! 🙏\n`;
    msg += `_Barang yang sudah dibeli dapat ditukar maks 2 hari dengan membawa nota ini._\n`;

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(waUrl, '_blank');
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
  window.printInvoicePDF = printInvoicePDF;
  window.printCurrentReceiptAsInvoicePDF = printCurrentReceiptAsInvoicePDF;
  window.shareReceiptViaWhatsApp = shareReceiptViaWhatsApp;

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
      const code = getTransactionCode(tx);
      const dateStr = formatTxDate(tx.created_at);
      const prodName = tx.products?.name || ('Produk #' + tx.product_id);
      const channel = tx.channel || 'Offline';
      const custName = tx.customers?.name || 'Umum';
      const kasir = formatCashierName(tx.created_by);
      const qty = getTransactionOutQty(tx);
      const price = tx.price || 0;
      const total = getTransactionNetTotal(tx, allOutTransactions);
      const note = cleanPosTrackingNote(tx.note);

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
      if (typeof window !== 'undefined' && typeof window.loadUserDirectory === 'function') {
        try { await window.loadUserDirectory(); } catch (_) {}
      }
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
      const invoiceBtn = event.target.closest('[data-action="print-invoice"]');
      if (invoiceBtn) {
        event.stopPropagation();
        printInvoicePDF(invoiceBtn.dataset.transactionId);
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
        requiredHeaders: ['SKU', 'Jumlah', 'Harga Satuan (Rp)', 'Customer', 'Channel', 'Tanggal (YYYY-MM-DD)'],
        templateRows: [
          ['PAK-LOK-001', '8991234567890', '2', '25000', 'Budi Santoso', 'Offline', '2026-10-16', 'Kasir Tunai Toko'],
          ['POM-RES-002', '', '1', '70000', 'Umum', 'Shopee', '2026-10-16', 'Pesanan Marketplace Resi SPX-1029'],
          ['MED-BLU-003', '', '3', '15000', 'Ahmad Dani', 'Tokopedia', '2026-10-16', 'Pesanan Online']
        ],
        instructions: [
          'SKU atau Barcode harus cocok dengan produk di Master Barang dan stok di toko harus mencukupi.',
          'Barcode bersifat opsional (dapat dikosongkan jika produk tidak memiliki barcode fisik).',
          'Jumlah harus berupa bilangan bulat positif lebih dari 0.',
          'Harga Satuan berupa angka harga jual per unit barang.',
          'Customer dapat diisi nama pelanggan terdaftar atau "Umum".',
          'Channel dapat diisi: Offline, Shopee, Tokopedia, TikTok, Lazada, dll.',
          'Tanggal wajib berformat YYYY-MM-DD (contoh: 2026-10-16).',
          'Catatan bersifat opsional (keterangan tambahan/nomor resi/pesanan).'
        ],
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
            const sku = (record['SKU'] || '').trim();
            const barcode = (record['Barcode'] || '').trim();
            const quantityText = (record['Jumlah'] || '').trim();
            const priceText = (record['Harga Satuan (Rp)'] || '').trim();
            const customer = (record['Customer'] || '').trim();
            const channel = (record['Channel'] || '').trim() || 'Offline';
            const date = (record['Tanggal (YYYY-MM-DD)'] || '').trim();
            const notes = (record['Catatan'] || '').trim();
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
              notes
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
let _scanTarget = 'product';

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

async function startWebBarcodeScan(target = 'product') {
  if (typeof window.openItemBarcodeScanner !== 'function') {
    showToast('Modul pemindai barcode belum siap. Muat ulang halaman dan coba kembali.', 'error');
    return;
  }
  _scanTarget = target === 'resi' ? 'resi' : 'product';
  await window.openItemBarcodeScanner(handleScanSuccess);
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
  const trimmed = decodedText ? decodedText.trim() : '';

  if (_scanTarget === 'resi') {
    const input = document.getElementById('out-note');
    if (!input) {
      showToast('Kolom nomor resi tidak tersedia. Buka Kasir POS lalu coba kembali.', 'error');
      return;
    }
    input.value = trimmed;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    showToast(`No. resi terbaca: ${trimmed.slice(0, 50)}`, 'success');
    return;
  }

  // Check if modal-out (POS) is open
  const modalOut = document.getElementById('modal-out');
  const isPosOpen = modalOut && !modalOut.classList.contains('hidden');

  if (isPosOpen) {
    const matchedProduct = availableProducts.find(p =>
      (p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase() === trimmed.toLowerCase())
    );

    if (matchedProduct) {
      addToPosCart(matchedProduct);
      showToast(`✓ ${matchedProduct.name} ditambahkan ke keranjang`, 'success');
      return;
    }
    showToast(`Barcode "${trimmed.slice(0, 30)}" tidak cocok dengan SKU atau barcode produk.`, 'error');
    return;
  }

  const input = document.getElementById('out-note');
  if (input) {
    input.value = trimmed;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  showToast(`Barcode terbaca: ${trimmed.slice(0, 30)}...`, 'success');
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

window.selectOutProduct = selectOutProduct;
window.clearOutProductSelection = clearOutProductSelection;
window.addToPosCart = addToPosCart;
window.updatePosCartQty = updatePosCartQty;
window.removeFromPosCart = removeFromPosCart;
window.clearPosCart = clearPosCart;
window.calculatePosTotal = calculatePosTotal;
window.calculatePosChange = calculatePosChange;
window.clearPosDiscount = clearPosDiscount;
window.clearPosCash = clearPosCash;
window.quickSetPosCash = quickSetPosCash;
window.handlePosPaymentMethodChange = handlePosPaymentMethodChange;
window.handlePosChannelChange = handlePosChannelChange;
window.addPosCatalogProduct = addPosCatalogProduct;
window.openAddOutModal = openAddOutModal;
window.startWebBarcodeScan = startWebBarcodeScan;
window.closeOutModal = closeOutModal;
window.handleOutSubmit = handleOutSubmit;
window.openDeleteOutModal = openDeleteOutModal;
window.closeDeleteOutModal = closeDeleteOutModal;
window.confirmDeleteOut = confirmDeleteOut;
window.filterPosCategory = filterPosCategory;
window.renderPosCatalogGrid = renderPosCatalogGrid;
window.filterOutPeriod = filterOutPeriod;
window.handleSearchOut = handleSearchOut;
window.goToOutPage = goToOutPage;
window.loadOutTransactions = loadOutTransactions;
window.handleExportOut = handleExportOut;
window.openPackingListModal = openPackingListModal;
window.closePackingListModal = closePackingListModal;
window.detectCourierFromTracking = detectCourierFromTracking;
window.handlePosTrackingInputChange = handlePosTrackingInputChange;
window.filterOutChannel = filterOutChannel;
window.filterPackingChannel = filterPackingChannel;
window.printInvoicePDF = printInvoicePDF;
window.printCurrentReceiptAsInvoicePDF = printCurrentReceiptAsInvoicePDF;
window.shareReceiptViaWhatsApp = shareReceiptViaWhatsApp;

document.addEventListener('DOMContentLoaded', () => {
  const discountInput = document.getElementById('pos-discount-input');
  if (discountInput) {
    discountInput.addEventListener('input', (e) => {
      const raw = parseNumericValue(e.target.value);
      e.target.value = raw > 0 ? formatNumberInput(raw) : '';
      calculatePosTotal();
    });
  }

  const cashInput = document.getElementById('pos-cash-input');
  if (cashInput) {
    cashInput.addEventListener('input', (e) => {
      const raw = parseNumericValue(e.target.value);
      e.target.value = raw > 0 ? formatNumberInput(raw) : '';
      calculatePosChange();
    });
  }

  const outSearchInput = document.getElementById('out-product-search');
  outSearchInput?.addEventListener('input', handleOutProductSearchInput);

  // Fast Barcode Scanner or Enter Key directly adds matched product to cart
  outSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = (e.target.value || '').trim().toLowerCase();
      if (!query) return;

      // 1. Try exact barcode or SKU match
      let match = availableProducts.find(p =>
        (p.barcode && p.barcode.toLowerCase() === query) ||
        (p.sku && p.sku.toLowerCase() === query)
      );

      // 2. Fallback to first partial name/sku/barcode match
      if (!match) {
        const matches = availableProducts.filter(p =>
          (p.name && p.name.toLowerCase().includes(query)) ||
          (p.sku && p.sku.toLowerCase().includes(query)) ||
          (p.barcode && p.barcode.toLowerCase().includes(query))
        );
        if (matches.length > 0) match = matches[0];
      }

      if (match) {
        addToPosCart(match, 1);
        e.target.value = '';
        const suggestionsEl = document.getElementById('out-product-suggestions');
        if (suggestionsEl) {
          suggestionsEl.classList.add('hidden');
          suggestionsEl.innerHTML = '';
        }
      } else {
        if (typeof showToast === 'function') {
          showToast(`Produk "${query}" tidak ditemukan`, 'warning');
        }
      }
    }
  });

  document.addEventListener('click', (e) => {
    const suggestionsEl = document.getElementById('out-product-suggestions');
    const input = document.getElementById('out-product-search');
    if (suggestionsEl && !suggestionsEl.contains(e.target) && e.target !== input) {
      suggestionsEl.classList.add('hidden');
    }
  });

  document.getElementById('btn-scan-barcode')?.addEventListener('click', startWebBarcodeScan);
  document.getElementById('btn-take-photo')?.addEventListener('click', takePhotoCapture);
  document.getElementById('btn-remove-photo')?.addEventListener('click', () => {
    const photoInput = document.getElementById('out-photo-data');
    if (photoInput) photoInput.value = '';
    const previewImg = document.getElementById('photo-preview-img');
    if (previewImg) previewImg.src = '';
    document.getElementById('photo-preview')?.classList.add('hidden');
  });

  const packingModal = document.getElementById('modal-packing-list');
  if (packingModal) {
    packingModal.addEventListener('click', (e) => {
      if (e.target === packingModal) closePackingListModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('modal-packing-list');
      if (modal && !modal.classList.contains('hidden')) {
        closePackingListModal();
      }
    }
  });
  window.addEventListener('m2stock:channels-updated', loadChannelDropdown);
  window.addEventListener('aquastock:channels-updated', loadChannelDropdown);
  const handleTxUpdatedOut = () => {
    if (typeof loadOutTransactions === 'function') {
      loadOutTransactions();
    }
  };
  window.addEventListener('m2stock:transactions-updated', handleTxUpdatedOut);
  window.addEventListener('aquastock:transactions-updated', handleTxUpdatedOut);
  window.refreshIcons?.();
});

/* ==========================================================
 * END OF WEB BARCODE SCANNER MODULE
 * ========================================================== */
