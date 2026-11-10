import { describe, expect, it } from 'vitest';
import {
  MARKETPLACE_LINK_CSV_HEADERS,
  normalizeImportedChannelUrl,
  prepareMarketplaceLinkImport
} from '../public/assets/js/utils/marketplace-link-import.js';

describe('M2Stock marketplace link CSV import', () => {
  it('uses the Habitic export headers and accepts its channel URL domains', () => {
    expect(MARKETPLACE_LINK_CSV_HEADERS).toEqual([
      'SKU',
      'Nama Produk',
      'Shopee URL',
      'Tokopedia URL',
      'Lazada URL',
      'TikTok URL',
      'WhatsApp URL'
    ]);
    expect(normalizeImportedChannelUrl('TikTok Shop', 'https://shop-id.tokopedia.com/view/product/1')).toBe('https://shop-id.tokopedia.com/view/product/1');
    expect(normalizeImportedChannelUrl('Shopee', 'https://evil.example/shopee.co.id')).toBeNull();
    expect(normalizeImportedChannelUrl('Tokopedia', 'http://tokopedia.com/item')).toBeNull();
  });

  it('merges non-empty channel links by SKU while preserving existing links and other fields', () => {
    const { rows, errors } = prepareMarketplaceLinkImport([{
      SKU: ' sku-1 ',
      'Shopee URL': 'https://shopee.co.id/product/1',
      'Tokopedia URL': '',
      'Lazada URL': '',
      'TikTok URL': 'https://shop-id.tokopedia.com/view/product/1',
      'WhatsApp URL': ''
    }], [{
      id: 8,
      sku: 'SKU-1',
      name: 'Produk lama',
      channel: 'Tokopedia',
      channel_link: 'https://tokopedia.com/produk',
      channels: [{ channel: 'Tokopedia', link: 'https://tokopedia.com/produk' }]
    }]);

    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 8,
      sku: 'SKU-1',
      channel: 'Tokopedia'
    });
    expect(rows[0].channels).toEqual([
      { channel: 'Tokopedia', link: 'https://tokopedia.com/produk' },
      { channel: 'Shopee', link: 'https://shopee.co.id/product/1' },
      { channel: 'TikTok Shop', link: 'https://shop-id.tokopedia.com/view/product/1' }
    ]);
    expect(JSON.parse(rows[0].channel_link)).toEqual(rows[0].channels);
  });

  it('rejects duplicate, missing, ambiguous, unmatched SKUs and invalid URLs', () => {
    const products = [
      { id: 1, sku: 'SKU-1', channel: 'Offline', channel_link: '' },
      { id: 2, sku: 'SKU-DUP', channel: 'Offline', channel_link: '' },
      { id: 3, sku: 'SKU-DUP', channel: 'Offline', channel_link: '' }
    ];
    const { rows, errors, skipped } = prepareMarketplaceLinkImport([
      { SKU: 'SKU-1', 'Shopee URL': 'https://shopee.co.id/product/1' },
      { SKU: 'sku-1', 'Tokopedia URL': 'https://tokopedia.com/item' },
      { SKU: 'SKU-MISSING', 'Shopee URL': 'https://shopee.co.id/product/2' },
      { SKU: 'SKU-DUP', 'Lazada URL': 'https://lazada.co.id/products/1' },
      { SKU: 'SKU-1', 'Shopee URL': 'https://evil.example/' },
      { SKU: '', 'Shopee URL': 'https://shopee.co.id/product/3' }
    ], products);

    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(4);
    expect(errors.map(error => error.message).join(' ')).toMatch(/duplikat|lebih dari sekali|domainnya tidak sesuai|SKU wajib/i);
    expect(skipped).toEqual([{ row: 4, sku: 'SKU-MISSING', message: 'SKU "SKU-MISSING" tidak ditemukan di M2Stock.' }]);
  });

  it('requires at least one URL and treats blank channel cells as keep-existing', () => {
    const { rows, errors } = prepareMarketplaceLinkImport([{
      SKU: 'SKU-1',
      'Shopee URL': '',
      'Tokopedia URL': '',
      'Lazada URL': '',
      'TikTok URL': '',
      'WhatsApp URL': ''
    }], [{ id: 1, sku: 'SKU-1', channel: 'Shopee', channel_link: 'https://shopee.co.id/existing' }]);

    expect(rows).toEqual([]);
    expect(errors).toEqual([{
      row: 2,
      message: 'Isi minimal satu URL channel. Kolom URL kosong mempertahankan link yang sudah tersimpan.'
    }]);
  });
});
