/* ═══════════════════════════════════════════════════
   aQuaStock Pro — charts.js
   Konfigurasi Chart.js (sales bar, channel doughnut, report line)
   ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   CHARTS
   ═══════════════════════════════════════════════ */
const chartSalesEl = document.getElementById('chartSales');
if (chartSalesEl) {
  new Chart(chartSalesEl.getContext('2d'), {
    type: 'bar',
    data: {
      labels: Array.from({length: 10}, (_, i) => `${21 + i} Sep`),
      datasets: [
        { label: 'Penjualan', data: [450, 620, 380, 780, 520, 920, 480, 1100, 850, 1250],
          backgroundColor: '#0088CC', borderRadius: 4, barPercentage: 0.9 },
        { label: 'Laba', data: [120, 180, 95, 240, 160, 320, 140, 380, 280, 420],
          backgroundColor: '#34C759', borderRadius: 4, barPercentage: 0.9 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1C1C1E', borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1, padding: 12, titleColor: '#fff', bodyColor: '#fff',
          callbacks: { label: (ctx) => `${ctx.dataset.label}: Rp ${ctx.parsed.y}rb` }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#A0A0A5', font: { size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' },
             ticks: { color: '#A0A0A5', font: { size: 11 }, callback: (v) => `${v}rb` } }
      }
    }
  });
}

const chartChannelEl = document.getElementById('chartChannel');
if (chartChannelEl) {
  new Chart(chartChannelEl.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Shopee', 'Tokopedia', 'TikTok', 'Offline'],
      datasets: [{
        data: [42, 31, 17, 10],
        backgroundColor: ['#EE4D2D', '#42B549', '#FF0050', '#0088CC'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#A0A0A5', font: { size: 11 }, padding: 12,
                    usePointStyle: true, pointStyle: 'circle' }
        }
      }
    }
  });
}

const chartReportEl = document.getElementById('chartReport');
if (chartReportEl) {
  new Chart(chartReportEl.getContext('2d'), {
    type: 'line',
    data: {
      labels: Array.from({length: 30}, (_, i) => `${i + 1}`),
      datasets: [{
        label: 'Penjualan Harian',
        data: [280, 340, 220, 450, 380, 520, 310, 490, 620, 410, 550, 380, 470, 590, 420, 660, 510, 380, 550, 680, 490, 720, 630, 580, 760, 690, 820, 740, 890, 950],
        borderColor: '#0088CC',
        backgroundColor: 'rgba(0, 136, 204, 0.1)',
        borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0,
        pointHoverRadius: 6, pointHoverBackgroundColor: '#0088CC',
        pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1C1C1E', borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1, padding: 12, titleColor: '#fff', bodyColor: '#fff',
          callbacks: {
            title: (items) => `Tanggal ${items[0].label} Sep`,
            label: (ctx) => `Penjualan: Rp ${ctx.parsed.y}rb`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#A0A0A5', font: { size: 11 }, maxTicksLimit: 10 } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' },
             ticks: { color: '#A0A0A5', font: { size: 11 }, callback: (v) => `${v}rb` } }
      }
    }
  });
}
