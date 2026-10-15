/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/return.js
   Layer API untuk Modul Retur Barang (returns)
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError, isMockMode } from './_client.js';

const now = new Date();
const formatDateOffset = (days) => {
  const d = new Date(now.getTime() + days * 86400000);
  return d.toISOString().slice(0, 10);
};

// Mock data untuk development & offline fallback
let MOCK_RETURNS = [];

export const returnApi = {
  /**
   * Helper untuk membuat nomor retur otomatis
   */
  generateNoRetur(tipe = 'ke_supplier') {
    const prefix = tipe === 'ke_supplier' ? 'RET-SUP' : 'RET-CUST';
    const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
    const rand = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${dateStr}-${rand}`;
  },

  /**
   * Mengambil daftar retur dengan filter
   */
  async getAll({ page = 1, limit = 50, tipe = null, status = null, search = '', startDate = null, endDate = null } = {}) {
    if (isMockMode()) {
      return this._getMockData({ page, limit, tipe, status, search, startDate, endDate });
    }

    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('returns')
        .select('*', { count: 'exact' });

      if (tipe && tipe !== 'ALL') {
        query = query.eq('tipe', tipe.toLowerCase());
      }

      if (status && status !== 'ALL') {
        query = query.eq('status', status.toLowerCase());
      }

      if (startDate) {
        query = query.gte('tanggal', startDate);
      }
      if (endDate) {
        query = query.lte('tanggal', endDate);
      }

      if (search && search.trim() !== '') {
        const s = search.trim();
        query = query.or(`no_retur.ilike.%${s}%,alasan.ilike.%${s}%,keterangan.ilike.%${s}%`);
      }

      const { data, error, count } = await query
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.warn('[ReturnApi] Supabase error, fallback to mock:', error.message);
        return this._getMockData({ page, limit, tipe, status, search, startDate, endDate });
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
      console.warn('[ReturnApi] Exception, fallback to mock:', err);
      return this._getMockData({ page, limit, tipe, status, search, startDate, endDate });
    }
  },

  /**
   * Mengambil kalkulasi KPI Retur
   */
  async getSummary(inputItems = null) {
    try {
      let items;
      if (inputItems && Array.isArray(inputItems)) {
        items = inputItems;
      } else {
        const res = await this.getAll({ page: 1, limit: 1000 });
        items = res.data || [];
      }

      const currentMonthPrefix = new Date().toISOString().slice(0, 7);

      let returKeSupplierBulanIni = 0;
      let returDariCustomerBulanIni = 0;
      let nilaiReturBulanIni = 0;
      let sedangDiprosesCount = 0;

      items.forEach(r => {
        const isThisMonth = (r.tanggal || r.created_at || '').startsWith(currentMonthPrefix);
        const qty = Number(r.qty) || 0;
        const harga = Number(r.harga_satuan) || 250000; // estimasi nilai satuan rata-rata jika kolom belum ada

        if (r.status === 'diproses') {
          sedangDiprosesCount++;
        }

        if (isThisMonth) {
          if (r.tipe === 'ke_supplier') {
            returKeSupplierBulanIni += qty;
          } else if (r.tipe === 'dari_customer') {
            returDariCustomerBulanIni += qty;
          }
          nilaiReturBulanIni += (qty * harga);
        }
      });

      return formatResponse({
        ok: true,
        data: {
          returKeSupplier: returKeSupplierBulanIni,
          returDariCustomer: returDariCustomerBulanIni,
          nilaiReturBulanIni: nilaiReturBulanIni,
          sedangDiproses: sedangDiprosesCount,
          totalSemua: items.length
        }
      });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Menambah pencatatan retur baru
   */
  async create({ no_retur, tanggal, tipe, produk_id = null, produk_nama = '', qty, harga_satuan = 0, alasan, status = 'diproses', keterangan = '' }) {
    try {
      let created_by = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          created_by = authData.user.id;
        }
      } catch (_) {}

      const autoNo = no_retur && no_retur.trim() !== '' ? no_retur.trim() : this.generateNoRetur(tipe);

      const payload = {
        no_retur: autoNo,
        tanggal: tanggal || new Date().toISOString().slice(0, 10),
        tipe: (tipe || 'ke_supplier').toLowerCase(),
        produk_id: produk_id || null,
        qty: Number(qty) || 1,
        alasan: (alasan || '').trim(),
        status: status || 'diproses',
        keterangan: keterangan ? keterangan.trim() : (produk_nama ? `Barang: ${produk_nama}` : null),
        created_by,
        created_at: new Date().toISOString()
      };

      if (!isMockMode()) {
        const { data, error } = await supabase.from('returns').insert([payload]).select().single();
        if (!error && data) {
          return formatResponse({ ok: true, data });
        }
      }

      const mockNew = {
        id: `ret-${Date.now()}`,
        produk_nama: produk_nama || 'Barang Retur',
        harga_satuan: Number(harga_satuan) || 0,
        ...payload
      };
      MOCK_RETURNS.unshift(mockNew);
      return formatResponse({ ok: true, data: mockNew });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Mengupdate data retur (misal update status menjadi selesai atau ditolak)
   */
  async update(id, updates) {
    try {
      if (!isMockMode()) {
        const { data, error } = await supabase.from('returns').update(updates).eq('id', id).select().single();
        if (!error && data) {
          return formatResponse({ ok: true, data });
        }
      }

      const idx = MOCK_RETURNS.findIndex(r => r.id === id);
      if (idx !== -1) {
        MOCK_RETURNS[idx] = { ...MOCK_RETURNS[idx], ...updates };
        return formatResponse({ ok: true, data: MOCK_RETURNS[idx] });
      }

      return formatResponse({ ok: false, error: { message: 'Data retur tidak ditemukan' } });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Menghapus catatan retur
   */
  async delete(id) {
    try {
      if (!isMockMode()) {
        const { error } = await supabase.from('returns').delete().eq('id', id);
        if (!error) {
          return formatResponse({ ok: true, data: { id } });
        }
      }

      MOCK_RETURNS = MOCK_RETURNS.filter(r => r.id !== id);
      return formatResponse({ ok: true, data: { id } });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Helper internal untuk memfilter mock data
   */
  _getMockData({ page = 1, limit = 50, tipe = null, status = null, search = '', startDate = null, endDate = null }) {
    let list = [...MOCK_RETURNS];

    if (tipe && tipe !== 'ALL') {
      list = list.filter(r => r.tipe === tipe.toLowerCase());
    }

    if (status && status !== 'ALL') {
      list = list.filter(r => r.status === status.toLowerCase());
    }

    if (startDate) {
      list = list.filter(r => (r.tanggal || '') >= startDate);
    }
    if (endDate) {
      list = list.filter(r => (r.tanggal || '') <= endDate);
    }

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        (r.no_retur && r.no_retur.toLowerCase().includes(q)) ||
        (r.alasan && r.alasan.toLowerCase().includes(q)) ||
        (r.produk_nama && r.produk_nama.toLowerCase().includes(q)) ||
        (r.keterangan && r.keterangan.toLowerCase().includes(q))
      );
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

export default returnApi;
