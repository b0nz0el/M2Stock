/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/debt.js
   Layer API untuk Modul Hutang & Piutang (debts)
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError, isMockMode } from './_client.js';

const now = new Date();
const formatDateOffset = (days) => {
  const d = new Date(now.getTime() + days * 86400000);
  return d.toISOString().slice(0, 10);
};

// Mock data untuk development & offline fallback
let MOCK_DEBTS = [
  {
    id: 'debt-001',
    tipe: 'hutang',
    pihak: 'CV Aqua Teknik',
    nominal: 2100000,
    jatuh_tempo: formatDateOffset(3),
    status: 'belum_bayar',
    catatan: 'Pembelian 5 unit Filter Canister 1000L/h (Faktur #PO-2026-004)',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString()
  },
  {
    id: 'debt-002',
    tipe: 'hutang',
    pihak: 'PT Sumber Pakan',
    nominal: 1100000,
    jatuh_tempo: formatDateOffset(12),
    status: 'belum_bayar',
    catatan: 'Pengadaan Pakan Ikan Hikari 50 pack',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString()
  },
  {
    id: 'debt-003',
    tipe: 'piutang',
    pihak: 'Budi Santoso',
    nominal: 1200000,
    jatuh_tempo: formatDateOffset(2),
    status: 'belum_bayar',
    catatan: 'Order Lampu LED Aquascape & Setting Custom Aquarium',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString()
  },
  {
    id: 'debt-004',
    tipe: 'piutang',
    pihak: 'Siti Nurhaliza',
    nominal: 600000,
    jatuh_tempo: formatDateOffset(5),
    status: 'belum_bayar',
    catatan: 'Peralatan fitting pipa & bio foam filter',
    created_at: new Date(Date.now() - 6 * 86400000).toISOString()
  },
  {
    id: 'debt-005',
    tipe: 'hutang',
    pihak: 'Mitra Surya Logistik',
    nominal: 450000,
    jatuh_tempo: formatDateOffset(-2),
    status: 'jatuh_tempo',
    catatan: 'Ongkos ekspedisi kargo pengiriman luar kota',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString()
  },
  {
    id: 'debt-006',
    tipe: 'piutang',
    pihak: 'Aquascape Corner',
    nominal: 850000,
    jatuh_tempo: formatDateOffset(-4),
    status: 'lunas',
    catatan: 'Pelunasan invoice #INV-0012 via transfer bank',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString()
  }
];

export const debt = {
  /**
   * Mengambil daftar hutang & piutang dengan filter
   */
  async getAll({ page = 1, limit = 50, tipe = null, status = null, search = '' } = {}) {
    if (isMockMode()) {
      return this._getMockData({ page, limit, tipe, status, search });
    }

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
        console.warn('[DebtApi] Supabase error, fallback to mock:', error.message);
        return this._getMockData({ page, limit, tipe, status, search });
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
      console.warn('[DebtApi] Exception, fallback to mock:', err);
      return this._getMockData({ page, limit, tipe, status, search });
    }
  },

  /**
   * Mengambil kalkulasi KPI Hutang & Piutang
   */
  async getSummary() {
    try {
      const res = await this.getAll({ page: 1, limit: 1000 });
      const items = res.data || [];

      const today = new Date().toISOString().slice(0, 10);
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

      if (!isMockMode()) {
        const { data, error } = await supabase.from('debts').insert([payload]).select().single();
        if (!error && data) {
          return formatResponse({ ok: true, data });
        }
      }

      const mockNew = { id: `debt-${Date.now()}`, ...payload };
      MOCK_DEBTS.unshift(mockNew);
      return formatResponse({ ok: true, data: mockNew });
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
      if (!isMockMode()) {
        const { data, error } = await supabase.from('debts').update(updates).eq('id', id).select().single();
        if (!error && data) {
          return formatResponse({ ok: true, data });
        }
      }

      const idx = MOCK_DEBTS.findIndex(d => d.id === id);
      if (idx !== -1) {
        MOCK_DEBTS[idx] = { ...MOCK_DEBTS[idx], ...updates };
        return formatResponse({ ok: true, data: MOCK_DEBTS[idx] });
      }

      return formatResponse({ ok: false, error: { message: 'Data hutang/piutang tidak ditemukan' } });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Menghapus catatan hutang/piutang
   */
  async delete(id) {
    try {
      if (!isMockMode()) {
        const { error } = await supabase.from('debts').delete().eq('id', id);
        if (!error) {
          return formatResponse({ ok: true, data: { id } });
        }
      }

      MOCK_DEBTS = MOCK_DEBTS.filter(d => d.id !== id);
      return formatResponse({ ok: true, data: { id } });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Helper internal untuk memfilter mock data
   */
  _getMockData({ page = 1, limit = 50, tipe = null, status = null, search = '' }) {
    let list = [...MOCK_DEBTS];

    if (tipe && tipe !== 'ALL') {
      list = list.filter(d => d.tipe === tipe.toLowerCase());
    }

    if (status && status !== 'ALL') {
      list = list.filter(d => d.status === status.toLowerCase());
    }

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      list = list.filter(d =>
        (d.pihak && d.pihak.toLowerCase().includes(q)) ||
        (d.catatan && d.catatan.toLowerCase().includes(q))
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
