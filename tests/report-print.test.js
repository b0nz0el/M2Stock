import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock supabase-client.js
vi.mock('../public/assets/js/supabase-client.js', () => ({
  supabase: {
    from: vi.fn()
  }
}));

const mockReportData = {
  kpi: {
    totalSales: 15500000,
    grossProfit: 4650000,
    profitMargin: 30,
    totalTxOut: 42,
    totalQtySold: 128,
    totalStockCostValue: 8500000,
    totalStockQty: 310
  },
  topProducts: [
    {
      name: 'Filter Aquarium Hang-on 501',
      brand: 'Aquafresh',
      category: 'Filter & Pompa',
      qty: 10,
      revenue: 750000,
      profit: 250000,
      margin: 33
    },
    {
      name: 'Lampu LED RGB 30cm',
      brand: 'Aquaglow',
      category: 'Pencahayaan',
      qty: 5,
      revenue: 600000,
      profit: 200000,
      margin: 33
    }
  ],
  dailyTrend: [
    {
      date: '2026-10-29',
      txCount: 42,
      revenue: 15500000,
      profit: 4650000
    }
  ],
  stockReport: [
    {
      sku: 'FLT-501',
      name: 'Filter Aquarium Hang-on 501',
      category: 'Filter & Pompa',
      stock: 25,
      cost: 50000,
      sell: 75000,
      totalCost: 1250000,
      potentialProfit: 625000,
      isLow: false
    }
  ],
  categoryReport: [
    {
      category: 'Filter & Pompa',
      txCount: 15,
      qty: 25,
      revenue: 1875000,
      profit: 625000,
      margin: 33
    }
  ],
  channelReport: [
    {
      channel: 'offline',
      txCount: 25,
      qty: 80,
      revenue: 8500000,
      profit: 2550000
    },
    {
      channel: 'shopee',
      txCount: 17,
      qty: 48,
      revenue: 7000000,
      profit: 2100000
    }
  ],
  supplierReport: [
    {
      supplier: 'PT. Aquascaping Indonesia',
      txCount: 5,
      qty: 120,
      totalBuy: 6500000
    }
  ],
  cashierReport: [
    {
      cashier: 'David Kasir',
      txCount: 42,
      qty: 128,
      revenue: 15500000
    }
  ]
};

vi.mock('../public/assets/js/api/report.js', () => ({
  report: {
    getSummary: vi.fn().mockResolvedValue({
      ok: true,
      data: mockReportData
    })
  }
}));

vi.mock('../public/assets/js/utils/rbac-ui.js', () => ({
  applyReadOnlyUI: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../public/assets/js/utils/rbac.js', () => ({
  getUserRole: vi.fn().mockReturnValue('owner')
}));

