/* ═══════════════════════════════════════════════════
   M2Stock — api/storage.js
   Domain Supabase Storage (bucket product-images)
   ═══════════════════════════════════════════════════ */

import { isSupabaseAvailable, formatResponse, handleError } from './_client.js';

export const storage = {
    /**
     * Mengunggah foto produk ke Supabase Storage secara tangguh:
     * - Memeriksa dan memperbarui token sesi auth sebelum upload
     * - Auto-retry hingga 3 kali dengan jeda exponential backoff jika terjadi gangguan jaringan
     * - Otomatis refresh session jika menerima HTTP 401/403/JWT expired
     */
    uploadImage: async (fileOrBlob, path, opts = {}) => {
      if (!isSupabaseAvailable()) {
        return formatResponse({
          ok: false,
          error: {
            code: 'SUPABASE_UNAVAILABLE',
            message: 'Klien Supabase tidak tersedia; foto produk tidak dapat diunggah'
          }
        });
      }

      const maxAttempts = opts.maxAttempts || 3;
      let lastError = null;

      // 1. Proactive Session Verification: pastikan token aktif sebelum mengirim binary besar
      try {
        if (window.supabase?.auth && typeof window.supabase.auth.getSession === 'function') {
          const { data: sessionData } = await window.supabase.auth.getSession();
          const session = sessionData?.session;
          if (session) {
            const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
            // Jika token kedaluwarsa atau kurang dari 60 detik tersisa, refresh terlebih dahulu
            if (expiresAt > 0 && expiresAt - Date.now() < 60000 && typeof window.supabase.auth.refreshSession === 'function') {
              await window.supabase.auth.refreshSession().catch(() => {});
            }
          }
        }
      } catch (_) {}

      // 2. Loop retry dengan exponential backoff
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const uploadOptions = {
            contentType: 'image/webp',
            upsert: true,
            ...(opts || {})
          };
          delete uploadOptions.maxAttempts;

          const { data, error } = await window.supabase.storage
            .from('product-images')
            .upload(path, fileOrBlob, uploadOptions);

          if (!error && data) {
            const publicUrl = window.supabase.storage
              .from('product-images')
              .getPublicUrl(path).data?.publicUrl;

            return formatResponse({
              ok: true,
              data: { path: data.path, publicUrl: publicUrl },
              meta: { message: 'Foto produk berhasil diunggah', attempts: attempt }
            });
          }

          lastError = error;

          // Cek apakah error terkait auth/JWT/RLS (401, 403, JWT expired, atau row-level security)
          const errMsg = (error?.message || '').toLowerCase();
          const isAuthError = error?.statusCode === 401 ||
            error?.statusCode === 403 ||
            errMsg.includes('jwt') ||
            errMsg.includes('unauthorized') ||
            errMsg.includes('row-level security') ||
            errMsg.includes('expired');

          if (isAuthError && window.supabase?.auth && typeof window.supabase.auth.refreshSession === 'function' && attempt < maxAttempts) {
            console.warn(`[storage.uploadImage] Auth/JWT issue pada attempt ${attempt}, me-refresh session...`);
            try {
              await window.supabase.auth.refreshSession();
            } catch (_) {}
          }

          // Jika masih ada sisa percobaan, tunggu dengan exponential backoff (350ms, 700ms, ...)
          if (attempt < maxAttempts) {
            const delayMs = Math.min(2000, 350 * Math.pow(2, attempt - 1));
            console.warn(`[storage.uploadImage] Upload attempt ${attempt} gagal (${error?.message || 'Unknown error'}). Mencoba ulang dalam ${delayMs}ms...`);
            await new Promise(r => setTimeout(r, delayMs));
          }
        } catch (err) {
          lastError = err;
          if (attempt < maxAttempts) {
            const delayMs = Math.min(2000, 350 * Math.pow(2, attempt - 1));
            console.warn(`[storage.uploadImage] Exception pada attempt ${attempt} (${err?.message}). Mencoba ulang dalam ${delayMs}ms...`);
            await new Promise(r => setTimeout(r, delayMs));
          }
        }
      }

      return formatResponse({
        ok: false,
        error: {
          code: lastError?.code || 'STORAGE_UPLOAD_ERROR',
          message: lastError?.message
            ? `Gagal mengunggah foto produk ke storage: ${lastError.message}`
            : 'Gagal mengunggah foto produk ke storage setelah beberapa percobaan',
          details: lastError
        }
      });
    },

    getImageUrl: (path) => {
      if (isSupabaseAvailable()) {
        try {
          const { data } = window.supabase.storage
            .from('product-images')
            .getPublicUrl(path);
          return data?.publicUrl || null;
        } catch (_) {
          return null;
        }
      }
      return null;
    },

    deleteImage: async (path, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await window.supabase.storage
            .from('product-images')
            .remove([path]);

          if (error) {
            return formatResponse({
              ok: false,
              error: {
                code: error.code || 'STORAGE_DELETE_ERROR',
                message: error.message || 'Gagal menghapus foto dari storage',
                details: error
              }
            });
          }

          return formatResponse({
            ok: true,
            data: data,
            meta: { message: 'Foto berhasil dihapus dari storage' }
          });
        } catch (err) {
          return handleError(err);
        }
      }

      return formatResponse({
        ok: false,
        error: {
          code: 'SUPABASE_UNAVAILABLE',
          message: 'Klien Supabase tidak tersedia; foto produk tidak dapat dihapus'
        }
      });
    }
};

export default storage;
