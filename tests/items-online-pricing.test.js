import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const itemsPath = path.resolve(__dirname, '../public/dashboard/items.js');
const htmlPath = path.resolve(__dirname, '../public/dashboard/index.html');
const itemsJs = fs.readFileSync(itemsPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

describe('Master Barang — harga offline dan online', () => {
  it('menampilkan kolom harga jual dan markup offline serta online', () => {
    expect(html).toContain('>Hrg Jual Offline</th>');
    expect(html).toContain('>Markup Offline</th>');
    expect(html).toContain('>Hrg Jual Online</th>');
    expect(html).toContain('>Markup Online</th>');
  });

  it('menghitung harga online dari harga beli dengan markup 25%', () => {
    const functionMatch = itemsJs.match(/function getOnlinePricing\(costPrice\) \{[\s\S]*?\n  \}/);
    expect(functionMatch).not.toBeNull();

    const getOnlinePricing = new Function(`${functionMatch[0]}; return getOnlinePricing;`)();
    expect(getOnlinePricing(10000)).toEqual({ price: 12500, markup: 25 });
    expect(getOnlinePricing(0)).toEqual({ price: 0, markup: 0 });
  });

  it('menyertakan foto dan harga online pada ekspor CSV', () => {
    expect(itemsJs).toContain("'ID', 'Foto', 'SKU'");
    expect(itemsJs).toContain("'Harga Jual Offline (Rp)', 'Markup Offline (%)', 'Harga Jual Online (Rp)', 'Markup Online (%)'");
  });
});
