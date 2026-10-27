/* ═══════════════════════════════════════════════════
   Aquastock Pro — api/debt.js
   Layer API untuk Modul Hutang & Piutang (debts)
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError } from './_client.js';

export const debt = {
  /**
   * Mengambil daftar hutang & piutang dengan filter
   */
  async getAll({ page = 1, limit = 50, tipe = null, status = null, search = '' } = {}) {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('debts')
        .select('*', { count: 'exact' });

      if (tipe && tipe !== 'ALL') {
        query = query.eq('tipe', tipe.toLowerCase());
      }

      if (status && status !== 'ALL') {
        query = query.eq('status', status.toLowerCase());
      }

      if (search && search.trim() !== '') {
        const s = search.trim();
        query = query.or(`pihak.ilike.%${s}%,catatan.ilike.%${s}%`);
      }

      const { data, error, count } = await query
        .order('jatuh_tempo', { ascending: true })
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
   * Mengambil kalkulasi KPI Hutang & Piutang
   */
  async getSummary(items) {
    try {
      // Terima items sebagai parameter (dari loadData), tidak panggil getAll lagi
      if (!items || !Array.isArray(items)) {
        items = [];
      }

      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const currentMonthPrefix = new Date().toISOString().slice(0, 7);

      let totalHutang = 0;
      let totalPiutang = 0;
      let countJatuhTempoSoon = 0;
      let countLunasBulanIni = 0;

      items.forEach(d => {
        const nom = Number(d.nominal) || 0;
        const isBelumLunas = d.status !== 'lunas';

        if (d.tipe === 'hutang' && isBelumLunas) {
          totalHutang += nom;
        } else if (d.tipe === 'piutang' && isBelumLunas) {
          totalPiutang += nom;
        }

        // Cek jatuh tempo minggu ini (atau sudah lewat)
        if (isBelumLunas && d.jatuh_tempo && d.jatuh_tempo <= nextWeek) {
          countJatuhTempoSoon++;
        }

        // Sudah lunas bulan ini
        if (d.status === 'lunas' && (d.created_at || '').startsWith(currentMonthPrefix)) {
          countLunasBulanIni++;
        }
      });

      return formatResponse({
        ok: true,
        data: {
          totalHutang,
          totalPiutang,
          jatuhTempoMingguIni: countJatuhTempoSoon,
          sudahLunasBulanIni: countLunasBulanIni,
          totalSemua: items.length
        }
      });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Menambah pencatatan hutang/piutang baru
   */
  async create({ tipe, pihak, nominal, jatuh_tempo = null, status = 'belum_bayar', catatan = '' }) {
    try {
      let created_by = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          created_by = authData.user.id;
        }
      } catch (_) {}

      const payload = {
        tipe: (tipe || 'hutang').toLowerCase(),
        pihak: (pihak || '').trim(),
        nominal: Number(nominal) || 0,
        jatuh_tempo: jatuh_tempo || null,
        status: status || 'belum_bayar',
        catatan: catatan ? catatan.trim() : null,
        created_by,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from('debts').insert([payload]).select().single();
      if (error) {
        return formatResponse({ ok: false, error });
      }
      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Mengubah status menjadi lunas
   */
  async markAsLunas(id) {
    return this.update(id, { status: 'lunas' });
  },

  /**
   * Mengupdate data hutang/piutang
   */
  async update(id, updates) {
    try {
      const { data, error } = await supabase.from('debts').update(updates).eq('id', id).select().single();
      if (error) {
        return formatResponse({ ok: false, error });
      }
      if (!data) {
        return formatResponse({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Data hutang/piutang tidak ditemukan' }
        });
      }
      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Menghapus catatan hutang/piutang
   */
  async delete(id) {
    try {
      const { error } = await supabase.from('debts').delete().eq('id', id);
      if (error) {
        return formatResponse({ ok: false, error });
      }
      return formatResponse({ ok: true, data: { id } });
    } catch (err) {
      return handleError(err);
    }
  }
};
