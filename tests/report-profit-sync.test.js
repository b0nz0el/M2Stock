import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockTransactions = [
  {
    id: 1,
    type: 'out',
    product_id: 101,
    qty: 1,
    price: 17000,
    cost_price: 0, // disimulasikan 0 di database historis
    channel: 'Offline',
    created_at: '2026-10-21T10:00:00Z',
    created_by: 'user-fahri'
  },
  {
    id: 2,
    type: 'out',
    product_id: 102,
    qty: 1,
    price: 15000,
    cost_price: null, // disimulasikan null
    channel: 'Offline',
    created_at: '2026-10-24T11:00:00Z',
    created_by: 'user-fahri'
  },
  {
    id: 3,
    type: 'out',
    product_id: 103,
    qty: 2,
    price: 5000,
    cost_price: 0,
    channel: 'Offline',
    created_at: '2026-10-25T12:00:00Z',
    created_by: 'user-fahri'
  },
  {
    id: 4,
    type: 'out',
    product_id: 104,
    qty: 1,
    price: 10000,
    cost_price: 0,
    channel: 'Offline',
    created_at: '2026-10-25T13:00:00Z',
    created_by: 'user-fahri'
  }
];

const mockProducts = [
  {
    id: 101,
    name: 'Super vit 270g',
    sku: 'VIT-270',
    brand: 'Lokal',
    cost_price: 11200,
    sell_price: 17000,
    stock: 5,
    min_stock: 2,
    categories: { name: 'Vitamin' }
  },
  {
    id: 102,
    name: 'Berlian Udang 50g',
    sku: 'PAKAN-UDG',
    brand: 'Berlian',
    cost_price: 10000,
    sell_price: 15000,
    stock: 10,
    min_stock: 2,
    categories: { name: 'Pakan' }
  },
  {
    id: 103,
    name: 'Berlian kasar 55g',
    sku: 'PAKAN-KSR',
    brand: 'Berlian',
    cost_price: 3300,
    sell_price: 5000,
    stock: 8,
    min_stock: 2,
    categories: { name: 'Pakan' }
  },
  {
    id: 104,
    name: 'Berlian tropical 100g',
    sku: 'PAKAN-TRP',
    brand: 'Berlian',
    cost_price: 7000,
    sell_price: 10000,
    stock: 4,
    min_stock: 2,
    categories: { name: 'Pakan' }
  }
];

vi.mock('../public/assets/js/supabase-client.js', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'transactions') {
        const query = {
          select: vi.fn(() => query),
          order: vi.fn(() => query),
          gte: vi.fn(() => query),
          lte: vi.fn(() => query),
          then: (resolve) => resolve({ data: mockTransactions, error: null })
        };
        return query;
      }
      if (table === 'products') {
        const query = {
          select: vi.fn(() => query),
          then: (resolve) => resolve({ data: mockProducts, error: null })
        };
        return query;
      }
      return { select: vi.fn() };
    })
  }
}));

import { report as reportApi } from '../public/assets/js/api/report.js';

