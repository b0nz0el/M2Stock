import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Sinkronisasi stok lintas halaman', () => {
  const root = path.resolve(__dirname, '..');

  it('POS reload katalog ketika stok produk berubah', () => {
    const outJs = fs.readFileSync(path.join(root, 'public/dashboard/out.js'), 'utf8');
    expect(outJs).toContain("window.addEventListener('aquastock:products-updated'");
    expect(outJs).toContain('loadDropdowns()');
  });

  it('API transaksi menyiarkan perubahan produk setelah transaksi tersimpan', () => {
    const transactionsJs = fs.readFileSync(path.join(root, 'public/assets/js/api/transactions.js'), 'utf8');
    expect(transactionsJs).toContain('notifyProductsUpdated({ type: data.type');
    expect(transactionsJs).toContain("notifyProductsUpdated({ type: 'out', invoice_no: invoiceNo }");
  });
});
