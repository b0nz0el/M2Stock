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
