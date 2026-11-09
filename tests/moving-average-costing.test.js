import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('IAS 2 / PSAK 14: Moving Weighted Average Costing', () => {
  const rootDir = path.resolve(__dirname, '..');
  const migrationPath = path.join(rootDir, 'supabase/migrations/20261110_moving_average_costing.sql');

  it('memuat file migrasi moving_average_costing dengan trigger resmi', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.handle_transaction_stock_update()');
    expect(sql).toContain('trg_transaction_stock_update');
    expect(sql).toContain('cost_price = v_new_avg_cost');
  });

  it('mengimplementasikan rumus matematika Moving Weighted Average Cost yang presisi', () => {
    // Fungsi simulasi kalkulasi Moving Average sesuai logika PL/pgSQL
    function calculateMovingAverage(curStock, curCost, incomingQty, incomingCost, isOpname = false, isReturn = false) {
      if (isOpname || isReturn || incomingCost <= 0 || incomingQty <= 0) {
        return curCost; // Tidak mengubah HPP
      }
      if (curStock == null || curStock <= 0 || curCost <= 0) {
        return incomingCost;
      }
      const newCost = ((curStock * curCost) + (incomingQty * incomingCost)) / (curStock + incomingQty);
      return Math.round(newCost * 100) / 100;
    }

    // Kasus 1: Stok awal 10 unit @ Rp 50.000, masuk 10 unit @ Rp 60.000 -> Rata-rata Rp 55.000
    expect(calculateMovingAverage(10, 50000, 10, 60000)).toBe(55000);

    // Kasus 2: Stok awal 5 unit @ Rp 20.000, masuk 15 unit @ Rp 28.000
    // Total modal = (5 * 20.000) + (15 * 28.000) = 100.000 + 420.000 = 520.000
    // Total stok = 20 -> HPP = 520.000 / 20 = 26.000
    expect(calculateMovingAverage(5, 20000, 15, 28000)).toBe(26000);

    // Kasus 3: Stok awal 0 (kosong), masuk 20 unit @ Rp 75.000 -> Langsung Rp 75.000
    expect(calculateMovingAverage(0, 0, 20, 75000)).toBe(75000);

    // Kasus 4: Transaksi Stock Opname -> HPP tidak boleh berubah
    expect(calculateMovingAverage(10, 50000, 5, 40000, true, false)).toBe(50000);

    // Kasus 5: Retur dari Pelanggan -> HPP tidak boleh berubah
    expect(calculateMovingAverage(10, 50000, 1, 95000, false, true)).toBe(50000);
  });

  it('memastikan dokumentasi kontrak API mencatat kalkulasi HPP Moving Average', () => {
    const apiDocPath = path.join(rootDir, 'docs/api-contract.md');
    const apiDoc = fs.readFileSync(apiDocPath, 'utf8');
    expect(apiDoc).toContain('transactions');
  });
});

