import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('../public/assets/js/supabase-client.js', () => ({ supabase: {} }));

import Api from '../public/assets/js/api/index.js';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body
  };
}

describe('API client contract & error handling', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mengembalikan envelope standar dari backend', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ items: [] }));

    const res = await Api.request('/items');

    expect(res).toHaveProperty('ok', true);
    expect(res.data).toEqual({ items: [] });
    expect(res).toHaveProperty('error', null);
    expect(res.meta).toHaveProperty('timestamp');
  });

  it('menyediakan AbortController yang valid', () => {
    const controller = Api.createAbortController();
    expect(controller).toBeInstanceOf(AbortController);
    expect(controller.signal).toBeDefined();
  });

  it('menangani request yang dibatalkan dengan kode REQUEST_ABORTED', async () => {
    global.fetch.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    const controller = Api.createAbortController();
    controller.abort();

    const res = await Api.request('/items', { signal: controller.signal });

    expect(res.ok).toBe(false);
    expect(res.data).toBeNull();
    expect(res.error.code).toBe('REQUEST_ABORTED');
  });

  it('menangani kegagalan jaringan tanpa mengembalikan data simulasi', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const res = await Api.request('/items');

    expect(res.ok).toBe(false);
    expect(res.data).toBeNull();
    expect(res.error.code).toBe('NETWORK_ERROR');
    expect(res.error.message).toContain('Failed to fetch');
  });

  it('memetakan HTTP 404 ke kode NOT_FOUND', async () => {
    global.fetch.mockResolvedValue(jsonResponse(
      { message: 'Item tidak ditemukan' },
      { ok: false, status: 404 }
    ));

    const res = await Api.request('/items/ITM-999');

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('NOT_FOUND');
    expect(res.error.message).toContain('Item tidak ditemukan');
  });

  it('memetakan HTTP 500 ke INTERNAL_SERVER_ERROR', async () => {
    global.fetch.mockResolvedValue(jsonResponse(
      { message: 'Database failure' },
      { ok: false, status: 500 }
    ));

    const res = await Api.request('/transactions/in');

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.error.message).toContain('Database failure');
  });
});
