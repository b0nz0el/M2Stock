/* ═══════════════════════════════════════════════════
   aQuaStock Pro — report.js
   Controller Modul Laporan & Visualisasi Agregasi
   ═══════════════════════════════════════════════════ */

import { supabase } from '../assets/js/supabase-client.js';
import { report as reportApi } from '../assets/js/api/report.js';
import { applyReadOnlyUI } from '../assets/js/utils/rbac-ui.js';
import { getUserRole } from '../assets/js/utils/rbac.js';

(function () {
  'use strict';

  let currentTab = 'sales'; // 'sales' | 'profit' | 'stock' | 'category' | 'channel' | 'supplier' | 'cashier'
  let currentPeriod = 'month'; // 'today' | '7d' | 'month' | '30d' | 'year' | 'all'
  let reportData = null;
  let chartInstance = null;

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
    if (Math.abs(n) >= 1_000) {
      return 'Rp ' + (n / 1_000).toFixed(1).replace('.0', '') + 'rb';
    }
    return 'Rp ' + n.toLocaleString('id-ID');
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

  async function loadReport() {
    const refreshBtn = document.getElementById('btn-refresh-report');
    if (refreshBtn) refreshBtn.classList.add('opacity-50', 'pointer-events-none');

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
      if (refreshBtn) refreshBtn.classList.remove('opacity-50', 'pointer-events-none');
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

    if (elSales) elSales.textContent = formatShortNumber(kpi.totalSales);
    if (elProfit) elProfit.textContent = formatShortNumber(kpi.grossProfit);
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
      columns = ['#', 'Barang', 'Brand', 'Kategori', 'Terjual', 'Pendapatan', 'Laba', 'Margin'];
      const items = reportData?.topProducts || [];
      hasData = items.length > 0;

      rowsHtml = items.map((p, idx) => `
        <tr class="table-row border-b border-white/5">
          <td class="px-5 py-3.5"><span class="w-6 h-6 rounded-md bg-white/5 text-[#A0A0A5] grid place-items-center text-xs font-bold">${idx + 1}</span></td>
          <td class="px-5 py-3.5 font-medium text-white">${p.name}</td>
          <td class="px-5 py-3.5 text-[#A0A0A5]">${p.brand}</td>
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
      csvContent += 'No,Nama Produk,Brand,Kategori,Terjual,Pendapatan,Laba,Margin\n';
      (reportData.topProducts || []).forEach((p, idx) => {
        csvContent += `"${idx + 1}","${p.name}","${p.brand}","${p.category}","${p.qty}","${p.revenue}","${p.profit}","${p.margin}%"\n`;
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

  function setupEventHandlers() {
    // Tab switching
    const tabButtons = document.querySelectorAll('#report-filter-tabs button');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.getAttribute('data-tab') || 'sales';
        renderTabTable();
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
        loadReport();
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
        window.print();
      });
    }
  }

  // Inisialisasi saat DOM siap
  let reportEventsSetup = false;
  async function initReport() {
    if (!reportEventsSetup) {
      setupEventHandlers();
      reportEventsSetup = true;
    }
    await applyReadOnlyUI();
    await loadReport();
  }

  // Ekspor ke window untuk akses eksternal bila diperlukan
  if (typeof window !== 'undefined') {
    window.loadReport = loadReport;
    window.initReport = initReport;
    window.exportReportCSV = exportReportCSV;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReport);
  } else {
    initReport();
  }
})();
