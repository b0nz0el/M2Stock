import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractStockInSequence,
  formatSequentialStockInNo,
  getNextSequentialStockInNo
} from '../public/assets/js/api/transactions.js';

describe('Sistem Nomor Urut (Sequential) Barang Masuk 4 Digit', () => {
  describe('Helper Generator Format & Parsing Barang Masuk', () => {
    it('memformat nomor urut barang masuk 4 digit dengan padding nol secara benar (IN-YYMMDD-NNNN)', () => {
      const date1 = new Date(2026, 9, 25); // 25 Oktober 2026
      const date2 = new Date(2026, 10, 4);  // 04 November 2026
      const date3 = new Date(2026, 10, 9);  // 09 November 2026

      expect(formatSequentialStockInNo(1, date1)).toBe('IN-261025-0001');
      expect(formatSequentialStockInNo(2, date2)).toBe('IN-261104-0002');
      expect(formatSequentialStockInNo(3, date3)).toBe('IN-261109-0003');
      expect(formatSequentialStockInNo(4, date3)).toBe('IN-261109-0004');
    });

    it('mendukung penomoran barang masuk di atas 9999 tanpa pemotongan', () => {
      const date = new Date(2026, 10, 11);
      expect(formatSequentialStockInNo(10050, date)).toBe('IN-261111-10050');
    });

    it('mengekstrak sequence angka barang masuk dari kode atau note tag', () => {
      expect(extractStockInSequence('IN-261025-0001')).toBe(1);
      expect(extractStockInSequence('IN-261104-0002')).toBe(2);
      expect(extractStockInSequence('[IN-261109-0003] Penerimaan Barang')).toBe(3);
      expect(extractStockInSequence('INV-261109-0003')).toBe(0); // Sequence INV tidak tercampur
      expect(extractStockInSequence(null)).toBe(0);
    });

    it('menghitung nomor urut barang masuk berikutnya secara berkesinambungan lintas tanggal', () => {
      const existingInTxs = [
        { invoice_no: 'IN-261025-0001', created_at: '2026-10-25T10:00:00Z' },
        { invoice_no: 'IN-261104-0002', created_at: '2026-11-04T14:30:00Z' },
        { invoice_no: 'IN-261109-0003', created_at: '2026-11-09T09:15:00Z' }
      ];

      // Tanggal baru: 11 November 2026
      const nextDate = new Date(2026, 10, 11);
      const nextInNo = getNextSequentialStockInNo(existingInTxs, nextDate);

      // Tanggal berganti menjadi 261111, nomor urut tetap melanjutkan dari 0003 ke 0004
      expect(nextInNo).toBe('IN-261111-0004');
    });

    it('memulai dari 0001 jika belum ada riwayat barang masuk', () => {
      const date = new Date(2026, 10, 11);
      expect(getNextSequentialStockInNo([], date)).toBe('IN-261111-0001');
    });
  });

  describe('Integritas File Migrasi SQL Barang Masuk', () => {
    it('file migrasi 20261111_sequential_stock_in_numbering.sql memiliki seluruh komponen yang disyaratkan', () => {
      const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261111_sequential_stock_in_numbering.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      // 1. Pembuatan Sequence stock_in_number_seq
      expect(sqlContent).toContain('CREATE SEQUENCE IF NOT EXISTS public.stock_in_number_seq');

      // 2. Re-sequencing Data Historis Barang Masuk
      expect(sqlContent).toContain("WHERE type = 'in'");
      expect(sqlContent).toContain('Asia/Jakarta');
      expect(sqlContent).toContain('lpad(v_counter::TEXT, 4, \'0\')');
      expect(sqlContent).toContain("setval('public.stock_in_number_seq'");

      // 3. Helper & Trigger & PO RPC
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.get_next_stock_in_no()');
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.sync_transaction_columns()');
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.receive_purchase_order');
      expect(sqlContent).toContain('NOTIFY pgrst, \'reload schema\'');
    });
  });
});
