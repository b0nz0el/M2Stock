import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const indexHtml = readFileSync(resolve(process.cwd(), 'public/dashboard/index.html'), 'utf8');
const dashboardScript = readFileSync(resolve(process.cwd(), 'public/dashboard/dashboard.js'), 'utf8');

describe('Dashboard Transaksi Barang Masuk & Keluar', () => {
  beforeEach(() => {
    // Mock APIs on window
    window.Api = {
      items: {
        getAll: vi.fn().mockResolvedValue({
          ok: true,
          data: [
            { id: 1, name: 'Ikan Guppy', stock: 50, min_stock: 10, sell_price: 5000, cost_price: 2500 },
            { id: 2, name: 'Filter Gantung', stock: 2, min_stock: 5, sell_price: 45000, cost_price: 30000 }
          ]
        })
      },
      transactions: {
        getAll: vi.fn()
      }
    };
    window.resolveUserName = vi.fn().mockReturnValue('David');
    window.refreshIcons = vi.fn();
    window.syncTableLabels = vi.fn();
    window.updateDashboardSalesChart = vi.fn();
    window.updateDashboardChannelChart = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('memastikan markup index.html memiliki Transaksi Barang Keluar dan Transaksi Barang Masuk, dan menghapus Transaksi Terakhir', () => {
    expect(indexHtml).toContain('Transaksi Barang Keluar');
    expect(indexHtml).toContain('Transaksi Barang Masuk');
    expect(indexHtml).toContain('id="recent-in-transactions-list"');
    expect(indexHtml).toContain('id="recent-transactions-tbody"');
    expect(indexHtml).not.toContain('Transaksi Terakhir');
    expect(indexHtml).toContain('/dashboard/out/');
    expect(indexHtml).toContain('/dashboard/in/');
  });

  it('memastikan KPI Stok Kritis diganti dengan Valuasi Stok (Modal) pada dashboard', async () => {
    expect(indexHtml).toContain('Valuasi Stok (Modal)');
    expect(indexHtml).toContain('id="dash-stock-cost-value"');

    document.body.innerHTML = `
      <div id="dash-total-items"></div>
      <div id="dash-total-stock"></div>
      <div id="dash-stock-value"></div>
      <div id="dash-stock-cost-value"></div>
      <div id="dash-critical-stock"></div>
      <div id="restock-list"></div>
      <div id="recent-in-transactions-list"></div>
      <table>
        <tbody id="recent-transactions-tbody"></tbody>
      </table>
      <div id="top-products-list"></div>
      <div id="dash-sales-summary"></div>
    `;

    window.Api.items.getAll.mockResolvedValue({
      ok: true,
      data: [
        { id: 1, name: 'Pakan Ikan A', stock: 10, sell_price: 20000, cost_price: 15000, min_stock: 5 },
        { id: 2, name: 'Filter Air B', stock: 5, sell_price: 50000, cost_price: 35000, min_stock: 2 }
      ]
    });

    const runDashboard = new Function('window', 'document', 'Api', dashboardScript);
    runDashboard(window, document, window.Api);
    await window.loadDashboardData();

    // 10*15.000 + 5*35.000 = 150.000 + 175.000 = Rp 325.000
    const costValueEl = document.getElementById('dash-stock-cost-value');
    expect(costValueEl.textContent).toContain('325.000');
  });

  it('memisahkan transaksi masuk dan keluar secara tepat di dashboard', async () => {
    document.body.innerHTML = `
      <div id="dash-total-items"></div>
      <div id="dash-total-stock"></div>
      <div id="dash-stock-value"></div>
      <div id="dash-critical-stock"></div>
      <div id="restock-list"></div>
      <div id="recent-in-transactions-list"></div>
      <table>
        <tbody id="recent-transactions-tbody"></tbody>
      </table>
      <div id="top-products-list"></div>
      <div id="dash-sales-summary"></div>
    `;

    window.Api.transactions.getAll.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 101,
          type: 'in',
          product_id: 1,
          products: { name: 'Ikan Guppy Blue' },
          suppliers: { name: 'Supplier Fish Farm' },
          qty: 25,
          price: 2500,
          cost_price: 2500,
          created_at: new Date().toISOString()
        },
        {
          id: 102,
          type: 'out',
          product_id: 2,
          products: { name: 'Filter Gantung 501' },
          channel: 'Shopee',
          qty: 2,
          price: 45000,
          created_by: 'user-1',
          created_at: new Date().toISOString()
        },
        {
          id: 103,
          type: 'in',
          product_id: 2,
          products: { name: 'Filter Gantung 501' },
          suppliers: { name: 'Distributor Akuarium' },
          qty: 10,
          price: 30000,
          cost_price: 30000,
          created_at: new Date().toISOString()
        }
      ]
    });

    // Execute dashboard.js
    const runDashboard = new Function('window', 'document', 'Api', dashboardScript);
    runDashboard(window, document, window.Api);
    await window.loadDashboardData();

    // Verify Transaksi Barang Keluar table
    const outTbody = document.getElementById('recent-transactions-tbody');
    expect(outTbody.innerHTML).toContain('Filter Gantung 501');
    expect(outTbody.innerHTML).toContain('-2');
    expect(outTbody.innerHTML).toContain('Shopee');
    // It must NOT contain incoming transactions
    expect(outTbody.innerHTML).not.toContain('Ikan Guppy Blue');
    expect(outTbody.innerHTML).not.toContain('Supplier Fish Farm');

    // Verify Transaksi Barang Masuk list
    const inList = document.getElementById('recent-in-transactions-list');
    expect(inList.innerHTML).toContain('Ikan Guppy Blue');
    expect(inList.innerHTML).toContain('Supplier Fish Farm');
    expect(inList.innerHTML).toContain('+25 unit');
    expect(inList.innerHTML).toContain('Distributor Akuarium');
    expect(inList.innerHTML).toContain('+10 unit');
    // It must NOT contain outgoing transactions
    expect(inList.textContent).not.toContain('-2');
    expect(inList.innerHTML).not.toContain('Shopee');
  });

  it('menampilkan pesan kosong yang sesuai saat tidak ada transaksi barang keluar atau masuk', async () => {
    document.body.innerHTML = `
      <div id="dash-total-items"></div>
      <div id="dash-total-stock"></div>
      <div id="dash-stock-value"></div>
      <div id="dash-critical-stock"></div>
      <div id="restock-list"></div>
      <div id="recent-in-transactions-list"></div>
      <table>
        <tbody id="recent-transactions-tbody"></tbody>
      </table>
      <div id="top-products-list"></div>
      <div id="dash-sales-summary"></div>
    `;

    window.Api.transactions.getAll.mockResolvedValue({
      ok: true,
      data: []
    });

    const runDashboard = new Function('window', 'document', 'Api', dashboardScript);
    runDashboard(window, document, window.Api);
    await window.loadDashboardData();

    const outTbody = document.getElementById('recent-transactions-tbody');
    expect(outTbody.innerHTML).toContain('Belum ada transaksi barang keluar');

    const inList = document.getElementById('recent-in-transactions-list');
    expect(inList.innerHTML).toContain('Belum ada transaksi barang masuk');
  });
});
