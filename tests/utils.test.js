import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseIndonesianNumber,
  detectMultiplier,
  animateNumber,
  showToast,
  focusProgrammatically,
  exportToCSV,
  generateSKU,
  escapeHtml,
  showConfirmDialog
} from '../public/assets/js/utils.js';
import '../public/assets/js/icons.js';

describe('utils.js', () => {
  describe('parseIndonesianNumber', () => {
    it('mengubah string angka rupiah ribuan menjadi angka integer murni', () => {
      expect(parseIndonesianNumber('Rp 325.000')).toBe(325000);
      expect(parseIndonesianNumber('1.500.000')).toBe(1500000);
      expect(parseIndonesianNumber('10')).toBe(10);
      expect(parseIndonesianNumber('Rp 0')).toBe(0);
    });

    it('mengembalikan 0 jika teks tidak memiliki angka', () => {
      expect(parseIndonesianNumber('tidak ada angka')).toBe(0);
      expect(parseIndonesianNumber('')).toBe(0);
    });

    it('mengembalikan 0 untuk input non-string atau null/undefined', () => {
      expect(parseIndonesianNumber(null)).toBe(0);
      expect(parseIndonesianNumber(undefined)).toBe(0);
      expect(parseIndonesianNumber(12345)).toBe(0);
    });
  });

  describe('detectMultiplier', () => {
    it('mendeteksi kelipatan juta (jt / juta)', () => {
      expect(detectMultiplier('1.5 jt')).toBe(1000000);
      expect(detectMultiplier('2 Juta')).toBe(1000000);
      expect(detectMultiplier('100JT')).toBe(1000000);
    });

    it('mendeteksi kelipatan ribu (rb / ribu)', () => {
      expect(detectMultiplier('450 rb')).toBe(1000);
      expect(detectMultiplier('50 Ribu')).toBe(1000);
      expect(detectMultiplier('10RB')).toBe(1000);
    });

    it('mengembalikan 1 jika tidak ada suffix kelipatan', () => {
      expect(detectMultiplier('500')).toBe(1);
      expect(detectMultiplier('barang')).toBe(1);
      expect(detectMultiplier('')).toBe(1);
    });

    it('mengembalikan 1 jika input null / undefined / bukan string', () => {
      expect(detectMultiplier(null)).toBe(1);
      expect(detectMultiplier(undefined)).toBe(1);
      expect(detectMultiplier(100)).toBe(1);
    });
  });

  describe('animateNumber', () => {
    let el;
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
      el = document.createElement('div');
      document.body.appendChild(el);
      vi.restoreAllMocks();
      delete global.prefersReducedMotion;
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));
    });

    afterEach(() => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      delete global.prefersReducedMotion;
      window.matchMedia = originalMatchMedia;
    });

    it('kembali tanpa error jika elemen null/undefined', () => {
      expect(() => animateNumber(null, 100)).not.toThrow();
    });

    it('langsung menampilkan angka final jika prefers-reduced-motion aktif', () => {
      global.prefersReducedMotion = true;
      animateNumber(el, 1500, 1000, 'Rp ', ' total');
      expect(el.textContent).toBe('Rp 1.500 total');
    });

    it('menggunakan fallback window.matchMedia jika prefersReducedMotion global belum ada', () => {
      delete global.prefersReducedMotion;
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      animateNumber(el, 2000, 1000, 'Rp ', '');
      expect(el.textContent).toBe('Rp 2.000');
    });

    it('menjalankan animasi bertahap melalui requestAnimationFrame jika reduced-motion nonaktif', () => {
      global.prefersReducedMotion = false;
      let rAFCallback = null;
      const rAFMock = vi.fn((cb) => {
        rAFCallback = cb;
        return 1;
      });
      vi.stubGlobal('requestAnimationFrame', rAFMock);

      let mockNow = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => mockNow);

      animateNumber(el, 1000, 1000, 'Rp ', ' unit');

      expect(rAFCallback).toBeTypeOf('function');
      // Panggilan tick (50% progress)
      mockNow = 1500;
      rAFCallback(mockNow);
      expect(el.textContent).toContain('Rp ');
      expect(el.textContent).toContain('unit');

      // Panggilan tick berikutnya (100% progress / selesai)
      mockNow = 2100;
      rAFCallback(mockNow);
      expect(el.textContent).toBe('Rp 1.000 unit');

      vi.unstubAllGlobals();
    });
  });

  describe('showToast', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      document.body.innerHTML = '<div id="toast-container"></div>';
    });

    afterEach(() => {
      vi.useRealTimers();
      document.body.innerHTML = '';
    });

    it('membuat toast success yang ringkas dengan ikon dan pesan', () => {
      showToast('Data berhasil disimpan', 'success');

      const container = document.getElementById('toast-container');
      const toast = container.querySelector('.toast');
      expect(toast).not.toBeNull();
      expect(toast.getAttribute('role')).toBe('status');
      expect(toast.getAttribute('aria-live')).toBe('polite');
      expect(toast.textContent).toContain('Data berhasil disimpan');

      expect(toast.classList.contains('toast--success')).toBe(true);
      expect(toast.querySelector('.toast__icon [data-lucide="check"]')).not.toBeNull();
      expect(toast.querySelector('.toast__message').textContent).toBe('Data berhasil disimpan');
      expect(toast.querySelector('.toast__close').getAttribute('aria-label')).toBe('Tutup notifikasi');
      expect(toast.querySelector('.toast__icon + .toast__message')).not.toBeNull();
      expect(toast.querySelector('[style*="background"]')).toBeNull();
    });

    it('mencegah serangan XSS dengan merender teks secara aman (bukan elemen HTML)', () => {
      const maliciousPayload = '<img src=x onerror=alert(1)>';
      showToast(maliciousPayload, 'error');

      const toast = document.querySelector('.toast');
      expect(toast).not.toBeNull();
      // Pastikan elemen img tidak dibuat di DOM sama sekali
      expect(toast.querySelector('img')).toBeNull();
      // Pastikan teks mentah dirender sebagai string aman
      expect(toast.textContent).toContain(maliciousPayload);
    });

    it('mendukung tipe error, info, dan default fallback', () => {
      showToast('Terjadi kesalahan', 'error');
      showToast('Informasi sistem', 'info');
      showToast('Tipe tak dikenal', 'unknown');

      const toasts = document.querySelectorAll('.toast');
      expect(toasts.length).toBe(3);

      expect(toasts[0].classList.contains('toast--error')).toBe(true);
      expect(toasts[0].getAttribute('role')).toBe('alert');
      expect(toasts[1].classList.contains('toast--info')).toBe(true);
      expect(toasts[2].classList.contains('toast--info')).toBe(true);
    });

    it('otomatis fallback ke document.body jika #toast-container tidak ditemukan', () => {
      document.body.innerHTML = ''; // Hapus container
      showToast('Toast tanpa container', 'info');

      const toast = document.body.querySelector('.toast');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toContain('Toast tanpa container');
    });

    it('melakukan fade out setelah 3 detik dan menghapus elemen dari DOM setelah animasi', () => {
      showToast('Auto dismiss toast', 'success');
      const toast = document.querySelector('.toast');
      expect(toast).not.toBeNull();

      // Maju 3000ms
      vi.advanceTimersByTime(3000);
      expect(toast.classList.contains('toast--leaving')).toBe(true);

      // Maju 300ms lagi (total 3300ms) untuk remove
      vi.advanceTimersByTime(300);
      expect(document.querySelector('.toast')).toBeNull();
    });

    it('menutup toast saat tombol tutup ditekan', () => {
      showToast('Dapat ditutup', 'info');
      document.querySelector('.toast__close').click();
      expect(document.querySelector('.toast')).toBeNull();
    });
  });

  describe('focusProgrammatically', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('men-set atribut data-programmatic-focus="true" dan memfokuskan elemen', () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const btn = document.getElementById('btn');

      focusProgrammatically(btn);

      expect(btn.getAttribute('data-programmatic-focus')).toBe('true');
      expect(document.activeElement).toBe(btn);
    });

    it('mempertahankan atribut sebelum blur dan menghapusnya saat event blur terjadi', () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const btn = document.getElementById('btn');

      focusProgrammatically(btn);
      // Atribut tetap ada sebelum blur
      expect(btn.getAttribute('data-programmatic-focus')).toBe('true');

      // Trigger blur
      btn.dispatchEvent(new Event('blur'));
      // Atribut dihapus setelah blur
      expect(btn.getAttribute('data-programmatic-focus')).toBeNull();
    });

    it('tidak melempar error jika elemen bernilai null atau tidak memiliki method focus', () => {
      expect(() => focusProgrammatically(null)).not.toThrow();
      expect(() => focusProgrammatically({})).not.toThrow();
      expect(() => focusProgrammatically(undefined)).not.toThrow();
    });
  });

  describe('exportToCSV', () => {
    beforeEach(() => {
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-uuid');
      global.URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('menghasilkan CSV string dengan UTF-8 BOM, headers, dan rows yang diformat dengan benar', () => {
      const headers = ['Kode', 'Nama', 'Harga'];
      const rows = [
        ['BRG001', 'Pelet Ikan', 25000],
        ['BRG002', 'Filter Pompa', 75000]
      ];

      const csv = exportToCSV('test.csv', rows, headers);

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('"Kode","Nama","Harga"');
      expect(csv).toContain('"BRG001","Pelet Ikan","25000"');
      expect(csv).toContain('"BRG002","Filter Pompa","75000"');
    });

    it('melakukan escaping dengan tanda kutip untuk sel yang mengandung koma atau tanda kutip ganda', () => {
      const headers = ['Nama', 'Deskripsi'];
      const rows = [
        ['Pakan "Super", Premium', 'Cocok untuk ikan hias\nUkuran sedang']
      ];

      const csv = exportToCSV('escape.csv', rows, headers);

      expect(csv).toContain('"Pakan ""Super"", Premium"');
      expect(csv).toContain('"Cocok untuk ikan hias\nUkuran sedang"');
    });

    it('membuat tag <a> dan memicu link.click() untuk mengunduh file', () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');
      const headers = ['ID', 'Nama'];
      const rows = [['1', 'Supplier A']];

      exportToCSV('supplier.csv', rows, headers);

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/test-uuid');
    });

    it('mengizinkan template CSV tanpa data tetapi tetap menolak ekspor kosong biasa', () => {
      const headers = ['SKU', 'Nama Barang'];
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

      expect(exportToCSV('empty.csv', [], headers)).toBeNull();
      const template = exportToCSV('template.csv', [], headers, { allowEmpty: true });

      expect(template).toBe('\uFEFF"SKU","Nama Barang"');
      expect(clickSpy).toHaveBeenCalledOnce();
    });
  });

  describe('generateSKU', () => {
    it('menghasilkan SKU sesuai rumus kategori(3)-brand(3)-urutan(3)', () => {
      expect(generateSKU('Pakan', 'Lokal', 0)).toBe('PAK-LOK-001');
      expect(generateSKU('Pakan', 'Berlian', 3)).toBe('PAK-BER-004');
      expect(generateSKU('Vitamin', 'Lokal', 5)).toBe('VIT-LOK-006');
      expect(generateSKU('Obat', 'Lokal', 11)).toBe('OBA-LOK-012');
      expect(generateSKU('Filtrasi', 'Amara', 19)).toBe('FIL-AMA-020');
      expect(generateSKU('Pompa', 'Kandila', 43)).toBe('POM-KAN-044');
      expect(generateSKU('Pompa', 'Kandila', 46)).toBe('POM-KAN-047');
    });

    it('menangani input string idTerakhir atau string SKU sebelumnya', () => {
      expect(generateSKU('Pakan', 'Lokal', '46')).toBe('PAK-LOK-047');
      expect(generateSKU('Pompa', 'JIX', 'POM-JIX-038')).toBe('POM-JIX-039');
    });

    it('menggunakan fallback default UMU dan LOK jika kategori atau brand kosong', () => {
      expect(generateSKU('', '', 0)).toBe('UMU-LOK-001');
      expect(generateSKU(null, null, 10)).toBe('UMU-LOK-011');
      expect(generateSKU(undefined, undefined, undefined)).toBe('UMU-LOK-001');
    });

    it('melakukan padding X untuk kode kategori atau brand yang kurang dari 3 karakter', () => {
      expect(generateSKU('AA', 'B', 1)).toBe('AAX-BXX-002');
    });
  });

  describe('escapeHtml', () => {
    it('meng-escape karakter khusus HTML (&, <, >, ", \')', () => {
      const input = '<script>alert("xss & fun\'s")</script>';
      expect(escapeHtml(input)).toBe('&lt;script&gt;alert(&quot;xss &amp; fun&#39;s&quot;)&lt;/script&gt;');
    });

    it('mengembalikan string kosong jika input null atau undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('showConfirmDialog', () => {
    afterEach(() => {
      const dialog = document.getElementById('aquastock-confirm-dialog');
      if (dialog) dialog.remove();
    });

    it('merender dialog modal di DOM dengan teks dan tombol yang sesuai', () => {
      const promise = showConfirmDialog({
        title: 'Konfirmasi Hapus',
        message: 'Apakah yakin ingin menghapus data ini?',
        confirmText: 'Ya, Hapus',
        cancelText: 'Batalkan',
        type: 'danger'
      });

      const dialog = document.getElementById('aquastock-confirm-dialog');
      expect(dialog).not.toBeNull();
      expect(dialog.querySelector('#confirm-dialog-title').textContent).toBe('Konfirmasi Hapus');
      expect(dialog.querySelector('#confirm-dialog-message').textContent).toBe('Apakah yakin ingin menghapus data ini?');
      expect(dialog.querySelector('#confirm-dialog-btn-confirm').textContent.trim()).toBe('Ya, Hapus');
      expect(dialog.querySelector('#confirm-dialog-btn-cancel').textContent.trim()).toBe('Batalkan');

      // Bersihkan dengan klik cancel
      dialog.querySelector('#confirm-dialog-btn-cancel').click();
      return promise.then(result => {
        expect(result).toBe(false);
        expect(document.getElementById('aquastock-confirm-dialog')).toBeNull();
      });
    });

    it('mengembalikan true dan membersihkan DOM saat tombol konfirmasi diklik', async () => {
      const promise = showConfirmDialog({
        title: 'Lanjutkan',
        message: 'Proses data sekarang?'
      });

      const confirmBtn = document.getElementById('confirm-dialog-btn-confirm');
      expect(confirmBtn).not.toBeNull();
      confirmBtn.click();

      const result = await promise;
      expect(result).toBe(true);
      expect(document.getElementById('aquastock-confirm-dialog')).toBeNull();
    });

    it('mengembalikan false saat tombol Escape ditekan', async () => {
      const promise = showConfirmDialog({
        title: 'Keluar',
        message: 'Batalkan form?'
      });

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      const result = await promise;
      expect(result).toBe(false);
      expect(document.getElementById('aquastock-confirm-dialog')).toBeNull();
    });

    it('mengembalikan false saat mengklik area backdrop di luar modal box', async () => {
      const promise = showConfirmDialog({
        title: 'Batal Klik Luar',
        message: 'Klik luar untuk batal'
      });

      const overlay = document.getElementById('aquastock-confirm-dialog');
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      const result = await promise;
      expect(result).toBe(false);
      expect(document.getElementById('aquastock-confirm-dialog')).toBeNull();
    });
  });

  describe('icons.js (Lucide local subset)', () => {
    it('berhasil merender icon clipboard-check, cloud, external-link, maximize-2, share-2 menjadi SVG', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <i data-lucide="clipboard-check" class="w-4 h-4"></i>
        <i data-lucide="cloud" class="w-5 h-5"></i>
        <i data-lucide="external-link"></i>
        <i data-lucide="maximize-2"></i>
        <i data-lucide="share-2"></i>
      `;
      document.body.appendChild(container);

      expect(typeof window.refreshIcons).toBe('function');
      window.refreshIcons(container);

      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBe(5);

      const clipboardCheck = container.querySelector('svg[data-lucide="clipboard-check"]');
      expect(clipboardCheck).not.toBeNull();
      expect(clipboardCheck.classList.contains('lucide-clipboard-check')).toBe(true);
      expect(clipboardCheck.classList.contains('w-4')).toBe(true);

      const cloud = container.querySelector('svg[data-lucide="cloud"]');
      expect(cloud).not.toBeNull();
      expect(cloud.classList.contains('lucide-cloud')).toBe(true);

      const extLink = container.querySelector('svg[data-lucide="external-link"]');
      expect(extLink).not.toBeNull();

      container.remove();
    });
  });
});
