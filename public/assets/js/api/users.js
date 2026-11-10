/* ═══════════════════════════════════════════════════
   M2Stock — api/users.js
   Domain Users Management via Supabase RPC
   ═══════════════════════════════════════════════════ */

import { isSupabaseAvailable, formatResponse, handleError, apiRequest } from './_client.js';

export const users = {
    getAll: async (opts) => {
      if (isSupabaseAvailable()) {
        try {
          // Ambil data profile di public.profiles untuk validasi integritas
          const { data: profData } = await window.supabase
            .from('profiles')
            .select('id, name, full_name, email, role, created_at, updated_at');

          const profileMap = new Map();
          if (Array.isArray(profData)) {
            profData.forEach(p => profileMap.set(String(p.id), p));
          }

          const { data, error } = await window.supabase.rpc('get_auth_users');
          if (error) {
            // Jika RPC ditolak / error, gunakan data profiles langsung
            if (!profData) {
              return formatResponse({
                ok: false,
                error: { code: error.code || 'RPC_ERROR', message: error.message }
              });
            }
            return formatResponse({ ok: true, data: profData || [] });
          }

          // Sinkronisasi data: Jika user sudah dihapus dari tabel profiles, jangan tampilkan di UI!
          let validUsers = data || [];
          if (profileMap.size > 0) {
            validUsers = validUsers.filter(u => profileMap.has(String(u.id))).map(u => {
              const p = profileMap.get(String(u.id));
              return {
                ...u,
                role: (p?.role || u.role || 'VIEWER').toUpperCase(),
                full_name: p?.full_name || p?.name || u.full_name || u.name || (u.email ? u.email.split('@')[0] : 'User')
              };
            });
          } else if (Array.isArray(profData) && profData.length === 0) {
            // Jika profiles kosong, jangan tampilkan user tak bertuan
            validUsers = [];
          }

          return formatResponse({ ok: true, data: validUsers });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/system/users', { ...opts });
    },
    updateRole: async (targetUserId, newRole, opts) => {
      const normalizedRole = String(newRole || 'STAFF').trim().toUpperCase();
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await window.supabase.rpc('update_user_role', {
            target_user_id: targetUserId,
            new_role: normalizedRole
          });
          if (error) {
            // Jika RPC gagal, lakukan update langsung ke tabel profiles (dilindungi RLS is_owner())
            const { data: upData, error: upErr } = await window.supabase
              .from('profiles')
              .update({ role: normalizedRole, updated_at: new Date().toISOString() })
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
      return apiRequest(`/system/users/${targetUserId}/role`, { method: 'PUT', body: { role: normalizedRole }, ...opts });
    },
    delete: async (targetUserId, opts) => {
      if (!targetUserId) {
        return formatResponse({ ok: false, error: { message: 'ID pengguna tidak valid' } });
      }

      if (isSupabaseAvailable()) {
        try {
          // 1. Coba RPC admin_delete_user jika tersedia
          const { data, error } = await window.supabase.rpc('admin_delete_user', {
            target_user_id: targetUserId
          });

          if (!error) {
            return formatResponse({ ok: true, data: { success: true, user_id: targetUserId }, meta: { message: 'Pengguna berhasil dihapus' } });
          }

          // 2. Fallback: Hapus langsung dari public.profiles (dilindungi RLS is_owner)
          const { error: profDelErr } = await window.supabase
            .from('profiles')
            .delete()
            .eq('id', targetUserId);

          if (profDelErr) {
            return formatResponse({
              ok: false,
              error: { code: profDelErr.code || 'DELETE_USER_ERROR', message: profDelErr.message }
            });
          }

          return formatResponse({ ok: true, data: { success: true, user_id: targetUserId }, meta: { message: 'Pengguna berhasil dihapus' } });
        } catch (err) {
          return handleError(err);
        }
      }

      return apiRequest(`/system/users/${targetUserId}`, { method: 'DELETE', ...opts });
    },
    create: async ({ email, password, role = 'STAFF', full_name = '' }, opts) => {
      if (!email || !password) {
        return formatResponse({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Email dan password wajib diisi' }
        });
      }

      const cleanEmail = email.trim();
      const cleanRole = String(role).toUpperCase();
      const cleanName = (full_name || cleanEmail.split('@')[0]).trim();

      if (isSupabaseAvailable()) {
        // Strategy 1: RPC admin_create_user (Atomic, bypasses email rate limit)
        try {
          const { data: rpcData, error: rpcErr } = await window.supabase.rpc('admin_create_user', {
            new_email: cleanEmail,
            new_password: password,
            new_role: cleanRole,
            new_full_name: cleanName
          });

          if (!rpcErr && rpcData) {
            return formatResponse({
              ok: true,
              data: rpcData,
              meta: { message: `User ${cleanEmail} berhasil dibuat` }
            });
          }

          if (rpcErr && rpcErr.code !== 'PGRST202' && !String(rpcErr.message || '').includes('Could not find the function')) {
            return formatResponse({
              ok: false,
              error: { code: rpcErr.code || 'RPC_ERROR', message: rpcErr.message }
            });
          }
        } catch (_) {}

        // Strategy 2: Edge Function create-user (jika di-deploy)
        try {
          if (window.supabase.functions && typeof window.supabase.functions.invoke === 'function') {
            const { data: funcData, error: funcErr } = await window.supabase.functions.invoke('create-user', {
              body: { email: cleanEmail, password, role: cleanRole.toLowerCase(), full_name: cleanName }
            });
            if (!funcErr && funcData && (funcData.success || funcData.user)) {
              return formatResponse({
                ok: true,
                data: funcData.user || funcData,
                meta: { message: `User ${cleanEmail} berhasil dibuat` }
              });
            }
          }
        } catch (_) {}

        // Strategy 3: Supabase Auth direct signup
        try {
          const clientUrl = window.supabase?.supabaseUrl || 'https://kvdktgknwxmqpankwpre.supabase.co';
          const clientKey = window.supabase?.supabaseKey || '';

          const res = await fetch(`${clientUrl}/auth/v1/signup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': clientKey
            },
            body: JSON.stringify({
              email: cleanEmail,
              password: password,
              data: { full_name: cleanName, name: cleanName }
            })
          });

          const resData = await res.json();
          if (res.ok && resData) {
            const newUserId = resData.user?.id || resData.id;
            if (newUserId) {
              await users.updateRole(newUserId, cleanRole);
              await window.supabase.from('profiles').update({
                full_name: cleanName,
                name: cleanName,
                email: cleanEmail
              }).eq('id', newUserId);
            }

            return formatResponse({
              ok: true,
              data: resData.user || resData,
              meta: { message: `User ${cleanEmail} berhasil dibuat` }
            });
          }

          const errMsg = resData.msg || resData.error_description || resData.message || resData.error || '';
          const errCode = resData.error_code || resData.code || '';

          if (errCode === 'over_email_send_rate_limit' || errMsg.toLowerCase().includes('rate limit')) {
            return formatResponse({
              ok: false,
              error: {
                code: 'RATE_LIMIT',
                message: 'Batas kirim email Supabase tercapai (rate limit). Matikan opsi "Confirm email" di Supabase Dashboard (Authentication > Providers > Email) atau jalankan SQL admin_create_user di SQL Editor agar user bisa langsung dibuat.'
              }
            });
          }

          if (errCode === 'user_already_exists' || errMsg.toLowerCase().includes('already registered')) {
            return formatResponse({
              ok: false,
              error: { code: 'DUPLICATE_EMAIL', message: `Email "${cleanEmail}" sudah terdaftar di sistem.` }
            });
          }

          if (errCode === 'email_address_invalid' || errMsg.toLowerCase().includes('email')) {
            return formatResponse({
              ok: false,
              error: { code: 'INVALID_EMAIL', message: `Format email "${cleanEmail}" tidak valid.` }
            });
          }

          return formatResponse({
            ok: false,
            error: { code: errCode || 'SIGNUP_ERROR', message: errMsg || 'Gagal mendaftarkan user' }
          });
        } catch (signupErr) {
          return handleError(signupErr);
        }
      }

      return apiRequest('/system/users', {
        method: 'POST',
        body: { email: cleanEmail, password, role: cleanRole, full_name: cleanName },
        ...opts
      });
    }
};

export default users;
