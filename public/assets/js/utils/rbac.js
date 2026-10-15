/* ═══════════════════════════════════════════════════
   aQuaStock Pro — rbac.js
   Role-Based Access Control (RBAC) & Route Guard
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';

export const MENU_ACCESS = {
  dashboard:  ['OWNER', 'STAFF', 'VIEWER'],
  items:      ['OWNER', 'STAFF', 'VIEWER'],
  in:         ['OWNER', 'STAFF', 'VIEWER'],
  out:        ['OWNER', 'STAFF', 'VIEWER'],
  po:         ['OWNER', 'STAFF', 'VIEWER'],
  return:     ['OWNER', 'STAFF', 'VIEWER'],
  suppliers:  ['OWNER', 'STAFF', 'VIEWER'],
  customers:  ['OWNER', 'STAFF'],
  cash:       ['OWNER', 'STAFF', 'VIEWER'],
  debt:       ['OWNER', 'STAFF', 'VIEWER'],
  report:     ['OWNER', 'STAFF'],
  users:      ['OWNER'],
  audit:      ['OWNER'],
  backup:     ['OWNER'],
  settings:   ['OWNER'],
  notif:      ['OWNER', 'STAFF', 'VIEWER'],
};

const CACHE_KEY = 'rbac_user_role';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

/**
 * Memeriksa apakah role memiliki hak akses ke halaman tertentu
 * @param {string} role - OWNER | STAFF | VIEWER
 * @param {string} page - Nama halaman (sesuai key MENU_ACCESS)
 * @returns {boolean}
 */
export function hasAccess(role, page) {
  if (!page) return false;
  const normalizedRole = (role || 'VIEWER').toString().trim().toUpperCase();
  const allowed = MENU_ACCESS[page];
  if (!allowed) return false;
  return allowed.includes(normalizedRole);
}

/**
 * Membersihkan cache role pengguna di sessionStorage
 */
export function clearRoleCache() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CACHE_KEY);
    }
  } catch (_) {}
}

/**
 * Mengambil role pengguna aktif:
 * 1. Cek cache sessionStorage (TTL 5 menit)
 * 2. Ambil dari Supabase profiles jika cache miss / expired
 * 3. Default ke VIEWER jika role null/undefined
 * @returns {Promise<string|null>} - Role ('OWNER'|'STAFF'|'VIEWER') atau null jika belum login
 */
export async function getUserRole() {
  // 1. Cek cache sessionStorage
  try {
    if (typeof sessionStorage !== 'undefined') {
      const cachedStr = sessionStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (cached && cached.role && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
          return cached.role;
        }
      }
    }
  } catch (_) {}

  // 2. Dapatkan Supabase Client
  const client = (typeof window !== 'undefined' && window.supabase) ? window.supabase : supabase;
  if (!client || !client.auth) {
    try {
      const local = JSON.parse(localStorage.getItem('auth_user') || '{}');
      if (local.role) {
        const r = local.role.toString().trim().toUpperCase();
        if (['OWNER', 'STAFF', 'VIEWER'].includes(r)) return r;
      }
    } catch (_) {}
    return 'VIEWER';
  }

  try {
    const { data: authData, error: authError } = await client.auth.getUser();
    const user = authData?.user;

    // Jika user belum login / token invalid
    if (authError || !user) {
      return null;
    }

    let role = null;

    // Ambil dari tabel profiles di Supabase
    try {
      const { data: profile, error: profError } = await client
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!profError && profile && profile.role) {
        role = profile.role.toString().trim().toUpperCase();
      }
    } catch (_) {}

    // Fallback ke user_metadata jika di profile belum ada
    if (!role && user.user_metadata?.role) {
      role = (user.user_metadata.role).toString().trim().toUpperCase();
    }

    // Edge case: Role null/undefined/invalid → treat sebagai VIEWER (least privilege)
    if (!role || !['OWNER', 'STAFF', 'VIEWER'].includes(role)) {
      role = 'VIEWER';
    }

    // Simpan ke cache sessionStorage dengan TTL
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          role: role,
          userId: user.id,
          timestamp: Date.now()
        }));
      }
    } catch (_) {}

    // Sinkronkan ke auth_user di localStorage agar komponen lain konsisten
    try {
      if (typeof localStorage !== 'undefined') {
        const currentCache = JSON.parse(localStorage.getItem('auth_user') || '{}');
        localStorage.setItem('auth_user', JSON.stringify({
          ...currentCache,
          role: role
        }));
      }
    } catch (_) {}

    return role;
  } catch (err) {
    console.error('RBAC getUserRole error:', err);
    return 'VIEWER';
  }
}

/**
 * Route guard untuk memproteksi halaman dari akses langsung via URL
 * @param {string} page - Nama halaman (misal 'users', 'report', 'audit')
 * @returns {Promise<boolean>}
 */
export async function guardRoute(page) {
  const role = await getUserRole();

  // Edge case: belum login
  if (!role) {
    if (typeof window !== 'undefined') {
      window.location.replace('/login/');
    }
    return false;
  }

  // Edge case: tidak punya hak akses
  if (!hasAccess(role, page)) {
    if (typeof window !== 'undefined') {
      window.location.replace('/dashboard/');
    }
    return false;
  }

  return true;
}

// Global window registration untuk interoperabilitas dengan non-module scripts
if (typeof window !== 'undefined') {
  window.RBAC = {
    MENU_ACCESS,
    hasAccess,
    getUserRole,
    guardRoute,
    clearRoleCache
  };
}
