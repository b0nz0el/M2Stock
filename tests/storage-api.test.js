import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storage } from '../public/assets/js/api/storage.js';

describe('storage.js — Resilient Image Upload with Auto-Retry & Token Refresh', () => {
  let mockSupabase;
  let uploadMock;
  let getPublicUrlMock;
  let refreshSessionMock;
  let getSessionMock;

  beforeEach(() => {
    uploadMock = vi.fn();
    getPublicUrlMock = vi.fn().mockReturnValue({
      data: { publicUrl: 'https://kvdktgknwxmqpankwpre.supabase.co/storage/v1/object/public/product-images/test.webp' }
    });
    refreshSessionMock = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'new-token', expires_at: Math.floor(Date.now() / 1000) + 3600 } }
    });
    getSessionMock = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'valid-token', expires_at: Math.floor(Date.now() / 1000) + 3600 } }
    });

    mockSupabase = {
      auth: {
        getSession: getSessionMock,
        refreshSession: refreshSessionMock
      },
      storage: {
        from: vi.fn(() => ({
          upload: uploadMock,
          getPublicUrl: getPublicUrlMock,
          remove: vi.fn().mockResolvedValue({ data: [{ name: 'test.webp' }], error: null })
        }))
      }
    };

    vi.stubGlobal('window', {
      supabase: mockSupabase
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mengunggah foto dengan sukses pada percobaan pertama', async () => {
    uploadMock.mockResolvedValueOnce({
      data: { path: 'test.webp' },
      error: null
    });

    const fakeBlob = new Blob(['dummy'], { type: 'image/webp' });
    const res = await storage.uploadImage(fakeBlob, 'test.webp');

    expect(res.ok).toBe(true);
    expect(res.data.publicUrl).toContain('product-images/test.webp');
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(res.meta.attempts).toBe(1);
  });

  it('melakukan auto-retry saat percobaan pertama gagal karena network glitch dan berhasil di percobaan kedua', async () => {
    uploadMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed to fetch', statusCode: 500 }
      })
      .mockResolvedValueOnce({
        data: { path: 'test.webp' },
        error: null
      });

    const fakeBlob = new Blob(['dummy'], { type: 'image/webp' });
    const res = await storage.uploadImage(fakeBlob, 'test.webp');

    expect(res.ok).toBe(true);
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(res.meta.attempts).toBe(2);
  });

  it('otomatis me-refresh token auth ketika menerima 401/JWT expired lalu berhasil upload', async () => {
    uploadMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid JWT / token expired', statusCode: 401 }
      })
      .mockResolvedValueOnce({
        data: { path: 'test.webp' },
        error: null
      });

    const fakeBlob = new Blob(['dummy'], { type: 'image/webp' });
    const res = await storage.uploadImage(fakeBlob, 'test.webp');

    expect(res.ok).toBe(true);
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(res.meta.attempts).toBe(2);
  });

  it('mengembalikan ok: false dengan pesan jelas jika semua percobaan (3x) gagal', async () => {
    uploadMock.mockResolvedValue({
      data: null,
      error: { message: 'Connection timeout', statusCode: 504 }
    });

    const fakeBlob = new Blob(['dummy'], { type: 'image/webp' });
    const res = await storage.uploadImage(fakeBlob, 'test.webp', { maxAttempts: 2 });

    expect(res.ok).toBe(false);
    expect(res.error.message).toContain('Gagal mengunggah foto produk ke storage');
    expect(uploadMock).toHaveBeenCalledTimes(2);
  });

  it('mengembalikan error jika klien Supabase tidak tersedia', async () => {
    delete window.supabase;
    const fakeBlob = new Blob(['dummy'], { type: 'image/webp' });
    const res = await storage.uploadImage(fakeBlob, 'test.webp');

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('SUPABASE_UNAVAILABLE');
  });

  it('getImageUrl menghasilkan URL publik produk', () => {
    const url = storage.getImageUrl('test.webp');
    expect(url).toBe('https://kvdktgknwxmqpankwpre.supabase.co/storage/v1/object/public/product-images/test.webp');
  });

  it('deleteImage memanggil storage.remove dengan benar', async () => {
    const res = await storage.deleteImage('test.webp');
    expect(res.ok).toBe(true);
  });
});