describe('Report Print & PDF Generation (/dashboard/report/)', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('aquastock_store_info', JSON.stringify({
      name: 'M2Stock Official Store',
      address: 'Jl. Sam Ratulangi No. 88, Manado',
      phone: '081234567890',
      email: 'owner@m2stock.id'
    }));

    document.body.innerHTML = `
      <div id="page-report">
        <select id="report-period">
          <option value="month" selected>Bulan Ini</option>
          <option value="today">Hari Ini</option>
        </select>
        <button id="btn-refresh-report"></button>
        <button id="btn-export-excel"></button>
        <button id="btn-export-pdf"></button>
        <div id="report-filter-tabs">
          <button type="button" data-tab="sales" class="active">Penjualan</button>
          <button type="button" data-tab="profit">Laba</button>
          <button type="button" data-tab="stock">Stok</button>
          <button type="button" data-tab="category">Kategori</button>
          <button type="button" data-tab="channel">Channel</button>
          <button type="button" data-tab="supplier">Supplier</button>
          <button type="button" data-tab="cashier">Kasir</button>
        </div>
        <p id="kpi-sales"></p>
        <p id="kpi-margin"></p>
        <p id="kpi-profit"></p>
        <p id="kpi-transactions"></p>
        <p id="kpi-stock-val"></p>
        <div id="report-table-title"></div>
        <div id="report-table-subtitle"></div>
        <table>
          <thead id="report-table-head"></thead>
          <tbody id="report-table-body"></tbody>
          <tfoot id="report-table-footer"></tfoot>
        </table>
        <div id="sidebar-user-email">owner@m2stock.id</div>
        <div id="sidebar-user-role">Owner</div>
      </div>
    `;

    await import('../public/dashboard/report.js');
    if (typeof window.initReport === 'function') {
      await window.initReport();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('mengekspor fungsi window.generateReportPrintHTML dan window.printReportPDF', () => {
    expect(typeof window.generateReportPrintHTML).toBe('function');
    expect(typeof window.printReportPDF).toBe('function');
  });

  it('menghasilkan dokumen cetak A4 portrait berstandar eksekutif dengan Kop Toko resmi', () => {
    // Reset tab to sales
    const salesTabBtn = document.querySelector('button[data-tab="sales"]');
    if (salesTabBtn) salesTabBtn.click();

    const html = window.generateReportPrintHTML();

    // Validasi CSS A4
    expect(html).toContain('@page');
    expect(html).toContain('size: A4 portrait;');
    expect(html).toContain('font-family: -apple-system, BlinkMacSystemFont, "Segoe UI"');

    // Validasi Kop Toko
    expect(html).toContain('M2Stock Official Store');
    expect(html).toContain('Jl. Sam Ratulangi No. 88, Manado');
    expect(html).toContain('Telp: 081234567890');
    expect(html).toContain('Laporan Resmi Bisnis');
    expect(html).toContain('Laporan Penjualan (Produk Terlaris)');

    // Validasi KPI summary cards
    expect(html).toContain('Total Penjualan');
    expect(html).toContain('Rp 15.500.000');
    expect(html).toContain('Laba Kotor');
    expect(html).toContain('Rp 4.650.000');
    expect(html).toContain('Valuasi Stok (Modal)');
    expect(html).toContain('Rp 8.500.000');

    // Validasi data tabel penjualan aktif
    expect(html).toContain('Filter Aquarium Hang-on 501');
    expect(html).toContain('Lampu LED RGB 30cm');
    expect(html).toContain('Aquafresh');
    expect(html).toContain('Rp 750.000');
    expect(html).toContain('Rp 600.000');

    // Validasi Grand Total row di tfoot
    expect(html).toContain('TOTAL KESELURUHAN');
    expect(html).toContain('Rp 1.350.000');
    expect(html).toContain('Rp 450.000');

    // Validasi Kolom Tanda Tangan
    expect(html).toContain('Kasir / Pembuat Laporan');
    expect(html).toContain('Pemilik Toko / Penanggung Jawab');
    expect(html).toContain('owner@m2stock.id (Owner)');

    // Validasi Footer Kerahasiaan & Timestamp
    expect(html).toContain('Dicetak otomatis via M2Stock pada:');
    expect(html).toContain('Dokumen ini sah dan bersifat rahasia untuk operasional internal toko');
  });

  it('menghasilkan struktur tabel yang tepat untuk tab Laba Harian', () => {
    const profitTabBtn = document.querySelector('button[data-tab="profit"]');
    profitTabBtn.click();

    const html = window.generateReportPrintHTML();
    expect(html).toContain('Laporan Analisis Laba Kotor Harian');
    expect(html).toContain('Tanggal Transaksi');
    expect(html).toContain('Total Omzet (Penjualan)');
    expect(html).toContain('Laba Kotor');
    expect(html).toContain('Margin Laba');
    expect(html).toContain('2026-10-29');
    expect(html).toContain('Rp 15.500.000');
    expect(html).toContain('Rp 4.650.000');
    expect(html).toContain('30%');
    expect(html).toContain('TOTAL PERIODE');
  });

  it('menghasilkan struktur tabel yang tepat untuk tab Stok & Valuasi Aset', () => {
    const stockTabBtn = document.querySelector('button[data-tab="stock"]');
    stockTabBtn.click();

    const html = window.generateReportPrintHTML();
    expect(html).toContain('Laporan Analisis Valuasi Stok &amp; Inventori');
    expect(html).toContain('SKU');
    expect(html).toContain('Harga Modal');
    expect(html).toContain('Nilai Modal');
    expect(html).toContain('FLT-501');
    expect(html).toContain('Rp 1.250.000');
    expect(html).toContain('TOTAL VALUASI INVENTORI');
  });

  it('menghasilkan struktur tabel yang tepat untuk tab Kategori Produk', () => {
    const catTabBtn = document.querySelector('button[data-tab="category"]');
    catTabBtn.click();

    const html = window.generateReportPrintHTML();
    expect(html).toContain('Laporan Kinerja Penjualan per Kategori');
    expect(html).toContain('Filter &amp; Pompa');
    expect(html).toContain('Rp 1.875.000');
    expect(html).toContain('Rp 625.000');
    expect(html).toContain('TOTAL SEMUA KATEGORI');
  });

  it('menghasilkan struktur tabel yang tepat untuk tab Channel Penjualan', () => {
    const channelTabBtn = document.querySelector('button[data-tab="channel"]');
    channelTabBtn.click();

    const html = window.generateReportPrintHTML();
    expect(html).toContain('Laporan Kontribusi Saluran Penjualan (Channel)');
    expect(html).toContain('offline');
    expect(html).toContain('shopee');
    expect(html).toContain('TOTAL SEMUA CHANNEL');
  });

  it('menghasilkan struktur tabel yang tepat untuk tab Supplier Pengadaan', () => {
    const supTabBtn = document.querySelector('button[data-tab="supplier"]');
    supTabBtn.click();

    const html = window.generateReportPrintHTML();
    expect(html).toContain('Laporan Pengadaan Barang per Supplier');
    expect(html).toContain('PT. Aquascaping Indonesia');
    expect(html).toContain('Rp 6.500.000');
    expect(html).toContain('TOTAL PENGADAAN');
  });

  it('menghasilkan struktur tabel yang tepat untuk tab Kasir / Operator', () => {
    const cashierTabBtn = document.querySelector('button[data-tab="cashier"]');
    cashierTabBtn.click();

    const html = window.generateReportPrintHTML();
    expect(html).toContain('Laporan Kinerja Transaksi per Kasir');
    expect(html).toContain('David Kasir');
    expect(html).toContain('Rp 15.500.000');
    expect(html).toContain('TOTAL TRANSAKSI KASIR');
  });

  it('mengeksekusi cetak via window.open ketika didukung browser', () => {
    const mockPrint = vi.fn();
    const mockFocus = vi.fn();
    const mockDocWrite = vi.fn();
    const mockDocOpen = vi.fn();
    const mockDocClose = vi.fn();

    const mockWin = {
      document: {
        open: mockDocOpen,
        write: mockDocWrite,
        close: mockDocClose,
        readyState: 'complete',
        fonts: { ready: Promise.resolve() }
      },
      focus: mockFocus,
      print: mockPrint
    };

    vi.spyOn(window, 'open').mockReturnValue(mockWin);

    window.printReportPDF();

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(mockDocOpen).toHaveBeenCalled();
    expect(mockDocWrite).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'));
    expect(mockDocClose).toHaveBeenCalled();
  });

  it('menggunakan fallback hidden iframe saat window.open diblokir (popup blocker)', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    const appendChildSpy = vi.spyOn(document.body, 'appendChild');

    window.printReportPDF();

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    // Verifikasi iframe dibuat dan disematkan ke DOM
    const iframe = appendChildSpy.mock.calls.find(call => call[0].tagName === 'IFRAME')?.[0];
    expect(iframe).toBeDefined();
    expect(iframe.style.visibility).toBe('hidden');
  });

  it('mengikat tombol #btn-export-pdf untuk memanggil printReportPDF()', () => {
    const printSpy = vi.spyOn(window, 'printReportPDF');
    const btn = document.getElementById('btn-export-pdf');
    btn.click();
    expect(printSpy).toHaveBeenCalled();
  });

  it('menyinkronkan logo resmi Habitic, slogan, alamat, dan kontak dari Informasi Profil Toko', () => {
    localStorage.setItem('aquastock_store_info', JSON.stringify({
      name: 'Habitic',
      slogan: 'Aquarium Lifestyle Solutions',
      address: 'Jl. Mangga No. 67, Jatimakmur, Kota Bekasi',
      phone: '0812-9662-8052',
      email: 'halo.habitic@gmail.com',
      logo_url: '/assets/images/habitic-logo.png'
    }));

    const html = window.generateReportPrintHTML();

    // Verifikasi kop resmi berlogo dan beridentitas Habitic
    expect(html).toContain('doc-logo-img');
    expect(html).toContain('/assets/images/habitic-logo.png');
    expect(html).toContain('Diterbitkan oleh');
    expect(html).toContain('Habitic');
    expect(html).toContain('Aquarium Lifestyle Solutions');
    expect(html).toContain('Jl. Mangga No. 67, Jatimakmur, Kota Bekasi');
    expect(html).toContain('0812-9662-8052');
    expect(html).toContain('halo.habitic@gmail.com');
  });

  it('mendukung custom logo_url dari profil toko pada kop laporan', () => {
    localStorage.setItem('aquastock_store_info', JSON.stringify({
      name: 'Habitic Megastore',
      slogan: 'Premium Aquatic Center',
      address: 'Jl. Jendral Sudirman Kav. 50, Jakarta',
      phone: '081122334455',
      email: 'info@habitic.com',
      logo_url: 'https://cdn.example.com/custom-habitic-logo.png'
    }));

    const html = window.generateReportPrintHTML();
    expect(html).toContain('https://cdn.example.com/custom-habitic-logo.png');
    expect(html).toContain('Habitic Megastore');
    expect(html).toContain('Premium Aquatic Center');
  });
});
