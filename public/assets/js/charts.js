/* ═══════════════════════════════════════════════════
   aQuaStock Pro — charts.js
   Konfigurasi Chart.js (sales bar, channel doughnut, report line)
   ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   CHARTS
   ═══════════════════════════════════════════════ */
(function() {
  if (typeof Chart === 'undefined') {
    // Chart.js tidak dimuat di halaman ini, skip rendering
    return;
  }

  const chartSalesEl = document.getElementById('chartSales');
  if (chartSalesEl) {
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const defaultLabels = Array.from({length: 10}, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (9 - i));
      return `${d.getDate()} ${months[d.getMonth()]}`;
    });

    window.salesChart = new Chart(chartSalesEl.getContext('2d'), {
      type: 'bar',
      data: {
        labels: defaultLabels,
        datasets: [
          { label: 'Penjualan', data: new Array(10).fill(0),
            backgroundColor: '#0088CC', borderRadius: 4, barPercentage: 0.9 },
          { label: 'Laba', data: new Array(10).fill(0),
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
               ticks: { color: '#A0A0A5', font: { size: 11 }, callback: (v) => `${v}rb` },
               suggestedMax: 10 }
        }
      }
    });
  }

  const chartChannelEl = document.getElementById('chartChannel');
  if (chartChannelEl) {
    window.channelChart = new Chart(chartChannelEl.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Belum ada penjualan'],
        datasets: [{
          data: [1],
          backgroundColor: ['rgba(255,255,255,0.08)'],
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
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.label === 'Belum ada penjualan' ? 'Belum ada data transaksi' : `${ctx.label}: ${ctx.parsed} unit`
            }
          }
        }
      }
    });
  }

  window.updateDashboardSalesChart = function(labels, sales, profit) {
    if (window.salesChart) {
      window.salesChart.data.labels = labels;
      window.salesChart.data.datasets[0].data = sales;
      window.salesChart.data.datasets[1].data = profit;
      window.salesChart.update();
    }
  };

  window.updateDashboardChannelChart = function(labels, data, colors) {
    if (window.channelChart) {
      window.channelChart.data.labels = labels;
      window.channelChart.data.datasets[0].data = data;
      if (colors) window.channelChart.data.datasets[0].backgroundColor = colors;
      window.channelChart.update();
    }
  };

const chartReportEl = document.getElementById('chartReport');
if (chartReportEl) {
  new Chart(chartReportEl.getContext('2d'), {
    type: 'line',
    data: {
      labels: Array.from({length: 30}, (_, i) => `${i + 1}`),
      datasets: [{
        label: 'Penjualan Harian',
        data: new Array(30).fill(0),
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
})();

