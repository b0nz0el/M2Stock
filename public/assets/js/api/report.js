/* ═══════════════════════════════════════════════════
   Aquastock Pro — api/report.js
   Domain Laporan & Agregasi Data Transaksi / Produk
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError } from './_client.js';

export const report = {
  /**
   * Mengambil data dasar laporan (transaksi out + in + products + categories)
   * @param {Object} params - { startDate, endDate }
   */
  getRawReportData: async (params = {}) => {
    try {
      const client = (typeof window !== 'undefined' && window.supabase) ? window.supabase : supabase;

      // 1. Ambil transaksi beserta relasi
      let txQuery = client
        .from('transactions')
        .select(`
          id,
          type,
          qty,
          price,
          cost_price,
          channel,
          created_by,
          created_at,
          note,
          product_id,
          supplier_id,
          customer_id,
          products (
            id,
            name,
            sku,
            brand,
            cost_price,
            sell_price,
            category_id,
            categories (
              id,
              name
            )
          ),
          suppliers (
            id,
            name
          ),
          customers (
            id,
            name
          )
        `)
        .order('created_at', { ascending: true });

      if (params.startDate) {
        txQuery = txQuery.gte('created_at', params.startDate);
      }
      if (params.endDate) {
        txQuery = txQuery.lte('created_at', params.endDate);
      }

      // 2. Ambil master produk untuk laporan stok saat ini
      const prodQuery = client
        .from('products')
        .select(`
          id,
          sku,
          name,
          brand,
          stock,
          min_stock,
          cost_price,
          sell_price,
          category_id,
          categories (
            id,
            name
          )
        `);

      const [txRes, prodRes] = await Promise.all([txQuery, prodQuery]);

      if (txRes.error) throw txRes.error;
      if (prodRes.error) throw prodRes.error;

      return formatResponse({
        ok: true,
        data: {
          transactions: txRes.data || [],
          products: prodRes.data || []
        }
      });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Menghitung rangkuman KPI & Tab Agregasi
   * @param {Object} params - { startDate, endDate }
   */
  getSummary: async (params = {}) => {
    const rawRes = await report.getRawReportData(params);
    if (!rawRes.ok) return rawRes;

    const { transactions, products } = rawRes.data;

    const outTransactions = transactions.filter(t => t.type === 'out');
    const inTransactions = transactions.filter(t => t.type === 'in');

    // 1. Overall Metrics
    const productMap = {};
    products.forEach(p => {
      if (p && p.id != null) productMap[String(p.id)] = p;
    });

    const getTxPricing = (t) => {
      const pid = String(t.product_id || t.products?.id || '');
      const prod = t.products || productMap[pid] || {};
      const qty = Number(t.qty) || 0;
      const sellPrice = Number(t.price) || Number(prod.sell_price) || 0;
      // Prioritaskan snapshot HPP historis jika > 0, fallback ke cost_price master produk (IAS 2)
      const costPrice = (Number(t.cost_price) > 0)
        ? Number(t.cost_price)
        : (Number(prod.cost_price) || 0);

      const revenue = qty * sellPrice;
      const cogs = qty * costPrice;
      const profit = Math.max(0, revenue - cogs);

      return { prod, pid, qty, sellPrice, costPrice, revenue, cogs, profit };
    };

    let totalSales = 0;
    let totalCogs = 0; // HPP (Cost of Goods Sold)
    let totalQtySold = 0;

    outTransactions.forEach(t => {
      const { qty, revenue, cogs } = getTxPricing(t);
      totalSales += revenue;
      totalCogs += cogs;
      totalQtySold += qty;
    });

    const grossProfit = Math.max(0, totalSales - totalCogs);
    const profitMargin = totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0;
    const totalTxOut = outTransactions.length;

    // Nilai Stok saat ini
    let totalStockQty = 0;
    let totalStockCostValue = 0;
    let totalStockSellValue = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      const stock = Number(p.stock) || 0;
      const minStock = Number(p.min_stock) || 0;
      const cost = Number(p.cost_price) || 0;
      const sell = Number(p.sell_price) || 0;

      totalStockQty += stock;
      totalStockCostValue += stock * cost;
      totalStockSellValue += stock * sell;

      if (stock <= minStock) {
        lowStockCount++;
      }
    });

    // 2. Tab Penjualan (Top Selling Products)
    const productSalesMap = {};
    outTransactions.forEach(t => {
      const { prod, pid, qty, revenue, profit } = getTxPricing(t);
      const pName = prod.name || t.products?.name || `Produk #${pid}`;
      const brand = prod.brand || t.products?.brand || '-';
      const category = prod.categories?.name || t.products?.categories?.name || 'Umum';

      const key = pid || pName;
      if (!productSalesMap[key]) {
        productSalesMap[key] = {
          id: pid,
          name: pName,
          brand,
          category,
          qty: 0,
          revenue: 0,
          profit: 0
        };
      }
      productSalesMap[key].qty += qty;
      productSalesMap[key].revenue += revenue;
      productSalesMap[key].profit += profit;
    });

    const topProducts = Object.values(productSalesMap)
      .map(p => ({
        ...p,
        margin: p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 3. Tab Laba (Daily Trend Penjualan vs Laba)
    const dailyMap = {};
    outTransactions.forEach(t => {
      const dateKey = (t.created_at || '').substring(0, 10);
      if (!dateKey) return;
      const { revenue, profit } = getTxPricing(t);

      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, revenue: 0, profit: 0, txCount: 0 };
      }
      dailyMap[dateKey].revenue += revenue;
      dailyMap[dateKey].profit += profit;
      dailyMap[dateKey].txCount += 1;
    });

    const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // 4. Tab Kategori
    const categoryMap = {};
    outTransactions.forEach(t => {
      const { prod, qty, revenue, profit } = getTxPricing(t);
      const catName = prod.categories?.name || t.products?.categories?.name || 'Umum';

      if (!categoryMap[catName]) {
        categoryMap[catName] = { category: catName, qty: 0, revenue: 0, profit: 0, txCount: 0 };
      }
      categoryMap[catName].qty += qty;
      categoryMap[catName].revenue += revenue;
      categoryMap[catName].profit += profit;
      categoryMap[catName].txCount += 1;
    });

    const categoryReport = Object.values(categoryMap)
      .map(c => ({
        ...c,
        margin: c.revenue > 0 ? Math.round((c.profit / c.revenue) * 100) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 5. Tab Channel
    const channelMap = {};
    outTransactions.forEach(t => {
      const { qty, revenue, profit } = getTxPricing(t);
      const chName = (t.channel || 'offline').toUpperCase();

      if (!channelMap[chName]) {
        channelMap[chName] = { channel: chName, qty: 0, revenue: 0, profit: 0, txCount: 0 };
      }
      channelMap[chName].qty += qty;
      channelMap[chName].revenue += revenue;
      channelMap[chName].profit += profit;
      channelMap[chName].txCount += 1;
    });

    const channelReport = Object.values(channelMap).sort((a, b) => b.revenue - a.revenue);

    // 6. Tab Supplier (Berdasarkan transaksi barang masuk)
    const supplierMap = {};
    inTransactions.forEach(t => {
      const supName = t.suppliers?.name || 'Umum';
      const qty = Number(t.qty) || 0;
      const price = Number(t.price) || 0;
      const totalBuy = qty * price;

      if (!supplierMap[supName]) {
        supplierMap[supName] = { supplier: supName, qty: 0, totalBuy: 0, txCount: 0 };
      }
      supplierMap[supName].qty += qty;
      supplierMap[supName].totalBuy += totalBuy;
      supplierMap[supName].txCount += 1;
    });

    const supplierReport = Object.values(supplierMap).sort((a, b) => b.totalBuy - a.totalBuy);

    // 7. Tab Kasir
    const cashierMap = {};
    outTransactions.forEach(t => {
      const { qty, revenue, profit } = getTxPricing(t);
      const kasir = (typeof window !== 'undefined' && typeof window.resolveUserName === 'function')
        ? window.resolveUserName(t.created_by)
        : (t.created_by && !t.created_by.includes('-') ? t.created_by : 'David');

      if (!cashierMap[kasir]) {
        cashierMap[kasir] = { cashier: kasir, qty: 0, revenue: 0, profit: 0, txCount: 0 };
      }
      cashierMap[kasir].qty += qty;
      cashierMap[kasir].revenue += revenue;
      cashierMap[kasir].profit += profit;
      cashierMap[kasir].txCount += 1;
    });

    const cashierReport = Object.values(cashierMap).sort((a, b) => b.revenue - a.revenue);

    // 8. Tab Stok
    const stockReport = products.map(p => {
      const stock = Number(p.stock) || 0;
      const minStock = Number(p.min_stock) || 0;
      const cost = Number(p.cost_price) || 0;
      const sell = Number(p.sell_price) || 0;
      const totalCost = stock * cost;
      const totalSell = stock * sell;
      const potentialProfit = totalSell - totalCost;

      return {
        id: p.id,
        sku: p.sku || '-',
        name: p.name || '',
        brand: p.brand || '-',
        category: p.categories?.name || 'Umum',
        stock,
        minStock,
        cost,
        sell,
        totalCost,
        totalSell,
        potentialProfit,
        isLow: stock <= minStock
      };
    }).sort((a, b) => a.stock - b.stock);

    return formatResponse({
      ok: true,
      data: {
        kpi: {
          totalSales,
          grossProfit,
          profitMargin,
          totalTxOut,
          totalQtySold,
          totalStockCostValue,
          totalStockSellValue,
          totalStockQty,
          lowStockCount
        },
        topProducts,
        dailyTrend,
        categoryReport,
        channelReport,
        supplierReport,
        cashierReport,
        stockReport
      }
    });
  },

  // Standard CRUD signature compatibility
  getAll: (params) => report.getSummary(params),
  getById: (id) => formatResponse({ ok: false, error: { message: 'Operasi tidak didukung pada laporan' } }),
  create: (data) => formatResponse({ ok: false, error: { message: 'Laporan dihasilkan secara agregat' } }),
  update: (id, data) => formatResponse({ ok: false, error: { message: 'Laporan bersifat read-only' } }),
  remove: (id) => formatResponse({ ok: false, error: { message: 'Laporan bersifat read-only' } })
};

export default report;
