/* ═══════════════════════════════════════════════════
   Aquastock Pro — api/_client.js
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

let cachedClientIp = null;
let clientIpPromise = null;

/**
 * Mendapatkan IP Address publik pengguna secara akurat (via Cloudflare Edge / cdn-cgi)
 */
export async function getClientIp() {
  if (cachedClientIp) return cachedClientIp;
  try {
    const stored = sessionStorage.getItem('cached_client_ip');
    if (stored) {
      cachedClientIp = stored;
      return stored;
    }
  } catch (_) {}

  if (clientIpPromise) return clientIpPromise;

  clientIpPromise = (async () => {
    // 1. Ambil dari Cloudflare edge /cdn-cgi/trace (same-origin, zero-latency)
    try {
      const res = await fetch('/cdn-cgi/trace', { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        const match = text.match(/^ip=(.+)$/m);
        if (match && match[1]) {
          cachedClientIp = match[1].trim();
          try { sessionStorage.setItem('cached_client_ip', cachedClientIp); } catch (_) {}
          return cachedClientIp;
        }
      }
    } catch (_) {}

    // 2. Fallback ipify jika di localhost
    try {
      const res2 = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2500) });
      if (res2.ok) {
        const data = await res2.json();
        if (data && data.ip) {
          cachedClientIp = data.ip.trim();
          try { sessionStorage.setItem('cached_client_ip', cachedClientIp); } catch (_) {}
          return cachedClientIp;
        }
      }
    } catch (_) {}

    return null;
  })();

  return clientIpPromise;
}

if (typeof window !== 'undefined') {
  window.getClientIp = getClientIp;
}

/**
 * Helper pencatatan audit log aman (non-blocking) dengan IP valid
 */
export async function logAudit(action, target) {
  try {
    if (typeof window === 'undefined') return;
    const ip = await getClientIp();
    if (window.Api?.audit?.log) {
      window.Api.audit.log({ action, target, ip });
    } else if (window.supabase && typeof window.supabase.from === 'function') {
      window.supabase.auth.getUser().then(({ data }) => {
        window.supabase.from('audit_logs').insert([{
          action: (action || 'CREATE').toUpperCase(),
          target: target || null,
          ip: ip || null,
          user_id: data?.user?.id || null,
          user_email: data?.user?.email || null,
          created_at: new Date().toISOString()
        }]).then(() => {}).catch(() => {});
      }).catch(() => {});
    }
  } catch (_) {}
}

/**
 * Helper pengiriman notifikasi otomatis ke Owner (non-blocking)
 */
export function notifyOwner(payload) {
  try {
    if (typeof window === 'undefined') return;
    if (window.Api?.notif?.notifyOwner) {
      window.Api.notif.notifyOwner(payload);
    } else if (window.supabase && typeof window.supabase.from === 'function') {
      window.supabase.from('profiles').select('id').ilike('role', 'owner').then(({ data: owners }) => {
        const ownerIds = (owners && owners.length > 0) ? owners.map(o => o.id) : [];
        if (ownerIds.length === 0) return;
        const rows = ownerIds.map(uid => ({
          user_id: uid,
          tipe: payload.tipe || 'info',
          judul: (payload.judul || '').trim(),
          pesan: (payload.pesan || '').trim(),
          link: payload.link ? payload.link.trim() : null,
          is_read: false,
          created_at: new Date().toISOString()
        }));
        window.supabase.from('notifications').insert(rows).then(() => {}).catch(() => {});
      }).catch(() => {});
    }
  } catch (_) {}
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
