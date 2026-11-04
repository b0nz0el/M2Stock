import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const itemsPath = path.resolve(__dirname, '../public/dashboard/items.js');
const htmlPath = path.resolve(__dirname, '../public/dashboard/index.html');
const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261103_product_online_price.sql');
const itemsJs = fs.readFileSync(itemsPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');

describe('Master Barang — harga offline dan online', () => {
  it('menampilkan kolom harga jual dan markup offline serta online', () => {
    expect(html).toContain('>Hrg Jual Offline</th>');
    expect(html).toContain('>Markup Offline</th>');
    expect(html).toContain('>Hrg Jual Online</th>');
    expect(html).toContain('>Markup Online</th>');
  });

  it('menghitung markup online dari harga beli dan harga online tersimpan', () => {
    const pricingFunction = itemsJs.match(/function getOnlinePricing\(costPrice, onlinePrice, marketplaceFee = 0\.395\) \{[\s\S]*?\n  \}/);
    expect(pricingFunction).not.toBeNull();

    const getOnlinePricing = new Function(`${pricingFunction[0]}; return getOnlinePricing;`)();
    expect(getOnlinePricing(10000)).toMatchObject({ price: 12500, markup: -24.37, netProfit: -2437 });
    expect(getOnlinePricing(10000, null)).toMatchObject({ price: 12500, markup: -24.37, netProfit: -2437 });
    expect(getOnlinePricing(10000, 13150)).toMatchObject({ price: 13150, markup: -20.44, netProfit: -2044 });
    expect(getOnlinePricing(0)).toMatchObject({ price: 0, markup: 0, netProfit: 0 });
  });

  it('menyediakan target massal offline/online dan pengaturan markup', () => {
    expect(html).toContain('id="tab-bulk-offline"');
    expect(html).toContain('id="tab-bulk-online"');
    expect(html).toContain('Set Markup (%)');
    expect(itemsJs).toContain('online_sell_price: newPrice');
    expect(itemsJs).toContain('sell_price: newPrice');
  });

  it('mengubah markup yang dipilih menjadi harga pada channel yang sesuai', () => {
    const bulkFunctionStart = itemsJs.indexOf('function getBulkPriceProjection(item, nominalValue, percentValue, hasValue)');
    const bulkFunctionEnd = itemsJs.indexOf('\n  function updateBulkPricePreview()', bulkFunctionStart);
    const functionMatch = bulkFunctionStart >= 0 && bulkFunctionEnd >= 0
      ? [itemsJs.slice(bulkFunctionStart, bulkFunctionEnd).trim()]
      : null;
    expect(functionMatch).not.toBeNull();
    const pricingFunction = itemsJs.match(/function getOnlinePricing\(costPrice, onlinePrice, marketplaceFee = 0\.395\) \{[\s\S]*?\n  \}/);
    const createProjection = new Function(
      'getOnlinePricing',
      'bulkPriceTarget',
      'bulkPriceMode',
      `${pricingFunction[0]}; ${functionMatch[0]}; return getBulkPriceProjection;`
    );

    const offlineProjection = createProjection(
      new Function(`${pricingFunction[0]}; return getOnlinePricing;`)(),
      'offline',
      'percent'
    )({ cost_price: 10000, sell_price: 15000 }, 0, 40, true);
    expect(offlineProjection).toMatchObject({
      newPrice: 14000,
      newMarkup: 40,
      update: { sell_price: 14000 }
    });

    const onlineProjection = createProjection(
      new Function(`${pricingFunction[0]}; return getOnlinePricing;`)(),
      'online',
      'percent'
    )({ cost_price: 10000, online_sell_price: 12500 }, 0, 32.5, true);
    expect(onlineProjection).toMatchObject({
      newPrice: 21901,
      newMarkup: 32.5,
      update: { online_sell_price: 21901 }
    });

    const nominalProjection = createProjection(
      new Function(`${pricingFunction[0]}; return getOnlinePricing;`)(),
      'online',
      'nominal'
    )({ cost_price: 10000, online_sell_price: 12500 }, 13579, 0, true);
    expect(nominalProjection).toMatchObject({
      newPrice: 13579,
      newMarkup: -17.85,
      update: { online_sell_price: 13579 }
    });
  });

  it('menyertakan foto dan harga online pada ekspor CSV', () => {
    expect(itemsJs).toContain("'ID', 'Foto', 'SKU'");
    expect(itemsJs).toContain("'Harga Jual Offline (Rp)', 'Markup Offline (%)', 'Harga Jual Online (Rp)', 'Markup Online (%)'");
  });

  it('menyiapkan kolom harga online dan mengisi harga lama dengan modal +25%', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS online_sell_price');
    expect(migration).toContain('ROUND(GREATEST(COALESCE(cost_price, 0), 0) * 1.25)');
    expect(migration).toContain('CHECK (online_sell_price >= 0)');
  });
});
