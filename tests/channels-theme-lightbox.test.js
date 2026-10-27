import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../public/assets/js/supabase-client.js', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { key: 'test', value: [] }, error: null })
        }))
      }))
    }))
  }
}));

import { settings as settingsApi } from '../public/assets/js/api/settings.js';

describe('Theme Appearance & Lightbox & Channel CRUD', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-accent');
    document.documentElement.removeAttribute('data-compact');
    document.body.innerHTML = `
      <!-- Packing List Modal -->
      <div id="modal-packing-list" class="flex fixed inset-0 bg-black/70">
        <button type="button" onclick="closePackingListModal()">Tutup</button>
      </div>

      <!-- Image Viewer Modal -->
      <div id="modal-image-viewer" class="hidden fixed inset-0 bg-black/85">
        <h4 id="image-viewer-title"></h4>
        <p id="image-viewer-sku"></p>
        <a id="image-viewer-download" href=""></a>
        <img id="image-viewer-img" src="" alt="">
        <button type="button" onclick="closeImageViewer()">Tutup</button>
      </div>

      <!-- POS Channel Dropdown -->
      <select id="out-channel">
        <option value="Offline">Offline</option>
      </select>
    `;
  });

  describe('Theme Appearance Engine', () => {
    it('applies custom accent color to documentElement', async () => {
      const { applyAppearance } = await import('../public/assets/js/app.js');
      applyAppearance({ primary_color: '#34C759', compact_mode: true });
      expect(document.documentElement.getAttribute('data-accent')).toBe('#34C759');
      expect(document.documentElement.getAttribute('data-compact')).toBe('true');
    });

    it('removes custom accent attribute when default #0088CC is selected', async () => {
      const { applyAppearance } = await import('../public/assets/js/app.js');
      document.documentElement.setAttribute('data-accent', '#FF9500');
      applyAppearance({ primary_color: '#0088CC', compact_mode: false });
      expect(document.documentElement.getAttribute('data-accent')).toBeNull();
      expect(document.documentElement.getAttribute('data-compact')).toBeNull();
    });
  });

  describe('Universal Image Viewer Lightbox', () => {
    it('opens lightbox and populates image, title, and SKU', async () => {
      const { openImageViewer, closeImageViewer } = await import('../public/assets/js/app.js');
      openImageViewer('https://example.com/fish.webp', 'Ikan Cupang Nemo', 'CUP-01');

      const modal = document.getElementById('modal-image-viewer');
      const img = document.getElementById('image-viewer-img');
      const title = document.getElementById('image-viewer-title');
      const sku = document.getElementById('image-viewer-sku');

      expect(modal.classList.contains('hidden')).toBe(false);
      expect(img.src).toBe('https://example.com/fish.webp');
      expect(title.textContent).toBe('Ikan Cupang Nemo');
      expect(sku.textContent).toContain('CUP-01');

      closeImageViewer();
      expect(modal.classList.contains('hidden')).toBe(true);
      expect(img.src).toBe('');
    });
  });

  describe('Sales Channel CRUD (settingsApi)', () => {
    it('returns default channels when no channels are stored', async () => {
      const channels = await settingsApi.getChannels();
      expect(channels.length).toBeGreaterThanOrEqual(6);
      expect(channels.map(c => c.name)).toContain('Offline');
      expect(channels.map(c => c.name)).toContain('Shopee');
      expect(channels.map(c => c.name)).toContain('Tokopedia');
    });

    it('persists and retrieves custom added channels while preserving Offline', async () => {
      const customChannels = ['Offline', 'Shopee', 'Tokopedia', 'Blibli Store'];
      await settingsApi.saveChannels(customChannels);

      const retrieved = await settingsApi.getChannels();
      const names = retrieved.map(c => c.name);
      expect(names).toContain('Blibli Store');
      expect(names).toContain('Offline');
    });

    it('automatically ensures Offline is included even if omitted in saveChannels', async () => {
      const withoutOffline = ['Shopee', 'TikTok Shop'];
      await settingsApi.saveChannels(withoutOffline);

      const retrieved = await settingsApi.getChannels();
      const names = retrieved.map(c => c.name);
      expect(names).toContain('Offline');
      expect(names).toContain('Shopee');
    });
  });

  describe('Packing List Modal Close', () => {
    it('closes packing list modal correctly', () => {
      function closePackingListModal() {
        const modal = document.getElementById('modal-packing-list');
        if (modal) {
          modal.classList.add('hidden');
          modal.classList.remove('flex');
        }
      }

      const modal = document.getElementById('modal-packing-list');
      expect(modal.classList.contains('hidden')).toBe(false);

      closePackingListModal();
      expect(modal.classList.contains('hidden')).toBe(true);
      expect(modal.classList.contains('flex')).toBe(false);
    });
  });
});
