/* ═══════════════════════════════════════════════════
   Aquastock Pro — report.js
   Controller Modul Laporan & Visualisasi Agregasi
   ═══════════════════════════════════════════════════ */

import { supabase } from '../assets/js/supabase-client.js';
import { report as reportApi } from '../assets/js/api/report.js';
import { applyReadOnlyUI } from '../assets/js/utils/rbac-ui.js';
import { getUserRole } from '../assets/js/utils/rbac.js';

(function () {
  'use strict';

  let currentTab = 'sales'; // 'sales' | 'profit' | 'stock' | 'category' | 'channel' | 'supplier' | 'cashier'
  let currentPeriod = '30d'; // 'today' | '7d' | 'month' | '30d' | 'year' | 'all'
  let reportData = null;
  let chartInstance = null;
  let activeStoreInfo = null;

  async function loadStoreInfo() {
    try {
      if (typeof window !== 'undefined' && window.Api?.settings?.getStoreInfo) {
        activeStoreInfo = await window.Api.settings.getStoreInfo();
      }
    } catch (_) {}
    if (!activeStoreInfo && typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem('aquastock_store_info');
        if (cached) activeStoreInfo = JSON.parse(cached);
      } catch (_) {}
    }
    return activeStoreInfo;
  }

  function formatRupiah(num) {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
  }

  function formatShortNumber(num) {
    const n = Number(num) || 0;
    if (Math.abs(n) >= 1_000_000_000) {
      return 'Rp ' + (n / 1_000_000_000).toFixed(1).replace('.0', '') + 'M';
    }
    if (Math.abs(n) >= 1_000_000) {
      return 'Rp ' + (n / 1_000_000).toFixed(1).replace('.0', '') + 'jt';
    }
    // Nilai di bawah 1 juta ditampilkan format penuh (contoh: Rp 52.000, Rp 17.200) agar sinkron dengan Dashboard POS
    return formatRupiah(n);
  }

  function getPeriodDates(period) {
    const now = new Date();
    let startDate = null;
    let endDate = now.toISOString();

    if (period === 'today') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      startDate = d.toISOString();
    } else if (period === '7d') {
      const d = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      startDate = d.toISOString();
    } else if (period === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      startDate = d.toISOString();
    } else if (period === '30d') {
      const d = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      startDate = d.toISOString();
    } else if (period === 'year') {
      const d = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      startDate = d.toISOString();
    } else if (period === 'all') {
      startDate = null;
    }

    return { startDate, endDate };
  }

  async function loadReport(showFeedback = false) {
    const periodSelect = document.getElementById('report-period');
    if (periodSelect && periodSelect.value) {
      currentPeriod = periodSelect.value;
    }

    const refreshBtn = document.getElementById('btn-refresh-report');
    const refreshIcon = refreshBtn ? refreshBtn.querySelector('i, svg') : null;
    if (refreshBtn) refreshBtn.classList.add('opacity-50', 'pointer-events-none');
    if (refreshIcon) refreshIcon.classList.add('animate-spin');

    try {
      const { startDate, endDate } = getPeriodDates(currentPeriod);
      const res = await reportApi.getSummary({ startDate, endDate });

      if (!res.ok) {
        throw new Error(res.error?.message || 'Gagal memuat data laporan');
      }

      reportData = res.data;
      renderKPI();
      renderChart();
      renderTabTable();
    } catch (err) {
      console.error('Error loadReport:', err);
      if (typeof showToast === 'function') {
        showToast(err.message || 'Gagal memuat laporan', 'error');
      }
    } finally {
      setTimeout(() => {
        if (refreshBtn) refreshBtn.classList.remove('opacity-50', 'pointer-events-none');
        if (refreshIcon) refreshIcon.classList.remove('animate-spin');
      }, 350);
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    }
  }

  function renderKPI() {
    if (!reportData || !reportData.kpi) return;
    const kpi = reportData.kpi;

    const elSales = document.getElementById('kpi-sales');
    const elProfit = document.getElementById('kpi-profit');
    const elMargin = document.getElementById('kpi-margin');
    const elTx = document.getElementById('kpi-tx');
    const elQty = document.getElementById('kpi-qty');
    const elStock = document.getElementById('kpi-stock-val');
    const elStockUnit = document.getElementById('kpi-stock-qty');

    if (elSales) {
      elSales.textContent = formatShortNumber(kpi.totalSales);
      elSales.setAttribute('title', formatRupiah(kpi.totalSales));
    }
    if (elProfit) {
      elProfit.textContent = formatShortNumber(kpi.grossProfit);
      elProfit.setAttribute('title', formatRupiah(kpi.grossProfit));
    }
    if (elMargin) elMargin.textContent = `Margin ${kpi.profitMargin}%`;
    if (elTx) elTx.textContent = Number(kpi.totalTxOut).toLocaleString('id-ID');
    if (elQty) elQty.textContent = `${Number(kpi.totalQtySold).toLocaleString('id-ID')} unit terjual`;
    if (elStock) elStock.textContent = formatRupiah(kpi.totalStockCostValue);
    if (elStockUnit) elStockUnit.textContent = `${Number(kpi.totalStockQty).toLocaleString('id-ID')} unit total`;
  }

  function renderChart() {
    const canvas = document.getElementById('chartReport');
    if (!canvas || typeof Chart === 'undefined') return;

    try {
      const existingChart = typeof Chart.getChart === 'function' ? Chart.getChart(canvas) : null;
      if (existingChart) {
        existingChart.destroy();
      }
    } catch (_) {}

    if (chartInstance) {
      try {
        chartInstance.destroy();
      } catch (_) {}
      chartInstance = null;
    }

    const daily = reportData?.dailyTrend || [];
    const labels = daily.map(d => {
      const parts = d.date.split('-');
      return `${parts[2]}/${parts[1]}`;
    });
    const revenues = daily.map(d => d.revenue);
    const profits = daily.map(d => d.profit);

    // Fallback jika belum ada data harian
    const chartLabels = labels.length > 0 ? labels : ['Belum ada transaksi'];
    const chartRevenues = revenues.length > 0 ? revenues : [0];
    const chartProfits = profits.length > 0 ? profits : [0];

    const ctx = canvas.getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: 'Penjualan (Rp)',
            data: chartRevenues,
            borderColor: '#0088CC',
            backgroundColor: 'rgba(0, 136, 204, 0.1)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3
          },
          {
            label: 'Laba Kotor (Rp)',
            data: chartProfits,
            borderColor: '#34C759',
            backgroundColor: 'rgba(52, 199, 89, 0.1)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: { color: '#A0A0A5', font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatRupiah(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#A0A0A5', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#A0A0A5',
              font: { size: 11 },
              callback: (val) => formatShortNumber(val)
            }
          }
        }
      }
    });
  }

  function renderTabTable() {
    const thead = document.getElementById('report-table-head');
    const tbody = document.getElementById('report-table-body');
    const tableTitle = document.getElementById('report-table-title');
    const emptyState = document.getElementById('report-empty-state');
    const tableWrap = document.getElementById('report-table-wrap');

    if (!thead || !tbody) return;

    let columns = [];
    let rowsHtml = '';
    let hasData = false;

    if (currentTab === 'sales') {
      if (tableTitle) tableTitle.textContent = 'Barang Terlaris (Berdasarkan Omzet)';
      columns = ['No', 'Barang', 'Channel', 'Kategori', 'Terjual', 'Pendapatan', 'Laba', 'Margin'];
      const items = reportData?.topProducts || [];
      hasData = items.length > 0;

      rowsHtml = items.map((p, idx) => `
        <tr class="table-row border-b border-white/5">
          <td class="px-5 py-3.5"><span class="w-6 h-6 rounded-md bg-white/5 text-[#A0A0A5] grid place-items-center text-xs font-bold">${idx + 1}</span></td>
          <td class="px-5 py-3.5 font-medium text-white">${p.name}</td>
          <td class="px-5 py-3.5"><span class="badge bg-white/5 text-[#A0A0A5] px-2 py-0.5 rounded text-xs font-medium">${p.channel || 'Offline'}</span></td>
          <td class="px-5 py-3.5"><span class="badge bg-[#0088CC]/15 text-[#32ADE6]">${p.category}</span></td>
          <td class="px-5 py-3.5 text-right font-semibold">${p.qty} unit</td>
          <td class="px-5 py-3.5 text-right font-semibold text-white">${formatRupiah(p.revenue)}</td>
          <td class="px-5 py-3.5 text-right text-[#34C759] font-semibold">${formatRupiah(p.profit)}</td>
          <td class="px-5 py-3.5 text-right text-[#34C759] font-semibold">${p.margin}%</td>
        </tr>
      `).join('');
    } else if (currentTab === 'profit') {
      if (tableTitle) tableTitle.textContent = 'Rincian Laba Kotor Harian';
      columns = ['Tanggal', 'Jumlah Transaksi', 'Total Omzet', 'Laba Kotor', 'Margin'];
      const items = (reportData?.dailyTrend || []).slice().reverse();
      hasData = items.length > 0;

      rowsHtml = items.map(d => {
        const margin = d.revenue > 0 ? Math.round((d.profit / d.revenue) * 100) : 0;
        return `
          <tr class="table-row border-b border-white/5">
            <td class="px-5 py-3.5 font-medium text-white">${d.date}</td>
            <td class="px-5 py-3.5 text-[#A0A0A5]">${d.txCount} transaksi</td>
            <td class="px-5 py-3.5 text-right font-semibold text-white">${formatRupiah(d.revenue)}</td>
            <td class="px-5 py-3.5 text-right text-[#34C759] font-semibold">${formatRupiah(d.profit)}</td>
            <td class="px-5 py-3.5 text-right text-[#34C759] font-semibold">${margin}%</td>
          </tr>
        `;
      }).join('');
    } else if (currentTab === 'stock') {
      if (tableTitle) tableTitle.textContent = 'Analisis Valuasi Stok Saat Ini';
      columns = ['SKU', 'Barang', 'Kategori', 'Stok', 'Harga Modal', 'Harga Jual', 'Nilai Modal', 'Potensi Laba'];
      const items = reportData?.stockReport || [];
      hasData = items.length > 0;

      rowsHtml = items.map(p => `
        <tr class="table-row border-b border-white/5">
          <td class="px-5 py-3.5 font-mono text-xs text-[#A0A0A5]">${p.sku}</td>
          <td class="px-5 py-3.5 font-medium text-white">${p.name}</td>
          <td class="px-5 py-3.5"><span class="badge bg-[#0088CC]/15 text-[#32ADE6]">${p.category}</span></td>
          <td class="px-5 py-3.5 text-right ${p.isLow ? 'text-[#FF3B30] font-bold' : 'font-medium'}">${p.stock} unit</td>
          <td class="px-5 py-3.5 text-right text-[#A0A0A5]">${formatRupiah(p.cost)}</td>
          <td class="px-5 py-3.5 text-right font-semibold text-white">${formatRupiah(p.sell)}</td>
          <td class="px-5 py-3.5 text-right font-semibold text-white">${formatRupiah(p.totalCost)}</td>
          <td class="px-5 py-3.5 text-right text-[#34C759] font-semibold">${formatRupiah(p.potentialProfit)}</td>
        </tr>
      `).join('');
    } else if (currentTab === 'category') {
      if (tableTitle) tableTitle.textContent = 'Kinerja Penjualan per Kategori Produk';
      columns = ['Kategori', 'Transaksi', 'Unit Terjual', 'Pendapatan', 'Laba Kotor', 'Margin'];
      const items = reportData?.categoryReport || [];
      hasData = items.length > 0;

      rowsHtml = items.map(c => `
        <tr class="table-row border-b border-white/5">
          <td class="px-5 py-3.5 font-medium text-white">${c.category}</td>
          <td class="px-5 py-3.5 text-[#A0A0A5]">${c.txCount} tx</td>
          <td class="px-5 py-3.5 text-right font-semibold">${c.qty} unit</td>
          <td class="px-5 py-3.5 text-right font-semibold text-white">${formatRupiah(c.revenue)}</td>
          <td class="px-5 py-3.5 text-right text-[#34C759] font-semibold">${formatRupiah(c.profit)}</td>
          <td class="px-5 py-3.5 text-right text-[#34C759] font-semibold">${c.margin}%</td>
        </tr>
      `).join('');
    } else if (currentTab === 'channel') {
      if (tableTitle) tableTitle.textContent = 'Kontribusi Saluran Penjualan (Channel)';
      columns = ['Channel', 'Transaksi', 'Unit Terjual', 'Total Omzet', 'Laba Kotor'];
      const items = reportData?.channelReport || [];
      hasData = items.length > 0;

      rowsHtml = items.map(ch => `
        <tr class="table-row border-b border-white/5">
          <td class="px-5 py-3.5 font-medium text-white">
            <span class="badge bg-[#0088CC]/15 text-[#32ADE6]">${ch.channel}</span>
          </td>
          <td class="px-5 py-3.5 text-[#A0A0A5]">${ch.txCount} tx</td>
          <td class="px-5 py-3.5 text-right font-semibold">${ch.qty} unit</td>
          <td class="px-5 py-3.5 text-right font-semibold text-white">${formatRupiah(ch.revenue)}</td>
          <td class="px-5 py-3.5 text-right text-[#34C759] font-semibold">${formatRupiah(ch.profit)}</td>
        </tr>
      `).join('');
    } else if (currentTab === 'supplier') {
      if (tableTitle) tableTitle.textContent = 'Riwayat Pengadaan per Supplier (Inbound)';
      columns = ['Nama Supplier', 'Frekuensi Masuk', 'Unit Diterima', 'Total Nilai Pembelian'];
      const items = reportData?.supplierReport || [];
      hasData = items.length > 0;

      rowsHtml = items.map(s => `
        <tr class="table-row border-b border-white/5">
          <td class="px-5 py-3.5 font-medium text-white">${s.supplier}</td>
          <td class="px-5 py-3.5 text-[#A0A0A5]">${s.txCount} kali</td>
          <td class="px-5 py-3.5 text-right font-semibold text-[#34C759]">+${s.qty} unit</td>
          <td class="px-5 py-3.5 text-right font-semibold text-white">${formatRupiah(s.totalBuy)}</td>
        </tr>
      `).join('');
    } else if (currentTab === 'cashier') {
      if (tableTitle) tableTitle.textContent = 'Kinerja Transaksi per Kasir';
      columns = ['Kasir / User', 'Transaksi Dilayani', 'Total Unit Keluar', 'Total Omzet'];
      const items = reportData?.cashierReport || [];
      hasData = items.length > 0;

      rowsHtml = items.map(k => `
        <tr class="table-row border-b border-white/5">
          <td class="px-5 py-3.5 font-medium text-white">${k.cashier}</td>
          <td class="px-5 py-3.5 text-[#A0A0A5]">${k.txCount} tx</td>
          <td class="px-5 py-3.5 text-right font-semibold">${k.qty} unit</td>
          <td class="px-5 py-3.5 text-right font-semibold text-white">${formatRupiah(k.revenue)}</td>
        </tr>
      `).join('');
    }

    // Render headers
    thead.innerHTML = `
      <tr class="text-left text-[#A0A0A5]">
        ${columns.map((col, idx) => {
          const isRight = col.includes('Terjual') || col.includes('Pendapatan') || col.includes('Laba') ||
                          col.includes('Margin') || col.includes('Omzet') || col.includes('Unit') ||
                          col.includes('Modal') || col.includes('Jual') || col.includes('Pembelian') ||
                          col.includes('Stok');
          return `<th class="px-5 py-3 font-medium text-xs uppercase tracking-wider ${isRight ? 'text-right' : ''}">${col}</th>`;
        }).join('')}
      </tr>
    `;

    // Render body / empty state
    if (!hasData) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (tableWrap) tableWrap.classList.add('hidden');
      tbody.innerHTML = '';
    } else {
      if (emptyState) emptyState.classList.add('hidden');
      if (tableWrap) tableWrap.classList.remove('hidden');
      tbody.innerHTML = rowsHtml;
    }

    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    if (typeof window.syncTableLabels === 'function') window.syncTableLabels();
  }

  function exportReportCSV() {
    if (!reportData) {
      if (typeof showToast === 'function') showToast('Tidak ada data laporan untuk diexport', 'warning');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    let filename = `laporan-${currentTab}-${currentPeriod}.csv`;

    if (currentTab === 'sales') {
      csvContent += 'No,Nama Produk,Channel,Kategori,Terjual,Pendapatan,Laba,Margin\n';
      (reportData.topProducts || []).forEach((p, idx) => {
        csvContent += `"${idx + 1}","${p.name}","${p.channel || 'Offline'}","${p.category}","${p.qty}","${p.revenue}","${p.profit}","${p.margin}%"\n`;
      });
    } else if (currentTab === 'profit') {
      csvContent += 'Tanggal,Jumlah Transaksi,Total Omzet,Laba Kotor,Margin\n';
      (reportData.dailyTrend || []).forEach(d => {
        const margin = d.revenue > 0 ? Math.round((d.profit / d.revenue) * 100) : 0;
        csvContent += `"${d.date}","${d.txCount}","${d.revenue}","${d.profit}","${margin}%"\n`;
      });
    } else if (currentTab === 'stock') {
      csvContent += 'SKU,Nama Produk,Kategori,Stok,Harga Modal,Harga Jual,Nilai Modal,Potensi Laba\n';
      (reportData.stockReport || []).forEach(p => {
        csvContent += `"${p.sku}","${p.name}","${p.category}","${p.stock}","${p.cost}","${p.sell}","${p.totalCost}","${p.potentialProfit}"\n`;
      });
    } else {
      csvContent += 'Item,Transaksi,Unit,Nilai\n';
      csvContent += `"Ringkasan","${reportData.kpi.totalTxOut}","${reportData.kpi.totalQtySold}","${reportData.kpi.totalSales}"\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (typeof showToast === 'function') showToast(`Laporan ${currentTab} berhasil diexport`, 'success');
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateTimeID(date = new Date()) {
    const d = new Date(date);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hh}:${mm} WIB`;
  }

  function generateReportPrintHTML() {
    let storeName = 'Habitic';
    let storeSlogan = 'Aquarium Lifestyle Solutions';
    let storeAddress = 'Jl. Mangga No. 67, Jatimakmur, Kota Bekasi';
    let storePhone = '0812-9662-8052';
    let storeEmail = 'halo.habitic@gmail.com';
    let storeLogoUrl = '/assets/images/habitic-logo.png';

    let info = null;
    try {
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('aquastock_store_info') : null;
      if (cached) info = JSON.parse(cached);
    } catch (_) {}
    if (!info) info = activeStoreInfo;

    if (info) {
      if (info.name) storeName = info.name;
      if (info.slogan) storeSlogan = info.slogan;
      if (info.address) storeAddress = info.address;
      if (info.phone) storePhone = info.phone;
      if (info.email) storeEmail = info.email;
      if (info.logo_url) storeLogoUrl = info.logo_url;
    }

    if (!storeLogoUrl || storeLogoUrl.trim() === '') {
      if (String(storeName).toLowerCase().includes('habitic')) {
        storeLogoUrl = '/assets/images/habitic-logo.png';
      }
    }

    const contactParts = [];
    if (storePhone && storePhone !== '-') {
      const cleanPhone = escapeHtml(storePhone);
      if (cleanPhone.toLowerCase().includes('telp') || cleanPhone.toLowerCase().includes('wa')) {
        contactParts.push(cleanPhone);
      } else {
        contactParts.push(`WA / Telp: ${cleanPhone}`);
      }
    }
    if (storeEmail && storeEmail !== '-') {
      contactParts.push(`Email: ${escapeHtml(storeEmail)}`);
    }
    const contactLine = contactParts.join(' | ');

    let currentUserName = 'David (Owner)';
    try {
      const userEmail = document.getElementById('sidebar-user-email')?.textContent?.trim() || '';
      const userRole = document.getElementById('sidebar-user-role')?.textContent?.trim() || '';
      if (userEmail) currentUserName = `${userEmail} (${userRole || 'Staff'})`;
    } catch (_) {}

    const periodLabels = {
      today: 'Hari Ini',
      '7d': '7 Hari Terakhir',
      month: 'Bulan Ini',
      '30d': '30 Hari Terakhir',
      year: 'Tahun Ini',
      all: 'Semua Waktu'
    };
    const periodText = periodLabels[currentPeriod] || 'Bulan Ini';

    const tabTitles = {
      sales: 'Laporan Penjualan (Produk Terlaris)',
      profit: 'Laporan Analisis Laba Kotor Harian',
      stock: 'Laporan Analisis Valuasi Stok & Inventori',
      category: 'Laporan Kinerja Penjualan per Kategori',
      channel: 'Laporan Kontribusi Saluran Penjualan (Channel)',
      supplier: 'Laporan Pengadaan Barang per Supplier',
      cashier: 'Laporan Kinerja Transaksi per Kasir'
    };
    const reportTitle = tabTitles[currentTab] || 'Laporan Bisnis & Analisis Operasional';

    const kpi = reportData?.kpi || {
      totalSales: 0,
      grossProfit: 0,
      profitMargin: 0,
      totalTxOut: 0,
      totalQtySold: 0,
      totalStockCostValue: 0,
      totalStockQty: 0
    };

    let tableHeadersHtml = '';
    let tableRowsHtml = '';
    let tableFooterHtml = '';

    if (currentTab === 'sales') {
      const items = reportData?.topProducts || [];
      tableHeadersHtml = `
        <tr>
          <th style="width: 5%;" class="text-center">No</th>
          <th style="width: 32%;">Nama Produk</th>
          <th style="width: 14%;">Channel</th>
          <th style="width: 13%;">Kategori</th>
          <th style="width: 8%;" class="text-right">Terjual</th>
          <th style="width: 12%;" class="text-right">Pendapatan</th>
          <th style="width: 10%;" class="text-right">Laba Kotor</th>
          <th style="width: 6%;" class="text-right">Margin</th>
        </tr>
      `;

      let totQty = 0;
      let totRev = 0;
      let totProfit = 0;

      if (items.length === 0) {
        tableRowsHtml = `<tr><td colspan="8" class="text-center empty-cell">Tidak ada data transaksi penjualan pada periode ini</td></tr>`;
      } else {
        tableRowsHtml = items.map((p, idx) => {
          totQty += Number(p.qty) || 0;
          totRev += Number(p.revenue) || 0;
          totProfit += Number(p.profit) || 0;
          return `
            <tr>
              <td class="text-center font-bold text-muted">${idx + 1}</td>
              <td class="font-bold text-dark">${escapeHtml(p.name)}</td>
              <td><span class="badge-cat" style="background:#f1f5f9; color:#475467;">${escapeHtml(p.channel || p.brand || 'Offline')}</span></td>
              <td><span class="badge-cat">${escapeHtml(p.category || 'Umum')}</span></td>
              <td class="text-right font-bold">${Number(p.qty || 0).toLocaleString('id-ID')} unit</td>
              <td class="text-right font-bold text-dark">${formatRupiah(p.revenue)}</td>
              <td class="text-right font-bold text-green">${formatRupiah(p.profit)}</td>
              <td class="text-right font-bold">${p.margin}%</td>
            </tr>
          `;
        }).join('');

        const overallMargin = totRev > 0 ? Math.round((totProfit / totRev) * 100) : 0;
        tableFooterHtml = `
          <tr class="total-row">
            <td colspan="4" class="text-right font-bold">TOTAL KESELURUHAN</td>
            <td class="text-right font-bold">${totQty.toLocaleString('id-ID')} unit</td>
            <td class="text-right font-bold text-dark">${formatRupiah(totRev)}</td>
            <td class="text-right font-bold text-green">${formatRupiah(totProfit)}</td>
            <td class="text-right font-bold">${overallMargin}%</td>
          </tr>
        `;
      }
    } else if (currentTab === 'profit') {
      const items = (reportData?.dailyTrend || []).slice().reverse();
      tableHeadersHtml = `
        <tr>
          <th style="width: 25%;">Tanggal Transaksi</th>
          <th style="width: 18%;" class="text-center">Jumlah Transaksi</th>
          <th style="width: 23%;" class="text-right">Total Omzet (Penjualan)</th>
          <th style="width: 20%;" class="text-right">Laba Kotor</th>
          <th style="width: 14%;" class="text-right">Margin Laba</th>
        </tr>
      `;

      let totTx = 0;
      let totRev = 0;
      let totProfit = 0;

      if (items.length === 0) {
        tableRowsHtml = `<tr><td colspan="5" class="text-center empty-cell">Tidak ada data laba harian pada periode ini</td></tr>`;
      } else {
        tableRowsHtml = items.map(d => {
          totTx += Number(d.txCount) || 0;
          totRev += Number(d.revenue) || 0;
          totProfit += Number(d.profit) || 0;
          const margin = d.revenue > 0 ? Math.round((d.profit / d.revenue) * 100) : 0;
          return `
            <tr>
              <td class="font-bold text-dark">${escapeHtml(d.date)}</td>
              <td class="text-center">${Number(d.txCount || 0).toLocaleString('id-ID')} transaksi</td>
              <td class="text-right font-bold text-dark">${formatRupiah(d.revenue)}</td>
              <td class="text-right font-bold text-green">${formatRupiah(d.profit)}</td>
              <td class="text-right font-bold">${margin}%</td>
            </tr>
          `;
        }).join('');

        const overallMargin = totRev > 0 ? Math.round((totProfit / totRev) * 100) : 0;
        tableFooterHtml = `
          <tr class="total-row">
            <td class="font-bold">TOTAL PERIODE</td>
            <td class="text-center font-bold">${totTx.toLocaleString('id-ID')} transaksi</td>
            <td class="text-right font-bold text-dark">${formatRupiah(totRev)}</td>
            <td class="text-right font-bold text-green">${formatRupiah(totProfit)}</td>
            <td class="text-right font-bold">${overallMargin}%</td>
          </tr>
        `;
      }
    } else if (currentTab === 'stock') {
      const items = reportData?.stockReport || [];
      tableHeadersHtml = `
        <tr>
          <th style="width: 12%;">SKU</th>
          <th style="width: 28%;">Nama Barang</th>
          <th style="width: 12%;">Kategori</th>
          <th style="width: 8%;" class="text-right">Stok</th>
          <th style="width: 10%;" class="text-right">Harga Modal</th>
          <th style="width: 10%;" class="text-right">Harga Jual</th>
          <th style="width: 10%;" class="text-right">Nilai Modal</th>
          <th style="width: 10%;" class="text-right">Potensi Laba</th>
        </tr>
      `;

      let totStock = 0;
      let totCost = 0;
      let totPotProfit = 0;

      if (items.length === 0) {
        tableRowsHtml = `<tr><td colspan="8" class="text-center empty-cell">Tidak ada data stok produk</td></tr>`;
      } else {
        tableRowsHtml = items.map(p => {
          totStock += Number(p.stock) || 0;
          totCost += Number(p.totalCost) || 0;
          totPotProfit += Number(p.potentialProfit) || 0;
          return `
            <tr>
              <td class="font-mono text-muted">${escapeHtml(p.sku || '-')}</td>
              <td class="font-bold text-dark">${escapeHtml(p.name)}</td>
              <td><span class="badge-cat">${escapeHtml(p.category || 'Umum')}</span></td>
              <td class="text-right font-bold ${p.isLow ? 'text-red' : ''}">${Number(p.stock || 0).toLocaleString('id-ID')} unit</td>
              <td class="text-right text-muted">${formatRupiah(p.cost)}</td>
              <td class="text-right font-bold text-dark">${formatRupiah(p.sell)}</td>
              <td class="text-right font-bold text-dark">${formatRupiah(p.totalCost)}</td>
              <td class="text-right font-bold text-green">${formatRupiah(p.potentialProfit)}</td>
            </tr>
          `;
        }).join('');

        tableFooterHtml = `
          <tr class="total-row">
            <td colspan="3" class="text-right font-bold">TOTAL VALUASI INVENTORI</td>
            <td class="text-right font-bold">${totStock.toLocaleString('id-ID')} unit</td>
            <td colspan="2"></td>
            <td class="text-right font-bold text-dark">${formatRupiah(totCost)}</td>
            <td class="text-right font-bold text-green">${formatRupiah(totPotProfit)}</td>
          </tr>
        `;
      }
    } else if (currentTab === 'category') {
      const items = reportData?.categoryReport || [];
      tableHeadersHtml = `
        <tr>
          <th style="width: 30%;">Kategori Produk</th>
          <th style="width: 15%;" class="text-center">Transaksi</th>
          <th style="width: 15%;" class="text-right">Unit Terjual</th>
          <th style="width: 18%;" class="text-right">Pendapatan (Omzet)</th>
          <th style="width: 14%;" class="text-right">Laba Kotor</th>
          <th style="width: 8%;" class="text-right">Margin</th>
        </tr>
      `;

      let totTx = 0;
      let totQty = 0;
      let totRev = 0;
      let totProfit = 0;

      if (items.length === 0) {
        tableRowsHtml = `<tr><td colspan="6" class="text-center empty-cell">Tidak ada data transaksi kategori pada periode ini</td></tr>`;
      } else {
        tableRowsHtml = items.map(c => {
          totTx += Number(c.txCount) || 0;
          totQty += Number(c.qty) || 0;
          totRev += Number(c.revenue) || 0;
          totProfit += Number(c.profit) || 0;
          return `
            <tr>
              <td class="font-bold text-dark">${escapeHtml(c.category)}</td>
              <td class="text-center">${Number(c.txCount || 0).toLocaleString('id-ID')} tx</td>
              <td class="text-right font-bold">${Number(c.qty || 0).toLocaleString('id-ID')} unit</td>
              <td class="text-right font-bold text-dark">${formatRupiah(c.revenue)}</td>
              <td class="text-right font-bold text-green">${formatRupiah(c.profit)}</td>
              <td class="text-right font-bold">${c.margin}%</td>
            </tr>
          `;
        }).join('');

        const overallMargin = totRev > 0 ? Math.round((totProfit / totRev) * 100) : 0;
        tableFooterHtml = `
          <tr class="total-row">
            <td class="font-bold">TOTAL SEMUA KATEGORI</td>
            <td class="text-center font-bold">${totTx.toLocaleString('id-ID')} tx</td>
            <td class="text-right font-bold">${totQty.toLocaleString('id-ID')} unit</td>
            <td class="text-right font-bold text-dark">${formatRupiah(totRev)}</td>
            <td class="text-right font-bold text-green">${formatRupiah(totProfit)}</td>
            <td class="text-right font-bold">${overallMargin}%</td>
          </tr>
        `;
      }
    } else if (currentTab === 'channel') {
      const items = reportData?.channelReport || [];
      tableHeadersHtml = `
        <tr>
          <th style="width: 32%;">Saluran Penjualan (Channel)</th>
          <th style="width: 16%;" class="text-center">Jumlah Transaksi</th>
          <th style="width: 16%;" class="text-right">Unit Terjual</th>
          <th style="width: 20%;" class="text-right">Total Omzet</th>
          <th style="width: 16%;" class="text-right">Laba Kotor</th>
        </tr>
      `;

      let totTx = 0;
      let totQty = 0;
      let totRev = 0;
      let totProfit = 0;

      if (items.length === 0) {
        tableRowsHtml = `<tr><td colspan="5" class="text-center empty-cell">Tidak ada data channel penjualan pada periode ini</td></tr>`;
      } else {
        tableRowsHtml = items.map(ch => {
          totTx += Number(ch.txCount) || 0;
          totQty += Number(ch.qty) || 0;
          totRev += Number(ch.revenue) || 0;
          totProfit += Number(ch.profit) || 0;
          return `
            <tr>
              <td class="font-bold text-dark"><span class="badge-cat">${escapeHtml(ch.channel)}</span></td>
              <td class="text-center">${Number(ch.txCount || 0).toLocaleString('id-ID')} tx</td>
              <td class="text-right font-bold">${Number(ch.qty || 0).toLocaleString('id-ID')} unit</td>
              <td class="text-right font-bold text-dark">${formatRupiah(ch.revenue)}</td>
              <td class="text-right font-bold text-green">${formatRupiah(ch.profit)}</td>
            </tr>
          `;
        }).join('');

        tableFooterHtml = `
          <tr class="total-row">
            <td class="font-bold">TOTAL SEMUA CHANNEL</td>
            <td class="text-center font-bold">${totTx.toLocaleString('id-ID')} tx</td>
            <td class="text-right font-bold">${totQty.toLocaleString('id-ID')} unit</td>
            <td class="text-right font-bold text-dark">${formatRupiah(totRev)}</td>
            <td class="text-right font-bold text-green">${formatRupiah(totProfit)}</td>
          </tr>
        `;
      }
    } else if (currentTab === 'supplier') {
      const items = reportData?.supplierReport || [];
      tableHeadersHtml = `
        <tr>
          <th style="width: 40%;">Nama Supplier</th>
          <th style="width: 18%;" class="text-center">Frekuensi Masuk</th>
          <th style="width: 18%;" class="text-right">Unit Diterima</th>
          <th style="width: 24%;" class="text-right">Total Nilai Pembelian Modal</th>
        </tr>
      `;

      let totTx = 0;
      let totQty = 0;
      let totBuy = 0;

      if (items.length === 0) {
        tableRowsHtml = `<tr><td colspan="4" class="text-center empty-cell">Tidak ada data pengadaan supplier pada periode ini</td></tr>`;
      } else {
        tableRowsHtml = items.map(s => {
          totTx += Number(s.txCount) || 0;
          totQty += Number(s.qty) || 0;
          totBuy += Number(s.totalBuy) || 0;
          return `
            <tr>
              <td class="font-bold text-dark">${escapeHtml(s.supplier)}</td>
              <td class="text-center">${Number(s.txCount || 0).toLocaleString('id-ID')} kali</td>
              <td class="text-right font-bold text-green">+${Number(s.qty || 0).toLocaleString('id-ID')} unit</td>
              <td class="text-right font-bold text-dark">${formatRupiah(s.totalBuy)}</td>
            </tr>
          `;
        }).join('');

        tableFooterHtml = `
          <tr class="total-row">
            <td class="font-bold">TOTAL PENGADAAN</td>
            <td class="text-center font-bold">${totTx.toLocaleString('id-ID')} kali</td>
            <td class="text-right font-bold text-green">+${totQty.toLocaleString('id-ID')} unit</td>
            <td class="text-right font-bold text-dark">${formatRupiah(totBuy)}</td>
          </tr>
        `;
      }
    } else if (currentTab === 'cashier') {
      const items = reportData?.cashierReport || [];
      tableHeadersHtml = `
        <tr>
          <th style="width: 40%;">Kasir / Operator</th>
          <th style="width: 18%;" class="text-center">Transaksi Dilayani</th>
          <th style="width: 18%;" class="text-right">Total Unit Keluar</th>
          <th style="width: 24%;" class="text-right">Total Omzet Penjualan</th>
        </tr>
      `;

      let totTx = 0;
      let totQty = 0;
      let totRev = 0;

      if (items.length === 0) {
        tableRowsHtml = `<tr><td colspan="4" class="text-center empty-cell">Tidak ada data kinerja kasir pada periode ini</td></tr>`;
      } else {
        tableRowsHtml = items.map(k => {
          totTx += Number(k.txCount) || 0;
          totQty += Number(k.qty) || 0;
          totRev += Number(k.revenue) || 0;
          return `
            <tr>
              <td class="font-bold text-dark">${escapeHtml(k.cashier)}</td>
              <td class="text-center">${Number(k.txCount || 0).toLocaleString('id-ID')} tx</td>
              <td class="text-right font-bold">${Number(k.qty || 0).toLocaleString('id-ID')} unit</td>
              <td class="text-right font-bold text-dark">${formatRupiah(k.revenue)}</td>
            </tr>
          `;
        }).join('');

        tableFooterHtml = `
          <tr class="total-row">
            <td class="font-bold">TOTAL TRANSAKSI KASIR</td>
            <td class="text-center font-bold">${totTx.toLocaleString('id-ID')} tx</td>
            <td class="text-right font-bold">${totQty.toLocaleString('id-ID')} unit</td>
            <td class="text-right font-bold text-dark">${formatRupiah(totRev)}</td>
          </tr>
        `;
      }
    }

    const printTimestamp = formatDateTimeID();

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Laporan - ${escapeHtml(reportTitle)} - ${escapeHtml(storeName)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #1e293b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 8.5pt;
      line-height: 1.35;
    }
    .report-sheet {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
      padding: 2mm 0;
    }
    /* Header Kop Laporan Resmi (Presisi A4 Portrait) */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 6mm;
      padding-bottom: 4mm;
      margin-bottom: 4.5mm;
      border-bottom: 1.5pt solid #174c89;
    }
    .doc-brand {
      display: flex;
      align-items: flex-start;
      gap: 5mm;
      min-width: 0;
    }
    .doc-logo-wrap {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-top: 0.5mm;
    }
    .doc-logo-img {
      display: block;
      width: 36mm;
      max-width: 38mm;
      height: auto;
      max-height: 16mm;
      object-fit: contain;
    }
    .doc-logo-fallback {
      width: 12mm;
      height: 12mm;
      border-radius: 2mm;
      background: #174c89;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 10pt;
    }
    .doc-identity {
      min-width: 0;
    }
    .doc-issuer-label {
      color: #174c89;
      font-size: 7pt;
      font-weight: 700;
      letter-spacing: .12em;
      text-transform: uppercase;
      margin: 0 0 1mm;
    }
    .store-name {
      font-size: 13pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin: 0;
      line-height: 1.2;
    }
    .store-slogan {
      margin: 0.8mm 0 0;
      color: #475467;
      font-size: 8pt;
      font-weight: 600;
      line-height: 1.25;
    }
    .store-contact {
      margin: 0.5mm 0 0;
      color: #475467;
      font-size: 7.5pt;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }
    .doc-badge-col {
      text-align: right;
      flex-shrink: 0;
      min-width: 50mm;
    }
    .doc-badge {
      display: inline-block;
      padding: 1.5mm 3.5mm;
      background: #174c89;
      color: #ffffff;
      font-size: 7.5pt;
      font-weight: 700;
      border-radius: 1mm;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .doc-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0f172a;
      margin: 1.5mm 0 0.5mm;
      line-height: 1.2;
    }
    .doc-period-meta {
      font-size: 7.5pt;
      color: #64748b;
    }
    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 3mm;
      margin-bottom: 4.5mm;
    }
    .kpi-card {
      background: #f8fafc;
      border: 0.75pt solid #e2e8f0;
      border-radius: 1.5mm;
      padding: 2.5mm 3mm;
    }
    .kpi-label {
      font-size: 6.8pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 0 0 1mm;
    }
    .kpi-value {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }
    .kpi-sub {
      font-size: 6.8pt;
      color: #0088CC;
      font-weight: 600;
      margin-top: 0.8mm;
    }
    .kpi-sub.profit {
      color: #16a34a;
    }
    /* Section & Table */
    .section-heading {
      font-size: 9pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 2mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .report-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 5mm;
      font-size: 7.8pt;
    }
    .report-table thead {
      display: table-header-group;
    }
    .report-table tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .report-table th {
      background: #0f172a;
      color: #ffffff;
      font-size: 7.2pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 2mm 2.2mm;
      border: 0.5pt solid #0f172a;
      text-align: left;
      vertical-align: middle;
    }
    .report-table td {
      padding: 1.8mm 2.2mm;
      border: 0.5pt solid #cbd5e1;
      color: #334155;
      vertical-align: middle;
    }
    .report-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .report-table .total-row td {
      background: #e2e8f0;
      color: #0f172a;
      font-weight: 800;
      border-top: 1.5pt solid #0f172a;
      border-bottom: 1.5pt solid #0f172a;
      font-size: 8pt;
    }
    .text-right { text-align: right !important; }
    .text-center { text-align: center !important; }
    .font-bold { font-weight: 700 !important; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace !important; font-size: 7.2pt !important; }
    .text-dark { color: #0f172a !important; }
    .text-muted { color: #64748b !important; }
    .text-green { color: #16a34a !important; }
    .text-red { color: #dc2626 !important; }
    .empty-cell { padding: 8mm !important; color: #94a3b8 !important; font-style: italic; }
    .badge-cat {
      display: inline-block;
      padding: 0.4mm 1.5mm;
      border-radius: 0.8mm;
      background: #e0f2fe;
      color: #0369a1;
      font-size: 6.8pt;
      font-weight: 600;
    }
    /* Signature */
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 6mm;
      padding-top: 2mm;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .sig-box {
      width: 48mm;
      text-align: center;
      font-size: 7.5pt;
      color: #475467;
    }
    .sig-role {
      font-weight: 600;
      margin-bottom: 16mm;
    }
    .sig-name {
      font-weight: 700;
      color: #0f172a;
      padding-top: 1mm;
      border-top: 0.75pt solid #94a3b8;
    }
    /* Footer */
    .report-footer {
      margin-top: 5mm;
      padding-top: 2.5mm;
      border-top: 0.5pt solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 6.8pt;
      color: #94a3b8;
    }
    @media screen {
      body { padding: 10mm; background: #e2e8f0; }
      .report-sheet { background: #fff; padding: 10mm; box-shadow: 0 2mm 8mm rgba(0,0,0,0.1); border-radius: 2mm; }
    }
    @media print {
      body { padding: 0; background: #fff; }
      .report-sheet { width: 100%; max-width: 100%; margin: 0; padding: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <main class="report-sheet">
    <!-- Header Kop Dokumen Resmi -->
    <header class="doc-header">
      <div class="doc-brand">
        <div class="doc-logo-wrap">
          ${storeLogoUrl ? `
            <img class="doc-logo-img" src="${escapeHtml(storeLogoUrl)}" alt="${escapeHtml(storeName)}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
            <div class="doc-logo-fallback" style="display:none;">${escapeHtml(storeName.slice(0, 2).toUpperCase())}</div>
          ` : `
            <div class="doc-logo-fallback">${escapeHtml(storeName.slice(0, 2).toUpperCase())}</div>
          `}
        </div>
        <div class="doc-identity">
          <p class="doc-issuer-label">Diterbitkan oleh</p>
          <h1 class="store-name">${escapeHtml(storeName)}</h1>
          ${storeSlogan ? `<p class="store-slogan">${escapeHtml(storeSlogan)}</p>` : ''}
          <p class="store-contact">${escapeHtml(storeAddress)}</p>
          ${contactLine ? `<p class="store-contact">${contactLine}</p>` : ''}
        </div>
      </div>
      <div class="doc-badge-col">
        <span class="doc-badge">Laporan Resmi Bisnis</span>
        <div class="doc-title">${escapeHtml(reportTitle)}</div>
        <div class="doc-period-meta">Periode: <strong>${escapeHtml(periodText)}</strong> · Dicetak oleh: ${escapeHtml(currentUserName)}</div>
      </div>
    </header>

    <!-- Executive KPI Metrics Grid -->
    <section class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Penjualan</div>
        <div class="kpi-value">${formatRupiah(kpi.totalSales)}</div>
        <div class="kpi-sub">Margin Laba: ${kpi.profitMargin}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Laba Kotor</div>
        <div class="kpi-value text-green">${formatRupiah(kpi.grossProfit)}</div>
        <div class="kpi-sub profit">Pendapatan - HPP Modal</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Transaksi Keluar</div>
        <div class="kpi-value">${Number(kpi.totalTxOut).toLocaleString('id-ID')}</div>
        <div class="kpi-sub">${Number(kpi.totalQtySold).toLocaleString('id-ID')} unit terjual</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Valuasi Stok (Modal)</div>
        <div class="kpi-value">${formatRupiah(kpi.totalStockCostValue)}</div>
        <div class="kpi-sub">${Number(kpi.totalStockQty).toLocaleString('id-ID')} unit total</div>
      </div>
    </section>

    <!-- Table Section -->
    <div class="section-heading">
      <span>${escapeHtml(reportTitle)}</span>
      <span class="doc-period-meta">Data Per ${escapeHtml(periodText)}</span>
    </div>

    <table class="report-table">
      <thead>
        ${tableHeadersHtml}
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
      ${tableFooterHtml ? `<tfoot>${tableFooterHtml}</tfoot>` : ''}
    </table>

    <!-- Signature Section -->
    <section class="signature-section">
      <div class="sig-box">
        <div class="sig-role">Kasir / Pembuat Laporan</div>
        <div class="sig-name">${escapeHtml(currentUserName)}</div>
      </div>
      <div class="sig-box">
        <div class="sig-role">Pemilik Toko / Penanggung Jawab</div>
        <div class="sig-name">${escapeHtml(storeName)}</div>
      </div>
    </section>

    <!-- Footer Timestamp & App Version -->
    <footer class="report-footer">
      <span>Dicetak otomatis via Aquastock Pro pada: ${printTimestamp}</span>
      <span>Dokumen ini sah dan bersifat rahasia untuk operasional internal toko</span>
    </footer>
  </main>
</body>
</html>`;
  }

  function printReportPDF() {
    if (!reportData) {
      if (typeof showToast === 'function') showToast('Data laporan belum siap dicetak. Sedang memuat ulang...', 'warning');
      loadReport().then(() => {
        if (reportData) printReportPDF();
      });
      return;
    }

    const executePrint = () => {
      const htmlContent = generateReportPrintHTML();

      // 1. Coba buka dedicated print window
      let printWindow = null;
      try {
        printWindow = window.open('', '_blank');
      } catch (_) {}

      if (printWindow) {
        try {
          printWindow.document.open();
          printWindow.document.write(htmlContent);
          printWindow.document.close();

          const triggerPrint = async () => {
            try {
              if (printWindow.document.fonts && printWindow.document.fonts.ready) {
                await printWindow.document.fonts.ready;
              }
              if (printWindow.document.images && printWindow.document.images.length) {
                await Promise.all(Array.from(printWindow.document.images, img => {
                  if (img.complete) return Promise.resolve();
                  return new Promise(res => {
                    img.onload = res;
                    img.onerror = res;
                    setTimeout(res, 800);
                  });
                }));
              }
            } catch (_) {}
            printWindow.focus();
            printWindow.print();
          };

          if (printWindow.document.readyState === 'complete') {
            setTimeout(triggerPrint, 250);
          } else {
            printWindow.onload = () => setTimeout(triggerPrint, 250);
          }
          return;
        } catch (err) {
          console.warn('Gagal cetak via window.open, mencoba fallback iframe:', err);
        }
      }

      // 2. Fallback: Hidden iframe (anti popup blocker di mobile / Safari iOS)
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

        const runIframePrint = () => {
          try {
            if (iframe.contentWindow) {
              if (typeof iframe.contentWindow.focus === 'function') iframe.contentWindow.focus();
              if (typeof iframe.contentWindow.print === 'function') iframe.contentWindow.print();
            }
          } catch (_) {}
          setTimeout(() => {
            try { iframe.remove(); } catch (_) {}
          }, 2000);
        };

        if (iframeDoc && iframeDoc.images && iframeDoc.images.length) {
          Promise.all(Array.from(iframeDoc.images, img => {
            if (img.complete) return Promise.resolve();
            return new Promise(res => { img.onload = res; img.onerror = res; setTimeout(res, 800); });
          })).then(() => setTimeout(runIframePrint, 200)).catch(() => setTimeout(runIframePrint, 200));
        } else {
          setTimeout(runIframePrint, 350);
        }
      } catch (fallbackErr) {
        console.error('Semua metode cetak gagal:', fallbackErr);
        if (typeof showToast === 'function') {
          showToast('Gagal membuka dialog cetak: ' + fallbackErr.message, 'error');
        }
      }
    };

    if (!activeStoreInfo) {
      loadStoreInfo().then(() => executePrint()).catch(() => executePrint());
    } else {
      executePrint();
    }
  }

  function setReportTab(tab) {
    currentTab = tab || 'sales';
    const tabButtons = document.querySelectorAll('#report-filter-tabs button');
    tabButtons.forEach(b => {
      if (b.getAttribute('data-tab') === currentTab) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    renderTabTable();
  }

  function setupEventHandlers() {
    // Tab switching
    const tabButtons = document.querySelectorAll('#report-filter-tabs button');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        setReportTab(btn.getAttribute('data-tab') || 'sales');
      });
    });

    // Period switching
    const periodSelect = document.getElementById('report-period');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        currentPeriod = e.target.value;
        loadReport();
      });
    }

    // Refresh button
    const btnRefresh = document.getElementById('btn-refresh-report');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        loadReport(true);
      });
    }

    // Export Excel / CSV button
    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) {
      btnExportExcel.addEventListener('click', () => {
        exportReportCSV();
      });
    }

    // Export PDF / Print button
    const btnExportPdf = document.getElementById('btn-export-pdf');
    if (btnExportPdf) {
      btnExportPdf.addEventListener('click', () => {
        if (typeof window.printReportPDF === 'function') {
          window.printReportPDF();
        } else {
          printReportPDF();
        }
      });
    }
  }

  // Inisialisasi saat DOM siap
  async function initReport() {
    setupEventHandlers();
    loadStoreInfo();
    await applyReadOnlyUI();
    await loadReport();
  }

  // Ekspor ke window untuk akses eksternal bila diperlukan
  if (typeof window !== 'undefined') {
    window.loadReport = loadReport;
    window.initReport = initReport;
    window.exportReportCSV = exportReportCSV;
    window.generateReportPrintHTML = generateReportPrintHTML;
    window.printReportPDF = printReportPDF;
    window.setReportTab = setReportTab;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReport);
  } else {
    initReport();
  }
})();
