/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/cash.js
   Layer API untuk Modul Kas & Keuangan (cash_flow)
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError, isMockMode } from './_client.js';

// Mock data untuk development & offline fallback
let MOCK_CASH_FLOW = [];

export const cash = {
  /**
   * Mengambil data arus kas dengan pagination dan filter
   */
  async getAll({ page = 1, limit = 20, kategori = null, metode = null, startDate = null, endDate = null, search = '' } = {}) {
    if (isMockMode()) {
      return this._getMockData({ page, limit, kategori, metode, startDate, endDate, search });
    }

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
        console.warn('[CashApi] Supabase query error, fallback to mock:', error.message);
        return this._getMockData({ page, limit, kategori, metode, startDate, endDate, search });
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
      console.warn('[CashApi] Exception, fallback to mock:', err);
      return this._getMockData({ page, limit, kategori, metode, startDate, endDate, search });
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

      if (!isMockMode()) {
        const { data, error } = await supabase.from('cash_flow').insert([payload]).select().single();
        if (!error && data) {
          return formatResponse({ ok: true, data });
        }
      }

      // Mock fallback
      const mockNew = { id: `cf-${Date.now()}`, ...payload };
      MOCK_CASH_FLOW.unshift(mockNew);
      return formatResponse({ ok: true, data: mockNew });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Memperbarui entri arus kas
   */
  async update(id, updates) {
    try {
      if (!isMockMode()) {
        const { data, error } = await supabase.from('cash_flow').update(updates).eq('id', id).select().single();
        if (!error && data) {
          return formatResponse({ ok: true, data });
        }
      }

      const idx = MOCK_CASH_FLOW.findIndex(c => c.id === id);
      if (idx !== -1) {
        MOCK_CASH_FLOW[idx] = { ...MOCK_CASH_FLOW[idx], ...updates };
        return formatResponse({ ok: true, data: MOCK_CASH_FLOW[idx] });
      }

      return formatResponse({ ok: false, error: { message: 'Transaksi kas tidak ditemukan' } });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Menghapus entri arus kas
   */
  async delete(id) {
    try {
      if (!isMockMode()) {
        const { error } = await supabase.from('cash_flow').delete().eq('id', id);
        if (!error) {
          return formatResponse({ ok: true, data: { id } });
        }
      }

      MOCK_CASH_FLOW = MOCK_CASH_FLOW.filter(c => c.id !== id);
      return formatResponse({ ok: true, data: { id } });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Helper internal untuk memfilter mock data
   */
  _getMockData({ page = 1, limit = 20, kategori = null, metode = null, startDate = null, endDate = null, search = '' }) {
    let list = [...MOCK_CASH_FLOW];

    if (kategori && kategori !== 'ALL') {
      list = list.filter(c => c.kategori === kategori);
    }

    if (metode && metode !== 'ALL') {
      list = list.filter(c => c.metode === metode);
    }

    if (startDate) {
      list = list.filter(c => c.tanggal >= startDate);
    }

    if (endDate) {
      list = list.filter(c => c.tanggal <= endDate);
    }

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      list = list.filter(c => c.keterangan && c.keterangan.toLowerCase().includes(q));
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
