/* ═══════════════════════════════════════════════════
   M2Stock — auth.js
   Modul Autentikasi Supabase & Proteksi Halaman
   ═══════════════════════════════════════════════════ */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Auth = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function okEnvelope(data, meta) {
    return { ok: true, data: data !== undefined ? data : null, error: null, meta: meta || {} };
  }

  function errEnvelope(message, code, meta) {
    return { ok: false, data: null, error: { message: message || 'Terjadi kesalahan autentikasi', code: code || 'AUTH_ERROR' }, meta: meta || {} };
  }

  function translateAuthError(err) {
    if (!err) return 'Terjadi kesalahan autentikasi';
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('invalid login credentials')) {
      return 'Email atau kata sandi salah';
    }
    if (msg.includes('user already registered') || msg.includes('already exists')) {
      return 'Email sudah terdaftar. Silakan masuk';
    }
    if (msg.includes('password should be at least')) {
      return 'Kata sandi minimal 6 karakter';
    }
    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return 'Terlalu banyak percobaan. Silakan coba lagi nanti';
    }
    if (msg.includes('email not confirmed')) {
      return 'Email belum dikonfirmasi';
    }
    if (msg.includes('invalid email')) {
      return 'Format email tidak valid';
    }
    return err.message || 'Gagal memproses autentikasi';
  }

  async function getClient() {
    if (typeof window !== 'undefined' && window.supabase) {
      return window.supabase;
    }
    let retries = 0;
    while (typeof window !== 'undefined' && !window.supabase && retries < 25) {
      await new Promise(r => setTimeout(r, 40));
      retries++;
    }
    return typeof window !== 'undefined' ? window.supabase : null;
  }

  async function login(email, password) {
    try {
      const client = await getClient();
      if (!client || !client.auth) {
        return errEnvelope('Klien database belum siap', 'CLIENT_NOT_READY');
      }

      const { data, error } = await client.auth.signInWithPassword({
        email: (email || '').trim(),
        password: password || ''
      });

      if (error) {
        return errEnvelope(translateAuthError(error), error.code || 'LOGIN_FAILED');
      }

      return okEnvelope({
        user: data.user,
        session: data.session
      });
    } catch (err) {
      return errEnvelope(translateAuthError(err), 'EXCEPTION');
    }
  }

  async function register(email, password) {
    try {
      const client = await getClient();
      if (!client || !client.auth) {
        return errEnvelope('Klien database belum siap', 'CLIENT_NOT_READY');
      }

      const { data, error } = await client.auth.signUp({
        email: (email || '').trim(),
        password: password || ''
      });

      if (error) {
        return errEnvelope(translateAuthError(error), error.code || 'REGISTER_FAILED');
      }

      return okEnvelope({
        user: data.user,
        session: data.session
      });
    } catch (err) {
      return errEnvelope(translateAuthError(err), 'EXCEPTION');
    }
  }

  async function logout() {
    try {
      const client = await getClient();
      if (client && client.auth) {
        await client.auth.signOut();
      }
      return okEnvelope(null);
    } catch (err) {
      return errEnvelope(translateAuthError(err), 'LOGOUT_FAILED');
    }
  }

  async function getSession() {
    try {
      const client = await getClient();
      if (!client || !client.auth) return null;
      const { data } = await client.auth.getSession();
      return data?.session || null;
    } catch (_) {
      return null;
    }
  }

  async function getCurrentUser() {
    try {
      const session = await getSession();
      if (session && session.user) return session.user;
      const client = await getClient();
      if (!client || !client.auth) return null;
      const { data } = await client.auth.getUser();
      return data?.user || null;
    } catch (_) {
      return null;
    }
  }

  async function requireAuth(redirectUrl) {
    if (typeof window === 'undefined') return true;

    const targetUrl = redirectUrl || '/login/';

    // 1. Fast path: jika di localStorage tidak ada token auth Supabase sama sekali
    try {
      const hasTokenInStorage = Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      if (!hasTokenInStorage) {
        window.location.replace(targetUrl);
        return false;
      }
    } catch (_) {}

    // 2. Verifikasi session aktual via SDK
    try {
      const session = await getSession();
      if (!session || !session.user) {
        window.location.replace(targetUrl);
        return false;
      }
      return true;
    } catch (_) {
      window.location.replace(targetUrl);
      return false;
    }
  }

  // Auto-protect halaman jika berada di lingkup /dashboard/
  if (typeof window !== 'undefined' && window.location && window.location.pathname && window.location.pathname.includes('/dashboard')) {
    requireAuth('/login/');
  }

  return {
    login: login,
    register: register,
    logout: logout,
    getSession: getSession,
    getCurrentUser: getCurrentUser,
    requireAuth: requireAuth
  };
});
