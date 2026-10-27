/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/audit.js
   Layer API untuk Audit Logs
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError, getClientIp } from './_client.js';

export const audit = {
  /**
   * Mengambil daftar log aktivitas dengan pagination & filter
   */
  async getAll({ page = 1, limit = 20, action = null, search = '', startDate = null, endDate = null } = {}) {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });

      if (action && action !== 'ALL') {
        query = query.eq('action', action.toUpperCase());
      }

      if (search && search.trim() !== '') {
        const s = search.trim();
        query = query.or(`target.ilike.%${s}%,user_email.ilike.%${s}%,ip.ilike.%${s}%`);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        return formatResponse({ ok: false, error });
      }

      return formatResponse({
        ok: true,
        data: data || [],
        meta: {
          page: Number(page),
          limit: Number(limit),
          total: count || (data ? data.length : 0),
          totalPages: count ? Math.ceil(count / limit) : 1
        }
      });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Mengambil statistik ringkasan audit log
   */
  async getSummary(inputItems = null) {
    try {
      let logs;
      if (inputItems && Array.isArray(inputItems)) {
        logs = inputItems;
      } else {
        const res = await this.getAll({ page: 1, limit: 1000 });
        if (!res.ok) return res;
        logs = res.data || [];
      }

      const today = new Date().toISOString().slice(0, 10);
      const summary = {
        total: logs.length,
        todayCount: logs.filter(l => (l.created_at || '').startsWith(today)).length,
        createCount: logs.filter(l => l.action === 'CREATE').length,
        updateCount: logs.filter(l => l.action === 'UPDATE').length,
        deleteCount: logs.filter(l => l.action === 'DELETE').length,
        loginCount: logs.filter(l => l.action === 'LOGIN').length
      };

      return formatResponse({ ok: true, data: summary });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Mencatat aktivitas log baru
   */
  async log({ action, target, ip = null, user_id = null, user_email = null }) {
    try {
      // Auto-resolve IP publik pengguna jika tidak disediakan
      if (!ip) {
        try {
          ip = await getClientIp();
        } catch (_) {}
      }

      // Ambil user auth saat ini jika tidak disediakan
      if (!user_id || !user_email) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user) {
            user_id = user_id || authData.user.id;
            user_email = user_email || authData.user.email;
          }
        } catch (_) {}
      }

      const payload = {
        action: (action || '').toUpperCase(),
        target: target || null,
        ip: ip || null,
        user_id: user_id || null,
        user_email: user_email || null,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from('audit_logs').insert([payload]).select().single();

      if (error) {
        console.warn('[AuditApi] Insert failed:', error.message);
        return formatResponse({ ok: false, error });
      }

      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  }
};
