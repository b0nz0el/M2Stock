import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Api from '../public/assets/js/api/index.js';

describe('api.js contract & error handling', () => {
  beforeEach(() => {
    Api.setMockMode(true);
    vi.restoreAllMocks();
  });

  describe('Response Envelope Structure', () => {
    it('mengembalikan format standar { ok, data, error, meta } pada operasi sukses', async () => {
      const res = await Api.items.getAll();
      expect(res).toHaveProperty('ok', true);
      expect(res).toHaveProperty('data');
      expect(Array.isArray(res.data)).toBe(true);
      expect(res).toHaveProperty('error', null);
      expect(res).toHaveProperty('meta');
      expect(res.meta).toHaveProperty('timestamp');
    });

    it('mengembalikan envelope mock yang valid untuk operasi read', async () => {
      const res = await Api.items.getAll();
      expect(res.ok).toBe(true);
      expect(res).toHaveProperty('data');
      expect(Array.isArray(res.data)).toBe(true);
      expect(res).toHaveProperty('error', null);
      expect(res.meta).toBeDefined();
    });
  });

  describe('AbortController & Cancellation', () => {
    it('menyediakan helper createAbortController yang valid', () => {
      const controller = Api.createAbortController();
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal).toBeDefined();
    });

    it('menangani request yang dibatalkan dengan kode error REQUEST_ABORTED', async () => {
      const controller = Api.createAbortController();
      controller.abort(); // Batalkan sebelum/saat eksekusi

      const res = await Api.items.getAll({}, { signal: controller.signal });
      expect(res.ok).toBe(false);
      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
      expect(res.error.code).toBe('REQUEST_ABORTED');
      expect(res.error.message).toContain('dibatalkan');
    });
  });

  describe('Centralized Error Handling (Non-Mock Fetch)', () => {
    beforeEach(() => {
      Api.setMockMode(false); // Matikan mock mode untuk menguji fetch sesungguhnya
    });

    it('menangani kegagalan jaringan (fetch throw exception)', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const res = await Api.items.getAll();
      expect(res.ok).toBe(false);
      expect(res.data).toBeNull();
      expect(res.error.code).toBe('NETWORK_ERROR');
      expect(res.error.message).toContain('Failed to fetch');
    });

    it('memetakan HTTP 404 ke kode error NOT_FOUND', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        json: async () => ({ message: 'Item tidak ditemukan' })
      });

      const res = await Api.items.getById('ITM-999');
      expect(res.ok).toBe(false);
      expect(res.error.code).toBe('NOT_FOUND');
      expect(res.error.message).toContain('Item tidak ditemukan');
    });

    it('memetakan HTTP 500 ke INTERNAL_SERVER_ERROR', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => 'application/json' },
        json: async () => ({ message: 'Database failure' })
      });

      const res = await Api.transactions.getIn();
      expect(res.ok).toBe(false);
      expect(res.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(res.error.message).toContain('Database failure');
    });
  });
});
