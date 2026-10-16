/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/po.js
   Layer API untuk Modul Purchase Order & PO Items
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError } from './_client.js';

export const po = {
  /**
   * Helper auto-generator nomor Purchase Order
   */
  generateNoPO() {
    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const rand = Math.floor(100 + Math.random() * 900);
    return `PO-${ym}-${rand}`;
  },

  /**
   * Mengambil daftar PO lengkap dengan filter
   */
  async getAll({ page = 1, limit = 50, status = null, search = '', startDate = null, endDate = null } = {}) {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('purchase_orders')
        .select('*, purchase_order_items(id, product_id, qty, harga, subtotal)', { count: 'exact' });

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
        query = query.or(`no_po.ilike.%${s}%,catatan.ilike.%${s}%`);
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
   * Mengambil ringkasan KPI Purchase Order
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

      let totalPOBulanIni = 0;
      let countDraft = 0;
      let countDikirim = 0;
      let totalNilaiBulanIni = 0;

      items.forEach(p => {
        const isThisMonth = (p.tanggal || p.created_at || '').startsWith(currentMonthPrefix);
        const st = (p.status || '').toLowerCase();
        const total = Number(p.total) || 0;

        if (st === 'draft') countDraft++;
        if (st === 'dikirim') countDikirim++;

        if (isThisMonth && st !== 'dibatalkan') {
          totalPOBulanIni++;
          totalNilaiBulanIni += total;
        }
      });

      return formatResponse({
        ok: true,
        data: {
          totalPOBulanIni,
          draftPO: countDraft,
          dikirim: countDikirim,
          totalNilaiPOBulanIni: totalNilaiBulanIni,
          totalSemua: items.length
        }
      });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Mengambil detail 1 PO beserta seluruh items
   */
  async getById(id) {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, purchase_order_items(*)')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return formatResponse({ ok: false, error });
      }
      if (!data) {
        return formatResponse({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Purchase order tidak ditemukan' }
        });
      }

      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Membuat Purchase Order baru beserta item-itemnya secara atomik
   */
  async create({ no_po, tanggal, supplier_id = null, supplier_nama = '', status = 'draft', catatan = '', items = [] }) {
    try {
      let created_by = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) created_by = authData.user.id;
      } catch (_) {}

      const autoNo = no_po && no_po.trim() !== '' ? no_po.trim() : this.generateNoPO();

      // Hitung total dari items & siapkan struktur payload
      let grandTotal = 0;
      const formattedItems = (items || []).map(it => {
        const qty = Math.max(1, Number(it.qty) || 1);
        const harga = Math.max(0, Number(it.harga) || 0);
        const subtotal = qty * harga;
        grandTotal += subtotal;
        return {
          product_id: it.product_id || null,
          product_name: it.product_name || it.product_nama || null,
          product_nama: it.product_name || it.product_nama || null,
          qty,
          harga,
          subtotal
        };
      });

      // 1. Coba eksekusi melalui PostgreSQL RPC atomik
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('create_purchase_order_atomic', {
          p_no_po: autoNo,
          p_tanggal: tanggal || new Date().toISOString().slice(0, 10),
          p_supplier_id: supplier_id || null,
          p_supplier_name: supplier_nama || '',
          p_status: status || 'draft',
          p_catatan: catatan || '',
          p_items: formattedItems
        });

        if (!rpcError && rpcData && rpcData.ok) {
          return formatResponse({
            ok: true,
            data: {
              id: rpcData.id,
              no_po: rpcData.no_po,
              total: rpcData.total,
              supplier_nama,
              items: formattedItems
            }
          });
        }
      } catch (_) {
        // Fallback ke insert langsung jika RPC belum terpasang di database
      }

      // 2. Fallback Direct Insert (jika RPC belum aktif)
      const poPayload = {
        no_po: autoNo,
        tanggal: tanggal || new Date().toISOString().slice(0, 10),
        supplier_id: supplier_id || null,
        supplier_name: supplier_nama || null,
        status: status || 'draft',
        total: grandTotal,
        catatan: catatan ? catatan.trim() : (supplier_nama ? `Supplier: ${supplier_nama}` : null),
        created_by,
        created_at: new Date().toISOString()
      };

      const { data: insertedPO, error: poErr } = await supabase
        .from('purchase_orders')
        .insert([poPayload])
        .select()
        .single();

      if (poErr) {
        return formatResponse({ ok: false, error: poErr });
      }
      if (!insertedPO) {
        return formatResponse({
          ok: false,
          error: { code: 'INSERT_FAILED', message: 'Purchase order tidak berhasil disimpan' }
        });
      }

      if (formattedItems.length > 0) {
        const itemsPayload = formattedItems.map(it => ({
          po_id: insertedPO.id,
          product_id: it.product_id,
          product_name: it.product_name || it.product_nama,
          qty: it.qty,
          harga: it.harga,
          subtotal: it.subtotal,
          created_at: new Date().toISOString()
        }));
        const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsPayload);
        if (itemsError) {
          // Rollback header jika items gagal disimpan
          await supabase.from('purchase_orders').delete().eq('id', insertedPO.id);
          return formatResponse({ ok: false, error: itemsError });
        }
      }

      return formatResponse({
        ok: true,
        data: { ...insertedPO, items: formattedItems, supplier_nama }
      });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Mengupdate data PO
   */
  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return formatResponse({ ok: false, error });
      }
      if (!data) {
        return formatResponse({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'PO tidak ditemukan' }
        });
      }
      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Mengupdate status PO secara aman & atomik
   * Jika status 'diterima', otomatis memicu receive_purchase_order RPC untuk mutasi stok
   */
  async updateStatus(id, newStatus, paymentMethod = 'Cash') {
    if (newStatus === 'diterima') {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('receive_purchase_order', {
          p_po_id: id,
          p_payment_method: paymentMethod || 'Cash'
        });
        if (!rpcErr && rpcData && rpcData.ok) {
          return formatResponse({ ok: true, data: rpcData });
        }
      } catch (_) {}
    }
    return this.update(id, { status: newStatus });
  },

  /**
   * Restock Assistant: Membuat Draft PO dari daftar barang dengan stok menipis (stock <= min_stock)
   */
  async generateFromLowStock(supplierId = null) {
    try {
      const { data, error } = await supabase.rpc('generate_draft_po_from_low_stock', {
        p_supplier_id: supplierId || null
      });
      if (error) {
        return formatResponse({ ok: false, error });
      }
      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Menghapus PO (otomatis cascade menghapus items di PostgreSQL)
   */
  async delete(id) {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
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
          error: { code: 'NOT_FOUND', message: 'Purchase Order tidak ditemukan atau tidak dapat dihapus' }
        });
      }
      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  }
};

export default po;
