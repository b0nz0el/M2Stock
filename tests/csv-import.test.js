import { describe, expect, it } from 'vitest';
import '../public/assets/js/components/csv-import.js';

describe('CSV import parser', () => {
  it('parses exported UTF-8 CSV with quoted commas, escaped quotes, and CRLF', () => {
    const rows = window.parseCsvImportText(
      '\uFEFFSKU,Nama Barang,Catatan\r\n' +
      '"SKU-1","Filter, ukuran besar","Kondisi ""baik"""\r\n' +
      '"SKU-2","Pompa","Baris pertama\nbaris kedua"\r\n'
    );

    expect(rows).toEqual([
      ['SKU', 'Nama Barang', 'Catatan'],
      ['SKU-1', 'Filter, ukuran besar', 'Kondisi "baik"'],
      ['SKU-2', 'Pompa', 'Baris pertama\nbaris kedua']
    ]);
  });

  it('rejects an unclosed quoted field', () => {
    expect(() => window.parseCsvImportText('SKU,Nama\nSKU-1,"Pompa'))
      .toThrow('CSV memiliki tanda kutip yang tidak berpasangan.');
  });

  it('validates ISO calendar dates rather than accepting normalized invalid dates', () => {
    expect(window.isValidCsvImportDate('2024-02-29')).toBe(true);
    expect(window.isValidCsvImportDate('2026-02-31')).toBe(false);
    expect(window.isValidCsvImportDate('16/10/2026')).toBe(false);
  });
});
