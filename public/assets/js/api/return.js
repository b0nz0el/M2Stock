/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/return.js
   Layer API untuk Modul Retur Barang (returns)
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError } from './_client.js';

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
  async getAll({ page = 1, limit = 50, tipe = null, status = null, search = '', productIds = [], startDate = null, endDate = null } = {}) {
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
        const searchFilters = [
          `no_retur.ilike.%${s}%`,
          `alasan.ilike.%${s}%`,
          `keterangan.ilike.%${s}%`
        ];
        if (productIds.length) {
          searchFilters.push(`produk_id.in.(${productIds.join(',')})`);
        }
        query = query.or(searchFilters.join(','));
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
   * Mengambil kalkulasi KPI Retur
   */
  async getSummary(inputItems = null) {
    try {
      let items;
      if (inputItems && Array.isArray(inputItems)) {
        items = inputItems;
      } else {
        const res = await this.getAll({ page: 1, limit: 1000 });
        if (!res.ok) return res;
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
        const harga = Number(r.harga_satuan) || 0;

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
   * Menambah pencatatan retur baru dengan relasi dan harga satuan
   */
  async create({ no_retur, tanggal, tipe, produk_id, qty, harga_satuan = 0, supplier_id = null, customer_id = null, alasan, status = 'diproses', keterangan = '' }) {
    if (!produk_id) {
      return formatResponse({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Produk retur wajib dipilih dari master barang'
        }
      });
    }

    try {
      let created_by = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          created_by = authData.user.id;
        }
      } catch (_) {}

      const autoNo = no_retur && no_retur.trim() !== '' ? no_retur.trim() : this.generateNoRetur(tipe);

      // Ambil nama produk untuk snapshot
      let snapshot_product_name = null;
      try {
        const { data: pData } = await supabase.from('products').select('name').eq('id', produk_id).maybeSingle();
        if (pData?.name) snapshot_product_name = pData.name;
      } catch (_) {}

      const payload = {
        no_retur: autoNo,
        tanggal: tanggal || new Date().toISOString().slice(0, 10),
        tipe: (tipe || 'ke_supplier').toLowerCase(),
        produk_id,
        supplier_id: supplier_id || null,
        customer_id: customer_id || null,
        qty: Number(qty) || 1,
        harga_satuan: Number(harga_satuan) || 0,
        snapshot_product_name,
        alasan: (alasan || '').trim(),
        status: status || 'diproses',
        keterangan: keterangan ? keterangan.trim() || null : null,
        created_by,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from('returns').insert([payload]).select().single();
      if (error) {
        return formatResponse({ ok: false, error });
      }
      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Mengupdate data retur
   * Jika status diubah menjadi 'selesai', memicu complete_return RPC untuk memutasi stok
   */
  async update(id, updates) {
    try {
      if (updates && updates.status === 'selesai') {
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('complete_return', {
            p_return_id: id
          });
          if (!rpcErr && rpcData && rpcData.ok) {
            return formatResponse({ ok: true, data: rpcData });
          }
          if (rpcErr) {
            return formatResponse({ ok: false, error: rpcErr });
          }
        } catch (_) {}
      }

      const { data, error } = await supabase.from('returns').update(updates).eq('id', id).select().single();
      if (error) {
        return formatResponse({ ok: false, error });
      }
      if (!data) {
        return formatResponse({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Data retur tidak ditemukan' }
        });
      }
      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Menghapus catatan retur
   */
  async delete(id) {
    try {
      const { data, error } = await supabase
        .from('returns')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (error) {
        return formatResponse({ ok: false, error });
      }
      if (!data) {
        return formatResponse({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Catatan retur tidak ditemukan atau tidak dapat dihapus' }
        });
      }
      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  }
};

export default returnApi;
