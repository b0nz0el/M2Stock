/* ═══════════════════════════════════════════════════
   Aquastock Pro — api/cash.js
   Layer API untuk Modul Kas & Keuangan (cash_flow)
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError, logAudit } from './_client.js';

export const cash = {
  /**
   * Mengambil data arus kas dengan pagination dan filter
   */
  async getAll({ page = 1, limit = 20, kategori = null, metode = null, startDate = null, endDate = null, search = '' } = {}) {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('cash_flow')
        .select('*', { count: 'exact' });

      if (kategori && kategori !== 'ALL') {
        query = query.eq('kategori', kategori);
      }

      if (metode && metode !== 'ALL') {
        query = query.eq('metode', metode);
      }

      if (startDate) {
        query = query.gte('tanggal', startDate);
      }

      if (endDate) {
        query = query.lte('tanggal', endDate);
      }

      if (search && search.trim() !== '') {
        const s = search.trim();
        query = query.ilike('keterangan', `%${s}%`);
      }

      const { data, error, count } = await query
        .order('tanggal', { ascending: false })
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
   * Mengambil statistik ringkasan KPI arus kas
   */
  async getSummary({ month = null, year = null, items: inputItems = null } = {}) {
    try {
      let items;
      if (inputItems && Array.isArray(inputItems)) {
        items = inputItems;
      } else {
        const res = await this.getAll({ page: 1, limit: 1000 });
        if (!res.ok) return res;
        items = res.data || [];
      }

      const now = new Date();
      const currentYear = year || now.getFullYear();
      const currentMonth = month !== null ? month : (now.getMonth() + 1);
      const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      let totalPemasukanAll = 0;
      let totalPengeluaranAll = 0;
      let pemasukanBulanIni = 0;
      let pengeluaranBulanIni = 0;

      items.forEach(row => {
        const inVal = Number(row.pemasukan) || 0;
        const outVal = Number(row.pengeluaran) || 0;

        totalPemasukanAll += inVal;
        totalPengeluaranAll += outVal;

        if ((row.tanggal || '').startsWith(monthPrefix)) {
          pemasukanBulanIni += inVal;
          pengeluaranBulanIni += outVal;
        }
      });

      const saldoKas = totalPemasukanAll - totalPengeluaranAll;
      const labaBersihBulanIni = pemasukanBulanIni - pengeluaranBulanIni;

      return formatResponse({
        ok: true,
        data: {
          saldoKas,
          totalPemasukanAll,
          totalPengeluaranAll,
          pemasukanBulanIni,
          pengeluaranBulanIni,
          labaBersihBulanIni,
          totalTransaksi: items.length
        }
      });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Menambahkan entri arus kas baru
   */
  async create({ tanggal, keterangan, kategori, metode, pemasukan = 0, pengeluaran = 0 }) {
    try {
      let created_by = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          created_by = authData.user.id;
        }
      } catch (_) {}

      const payload = {
        tanggal: tanggal || new Date().toISOString().slice(0, 10),
        keterangan: (keterangan || '').trim(),
        kategori: kategori || 'Lainnya',
        metode: metode || 'Cash',
        pemasukan: Number(pemasukan) || 0,
        pengeluaran: Number(pengeluaran) || 0,
        created_by,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from('cash_flow').insert([payload]).select().single();
      if (error) {
        return formatResponse({ ok: false, error });
      }

      try {
        if (typeof logAudit === 'function') {
          const inVal = Number(pemasukan) || 0;
          const outVal = Number(pengeluaran) || 0;
          const nominal = inVal > 0 ? inVal : outVal;
          const tipeKas = inVal > 0 ? 'Pemasukan' : 'Pengeluaran';
          logAudit('CREATE', `Catat Kas (${tipeKas}): ${(keterangan || '').slice(0, 40)} (Rp ${nominal.toLocaleString('id-ID')})`);
        }
      } catch (_) {}

      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Memperbarui entri arus kas
   */
  async update(id, updates) {
    try {
      const { data, error } = await supabase.from('cash_flow').update(updates).eq('id', id).select().single();
      if (error) {
        return formatResponse({ ok: false, error });
      }
      if (!data) {
        return formatResponse({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Transaksi kas tidak ditemukan' }
        });
      }
      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Menghapus entri arus kas
   */
  async delete(id) {
    try {
      const { error } = await supabase.from('cash_flow').delete().eq('id', id);
      if (error) {
        return formatResponse({ ok: false, error });
      }

      try {
        if (typeof logAudit === 'function') {
          logAudit('DELETE', `Hapus Entri Kas ID: ${id}`);
        }
      } catch (_) {}

      return formatResponse({ ok: true, data: { id } });
    } catch (err) {
      return handleError(err);
    }
  }
};
