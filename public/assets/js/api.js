/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api.js
   Wrapper fetch untuk backend (placeholder, siap diisi)
   ═══════════════════════════════════════════════════ */
/* Semua fungsi di bawah masih placeholder. Ganti isinya saat backend siap. */

const API_BASE = '/api';

async function apiRequest(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options
  });
  if (!res.ok) throw new Error('API error: ' + res.status);
  return res.json();
}

const Api = {
  // Auth
  login:    (data)      => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout:   ()          => apiRequest('/auth/logout', { method: 'POST' }),
  // Items
  getItems: ()          => apiRequest('/items'),
  // Transaksi
  getIn:    ()          => apiRequest('/transactions/in'),
  getOut:   ()          => apiRequest('/transactions/out'),
  // Laporan
  getReport: (params)   => apiRequest('/reports?' + new URLSearchParams(params || {}).toString())
};

window.Api = Api;
