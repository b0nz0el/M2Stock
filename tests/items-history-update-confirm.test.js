import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const htmlContent = readFileSync(resolve(process.cwd(), 'public/dashboard/index.html'), 'utf8');
const itemsScript = readFileSync(resolve(process.cwd(), 'public/dashboard/items.js'), 'utf8');

const sampleItem = {
  id: 10,
  sku: 'PLT-010',
  barcode: '8991234567890',
  name: 'Pelet Ikan Super Grow',
  brand: 'AquaGrow',
  category_id: 1,
  unit_id: 1,
  supplier_id: 5,
  cost_price: 25000,
  sell_price: 35000,
  online_sell_price: 37500,
  stock: 15,
  min_stock: 3,
  channel: 'Offline',
  channel_link: '',
  channels: [{ channel: 'Offline', link: '' }],
  images: []
};

describe('Master Barang — Izin Notifikasi Koreksi Riwayat Barang Masuk', () => {
  describe('HTML Markup & Accessibility Modal Konfirmasi', () => {
    it('memiliki elemen modal #modal-confirm-history-update dengan dialog ARIA', () => {
      expect(htmlContent).toContain('id="modal-confirm-history-update"');
      expect(htmlContent).toContain('role="dialog"');
      expect(htmlContent).toContain('aria-modal="true"');
      expect(htmlContent).toContain('aria-labelledby="modal-history-title"');
    });

    it('memiliki tombol konfirmasi riwayat, master saja, dan batal', () => {
      expect(htmlContent).toContain('id="btn-confirm-update-history"');
      expect(htmlContent).toContain('id="btn-confirm-update-master-only"');
      expect(htmlContent).toContain('id="btn-close-confirm-history"');
      expect(htmlContent).toContain('confirmHistoryUpdate(true)');
      expect(htmlContent).toContain('confirmHistoryUpdate(false)');
      expect(htmlContent).toContain('closeConfirmHistoryModal()');
    });

    it('memuat teks petunjuk izin notifikasi pada input supplier Master Barang', () => {
      expect(htmlContent).toContain('Riwayat transaksi lama diubah atas izin notifikasi saat update.');
    });
  });

  describe('Alur Interaksi items.js & Konfirmasi Riwayat', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="modal-item" class="hidden">
          <h3 id="modal-item-title"></h3>
          <form id="form-item">
            <input type="hidden" id="item-id" value="">
            <input id="item-sku" value="">
            <input id="item-barcode" value="">
            <input id="item-name" value="">
            <input id="item-brand" value="">
            <select id="item-category">
              <option value="1">Pakan</option>
            </select>
            <select id="item-unit">
              <option value="1">pcs</option>
            </select>
            <input id="item-stock" value="0">
            <span id="item-stock-label"></span>
            <p id="item-stock-help"></p>
            <section id="item-stock-adjustment-action" class="hidden"></section>
            <div id="item-supplier-wrap">
              <select id="item-supplier-id">
                <option value="">Umum / Tanpa Supplier</option>
                <option value="5" selected>PT Aqua Prima</option>
                <option value="8">CV Mina Jaya</option>
              </select>
            </div>
            <div id="item-stock-warning-banner" class="hidden"></div>
            <input id="item-cost-price" value="25000">
            <input id="item-sell-price" value="35000">
            <input id="item-online-sell-price" value="">
            <input id="item-min-stock" value="3">
            <select id="item-channel"><option value="Offline">Offline</option></select>
            <input id="item-channel-link" value="">
            <div id="item-channels-list"></div>
            <div id="product-photo-gallery"></div>
            <button id="btn-submit-item"><span>Simpan Produk</span></button>
          </form>
        </div>

        <div id="modal-confirm-history-update" class="hidden">
          <div class="modal-card">
            <button id="btn-close-confirm-history" onclick="closeConfirmHistoryModal()"></button>
            <button id="btn-confirm-update-history" onclick="confirmHistoryUpdate(true)"></button>
            <button id="btn-confirm-update-master-only" onclick="confirmHistoryUpdate(false)"></button>
          </div>
        </div>

        <table id="items-table"><tbody id="items-tbody"></tbody></table>
      `;

      window.Api = {
        items: {
          getAll: vi.fn().mockResolvedValue({ ok: true, data: [{ ...sampleItem }] }),
          getById: vi.fn().mockResolvedValue({ ok: true, data: { ...sampleItem } }),
          create: vi.fn().mockResolvedValue({ ok: true, data: { id: 101 } }),
          update: vi.fn().mockResolvedValue({ ok: true, data: [{ ...sampleItem }] })
        },
        transactions: {
          updateHistoryInByProduct: vi.fn().mockResolvedValue({
            ok: true,
            data: { updatedCount: 3, transactions: [{ id: 1 }, { id: 2 }, { id: 3 }] }
          })
        },
        suppliers: {
          getAll: vi.fn().mockResolvedValue({ ok: true, data: [{ id: 5, name: 'PT Aqua Prima' }, { id: 8, name: 'CV Mina Jaya' }] })
        },
        storage: {
          uploadImage: vi.fn().mockResolvedValue({ ok: true, data: { publicUrl: 'https://example.com/foto.webp' } })
        }
      };

      window.showToast = vi.fn();
      window.refreshIcons = vi.fn();
      window.eval(itemsScript);
    });

    afterEach(() => {
      delete window.Api;
      delete window.showToast;
      delete window.refreshIcons;
      document.body.innerHTML = '';
      vi.clearAllMocks();
    });

    async function openEditAndWait(id) {
      window.openEditItemModal(id);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    it('Membuka modal konfirmasi riwayat ketika harga beli (cost_price) diubah pada produk yang diedit', async () => {
      await window.loadItemsFromBackend();
      await openEditAndWait(10);

      const costInput = document.getElementById('item-cost-price');
      costInput.value = '32000'; // Ubah dari 25.000 ke 32.000

      const submitEvent = new Event('submit', { cancelable: true });
      await window.handleItemSubmit(submitEvent);

      const confirmModal = document.getElementById('modal-confirm-history-update');
      expect(confirmModal.classList.contains('hidden')).toBe(false);
      expect(confirmModal.classList.contains('flex')).toBe(true);

      // Pastikan belum disimpan ke database sebelum ada izin/keputusan pengguna
      expect(window.Api.items.update).not.toHaveBeenCalled();
      expect(window.Api.transactions.updateHistoryInByProduct).not.toHaveBeenCalled();
    });

    it('Membuka modal konfirmasi riwayat ketika supplier_id diubah pada produk yang diedit', async () => {
      await window.loadItemsFromBackend();
      await openEditAndWait(10);

      const supSelect = document.getElementById('item-supplier-id');
      supSelect.value = '8'; // Ubah dari 5 ke 8

      const submitEvent = new Event('submit', { cancelable: true });
      await window.handleItemSubmit(submitEvent);

      const confirmModal = document.getElementById('modal-confirm-history-update');
      expect(confirmModal.classList.contains('hidden')).toBe(false);

      expect(window.Api.items.update).not.toHaveBeenCalled();
      expect(window.Api.transactions.updateHistoryInByProduct).not.toHaveBeenCalled();
    });

    it('PILIHAN A (Atas Izin Notifikasi): confirmHistoryUpdate(true) mengupdate Master DAN riwayat transaksi lama', async () => {
      await window.loadItemsFromBackend();
      await openEditAndWait(10);

      document.getElementById('item-cost-price').value = '30000';
      document.getElementById('item-supplier-id').value = '8';

      const submitEvent = new Event('submit', { cancelable: true });
      await window.handleItemSubmit(submitEvent);

      // Pengguna memilih "Ya, Perbarui Master & Riwayat Lama"
      await window.confirmHistoryUpdate(true);

      // 1. Master Barang diperbarui
      expect(window.Api.items.update).toHaveBeenCalledWith(
        '10',
        expect.objectContaining({
          cost_price: 30000,
          supplier_id: 8
        })
      );

      // 2. Riwayat transaksi Barang Masuk lama dikoreksi
      expect(window.Api.transactions.updateHistoryInByProduct).toHaveBeenCalledWith(
        '10',
        {
          cost_price: 30000,
          supplier_id: 8
        }
      );

      // 3. Modal tertutup dan notifikasi berhasil ditampilkan
      const confirmModal = document.getElementById('modal-confirm-history-update');
      expect(confirmModal.classList.contains('hidden')).toBe(true);
      expect(window.showToast).toHaveBeenCalledWith(
        expect.stringContaining('3 riwayat Barang Masuk berhasil dikoreksi'),
        'success'
      );
    });

    it('PILIHAN B (Hanya Master): confirmHistoryUpdate(false) HANYA mengupdate Master tanpa menyentuh riwayat lama', async () => {
      await window.loadItemsFromBackend();
      await openEditAndWait(10);

      document.getElementById('item-cost-price').value = '30000';

      const submitEvent = new Event('submit', { cancelable: true });
      await window.handleItemSubmit(submitEvent);

      // Pengguna memilih "Hanya Perbarui Master Barang"
      await window.confirmHistoryUpdate(false);

      // 1. Master Barang diperbarui
      expect(window.Api.items.update).toHaveBeenCalledWith(
        '10',
        expect.objectContaining({
          cost_price: 30000
        })
      );

      // 2. Riwayat transaksi Barang Masuk lama TIDAK disentuh
      expect(window.Api.transactions.updateHistoryInByProduct).not.toHaveBeenCalled();

      // 3. Modal tertutup dan notifikasi menjelaskan riwayat dipertahankan
      const confirmModal = document.getElementById('modal-confirm-history-update');
      expect(confirmModal.classList.contains('hidden')).toBe(true);
      expect(window.showToast).toHaveBeenCalledWith(
        'Produk berhasil diperbarui (riwayat lama dipertahankan)',
        'success'
      );
    });

    it('Menutup dialog modal konfirmasi (Batal) membatalkan aksi simpan tanpa memanggil API', async () => {
      await window.loadItemsFromBackend();
      await openEditAndWait(10);

      document.getElementById('item-cost-price').value = '35000';
      await window.handleItemSubmit(new Event('submit', { cancelable: true }));

      const confirmModal = document.getElementById('modal-confirm-history-update');
      expect(confirmModal.classList.contains('hidden')).toBe(false);

      // Pengguna menekan tombol Batal
      window.closeConfirmHistoryModal();

      expect(confirmModal.classList.contains('hidden')).toBe(true);
      expect(window.Api.items.update).not.toHaveBeenCalled();
      expect(window.Api.transactions.updateHistoryInByProduct).not.toHaveBeenCalled();
    });

    it('Jika cost_price dan supplier_id TIDAK berubah, langsung simpan Master Barang tanpa membuka modal konfirmasi', async () => {
      await window.loadItemsFromBackend();
      await openEditAndWait(10);

      // Pengguna hanya mengganti nama barang dan harga jual
      document.getElementById('item-name').value = 'Pelet Ikan Super Grow - New Formula';
      document.getElementById('item-sell-price').value = '40000';
      // cost_price tetap 25000 dan supplier tetap 5

      const submitEvent = new Event('submit', { cancelable: true });
      await window.handleItemSubmit(submitEvent);

      const confirmModal = document.getElementById('modal-confirm-history-update');
      // Modal konfirmasi tidak boleh terbuka
      expect(confirmModal.classList.contains('hidden')).toBe(true);

      // Langsung memanggil update Master Barang
      expect(window.Api.items.update).toHaveBeenCalledWith(
        '10',
        expect.objectContaining({
          name: 'Pelet Ikan Super Grow - New Formula',
          sell_price: 40000,
          online_sell_price: 37500,
          cost_price: 25000,
          supplier_id: 5
        })
      );
      expect(window.Api.transactions.updateHistoryInByProduct).not.toHaveBeenCalled();
    });

    it('menyimpan harga jual offline dan online dari field edit barang', async () => {
      await window.loadItemsFromBackend();
      await openEditAndWait(10);

      document.getElementById('item-sell-price').value = '41000';
      document.getElementById('item-online-sell-price').value = '52000';

      await window.handleItemSubmit(new Event('submit', { cancelable: true }));

      expect(window.Api.items.update).toHaveBeenCalledWith(
        '10',
        expect.objectContaining({
          sell_price: 41000,
          online_sell_price: 52000
        })
      );
    });
  });
});
