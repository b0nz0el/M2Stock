import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(__dirname, '..');

vi.mock('../public/assets/js/api/_client.js', () => ({
  isSupabaseAvailable: vi.fn(() => true),
  formatResponse: (response) => ({
    ok: Boolean(response.ok),
    data: response.data ?? null,
    error: response.error ?? null,
    meta: response.meta ?? {}
  }),
  handleError: (error) => ({ ok: false, data: null, error }),
  apiRequest: vi.fn(),
  logAudit: vi.fn()
}));

import { items, parseItemImages } from '../public/assets/js/api/items.js';

describe('Product Images Gallery & Multi-Photo Feature', () => {
  describe('parseItemImages helper', () => {
    it('returns empty array for null, undefined, or empty string', () => {
      expect(parseItemImages(null)).toEqual([]);
      expect(parseItemImages(undefined)).toEqual([]);
      expect(parseItemImages('')).toEqual([]);
      expect(parseItemImages('   ')).toEqual([]);
    });

    it('parses single legacy image URL string', () => {
      const url = 'https://supabase.co/storage/v1/object/public/product-images/fish.webp';
      expect(parseItemImages(url)).toEqual([url]);
    });

    it('parses JSON array string of multiple image URLs', () => {
      const urls = [
        'https://supabase.co/storage/v1/object/public/product-images/fish-1.webp',
        'https://supabase.co/storage/v1/object/public/product-images/fish-2.webp',
        'https://supabase.co/storage/v1/object/public/product-images/fish-3.webp'
      ];
      const jsonStr = JSON.stringify(urls);
      expect(parseItemImages(jsonStr)).toEqual(urls);
    });

    it('parses delimiter-separated image URLs (fallback)', () => {
      const raw = 'https://example.com/1.webp ||| https://example.com/2.webp';
      expect(parseItemImages(raw)).toEqual([
        'https://example.com/1.webp',
        'https://example.com/2.webp'
      ]);
    });

    it('respects rawImages array if provided directly', () => {
      const rawImages = ['https://example.com/a.webp', 'https://example.com/b.webp'];
      expect(parseItemImages('https://example.com/legacy.webp', rawImages)).toEqual(rawImages);
    });
  });

  describe('Api.items mapping with multi-image support', () => {
    afterEach(() => {
      delete window.supabase;
    });

    it('maps multiple image URLs in image_url JSON to primary cover URL and images array', async () => {
      const gallery = [
        'https://example.com/cover.webp',
        'https://example.com/side.webp',
        'https://example.com/back.webp'
      ];
      const productRow = {
        id: 'prod-001',
        sku: 'CUP-NEMO-01',
        name: 'Cupang Nemo Galaxy',
        stock: 5,
        min_stock: 2,
        cost_price: 25000,
        sell_price: 50000,
        image_url: JSON.stringify(gallery),
        categories: { name: 'Ikan Hias' },
        units: { name: 'ekor' }
      };

      const select = vi.fn().mockResolvedValue({ data: [productRow], error: null });
      const order = vi.fn(() => ({ select, abortSignal: () => ({ select }) }));
      window.supabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [productRow], error: null }))
          }))
        }))
      };

      const res = await items.getAll();
      expect(res.ok).toBe(true);
      expect(res.data).toHaveLength(1);
      const item = res.data[0];
      // image_url harus string foto utama untuk kompatibilitas ke belakang
      expect(item.image_url).toBe('https://example.com/cover.webp');
      // images berisi array lengkap 3 foto
      expect(item.images).toEqual(gallery);
    });

    it('maps single legacy image_url to both image_url and single-element images array', async () => {
      const legacyUrl = 'https://example.com/legacy-fish.webp';
      const productRow = {
        id: 'prod-002',
        sku: 'PAKAN-01',
        name: 'Pelet Ikan Cupang',
        stock: 10,
        min_stock: 3,
        cost_price: 10000,
        sell_price: 15000,
        image_url: legacyUrl,
        categories: { name: 'Pakan' },
        units: { name: 'pcs' }
      };

      window.supabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [productRow], error: null }))
          }))
        }))
      };

      const res = await items.getAll();
      expect(res.ok).toBe(true);
      const item = res.data[0];
      expect(item.image_url).toBe(legacyUrl);
      expect(item.images).toEqual([legacyUrl]);
    });
  });

  describe('Universal Image Viewer Carousel (Lightbox)', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="modal-image-viewer" class="hidden fixed inset-0">
          <h4 id="image-viewer-title"></h4>
          <p id="image-viewer-sku"></p>
          <span id="image-viewer-counter" class="hidden"></span>
          <a id="image-viewer-download" href=""></a>
          <button type="button" id="btn-viewer-prev" class="hidden"></button>
          <img id="image-viewer-img" src="" alt="">
          <button type="button" id="btn-viewer-next" class="hidden"></button>
          <div id="image-viewer-thumbs" class="hidden"></div>
        </div>
      `;
    });

    it('supports single image mode with hidden carousel controls', async () => {
      const { openImageViewer, closeImageViewer } = await import('../public/assets/js/app.js');
      openImageViewer('https://example.com/single.webp', 'Produk Satuan', 'SAT-01');

      const modal = document.getElementById('modal-image-viewer');
      const img = document.getElementById('image-viewer-img');
      const counter = document.getElementById('image-viewer-counter');
      const prevBtn = document.getElementById('btn-viewer-prev');
      const nextBtn = document.getElementById('btn-viewer-next');

      expect(modal.classList.contains('hidden')).toBe(false);
      expect(img.src).toBe('https://example.com/single.webp');
      expect(counter.classList.contains('hidden')).toBe(true);
      expect(prevBtn.classList.contains('hidden')).toBe(true);
      expect(nextBtn.classList.contains('hidden')).toBe(true);

      closeImageViewer();
      expect(modal.classList.contains('hidden')).toBe(true);
    });

    it('supports multi-image carousel with navigation and counter', async () => {
      const { openImageViewer, navigateImageViewer, setImageViewerIndex, closeImageViewer } = await import('../public/assets/js/app.js');
      const photos = [
        'https://example.com/photo-1.webp',
        'https://example.com/photo-2.webp',
        'https://example.com/photo-3.webp'
      ];

      openImageViewer(photos, 'Aquarium Kaca 60cm', 'AQU-60');

      const modal = document.getElementById('modal-image-viewer');
      const img = document.getElementById('image-viewer-img');
      const counter = document.getElementById('image-viewer-counter');
      const prevBtn = document.getElementById('btn-viewer-prev');
      const nextBtn = document.getElementById('btn-viewer-next');
      const thumbs = document.getElementById('image-viewer-thumbs');

      expect(modal.classList.contains('hidden')).toBe(false);
      expect(img.src).toBe('https://example.com/photo-1.webp');
      expect(counter.textContent).toBe('Foto 1 / 3');
      expect(counter.classList.contains('hidden')).toBe(false);
      expect(prevBtn.classList.contains('hidden')).toBe(false);
      expect(nextBtn.classList.contains('hidden')).toBe(false);
      expect(thumbs.querySelectorAll('button')).toHaveLength(3);

      // Navigasi ke selanjutnya (Next)
      navigateImageViewer(1);
      expect(img.src).toBe('https://example.com/photo-2.webp');
      expect(counter.textContent).toBe('Foto 2 / 3');

      // Navigasi ke selanjutnya lagi (Next)
      navigateImageViewer(1);
      expect(img.src).toBe('https://example.com/photo-3.webp');
      expect(counter.textContent).toBe('Foto 3 / 3');

      // Navigasi Next sirkular kembali ke awal
      navigateImageViewer(1);
      expect(img.src).toBe('https://example.com/photo-1.webp');
      expect(counter.textContent).toBe('Foto 1 / 3');

      // Navigasi Prev ke gambar terakhir
      navigateImageViewer(-1);
      expect(img.src).toBe('https://example.com/photo-3.webp');
      expect(counter.textContent).toBe('Foto 3 / 3');

      // Lompat langsung via index thumbnail
      setImageViewerIndex(1);
      expect(img.src).toBe('https://example.com/photo-2.webp');
      expect(counter.textContent).toBe('Foto 2 / 3');

      closeImageViewer();
      expect(modal.classList.contains('hidden')).toBe(true);
    });
  });

  describe('HTML Dashboard Markup & Ergonomics', () => {
    it('verifies item modal has multi-photo gallery container and multiple attribute on file input', () => {
      const html = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
      expect(html).toContain('id="product-gallery-container"');
      expect(html).toContain('id="photo-count-badge"');
      expect(html).toContain('id="item-image-file" accept="image/*,image/heic" multiple');
      expect(html).toContain('id="item-image-camera" accept="image/*" capture="environment"');
      expect(html).toContain('id="btn-capture-camera"');
      expect(html).toContain('id="btn-pick-photo"');
    });

    it('verifies lightbox modal contains carousel buttons, counter, and thumbnail strip', () => {
      const html = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
      expect(html).toContain('id="btn-viewer-prev"');
      expect(html).toContain('id="btn-viewer-next"');
      expect(html).toContain('id="image-viewer-counter"');
      expect(html).toContain('id="image-viewer-thumbs"');
    });

    it('verifies icons.js includes star icon for primary product photo badge', () => {
      const iconsJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/icons.js'), 'utf8');
      expect(iconsJs).toContain('"star":');
      expect(iconsJs).toContain('12 2 15.09');
    });
  });
});
