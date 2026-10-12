import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseIndonesianNumber,
  detectMultiplier,
  animateNumber,
  showToast,
  focusProgrammatically,
  exportToCSV
} from '../public/assets/js/utils.js';

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

    it('membuat elemen toast dengan pesan dan warna success ke dalam #toast-container', () => {
      showToast('Data berhasil disimpan', 'success');

      const container = document.getElementById('toast-container');
      const toast = container.querySelector('.toast');
      expect(toast).not.toBeNull();
      expect(toast.getAttribute('role')).toBe('status');
      expect(toast.getAttribute('aria-live')).toBe('polite');
      expect(toast.textContent).toContain('Data berhasil disimpan');

      const indicator = toast.querySelector('span[style*="background"]');
      expect(indicator.getAttribute('style')).toContain('#34C759');
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

      // error (#FF3B30)
      expect(toasts[0].querySelector('span[style*="background"]').getAttribute('style')).toContain('#FF3B30');
      // info (#0088CC)
      expect(toasts[1].querySelector('span[style*="background"]').getAttribute('style')).toContain('#0088CC');
      // fallback info (#0088CC)
      expect(toasts[2].querySelector('span[style*="background"]').getAttribute('style')).toContain('#0088CC');
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
      expect(toast.style.opacity).toBe('0');
      expect(toast.style.transform).toBe('translateX(100%)');

      // Maju 300ms lagi (total 3300ms) untuk remove
      vi.advanceTimersByTime(300);
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
  });
});