describe('Sinkronisasi Laba Dashboard & Report (/dashboard/ vs /dashboard/report/)', () => {
  it('menghitung Penjualan Rp 52.000 dan Laba Rp 17.200 secara tepat saat cost_price transaksi 0/null', async () => {
    // Total Penjualan:
    // Super vit: 1 x 17.000 = 17.000
    // Berlian Udang: 1 x 15.000 = 15.000
    // Berlian kasar: 2 x 5.000 = 10.000
    // Berlian tropical: 1 x 10.000 = 10.000
    // Total Sales = 52.000
    //
    // Total HPP Modal (fallback dari products.cost_price):
    // Super vit: 1 x 11.200 = 11.200
    // Berlian Udang: 1 x 10.000 = 10.000
    // Berlian kasar: 2 x 3.300 = 6.600
    // Berlian tropical: 1 x 7.000 = 7.000
    // Total HPP Modal = 34.800
    //
    // Laba Kotor: 52.000 - 34.800 = 17.200!
    // Margin: Math.round((17.200 / 52.000) * 100) = 33%

    const res = await reportApi.getSummary();

    expect(res.ok).toBe(true);
    const { kpi, topProducts, dailyTrend } = res.data;

    // 1. Verifikasi KPI Utama
    expect(kpi.totalSales).toBe(52000);
    expect(kpi.grossProfit).toBe(17200);
    expect(kpi.profitMargin).toBe(33);

    // 2. Verifikasi Laba per Produk (tidak boleh margin 100% jika HPP ada di master produk)
    const superVit = topProducts.find(p => p.name === 'Super vit 270g');
    expect(superVit).toBeDefined();
    expect(superVit.revenue).toBe(17000);
    expect(superVit.profit).toBe(17000 - 11200); // 5.800
    expect(superVit.margin).toBe(Math.round((5800 / 17000) * 100)); // 34%

    const berlianUdang = topProducts.find(p => p.name === 'Berlian Udang 50g');
    expect(berlianUdang).toBeDefined();
    expect(berlianUdang.revenue).toBe(15000);
    expect(berlianUdang.profit).toBe(5000);

    const berlianKasar = topProducts.find(p => p.name === 'Berlian kasar 55g');
    expect(berlianKasar).toBeDefined();
    expect(berlianKasar.qty).toBe(2);
    expect(berlianKasar.revenue).toBe(10000);
    expect(berlianKasar.profit).toBe(10000 - 6600); // 3.400

    const berlianTropical = topProducts.find(p => p.name === 'Berlian tropical 100g');
    expect(berlianTropical).toBeDefined();
    expect(berlianTropical.revenue).toBe(10000);
    expect(berlianTropical.profit).toBe(3000);

    // 3. Verifikasi Akumulasi Laba pada Tren Harian
    const totalDailyProfit = dailyTrend.reduce((sum, d) => sum + d.profit, 0);
    const totalDailyRev = dailyTrend.reduce((sum, d) => sum + d.revenue, 0);
    expect(totalDailyRev).toBe(52000);
    expect(totalDailyProfit).toBe(17200);
  });

  it('memprioritaskan snapshot cost_price historis jika nilainya lebih dari 0', async () => {
    // Transaksi dengan snapshot HPP aktif
    const snapshotTx = [
      {
        id: 99,
        type: 'out',
        product_id: 101,
        qty: 1,
        price: 20000,
        cost_price: 13000, // snapshot HPP historis lebih tinggi dari modal saat ini
        created_at: '2026-10-29T10:00:00Z'
      }
    ];

    const client = {
      from: vi.fn((table) => {
        if (table === 'transactions') {
          const query = {
            select: vi.fn(() => query),
            order: vi.fn(() => query),
            gte: vi.fn(() => query),
            lte: vi.fn(() => query),
            then: (resolve) => resolve({ data: snapshotTx, error: null })
          };
          return query;
        }
        if (table === 'products') {
          const query = {
            select: vi.fn(() => query),
            then: (resolve) => resolve({ data: mockProducts, error: null })
          };
          return query;
        }
      })
    };

    window.supabase = client;

    const res = await reportApi.getSummary();
    expect(res.ok).toBe(true);
    expect(res.data.kpi.totalSales).toBe(20000);
    // HPP harus memakai snapshot 13.000, bukan produk modal 11.200
    expect(res.data.kpi.grossProfit).toBe(7000); // 20.000 - 13.000
    expect(res.data.kpi.profitMargin).toBe(35);
  });

  it('menghitung pendapatan bersih dan mengurutkan barang terlaris berdasarkan omzet riil setelah diskon', async () => {
    const discountedTx = [
      {
        id: 3725,
        type: 'out',
        product_id: 102,
        qty: 1,
        price: 20000,
        cost_price: 8000,
        channel: 'Shopee',
        note: '[INV-261104-3725] Pesanan Shopee |AQ_DISCOUNT=10135|AQ_TOTAL=9865',
        created_at: '2026-11-05T04:24:00Z'
      },
      {
        id: 9996,
        type: 'out',
        product_id: 101,
        qty: 1,
        price: 17000,
        cost_price: 11200,
        channel: 'Offline',
        created_at: '2026-10-25T11:30:00Z'
      }
    ];

    const client = {
      from: vi.fn((table) => {
        if (table === 'transactions') {
          const query = {
            select: vi.fn(() => query),
            order: vi.fn(() => query),
            gte: vi.fn(() => query),
            lte: vi.fn(() => query),
            then: (resolve) => resolve({ data: discountedTx, error: null })
          };
          return query;
        }
        if (table === 'products') {
          const query = {
            select: vi.fn(() => query),
            then: (resolve) => resolve({ data: mockProducts, error: null })
          };
          return query;
        }
      })
    };

    window.supabase = client;

    const res = await reportApi.getSummary();
    expect(res.ok).toBe(true);

    const { kpi, topProducts } = res.data;
    // Total Sales: 17000 (Super vit) + 9865 (Berlian Udang net) = 26865
    expect(kpi.totalSales).toBe(26865);

    // Ranking #1 harus Super vit (17.000), bukan Berlian Udang (9.865)
    expect(topProducts[0].name).toBe('Super vit 270g');
    expect(topProducts[0].revenue).toBe(17000);

    expect(topProducts[1].name).toBe('Berlian Udang 50g');
    expect(topProducts[1].revenue).toBe(9865);
    expect(topProducts[1].profit).toBe(9865 - 8000);
  });
});
