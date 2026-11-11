import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  transactions,
  extractInvoiceSequence,
  formatSequentialInvoiceNo,
  getNextSequentialInvoiceNo
} from '../public/assets/js/api/transactions.js';

describe('Sistem Nomor Urut (Sequential) Invoice Transaksi 4 Digit', () => {
  describe('Helper Generator Format & Parsing', () => {
    it('memformat nomor urut 4 digit dengan padding nol secara benar (INV-YYMMDD-NNNN)', () => {
      const date1 = new Date(2026, 9, 25); // 25 Oktober 2026
      const date2 = new Date(2026, 10, 4);  // 04 November 2026
      const date3 = new Date(2026, 10, 9);  // 09 November 2026

      expect(formatSequentialInvoiceNo(1, date1)).toBe('INV-261025-0001');
      expect(formatSequentialInvoiceNo(2, date2)).toBe('INV-261104-0002');
      expect(formatSequentialInvoiceNo(3, date3)).toBe('INV-261109-0003');
      expect(formatSequentialInvoiceNo(4, date3)).toBe('INV-261109-0004');
    });

    it('mendukung penomoran di atas 9999 tanpa pemotongan', () => {
      const date = new Date(2026, 10, 11);
      expect(formatSequentialInvoiceNo(10050, date)).toBe('INV-261111-10050');
    });

    it('mengekstrak sequence angka dari berbagai format kode invoice atau note tag', () => {
      expect(extractInvoiceSequence('INV-261025-0001')).toBe(1);
      expect(extractInvoiceSequence('INV-261104-0002')).toBe(2);
      expect(extractInvoiceSequence('[INV-261109-0003] Catatan POS')).toBe(3);
      expect(extractInvoiceSequence('SPX-ID-12345')).toBe(0);
      expect(extractInvoiceSequence(null)).toBe(0);
    });

    it('menghitung nomor urut berikutnya secara berkesinambungan lintas tanggal', () => {
      const existingTxs = [
        { invoice_no: 'INV-261025-0001', created_at: '2026-10-25T10:00:00Z' },
        { invoice_no: 'INV-261104-0002', created_at: '2026-11-04T14:30:00Z' },
        { invoice_no: 'INV-261109-0003', created_at: '2026-11-09T09:15:00Z' }
      ];

      // Tanggal baru: 11 November 2026
      const nextDate = new Date(2026, 10, 11);
      const nextInv = getNextSequentialInvoiceNo(existingTxs, nextDate);

      // Tanggal berganti menjadi 261111, tetapi sequence nomor urut melanjutkan dari 0003 ke 0004
      expect(nextInv).toBe('INV-261111-0004');
    });

    it('memulai dari 0001 jika belum ada riwayat invoice', () => {
      const date = new Date(2026, 10, 11);
      expect(getNextSequentialInvoiceNo([], date)).toBe('INV-261111-0001');
    });
  });

  describe('Integrasi Checkout Kasir POS (createBatchOut)', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('pada mode RPC atomik: tidak mengirim invoice_no acak dan mengadopsi invoice_no resmi dari RPC', async () => {
      const rpcSpy = vi.fn().mockResolvedValue({
        data: {
          ok: true,
          success: true,
          invoice_no: 'INV-261111-0004',
          total_amount: 145000,
          transactions: [
            { id: 'tx-1', product_id: '101', qty: 2, price: 50000, invoice_no: 'INV-261111-0004' },
            { id: 'tx-2', product_id: '102', qty: 3, price: 15000, invoice_no: 'INV-261111-0004' }
          ]
        },
        error: null
      });

      // Mock window.supabase
      global.window = {
        supabase: {
          rpc: rpcSpy,
          from: vi.fn()
        },
        dispatchEvent: vi.fn()
      };

      const cartItems = [
        { product_id: 101, name: 'Pompa Aquarium', qty: 2, price: 50000 },
        { product_id: 102, name: 'Pakan Ikan Pelet', qty: 3, price: 15000 }
      ];

      const res = await transactions.createBatchOut(cartItems, {
        channel: 'Offline',
        payment_method: 'Cash'
      });

      expect(res.ok).toBe(true);
      expect(res.data.invoice_no).toBe('INV-261111-0004');
      expect(rpcSpy).toHaveBeenCalledTimes(1);

      // Verifikasi bahwa RPC dipanggil dengan p_common tanpa nomor invoice acak
      const rpcArgs = rpcSpy.mock.calls[0][1];
      expect(rpcArgs.p_common.invoice_no).toBeUndefined();
    });

    it('pada mode fallback client-side: seluruh item dalam keranjang mendapatkan invoice_no sequential 4 digit yang sama persis', async () => {
      // Mock window.supabase agar RPC gagal dan masuk ke fallback loop
      const createdRows = [];
      const originalCreateOut = transactions.createOut;
      transactions.createOut = vi.fn().mockImplementation(async (row) => {
        createdRows.push(row);
        return { ok: true, data: { id: `tx-${createdRows.length}`, ...row } };
      });

      global.window = {
        supabase: {
          rpc: vi.fn().mockImplementation((fnName) => {
            if (fnName === 'get_next_invoice_no') {
              return Promise.resolve({ data: 'INV-261111-0005', error: null });
            }
            return Promise.resolve({ data: null, error: { message: 'RPC not available' } });
          }),
          from: vi.fn()
        },
        dispatchEvent: vi.fn()
      };

      const cartItems = [
        { product_id: 201, name: 'Lampu LED Aquascape', qty: 1, price: 120000 },
        { product_id: 202, name: 'Pasir Silika 1kg', qty: 2, price: 10000 }
      ];

      const res = await transactions.createBatchOut(cartItems, {
        channel: 'Offline',
        payment_method: 'Cash'
      });

      expect(res.ok).toBe(true);
      expect(res.data.invoice_no).toBe('INV-261111-0005');
      expect(createdRows).toHaveLength(2);

      // Kedua item harus memiliki invoice_no yang sama dan tag yang sama
      expect(createdRows[0].invoice_no).toBe('INV-261111-0005');
      expect(createdRows[1].invoice_no).toBe('INV-261111-0005');
      expect(createdRows[0].note).toContain('[INV-261111-0005]');
      expect(createdRows[1].note).toContain('[INV-261111-0005]');

      transactions.createOut = originalCreateOut;
    });
  });

  describe('Integritas File Migrasi SQL', () => {
    it('file migrasi 20261111_sequential_invoice_numbering.sql memiliki seluruh komponen yang disyaratkan', () => {
      const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261111_sequential_invoice_numbering.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      // 1. Pembuatan Sequence
      expect(sqlContent).toContain('CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq');

      // 2. Pembersihan & Re-sequencing Data Historis
      expect(sqlContent).toContain('min_created_at');
      expect(sqlContent).toContain('Asia/Jakarta');
      expect(sqlContent).toContain('lpad(v_counter::TEXT, 4, \'0\')');
      expect(sqlContent).toContain('setval(\'public.invoice_number_seq\'');

      // 3. RPC & Helper Function
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.get_next_invoice_no()');
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.process_pos_checkout');
      expect(sqlContent).toContain('NOTIFY pgrst, \'reload schema\'');
    });
  });
});
