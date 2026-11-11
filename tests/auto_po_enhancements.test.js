import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('../public/assets/js/supabase-client.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-smart-po' } } })
    },
    from: vi.fn(),
    rpc: vi.fn()
  }
}));

import { po as poApi } from '../public/assets/js/api/po.js';
import { supabase } from '../public/assets/js/supabase-client.js';

describe('Auto-PO Cerdas: Demand Velocity, Transaksi Bersih, & Transparansi UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('mencegah lonjakan qty 73 unit saat min_stock=40 tetapi penjualan 30 hari hanya 2 unit (slow-mover)', () => {
    const screper = { id: 'p-screper', name: 'Nikita Screper gagang stenlis', stock: 3, min_stock: 40 };
    const details = poApi.computeAutoOrderDetails(screper, { sold_7d: 0, sold_30d: 2, sold_90d: 2 });

    expect(details.qty).toBeLessThanOrEqual(2);
    expect(details.qty).toBe(1);
    expect(details.mode).toBe('demand_velocity');
    expect(details.reason).toContain('Terjual 30h: 2');
    expect(details.reason).toContain('Saran 18h');
  });

  it('menyarankan qty sesuai proyeksi cakupan hari (~17-18 unit) untuk produk fast-moving, bukan pukul rata 5 unit', () => {
    const fastItem = { id: 'p-fast', name: 'Pelet Koi 500gr', stock: 1, min_stock: 3 };
    const details = poApi.computeAutoOrderDetails(fastItem, { sold_7d: 7, sold_30d: 30, sold_90d: 90 }, { coverageDays: 18 });

    expect(details.weightedAds).toBeCloseTo(1.0, 2);
    expect(details.targetQty).toBe(18);
    expect(details.qty).toBe(17);
    expect(details.mode).toBe('demand_velocity');
    expect(details.reason).toContain('Stok: 1');
    expect(details.reason).toContain('Terjual 30h: 30');
  });

  it('membatasi lonjakan sesaat 1 hari di 7 hari terakhir (outlier cap 2.5x ads_30d)', () => {
    const outlierItem = { id: 'p-outlier', name: 'Pompa Celup', stock: 1, min_stock: 5 };
    // Total 30h = 30 unit (ads_30d = 1), dengan 28 unit terjadi di 7h terakhir (ads_7d = 4 -> di-cap ke 2.5)
    // weighted_ads = 0.45*2.5 + 0.40*1 + 0.15*(90/90=1) = 1.125 + 0.40 + 0.15 = 1.675
    // ceil(1.675 * 18) = 31 -> 31 - 1 = 30 (tanpa cap: 42 unit)
    const details = poApi.computeAutoOrderDetails(outlierItem, { sold_7d: 28, sold_30d: 30, sold_90d: 90 });

    expect(details.qty).toBeLessThan(35);
    expect(details.qty).toBe(30);
  });

  it('menghitung slow-mover bila sold_30d=0 tetapi sold_90d>0 memakai faktor 0.75 * ads_90d', () => {
    const slowItem = { id: 'p-slow-90', name: 'Batu Aerator', stock: 0, min_stock: 20 };
    // sold_90d = 180 -> ads_90d = 2 -> weighted_ads = 1.5 -> 1.5 * 18 = 27
    const details = poApi.computeAutoOrderDetails(slowItem, { sold_7d: 0, sold_30d: 0, sold_90d: 180 });
    expect(details.qty).toBe(27);
    expect(details.reason).toContain('Terjual 90h: 180');
  });

  it('memakai batas konservatif (<= 5 unit / min_stock) untuk barang tanpa penjualan 90 hari dan menghormati target manual', () => {
    const deadHighMin = { id: 'p-dead', name: 'Ornamen Besar', stock: 3, min_stock: 40 };
    const deadDetails = poApi.computeAutoOrderDetails(deadHighMin, null);
    expect(deadDetails.mode).toBe('zero_velocity_cap');
    expect(deadDetails.qty).toBe(2);
    expect(deadDetails.reason).toContain('Belum ada penjualan 90h');

    const explicitTarget = { id: 'p-exp', name: 'Filter Khusus', stock: 2, min_stock: 40, target_stock: 15 };
    const expDetails = poApi.computeAutoOrderDetails(explicitTarget, { sold_7d: 0, sold_30d: 0, sold_90d: 0 });
    expect(expDetails.mode).toBe('explicit_target');
    expect(expDetails.qty).toBe(13);
  });

  it('aggregateSalesVelocity mengecualikan [STOCK OPNAME], Retur, transaksi reversal, dan transaksi yang telah di-reverse', () => {
    const now = new Date('2026-11-11T10:00:00Z');
    const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

    const txRows = [
      // Penjualan bersih 3 hari lalu -> MASUK (7d, 30d, 90d)
      { id: 'tx-valid-1', type: 'out', product_id: 'p1', quantity: 5, channel: 'Offline', created_at: daysAgo(3) },
      // Penjualan bersih 20 hari lalu -> MASUK (30d, 90d)
      { id: 'tx-valid-2', type: 'out', product_id: 'p1', qty: 4, channel: 'Shopee', created_at: daysAgo(20) },
      // Penjualan bersih 60 hari lalu -> MASUK (90d)
      { id: 'tx-valid-3', type: 'out', product_id: 'p1', quantity: 6, channel: 'Tokopedia', created_at: daysAgo(60) },
      // Lebih dari 90 hari -> ABAIKAN
      { id: 'tx-old', type: 'out', product_id: 'p1', quantity: 50, channel: 'Offline', created_at: daysAgo(95) },
      // Koreksi Stock Opname -> ABAIKAN
      { id: 'tx-opname', type: 'out', product_id: 'p1', quantity: 30, note: '[STOCK OPNAME] Selisih hilang', created_at: daysAgo(2) },
      { id: 'tx-opname-notes', type: 'out', product_id: 'p1', quantity: 12, note: '', notes: '[STOCK OPNAME] Audit gudang', created_at: daysAgo(5) },
      // Retur supplier -> ABAIKAN
      { id: 'tx-retur-ch', type: 'out', product_id: 'p1', quantity: 25, channel: 'Retur', created_at: daysAgo(4) },
      { id: 'tx-retur-id', type: 'out', product_id: 'p1', quantity: 8, channel: 'Offline', return_id: 'ret-1', created_at: daysAgo(4) },
      // Transaksi batal (asli + baris reversal) -> ABAIKAN KEDUANYA
      { id: 'tx-cancelled', type: 'out', product_id: 'p1', quantity: 40, channel: 'Offline', created_at: daysAgo(1) },
      { id: 'tx-rev', type: 'in', product_id: 'p1', quantity: 40, reversal_of_id: 'tx-cancelled', created_at: daysAgo(1) },
      // Transaksi masuk normal -> ABAIKAN
      { id: 'tx-in', type: 'in', product_id: 'p1', quantity: 100, created_at: daysAgo(1) }
    ];

    const velocity = poApi.aggregateSalesVelocity(txRows, now);
    expect(velocity.get('p1')).toEqual({
      sold_7d: 5,
      sold_30d: 9,
      sold_90d: 15
    });
  });

  it('fallback Auto-PO mengintegrasikan demand penjualan bersih & app_settings coverage_days serta mengembalikan item_reasons', async () => {
    const now = new Date('2026-11-11T10:00:00Z');
    const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

    supabase.rpc.mockImplementation((rpcName, params) => {
      if (rpcName === 'generate_draft_po_from_low_stock_v2') {
        return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'schema cache' } });
      }
      if (rpcName === 'create_purchase_order_atomic') {
        return Promise.resolve({
          data: { ok: true, id: 'po-smart-1', no_po: params.p_no_po },
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    supabase.from.mockImplementation((table) => {
      if (table === 'products') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              // Fast mover: sold 30 dalam 30h -> ads ~1/h, coverage custom 20h -> 20 - 2 = 18 unit
              { id: 'p-fast-db', name: 'Kapas Premium', stock: 2, min_stock: 3, cost_price: 5000, supplier_id: 'sup-1', is_active: true },
              // Slow mover dengan min_stock salah ketik 40: hanya laku 1 unit -> qty = 1 (bukan 75!)
              { id: 'p-slow-db', name: 'Nikita Screper', stock: 5, min_stock: 40, cost_price: 17000, supplier_id: 'sup-1', is_active: true }
            ],
            error: null
          })
        };
      }
      if (table === 'app_settings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { value: { auto_po_coverage_days: 20, auto_po_enabled: true } },
                error: null
              })
            }))
          }))
        };
      }
      if (table === 'transactions') {
        const rowsPromise = Promise.resolve({
          data: [
            { id: 't1', type: 'out', product_id: 'p-fast-db', quantity: 7, channel: 'Offline', created_at: daysAgo(2) },
            { id: 't2', type: 'out', product_id: 'p-fast-db', quantity: 23, channel: 'Offline', created_at: daysAgo(15) },
            { id: 't3', type: 'out', product_id: 'p-fast-db', quantity: 60, channel: 'Offline', created_at: daysAgo(60) },
            { id: 't4', type: 'out', product_id: 'p-slow-db', quantity: 1, channel: 'Offline', created_at: daysAgo(20) },
            // Stock opname palsu yang harus diabaikan
            { id: 't5', type: 'out', product_id: 'p-slow-db', quantity: 99, note: '[STOCK OPNAME] Koreksi', created_at: daysAgo(3) }
          ],
          error: null
        });
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              gte: vi.fn(() => ({
                limit: vi.fn(() => rowsPromise)
              }))
            }))
          }))
        };
      }
      if (table === 'purchase_orders') {
        return {
          select: vi.fn((cols) => {
            if (cols === 'no_po') {
              const noRes = Promise.resolve({ data: [], error: null });
              return { ilike: vi.fn(() => ({ limit: vi.fn(() => noRes), then: noRes.then.bind(noRes) })) };
            }
            return { in: vi.fn().mockResolvedValue({ data: [], error: null }) };
          })
        };
      }
      if (table === 'suppliers') {
        return { select: vi.fn().mockResolvedValue({ data: [{ id: 'sup-1', name: 'BOS Sarno' }], error: null }) };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const res = await poApi.generateFromLowStock();
    expect(res.ok).toBe(true);
    expect(res.data.created).toBe(true);
    expect(res.data.coverage_days).toBe(20);
    expect(res.data.no_po).toBe('PO-202611-AUTO001');

    const reasonsByPid = new Map(res.data.item_reasons.map(r => [r.product_id, r]));
    expect(reasonsByPid.get('p-fast-db').qty).toBe(18);
    expect(reasonsByPid.get('p-fast-db').reason).toContain('Saran 20h');
    expect(reasonsByPid.get('p-slow-db').qty).toBe(1);
    expect(reasonsByPid.get('p-slow-db').reason).toContain('Terjual 30h: 1');
  });

  it('SQL migration dan sw.js sudah diperbarui sesuai kontrak Auto Cerdas dan cache-busting PWA', () => {
    const sqlMigration = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20261111_auto_po_enhancements.sql'), 'utf8');
    const swJs = fs.readFileSync(path.resolve(process.cwd(), 'public/sw.js'), 'utf8');
    const poDashboardJs = fs.readFileSync(path.resolve(process.cwd(), 'public/dashboard/po.js'), 'utf8');

    expect(sqlMigration).toContain('app_settings');
    expect(sqlMigration).toContain('v_coverage_days INT := 18');
    expect(sqlMigration).toContain('%[STOCK OPNAME]%');
    expect(sqlMigration).toContain('reversal_of_id');
    expect(sqlMigration).toContain('item_reasons');
    expect(swJs).toContain("'/dashboard/po.js'");
    expect(poDashboardJs).toContain('po-doc-item-insight');
  });
});
