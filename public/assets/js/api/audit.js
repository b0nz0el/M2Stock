/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/audit.js
   Layer API untuk Audit Logs
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError, isMockMode } from './_client.js';

// Mock audit logs data untuk fallback
const MOCK_AUDIT_LOGS = [
  {
    id: 'log-001',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'owner@aquastock.pro',
    action: 'CREATE',
    target: 'Barang "Pipa PVC 1/2 inch"',
    ip: '192.168.1.5',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  {
    id: 'log-002',
    user_id: '00000000-0000-0000-0000-000000000003',
    user_email: 'staff@aquastock.pro',
    action: 'UPDATE',
    target: 'Stok Pompa Air Submersible: 10 → 12',
    ip: '192.168.1.8',
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString()
  },
  {
    id: 'log-003',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'owner@aquastock.pro',
    action: 'LOGIN',
    target: 'Login berhasil via Desktop Chrome',
    ip: '192.168.1.5',
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  {
    id: 'log-004',
    user_id: '00000000-0000-0000-0000-000000000003',
    user_email: 'staff@aquastock.pro',
    action: 'DELETE',
    target: 'Transaksi draft #TRX-DRAFT-09',
    ip: '192.168.1.8',
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
  },
  {
    id: 'log-005',
    user_id: '00000000-0000-0000-0000-000000000003',
    user_email: 'staff@aquastock.pro',
    action: 'LOGIN',
    target: 'Login kasir via Android App PrinterJTM',
    ip: '192.168.1.12',
    created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString()
  }
];

export const audit = {
  /**
   * Mengambil daftar log aktivitas dengan pagination & filter
   */
  async getAll({ page = 1, limit = 20, action = null, search = '', startDate = null, endDate = null } = {}) {
    if (isMockMode()) {
      return this._getMockData({ page, limit, action, search, startDate, endDate });
    }

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
        // Fallback jika tabel belum termigrasi atau permission denied
        console.warn('[AuditApi] Supabase query failed, using fallback:', error.message);
        return this._getMockData({ page, limit, action, search, startDate, endDate });
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
      console.warn('[AuditApi] Exception caught, using fallback:', err);
      return this._getMockData({ page, limit, action, search, startDate, endDate });
    }
  },

  /**
   * Mengambil statistik ringkasan audit log
   */
  async getSummary() {
    try {
      const res = await this.getAll({ page: 1, limit: 1000 });
      const logs = res.data || [];

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
        action: (action || 'CREATE').toUpperCase(),
        target: target || '-',
        ip: ip || '127.0.0.1',
        user_id: user_id || null,
        user_email: user_email || 'system@aquastock.pro',
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
  },

  /**
   * Helper internal untuk memfilter mock audit logs
   */
  _getMockData({ page = 1, limit = 20, action = null, search = '', startDate = null, endDate = null }) {
    let list = [...MOCK_AUDIT_LOGS];

    if (action && action !== 'ALL') {
      list = list.filter(l => l.action === action.toUpperCase());
    }

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      list = list.filter(l =>
        (l.target && l.target.toLowerCase().includes(q)) ||
        (l.user_email && l.user_email.toLowerCase().includes(q)) ||
        (l.ip && l.ip.includes(q))
      );
    }

    if (startDate) {
      list = list.filter(l => l.created_at >= startDate);
    }
    if (endDate) {
      list = list.filter(l => l.created_at <= endDate);
    }

    const total = list.length;
    const from = (page - 1) * limit;
    const paginated = list.slice(from, from + limit);

    return formatResponse({
      ok: true,
      data: paginated,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total: total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  }
};
