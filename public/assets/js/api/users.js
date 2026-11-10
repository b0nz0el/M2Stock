/* ═══════════════════════════════════════════════════
   M2Stock — api/users.js
   Domain Users Management via Supabase RPC
   ═══════════════════════════════════════════════════ */

import { isSupabaseAvailable, formatResponse, handleError, apiRequest } from './_client.js';

export const users = {
    getAll: async (opts) => {
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await window.supabase.rpc('get_auth_users');
          if (error) {
            // Jika RPC ditolak (bukan Owner), fallback baca profile sendiri
            const { data: profData, error: profErr } = await window.supabase.from('profiles').select('*');
            if (profErr) {
              return formatResponse({
                ok: false,
                error: { code: error.code || 'RPC_ERROR', message: error.message }
              });
            }
            return formatResponse({ ok: true, data: profData || [] });
          }
          return formatResponse({ ok: true, data: data || [] });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/system/users', { ...opts });
    },
    updateRole: async (targetUserId, newRole, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await window.supabase.rpc('update_user_role', {
            target_user_id: targetUserId,
            new_role: newRole
          });
          if (error) {
            // Jika RPC gagal, lakukan update langsung ke tabel profiles (dilindungi RLS is_owner())
            const { data: upData, error: upErr } = await window.supabase
              .from('profiles')
              .update({ role: newRole })
              .eq('id', targetUserId)
              .select()
              .single();
            if (upErr) {
              return formatResponse({
                ok: false,
                error: { code: upErr.code || 'UPDATE_ROLE_ERROR', message: upErr.message }
              });
            }
            return formatResponse({ ok: true, data: upData, meta: { message: 'Role berhasil diperbarui' } });
          }
          return formatResponse({ ok: true, data: { success: true }, meta: { message: 'Role berhasil diperbarui' } });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest(`/system/users/${targetUserId}/role`, { method: 'PUT', body: { role: newRole }, ...opts });
    }
};

export default users;
