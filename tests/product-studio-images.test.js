import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  OFFICIAL_PRODUCT_CATALOG,
  resolveProductStudioImage,
  getProductStudioImageMeta,
  HABITIC_STUDIO_CDN_BASE,
  HABITIC_STUDIO_LOCAL_BASE
} from '../public/assets/js/product-catalog-images.js';

describe('Official Habitic Studio Product Images Integration', () => {
  it('contains exactly 64 master products in catalog', () => {
    expect(OFFICIAL_PRODUCT_CATALOG).toBeDefined();
    expect(OFFICIAL_PRODUCT_CATALOG.length).toBe(64);
  });

  it('verifies all 64 image files physically exist in public/assets/images/products/', () => {
    const productsDir = path.resolve(__dirname, '../public/assets/images/products');
    expect(fs.existsSync(productsDir)).toBe(true);

    OFFICIAL_PRODUCT_CATALOG.forEach((item) => {
      const filePath = path.join(productsDir, item.filename);
      expect(fs.existsSync(filePath), `File harus ada: ${item.filename}`).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(1000); // Bukan file kosong
    });
  });

  it('resolves product studio images by SKU', () => {
    expect(resolveProductStudioImage({ sku: 'POM-AMA-034' }))
      .toBe('/assets/images/products/habitic-amara-am-1200a-perlengkapan-akuarium-original.webp');

    expect(resolveProductStudioImage({ sku: 'POM-AMA-035' }))
      .toBe('/assets/images/products/habitic-amara-am-1600a-perlengkapan-akuarium-original.webp');

    expect(resolveProductStudioImage({ sku: 'POM-AMA-036' }))
      .toBe('/assets/images/products/habitic-amara-am-1800a-perlengkapan-akuarium-original.webp');

    expect(resolveProductStudioImage({ sku: 'POM-AMA-037' }))
      .toBe('/assets/images/products/habitic-amara-am-2600a-perlengkapan-akuarium-original.webp');

    expect(resolveProductStudioImage({ sku: 'FIL-AMA-335' }))
      .toBe('/assets/images/products/habitic-amara-aquarium-filter-cotton-8d-12x30cm-2pcs-perlengkapan-akuarium-original.webp');

    expect(resolveProductStudioImage({ sku: 'FIL-AMA-310' }))
      .toBe('/assets/images/products/habitic-amara-aquarium-filter-cotton-8d-30x40cm-2pcs-perlengkapan-akuarium-original.webp');
  });

  it('supports legacy SKU aliases seamlessly', () => {
    expect(resolveProductStudioImage({ sku: 'POM-AMA-024' }))
      .toBe('/assets/images/products/habitic-amara-aa-222-ac-220-240-3w-perlengkapan-akuarium-original.webp');

    expect(resolveProductStudioImage({ sku: 'POM-AMA-025' }))
      .toBe('/assets/images/products/habitic-amara-q-6-air-pump-aquarium-240v-perlengkapan-akuarium-original.webp');

    expect(resolveProductStudioImage({ sku: 'FIL-AMA-386' }))
      .toBe('/assets/images/products/habitic-amara-aquarium-spong-filter-aa-833-perlengkapan-akuarium-original.webp');
  });

  it('supports preferCdn option for edge delivery', () => {
    const cdnUrl = resolveProductStudioImage({ sku: 'POM-AMA-034' }, { preferCdn: true });
    expect(cdnUrl).toBe('https://habitic.pages.dev/assets/images/products/habitic-amara-am-1200a-perlengkapan-akuarium-original.webp');
  });

  it('returns comprehensive metadata via getProductStudioImageMeta', () => {
    const meta = getProductStudioImageMeta({ sku: 'POM-AMA-034' });
    expect(meta).not.toBeNull();
    expect(meta.local).toContain('habitic-amara-am-1200a');
    expect(meta.cdn).toContain('https://habitic.pages.dev');
    expect(meta.sku).toBe('POM-AMA-034');
    expect(meta.title).toContain('Amara AM-1200A');
  });

  it('preserves non-catalog custom images when SKU is not in Habitic', () => {
    const customItem = {
      sku: 'CUSTOM-SKU-999',
      name: 'Ikan Koi Khusus',
      image_url: 'https://cdn.aquastock.pro/custom-koi.jpg'
    };
    expect(resolveProductStudioImage(customItem)).toBeNull();
  });
});
