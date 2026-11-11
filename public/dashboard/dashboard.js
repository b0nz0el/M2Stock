function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
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

function getTransactionOutQty(txOrQty) {
  const qty = Math.abs(Number(typeof txOrQty === 'object' ? (txOrQty?.qty ?? txOrQty?.quantity) : txOrQty) || 0);
  return qty;
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

function getTransactionNetTotal(tx, list = []) {
  const qty = getTransactionOutQty(tx);
  const gross = qty * (Number(tx?.price ?? tx?.unit_price) || 0);
  const meta = parsePosReceiptMeta(tx?.note || tx?.notes);
  if (meta.total === null || meta.total === undefined) {
    return gross;
  }
  const invCode = getTransactionCode(tx);
  const siblings = (Array.isArray(list) && list.length > 0)
    ? list.filter(t => getTransactionCode(t) === invCode)
    : [tx];
  const totalGross = siblings.reduce((sum, t) => sum + (getTransactionOutQty(t) * (Number(t?.price ?? t?.unit_price) || 0)), 0);
  if (totalGross <= 0) return meta.total;
  const ratio = gross / totalGross;
  return Math.round(meta.total * ratio);
}

function getTransactionItemDiscount(tx, list = []) {
  const qty = getTransactionOutQty(tx);
  const gross = qty * (Number(tx?.price ?? tx?.unit_price) || 0);
  const meta = parsePosReceiptMeta(tx?.note || tx?.notes);
  if (!meta.discount) return 0;
  const invCode = getTransactionCode(tx);
  const siblings = (Array.isArray(list) && list.length > 0)
    ? list.filter(t => getTransactionCode(t) === invCode)
    : [tx];
  const totalGross = siblings.reduce((sum, t) => sum + (getTransactionOutQty(t) * (Number(t?.price ?? t?.unit_price) || 0)), 0);
  if (totalGross <= 0) return meta.discount;
  const ratio = gross / totalGross;
  return Math.round(meta.discount * ratio);
}

let currentDashboardPeriod = '30d';

function handleDashboardPeriodChange(period) {
  currentDashboardPeriod = period || '30d';
  loadDashboardData(currentDashboardPeriod, false);
}

async function loadDashboardData(period = null, showFeedback = false) {
  const activePeriod = period || document.getElementById('dashboard-period-filter')?.value || currentDashboardPeriod || '30d';
  currentDashboardPeriod = activePeriod;

  const refreshBtn = document.getElementById('btn-refresh-dashboard');
  const refreshIcon = refreshBtn?.querySelector('i, svg');
  if (refreshIcon) refreshIcon.classList.add('animate-spin');
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    // 1. Fetch Products
    const prodRes = await Api.items.getAll();
    const products = prodRes?.ok ? (prodRes.data || []) : [];

    const totalItems = products.length;
    let totalStock = 0;
    let stockValue = 0;
    let stockCostValue = 0;
    const criticalProducts = [];

    products.forEach(p => {
      const s = Number(p.stock) || 0;
      const sellPrice = Number(p.sell_price || p.cost_price || 0);
      const costPrice = Number(p.cost_price || 0);

      totalStock += s;
      stockValue += s * sellPrice;
      stockCostValue += s * costPrice;

      if (s <= (p.min_stock || 3)) {
        criticalProducts.push(p);
      }
    });

    const potentialProfit = stockValue - stockCostValue;

    const elTotalItems = document.getElementById('dash-total-items');
    const elTotalStock = document.getElementById('dash-total-stock');
    const elStockValue = document.getElementById('dash-stock-value');
    const elStockCostValue = document.getElementById('dash-stock-cost-value');
    const elPotentialProfit = document.getElementById('dash-potential-profit');
    const elCriticalStock = document.getElementById('dash-critical-stock');

    if (elTotalItems) elTotalItems.textContent = totalItems;
    if (elTotalStock) elTotalStock.textContent = totalStock;
    if (elStockValue) elStockValue.textContent = formatRupiahVal(stockValue);
    if (elStockCostValue) elStockCostValue.textContent = formatRupiahVal(stockCostValue);
    if (elPotentialProfit) elPotentialProfit.textContent = formatRupiahVal(potentialProfit);
    if (elCriticalStock) elCriticalStock.textContent = criticalProducts.length;

    // Render Restock List
    const restockContainer = document.getElementById('restock-list');
    if (restockContainer) {
      if (criticalProducts.length === 0) {
        restockContainer.innerHTML = '<p class="text-xs text-[#34C759] py-3 text-center">Semua stok produk aman</p>';
      } else {
        restockContainer.innerHTML = criticalProducts.slice(0, 3).map(p => {
          const isZero = (p.stock || 0) === 0;
          const badgeClass = isZero ? 'bg-[#FF3B30]/15 text-[#FF3B30]' : 'bg-[#FFCC00]/15 text-[#FFCC00]';
          const badgeText = isZero ? 'Habis' : 'Kritis';
          return `
              <div class="flex items-center justify-between">
                <div class="min-w-0">
                  <p class="text-sm font-medium truncate">${escapeHtml(p.name)}</p>
                  <p class="text-xs text-[#A0A0A5]">${p.stock || 0} unit</p>
                </div>
                <span class="badge ${badgeClass}">${badgeText}</span>
              </div>
            `;
        }).join('');
      }
    }

    // 2. Fetch Transactions
    if (typeof window.loadUserDirectory === 'function') {
      try { await window.loadUserDirectory(); } catch (_) { }
    }
    const txRes = await Api.transactions.getAll({ limit: 150 });
    const transactions = txRes?.ok ? (txRes.data || []) : [];

    // A. Transaksi Barang Keluar (Top 5 dari transaksi keluar)
    const recentTbody = document.getElementById('recent-transactions-tbody');
    if (recentTbody) {
      const outTransactions = transactions.filter(tx => tx.type === 'out');
      if (outTransactions.length === 0) {
        recentTbody.innerHTML = `
            <tr class="empty-state-row table-row">
              <td colspan="6" class="empty-state-cell px-5 py-8 text-center text-[#A0A0A5]">Belum ada transaksi barang keluar</td>
            </tr>
          `;
      } else {
        recentTbody.innerHTML = outTransactions.slice(0, 5).map(tx => {
          const dateStr = formatTxDate(tx.created_at);
          const prodName = tx.products?.name || 'Produk #' + tx.product_id;
          const channelBadge = getChannelBadge(tx.channel);
          const kasir = (typeof window.resolveUserName === 'function')
            ? window.resolveUserName(tx.created_by)
            : (typeof tx.created_by === 'string' && !tx.created_by.includes('-') ? tx.created_by : 'David');
          const qty = getTransactionOutQty(tx);
          const qtyStr = `-${qty}`;
          const qtyClass = 'text-[#FF3B30]';
          const netTotal = getTransactionNetTotal(tx, outTransactions);
          const discountVal = getTransactionItemDiscount(tx, outTransactions);

          return `
              <tr class="table-row border-b border-white/5">
                <td data-label="TANGGAL" class="px-5 py-3.5 text-[#A0A0A5] whitespace-nowrap">${dateStr}</td>
                <td data-label="BARANG" class="px-5 py-3.5 font-medium">${escapeHtml(prodName)}</td>
                <td data-label="CHANNEL" class="px-5 py-3.5 whitespace-nowrap">${channelBadge}</td>
                <td data-label="KASIR" data-cashier-id="${escapeHtml(tx.created_by || '')}" class="px-5 py-3.5 text-[#A0A0A5] whitespace-nowrap">${escapeHtml(kasir)}</td>
                <td data-label="JUMLAH" class="px-5 py-3.5 text-right font-semibold whitespace-nowrap ${qtyClass}">${qtyStr}</td>
                <td data-label="TOTAL" class="px-5 py-3.5 text-right font-semibold text-white whitespace-nowrap">
                  ${formatRupiahVal(netTotal)}
                  ${discountVal > 0 ? `<div class="text-[10px] text-[#34C759] font-normal leading-tight">Diskon ${formatRupiahVal(discountVal)}</div>` : ''}
                </td>
              </tr>
            `;
        }).join('');
      }
      if (typeof window.syncTableLabels === 'function') window.syncTableLabels();
    }

    // B. Transaksi Barang Masuk (Card Ringkasan Masuk)
    const recentInContainer = document.getElementById('recent-in-transactions-list');
    if (recentInContainer) {
      const inTransactions = transactions.filter(tx => tx.type === 'in');
      if (inTransactions.length === 0) {
        recentInContainer.innerHTML = '<p class="text-xs text-[#A0A0A5] py-4 text-center">Belum ada transaksi barang masuk</p>';
      } else {
        recentInContainer.innerHTML = inTransactions.slice(0, 3).map(tx => {
          const dateStr = formatTxDate(tx.created_at);
          const prodName = tx.products?.name || 'Produk #' + tx.product_id;
          const supplierName = tx.suppliers?.name || 'Supplier';
          const totalCost = (tx.qty || 0) * (tx.cost_price || tx.price || 0);

          return `
              <div class="flex items-center justify-between gap-3 border-b border-white/5 pb-2.5 last:border-b-0 last:pb-0">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium truncate text-white" title="${escapeHtml(prodName)}">${escapeHtml(prodName)}</p>
                  <p class="text-xs text-[#A0A0A5] truncate">${dateStr} · <span class="text-[#32ADE6]">${escapeHtml(supplierName)}</span></p>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-xs font-bold text-[#34C759] block">+${tx.qty} unit</span>
                  <span class="text-xs text-[#A0A0A5] font-medium block">${formatRupiahVal(totalCost)}</span>
                </div>
              </div>
            `;
        }).join('');
      }
    }

    // Hitung batas waktu filter periode
    const now = new Date();
    let periodCutoff = 0;
    let periodLabel = '30 Hari';
    let chartDaysCount = 10;

    if (activePeriod === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      periodCutoff = todayStart.getTime();
      periodLabel = 'Hari Ini';
      chartDaysCount = 7;
    } else if (activePeriod === '7d') {
      periodCutoff = now.getTime() - (7 * 24 * 60 * 60 * 1000);
      periodLabel = '7 Hari';
      chartDaysCount = 7;
    } else {
      periodCutoff = now.getTime() - (30 * 24 * 60 * 60 * 1000);
      periodLabel = '30 Hari';
      chartDaysCount = 10;
    }

    // Saring transaksi keluar sesuai periode
    const filteredOutTransactions = transactions.filter(t => {
      if (t.type !== 'out') return false;
      const tTime = new Date(t.created_at).getTime();
      return tTime >= periodCutoff;
    });

    // B. Top 5 Terlaris (Berdasarkan periode terpilih)
    const salesByProduct = {};
    filteredOutTransactions.forEach(t => {
      const pId = t.product_id;
      const pName = t.products?.name || 'Produk #' + pId;
      if (!salesByProduct[pId]) {
        salesByProduct[pId] = { name: pName, qty: 0 };
      }
      salesByProduct[pId].qty += (t.qty || 0);
    });

    const topList = Object.values(salesByProduct).sort((a, b) => b.qty - a.qty).slice(0, 5);
    const topContainer = document.getElementById('top-products-list');
    if (topContainer) {
      if (topList.length === 0) {
        topContainer.innerHTML = `<p class="text-xs text-[#A0A0A5] py-4 text-center">Belum ada penjualan periode ${periodLabel}</p>`;
      } else {
        const maxQty = topList[0].qty || 1;
        const colors = [
          'from-[#FFCC00] to-[#FF9500]',
          'from-[#0088CC] to-[#32ADE6]',
          'from-[#FF9500] to-[#FFCC00]',
          'bg-[#A0A0A5]',
          'bg-[#A0A0A5]'
        ];
        topContainer.innerHTML = topList.map((item, idx) => {
          const pct = Math.min(100, Math.round((item.qty / maxQty) * 100));
          const barBg = colors[idx] || 'bg-[#A0A0A5]';
          const colorClass = barBg.startsWith('from') ? `bg-gradient-to-r ${barBg}` : barBg;
          return `
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-sm font-medium truncate max-w-[200px]">${escapeHtml(item.name)}</span>
                  <span class="text-sm font-bold text-white">${item.qty}</span>
                </div>
                <div class="w-full bg-white/5 rounded-full h-1.5">
                  <div class="${colorClass} h-1.5 rounded-full progress-animate" style="width: ${pct}%"></div>
                </div>
              </div>
            `;
        }).join('');
      }
    }

    // C. Sales Chart
    const chartDays = [];
    for (let i = chartDaysCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      chartDays.push(d);
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const chartLabels = chartDays.map(d => `${d.getDate()} ${months[d.getMonth()]}`);
    const salesDaily = new Array(chartDaysCount).fill(0);
    const profitDaily = new Array(chartDaysCount).fill(0);

    let totalPeriodSales = 0;
    let totalPeriodProfit = 0;

    const prodMap = {};
    products.forEach(p => {
      if (p && p.id != null) prodMap[String(p.id)] = p;
    });

    filteredOutTransactions.forEach(t => {
      const prod = t.products || prodMap[String(t.product_id)] || {};
      const rev = getTransactionNetTotal(t, filteredOutTransactions);
      const unitCost = Number(t.cost_price) > 0 ? Number(t.cost_price) : Number(prod.cost_price || 0);
      const cost = getTransactionOutQty(t) * unitCost;
      const pft = Math.max(0, rev - cost);

      totalPeriodSales += rev;
      totalPeriodProfit += pft;

      const tDate = new Date(t.created_at);
      chartDays.forEach((d, idx) => {
        if (tDate.getDate() === d.getDate() && tDate.getMonth() === d.getMonth() && tDate.getFullYear() === d.getFullYear()) {
          salesDaily[idx] += Math.round(rev / 1000); // in thousands (rb)
          profitDaily[idx] += Math.round(pft / 1000);
        }
      });
    });

    // Update Sales Summary header
    const salesSummaryEl = document.getElementById('dash-sales-summary');
    if (salesSummaryEl) {
      salesSummaryEl.textContent = `${periodLabel}: ${formatRupiahVal(totalPeriodSales)} · Laba: ${formatRupiahVal(totalPeriodProfit)}`;
    }

    // Update sales bar chart ALWAYS
    try {
      if (typeof window.updateDashboardSalesChart === 'function') {
        window.updateDashboardSalesChart(chartLabels, salesDaily, profitDaily);
      }
    } catch (chartErr) {
      console.warn('Could not update sales chart:', chartErr);
    }

    // D. Channel Chart (sesuai periode terpilih)
    const channelCounts = { 'Shopee': 0, 'Tokopedia': 0, 'TikTok': 0, 'Offline': 0 };
    filteredOutTransactions.forEach(t => {
      const ch = t.channel || 'Offline';
      if (ch.toLowerCase().includes('shopee')) channelCounts['Shopee'] += (t.qty || 0);
      else if (ch.toLowerCase().includes('tokopedia')) channelCounts['Tokopedia'] += (t.qty || 0);
      else if (ch.toLowerCase().includes('tiktok')) channelCounts['TikTok'] += (t.qty || 0);
      else channelCounts['Offline'] += (t.qty || 0);
    });

    const totalChannelQty = Object.values(channelCounts).reduce((a, b) => a + b, 0);
    try {
      if (typeof window.updateDashboardChannelChart === 'function') {
        if (totalChannelQty > 0) {
          window.updateDashboardChannelChart(
            Object.keys(channelCounts),
            Object.values(channelCounts),
            ['#EE4D2D', '#42B549', '#00F2FE', '#0088CC']
          );
        } else {
          window.updateDashboardChannelChart(
            ['Belum ada data'],
            [1],
            ['rgba(255,255,255,0.08)']
          );
        }
      }
    } catch (channelErr) {
      console.warn('Could not update channel chart:', channelErr);
    }

    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  } catch (err) {
    console.error('Error loading dashboard data:', err);
    if (typeof window.showToast === 'function') {
      window.showToast('Gagal memuat data dashboard', 'error');
    }
  } finally {
    setTimeout(() => {
      if (refreshIcon) refreshIcon.classList.remove('animate-spin');
      if (refreshBtn) refreshBtn.disabled = false;
    }, 350);
  }
}

if (typeof window !== 'undefined') {
  window.loadDashboardData = loadDashboardData;
  window.handleDashboardPeriodChange = handleDashboardPeriodChange;

  const refreshDash = () => {
    loadDashboardData(null, false);
  };
  window.addEventListener('m2stock:transactions-updated', refreshDash);
  window.addEventListener('aquastock:transactions-updated', refreshDash);
  window.addEventListener('m2stock:products-updated', refreshDash);
  window.addEventListener('aquastock:products-updated', refreshDash);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    loadDashboardData(null, false);
  });
} else {
  loadDashboardData(null, false);
}
