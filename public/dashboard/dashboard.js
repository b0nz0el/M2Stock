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

  let currentDashboardPeriod = '30d';

  function handleDashboardPeriodChange(period) {
    currentDashboardPeriod = period || '30d';
    loadDashboardData(currentDashboardPeriod, false);
  }

  async function loadDashboardData(period = null, showFeedback = true) {
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
      const criticalProducts = [];

      products.forEach(p => {
        const s = p.stock || 0;
        totalStock += s;
        stockValue += s * (p.sell_price || p.cost_price || 0);
        if (s <= (p.min_stock || 3)) {
          criticalProducts.push(p);
        }
      });

      const elTotalItems = document.getElementById('dash-total-items');
      const elTotalStock = document.getElementById('dash-total-stock');
      const elStockValue = document.getElementById('dash-stock-value');
      const elCriticalStock = document.getElementById('dash-critical-stock');

      if (elTotalItems) elTotalItems.textContent = totalItems;
      if (elTotalStock) elTotalStock.textContent = totalStock;
      if (elStockValue) elStockValue.textContent = formatRupiahVal(stockValue);
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
                  <p class="text-sm font-medium truncate">${p.name}</p>
                  <p class="text-xs text-[#A0A0A5]">${p.stock || 0} unit</p>
                </div>
                <span class="badge ${badgeClass}">${badgeText}</span>
              </div>
            `;
          }).join('');
        }
      }

      // 2. Fetch Transactions
      const txRes = await Api.transactions.getAll({ limit: 150 });
      const transactions = txRes?.ok ? (txRes.data || []) : [];

      // A. Recent Transactions (Top 5 dari keseluruhan)
      const recentTbody = document.getElementById('recent-transactions-tbody');
      if (recentTbody) {
        if (transactions.length === 0) {
          recentTbody.innerHTML = `
            <tr class="empty-state-row table-row">
              <td colspan="6" class="empty-state-cell px-5 py-8 text-center text-[#A0A0A5]">Belum ada transaksi</td>
            </tr>
          `;
        } else {
          recentTbody.innerHTML = transactions.slice(0, 5).map(tx => {
            const dateStr = formatTxDate(tx.created_at);
            const prodName = tx.products?.name || 'Produk #' + tx.product_id;
            const channelBadge = tx.type === 'in' 
              ? `<span class="badge bg-[#34C759]/15 text-[#34C759]">Masuk (${tx.suppliers?.name || 'Supplier'})</span>`
              : getChannelBadge(tx.channel);
            const kasir = tx.created_by ? (tx.created_by.slice(0, 8) + '...') : 'Admin';
            const isOut = tx.type === 'out';
            const qtyStr = isOut ? `-${tx.qty}` : `+${tx.qty}`;
            const qtyClass = isOut ? 'text-[#FF3B30]' : 'text-[#34C759]';
            const total = (tx.qty || 0) * (tx.price || 0);

            return `
              <tr class="table-row border-b border-white/5">
                <td data-label="TANGGAL" class="px-5 py-3.5 text-[#A0A0A5]">${dateStr}</td>
                <td data-label="BARANG" class="px-5 py-3.5 font-medium">${prodName}</td>
                <td data-label="CHANNEL" class="px-5 py-3.5">${channelBadge}</td>
                <td data-label="KASIR" class="px-5 py-3.5 text-[#A0A0A5]">${kasir}</td>
                <td data-label="JUMLAH" class="px-5 py-3.5 text-right font-semibold ${qtyClass}">${qtyStr}</td>
                <td data-label="TOTAL" class="px-5 py-3.5 text-right font-semibold text-white">${formatRupiahVal(total)}</td>
              </tr>
            `;
          }).join('');
        }
        if (typeof window.syncTableLabels === 'function') window.syncTableLabels();
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
                  <span class="text-sm font-medium truncate max-w-[200px]">${item.name}</span>
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

      const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      const chartLabels = chartDays.map(d => `${d.getDate()} ${months[d.getMonth()]}`);
      const salesDaily = new Array(chartDaysCount).fill(0);
      const profitDaily = new Array(chartDaysCount).fill(0);

      let totalPeriodSales = 0;
      let totalPeriodProfit = 0;

      filteredOutTransactions.forEach(t => {
        const rev = (t.qty || 0) * (t.price || 0);
        const cost = (t.qty || 0) * (t.products?.cost_price || 0);
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
      if (typeof window.updateDashboardSalesChart === 'function') {
        window.updateDashboardSalesChart(chartLabels, salesDaily, profitDaily);
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

      if (typeof window.refreshIcons === 'function') window.refreshIcons();

      if (showFeedback && typeof window.showToast === 'function') {
        window.showToast('Data dashboard berhasil dimuat ulang', 'info');
      }
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      loadDashboardData(null, false);
    });
  } else {
    loadDashboardData(null, false);
  }
