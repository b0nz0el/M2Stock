/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/_client.js
   Wrapper fetch terpusat, envelope standar, error handling, & AbortController
   ═══════════════════════════════════════════════════ */

export const API_BASE = '/api';

/* Konfigurasi state API */
export const config = {
  defaultTimeout: 15000 // 15 detik timeout default
};

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
 * Eksekusi request API via fetch
 */
export async function apiRequest(path, options = {}) {
  // Setup sinyal pembatalan & timeout
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
