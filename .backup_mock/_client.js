/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/_client.js
   Wrapper fetch terpusat, envelope standar, error handling, & AbortController
   ═══════════════════════════════════════════════════ */

export const API_BASE = '/api';

/* Konfigurasi state API */
export const config = {
  mockMode: false, // false: gunakan backend Supabase jika tersedia
  defaultTimeout: 15000 // 15 detik timeout default
};

export function setMockMode(val) {
  config.mockMode = Boolean(val);
}

export function isMockMode() {
  return config.mockMode;
}

/**
 * Helper pemeriksaan ketersediaan klien Supabase global
 */
export function isSupabaseAvailable() {
  return typeof window !== 'undefined' && Boolean(window.supabase);
}

/**
 * Helper pembuat AbortController baru
 */
export function createAbortController() {
  return new AbortController();
}

/**
 * Helper pembuat respons standar
 */
export function formatResponse({ ok = true, data = null, error = null, meta = {} }) {
  return {
    ok: Boolean(ok),
    data: data,
    error: error ? {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Terjadi kesalahan sistem',
      details: error.details !== undefined ? error.details : null
    } : null,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Error handler terpusat untuk fetch & exceptions
 */
export function handleError(err, defaultCode = 'NETWORK_ERROR') {
  if (err && (err.name === 'AbortError' || err.code === 'REQUEST_ABORTED')) {
    return formatResponse({
      ok: false,
      error: {
        code: 'REQUEST_ABORTED',
        message: 'Permintaan dibatalkan oleh pengguna atau timeout',
        details: null
      }
    });
  }

  return formatResponse({
    ok: false,
    error: {
      code: (err && err.code) || defaultCode,
      message: (err && err.message) || 'Koneksi ke server gagal atau tidak tersedia',
      details: (err && err.details) !== undefined ? err.details : null
    }
  });
}

/**
 * Mock Data Store untuk sistem aQuaStock Pro (Jaquris)
 */
export const MOCK_DATA = {
  items: [
    { id: 'ITM-001', name: 'Filter Hang-on 501', category: 'Filter', stock: 18, minStock: 5, unitPrice: 85000 },
    { id: 'ITM-002', name: 'Lampu LED Aquascape 60cm', category: 'Lampu', stock: 12, minStock: 4, unitPrice: 450000 },
    { id: 'ITM-003', name: 'Pompa Udara 2 Lubang AC/DC', category: 'Aerator', stock: 9, minStock: 3, unitPrice: 135000 },
    { id: 'ITM-004', name: 'Pasir Silika Hitam 1kg', category: 'Substrat', stock: 54, minStock: 10, unitPrice: 12000 },
    { id: 'ITM-005', name: 'Batu Seiryu Stone', category: 'Hardscape', stock: 25, minStock: 5, unitPrice: 35000 }
  ],
  user: {
    id: 'USR-01',
    name: 'Mr David',
    username: 'david@jaquris.com',
    role: 'OWNER'
  }
};

/**
 * Eksekusi request API via fetch
 */
export async function apiRequest(path, options = {}) {
  // 1. Handle Mock Mode jika aktif
  if (config.mockMode) {
    return executeMockRequest(path, options);
  }

  // 2. Setup sinyal pembatalan & timeout
  const controller = options.signal ? null : new AbortController();
  const signal = options.signal || controller.signal;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), options.timeout || config.defaultTimeout)
    : null;

  try {
    const url = API_BASE + path;
    const fetchOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      },
      credentials: 'same-origin',
      signal: signal
    };

    if (options.body && typeof options.body === 'object') {
      fetchOptions.body = JSON.stringify(options.body);
    } else if (options.body) {
      fetchOptions.body = options.body;
    }

    const res = await fetch(url, fetchOptions);

    // Parse JSON atau fallback text
    let body;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await res.json();
    } else {
      const text = await res.text();
      body = { message: text };
    }

    if (!res.ok) {
      const errorCode = mapHttpStatusToCode(res.status);
      return formatResponse({
        ok: false,
        error: {
          code: (body && body.error && body.error.code) || errorCode,
          message: (body && body.error && body.error.message) || body.message || `HTTP ${res.status}: Gagal memproses permintaan`,
          details: (body && body.error && body.error.details) || body
        },
        meta: { status: res.status }
      });
    }

    // Jika response sudah berbentuk envelope standar
    if (body && typeof body === 'object' && 'ok' in body && ('data' in body || 'error' in body)) {
      return body;
    }

    // Bungkus ke dalam envelope standar
    return formatResponse({
      ok: true,
      data: body,
      meta: { status: res.status }
    });
  } catch (err) {
    return handleError(err);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function mapHttpStatusToCode(status) {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 422: return 'VALIDATION_ERROR';
    case 500: return 'INTERNAL_SERVER_ERROR';
    case 502: return 'BAD_GATEWAY';
    case 503: return 'SERVICE_UNAVAILABLE';
    default: return 'HTTP_ERROR_' + status;
  }
}

/**
 * Router Mock Request internal
 */
export async function executeMockRequest(path, options = {}) {
  // Delay simulasi latensi jaringan
  await new Promise(resolve => setTimeout(resolve, options.mockDelay || 150));

  // Periksa sinyal abort
  if (options.signal && options.signal.aborted) {
    return handleError({ name: 'AbortError' });
  }

  const cleanPath = path.split('?')[0];

  // Items
  if (cleanPath === '/items') {
    return formatResponse({
      ok: true,
      data: MOCK_DATA.items,
      meta: { total: MOCK_DATA.items.length }
    });
  }

  // Generic fallback mock untuk modul lain
  return formatResponse({
    ok: true,
    data: { message: `Endpoint ${cleanPath} siap terhubung backend` },
    meta: { mock: true, path: cleanPath }
  });
}
