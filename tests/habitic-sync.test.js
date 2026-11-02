import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from '../functions/api/integrations/habitic.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function makeRequest() {
  return new Request('https://aquastock-pro.pages.dev/api/integrations/habitic', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer valid-supabase-session',
      'X-Supabase-Key': 'public-anon-key'
    }
  });
}

describe('Aquastock to Habitic marketplace sync', () => {
  it('authenticates with Supabase and forwards only SKU/channel URLs server-side', async () => {
    const fetchMock = vi.fn(async (input, options = {}) => {
      const url = new URL(input);
      if (url.pathname === '/auth/v1/user') {
        return Response.json({ id: 'user-id' });
      }
      if (url.pathname === '/rest/v1/products') {
        expect(url.searchParams.get('select')).toBe('sku,channel,channel_link');
        return Response.json([
          {
            sku: 'SKU-001',
            channel: 'Shopee',
            channel_link: 'https://shopee.co.id/product/1',
            cost_price: 12345
          },
          { sku: '', channel: 'Offline', channel_link: '' }
        ]);
      }
      expect(url.href).toBe('https://habitic.pages.dev/api/sync/aquastock-products');
      expect(options.headers['X-Aquastock-Sync-Token']).toBe('server-only-secret');
      expect(JSON.parse(options.body)).toEqual({
        items: [{ sku: 'SKU-001', channel: 'Shopee', channel_link: 'https://shopee.co.id/product/1' }]
      });
      return Response.json({
        success: true,
        summary: { updatedProducts: 1, updatedLinks: 1 }
      });
    });
    globalThis.fetch = fetchMock;

    const response = await onRequestPost({
      request: makeRequest(),
      env: { HABITIC_SYNC_SECRET: 'server-only-secret' }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      sourceProducts: 1,
      summary: { updatedProducts: 1, updatedLinks: 1 }
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer valid-supabase-session');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer valid-supabase-session');
  });

  it('rejects unauthenticated requests before making upstream calls', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    const request = new Request('https://aquastock-pro.pages.dev/api/integrations/habitic', { method: 'POST' });

    const response = await onRequestPost({
      request,
      env: { HABITIC_SYNC_SECRET: 'server-only-secret' }
    });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports missing integration configuration explicitly', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const response = await onRequestPost({
      request: makeRequest(),
      env: {}
    });

    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/belum dikonfigurasi/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
