/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/notif.js
   Layer API untuk Modul Notifikasi (notifications)
   Data notifikasi langsung dari Supabase
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError } from './_client.js';

export const notif = {
  /**
   * Mengambil daftar notifikasi pengguna aktif
   * @param {Object} options
   * @param {string} options.filter - 'all' | 'unread' | 'read'
   * @param {number} options.limit - Jumlah maksimal notifikasi
   */
  async getAll({ filter = 'all', limit = 50 } = {}) {
    try {
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' });

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'read') {
        query = query.eq('is_read', true);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[NotifApi] Supabase query error:', error.message);
        return formatResponse({
          ok: false,
          data: [],
          error: { message: error.message },
          meta: { total: 0, unread: 0 }
        });
      }

      const items = data || [];
      const unreadCount = items.filter(n => !n.is_read).length;

      return formatResponse({
        ok: true,
        data: items,
        meta: {
          total: count !== null ? count : items.length,
          unread: unreadCount
        }
      });
    } catch (err) {
      console.warn('[NotifApi] Exception fetching notifications:', err);
      return formatResponse({
        ok: false,
        data: [],
        error: { message: err.message },
        meta: { total: 0, unread: 0 }
      });
    }
  },

  /**
   * Mengambil jumlah notifikasi yang belum dibaca
   */
  async getUnreadCount() {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      if (error) {
        return 0;
      }
      return count || 0;
    } catch (_) {
      return 0;
    }
  },

  /**
   * Menandai satu notifikasi sebagai sudah dibaca
   */
  async markAsRead(id) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return formatResponse({ ok: false, error: { message: error.message } });
      }

      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Menandai seluruh notifikasi belum dibaca milik pengguna sebagai sudah dibaca
   */
  async markAllAsRead() {
    try {
      let currentUserId = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) currentUserId = authData.user.id;
      } catch (_) {}

      let query = supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (currentUserId) {
        query = query.eq('user_id', currentUserId);
      }

      const { data, error } = await query.select();

      if (error) {
        return formatResponse({ ok: false, error: { message: error.message } });
      }

      return formatResponse({ ok: true, data: data || [] });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Membuat notifikasi baru
   */
  async create({ user_id = null, tipe = 'info', judul, pesan = '', link = null }) {
    try {
      let targetUserId = user_id;
      if (!targetUserId) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) targetUserId = authData.user.id;
      }

      if (!targetUserId) {
        return formatResponse({ ok: false, error: { message: 'User ID tidak ditemukan' } });
      }

      const payload = {
        user_id: targetUserId,
        tipe: tipe || 'info',
        judul: (judul || '').trim(),
        pesan: (pesan || '').trim(),
        link: link ? link.trim() : null,
        is_read: false,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('notifications')
        .insert([payload])
        .select()
        .single();

      if (error) {
        return formatResponse({ ok: false, error: { message: error.message } });
      }

      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Menghapus notifikasi (khusus OWNER)
   */
  async delete(id) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) {
        return formatResponse({ ok: false, error: { message: error.message } });
      }

      return formatResponse({ ok: true, data: { id } });
    } catch (err) {
      return handleError(err);
    }
  }
};

export default notif;
