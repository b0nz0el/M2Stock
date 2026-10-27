/* ═══════════════════════════════════════════════════
   Aquastock Pro — api/storage.js
   Domain Supabase Storage (bucket product-images)
   ═══════════════════════════════════════════════════ */

import { isSupabaseAvailable, formatResponse, handleError } from './_client.js';

export const storage = {
    uploadImage: async (fileOrBlob, path, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await window.supabase.storage
            .from('product-images')
            .upload(path, fileOrBlob, {
              contentType: 'image/webp',
              upsert: true,
              ...(opts || {})
            });

          if (error) {
            return formatResponse({
              ok: false,
              error: {
                code: error.code || 'STORAGE_UPLOAD_ERROR',
                message: error.message || 'Gagal mengunggah foto produk ke storage',
                details: error
              }
            });
          }

          const publicUrl = window.supabase.storage
            .from('product-images')
            .getPublicUrl(path).data?.publicUrl;

          return formatResponse({
            ok: true,
            data: { path: data.path, publicUrl: publicUrl },
            meta: { message: 'Foto produk berhasil diunggah' }
          });
        } catch (err) {
          return handleError(err);
        }
      }

      return formatResponse({
        ok: false,
        error: {
          code: 'SUPABASE_UNAVAILABLE',
          message: 'Klien Supabase tidak tersedia; foto produk tidak dapat diunggah'
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
