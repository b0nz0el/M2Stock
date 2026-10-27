import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const htmlContent = readFileSync(resolve(process.cwd(), 'public/dashboard/index.html'), 'utf8');
const cssContent = readFileSync(resolve(process.cwd(), 'public/assets/css/responsive.css'), 'utf8');
const inScript = readFileSync(resolve(process.cwd(), 'public/dashboard/in.js'), 'utf8');

describe('Barang Masuk New Product Photo & Camera Feature', () => {
  describe('HTML markup & Responsive CSS validation', () => {
    it('contains camera and file photo inputs with gallery in modal-in', () => {
      expect(htmlContent).toContain('id="in-gallery-container"');
      expect(htmlContent).toContain('id="in-photo-count-badge"');
      expect(htmlContent).toContain('id="in-image-camera"');
      expect(htmlContent).toContain('capture="environment"');
      expect(htmlContent).toContain('id="in-image-file"');
      expect(htmlContent).toContain('id="btn-in-capture-camera"');
      expect(htmlContent).toContain('id="btn-in-pick-photo"');
      expect(htmlContent).toContain('id="in-compression-info"');
    });

    it('clarifies initial stock guidance in modal-item to prevent double counting invoice purchases', () => {
      expect(htmlContent).toContain('Stok awal fisik toko. Jika barang ini dari faktur supplier, isi 0 lalu catat di menu Barang Masuk agar tidak terhitung ganda.');
    });

    it('includes responsive utilities in responsive.css to fix duplicate button texts on desktop', () => {
      expect(cssContent).toContain('.sm\\:hidden');
      expect(cssContent).toContain('display: none !important');
      expect(cssContent).toContain('.hidden.sm\\:inline');
    });
  });

  describe('in.js photo gallery management and upload flow', () => {
    let mockCreateItem;
    let mockCreateIn;
    let mockUploadImage;

    beforeEach(() => {
      document.body.innerHTML = `
        <div id="modal-in">
          <form id="form-in">
            <input id="in-product-id" value="">
            <input id="in-product-search" value="">
            <span id="in-product-badge"></span>
            <button id="in-clear-product" class="hidden"></button>
            <div id="in-product-suggestions" class="hidden"></div>
            
            <div id="in-new-product-fields" class="hidden">
              <select id="in-category-id">
                <option value="1">Pakan</option>
              </select>
              <select id="in-unit-id">
                <option value="1">pcs</option>
              </select>
              <input id="in-brand" value="Aquapro">
              <input id="in-sku" value="">
              <input id="in-sell-price" value="35000">

              <span id="in-photo-count-badge">(0/6)</span>
              <div id="in-gallery-container"></div>
              <input type="file" id="in-image-camera">
              <input type="file" id="in-image-file" multiple>
              <div id="in-compression-info" class="hidden">
                <span id="in-compression-info-text"></span>
              </div>
            </div>

            <select id="in-supplier-id">
              <option value="2">Supplier Mitra</option>
            </select>
            <input id="in-qty" value="1">
            <input id="in-price" value="20000">
            <input id="in-barcode" value="">
            <textarea id="in-note"></textarea>
            <span id="in-total-preview"></span>
            <button id="btn-submit-in"><span>Simpan</span></button>
          </form>
        </div>
      `;

      mockCreateItem = vi.fn().mockResolvedValue({
        ok: true,
        data: { id: 99, name: 'Pelet Ikan Super' }
      });
      mockCreateIn = vi.fn().mockResolvedValue({
        ok: true,
        data: { id: 1001, qty: 1 }
      });
      mockUploadImage = vi.fn().mockImplementation(async (blob, path) => ({
        ok: true,
        data: {
          path,
          publicUrl: `https://storage.supabase.co/product-images/${path}`
        }
      }));

      window.Api = {
        items: {
          getAll: vi.fn().mockResolvedValue({ ok: true, data: [] }),
          create: mockCreateItem
        },
        suppliers: {
          getAll: vi.fn().mockResolvedValue({ ok: true, data: [] })
        },
        transactions: {
          createIn: mockCreateIn,
          getAll: vi.fn().mockResolvedValue({ ok: true, data: [] }),
          getByType: vi.fn().mockResolvedValue({ ok: true, data: [], meta: { total: 0 } })
        },
        storage: {
          uploadImage: mockUploadImage
        }
      };

      window.ImageUtils = {
        compressImage: vi.fn().mockImplementation(async (file) => ({
          blob: new Blob(['fake-compressed-image'], { type: 'image/webp' }),
          previewUrl: 'blob:https://aquastock.test/mock-preview-url',
          originalSize: 2000000,
          compressedSize: 450000,
          originalSizeText: '2.0 MB',
          compressedSizeText: '450 KB',
          ratioText: '77%'
        }))
      };

      window.showToast = vi.fn();
      window.eval(inScript);
    });

    afterEach(() => {
      delete window.Api;
      delete window.ImageUtils;
      delete window.showToast;
      document.body.innerHTML = '';
      vi.clearAllMocks();
    });

    it('exports all gallery helper functions on window', () => {
      expect(typeof window.setInPhotoAsPrimary).toBe('function');
      expect(typeof window.removeInPhotoByIndex).toBe('function');
      expect(typeof window.previewInGalleryPhoto).toBe('function');
      expect(typeof window.handleInImageSelection).toBe('function');
      expect(typeof window.resetInImageForm).toBe('function');
    });

    it('processes selected images through ImageUtils and renders thumbnails with badges', async () => {
      window.selectNewProduct('Ikan Cupang Nemo');

      const mockFile1 = new File(['content1'], 'cupang1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['content2'], 'cupang2.png', { type: 'image/png' });

      await window.handleInImageSelection({
        target: { files: [mockFile1, mockFile2], value: '' }
      });

      expect(window.ImageUtils.compressImage).toHaveBeenCalledTimes(2);

      const gallery = document.getElementById('in-gallery-container');
      const badge = document.getElementById('in-photo-count-badge');
      expect(badge.textContent).toBe('(2/6)');
      expect(gallery.querySelectorAll('img').length).toBe(2);

      // Foto pertama harus memiliki label Foto Utama
      expect(gallery.innerHTML).toContain('Foto Utama');
    });

    it('allows changing primary photo and removing photo', async () => {
      window.selectNewProduct('Aquarium Mini');

      const file1 = new File(['1'], 'a.jpg', { type: 'image/jpeg' });
      const file2 = new File(['2'], 'b.jpg', { type: 'image/jpeg' });

      await window.handleInImageSelection({
        target: { files: [file1, file2], value: '' }
      });

      // Jadikan foto ke-2 sebagai foto utama
      window.setInPhotoAsPrimary(1);
      let badge = document.getElementById('in-photo-count-badge');
      expect(badge.textContent).toBe('(2/6)');

      // Hapus foto pertama
      window.removeInPhotoByIndex(0);
      badge = document.getElementById('in-photo-count-badge');
      expect(badge.textContent).toBe('(1/6)');
    });

    it('uploads compressed photos and passes image_url and images array to Api.items.create on submit', async () => {
      window.selectNewProduct('Pelet Ikan Super');

      const file = new File(['dummy'], 'pelet.jpg', { type: 'image/jpeg' });
      await window.handleInImageSelection({
        target: { files: [file], value: '' }
      });

      const form = document.getElementById('form-in');
      const event = new Event('submit', { cancelable: true });
      await window.handleInSubmit(event);

      // Memastikan upload foto terpanggil
      expect(mockUploadImage).toHaveBeenCalledTimes(1);

      // Memastikan Api.items.create menerima stock 0 (agar saat createIn qty 1 ditambahkan, stok menjadi 1 dan bukan 2!)
      expect(mockCreateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Pelet Ikan Super',
          stock: 0,
          cost_price: 20000,
          sell_price: 35000,
          image_url: expect.stringContaining('https://storage.supabase.co/product-images/'),
          images: expect.arrayContaining([expect.stringContaining('https://storage.supabase.co/product-images/')])
        })
      );

      // Memastikan transaksi masuk dibuat dengan qty 1
      expect(mockCreateIn).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 99,
          qty: 1,
          price: 20000
        })
      );

      // Memastikan foto di-reset setelah submit
      const badgeAfter = document.getElementById('in-photo-count-badge');
      expect(badgeAfter.textContent).toBe('(0/6)');
    });
  });
});
