/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/po.js
   Layer API untuk Modul Purchase Order & PO Items
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError, isMockMode } from './_client.js';

const now = new Date();
const formatDateOffset = (days) => {
  const d = new Date(now.getTime() + days * 86400000);
  return d.toISOString().slice(0, 10);
};

// Mock data untuk development & offline fallback
let MOCK_POS = [
  {
    id: 'po-001',
    no_po: 'PO-202610-001',
    tanggal: formatDateOffset(-2),
    supplier_id: 'sup-001',
    supplier_nama: 'CV Aqua Teknik',
    status: 'dikirim',
    total: 3500000,
    catatan: 'Pengadaan filter canister & sparepart pompa celup',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    items: [
      { id: 'poi-001', product_nama: 'Canister Filter SunSun HW-3000', qty: 2, harga: 1250000, subtotal: 2500000 },
      { id: 'poi-002', product_nama: 'Lampu Submersible UV 11W', qty: 5, harga: 200000, subtotal: 1000000 }
    ]
  },
  {
    id: 'po-002',
    no_po: 'PO-202610-002',
    tanggal: formatDateOffset(-4),
    supplier_id: 'sup-002',
    supplier_nama: 'PT Sumber Pakan',
    status: 'draft',
    total: 1800000,
    catatan: 'Restock pakan pelet discus & cichlid bulanan',
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    items: [
      { id: 'poi-003', product_nama: 'Pakan Hikari Discus 100g', qty: 20, harga: 60000, subtotal: 1200000 },
      { id: 'poi-004', product_nama: 'Tetra Bits Complete 300ml', qty: 10, harga: 60000, subtotal: 600000 }
    ]
  },
  {
    id: 'po-003',
    no_po: 'PO-202610-003',
    tanggal: formatDateOffset(-7),
    supplier_id: 'sup-003',
    supplier_nama: 'PT Indo Aquarium Flora',
    status: 'diterima',
    total: 4200000,
    catatan: 'Pemesanan tanaman aquascape tissue culture & hardscape batu serryu',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    items: [
      { id: 'poi-005', product_nama: 'Anubias Nana Petite Cup', qty: 30, harga: 45000, subtotal: 1350000 },
      { id: 'poi-006', product_nama: 'Bucephalandra Brownie Ghost', qty: 15, harga: 110000, subtotal: 1650000 },
      { id: 'poi-007', product_nama: 'Batu Seiryu Stone A Grade (Kg)', qty: 40, harga: 30000, subtotal: 1200000 }
    ]
  },
  {
    id: 'po-004',
    no_po: 'PO-202610-004',
    tanggal: formatDateOffset(-12),
    supplier_id: 'sup-004',
    supplier_nama: 'CV Mitra Glassindo',
    status: 'diterima',
    total: 5400000,
    catatan: 'Custom aquarium optic clear 90x45x45 & cabinet kayu jati belanda',
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    items: [
      { id: 'poi-008', product_nama: 'Aquarium Rimless Optic Clear 90cm', qty: 3, harga: 1200000, subtotal: 3600000 },
      { id: 'poi-009', product_nama: 'Cabinet Kayu Aquascape 90cm', qty: 1, harga: 1800000, subtotal: 1800000 }
    ]
  },
  {
    id: 'po-005',
    no_po: 'PO-202610-005',
    tanggal: formatDateOffset(-15),
    supplier_id: 'sup-001',
    supplier_nama: 'CV Aqua Teknik',
    status: 'dibatalkan',
    total: 950000,
    catatan: 'Dibatalkan karena stok supplier kosong dan harga naik',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    items: [
      { id: 'poi-010', product_nama: 'Regulator CO2 Solenoid 220V', qty: 2, harga: 475000, subtotal: 950000 }
    ]
  }
];

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
    if (isMockMode()) {
      return this._getMockData({ page, limit, status, search, startDate, endDate });
    }

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
        console.warn('[POApi] Supabase error, fallback to mock:', error.message);
        return this._getMockData({ page, limit, status, search, startDate, endDate });
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
      console.warn('[POApi] Exception, fallback to mock:', err);
      return this._getMockData({ page, limit, status, search, startDate, endDate });
    }
  },

  /**
   * Mengambil ringkasan KPI Purchase Order
   */
  async getSummary() {
    try {
      const res = await this.getAll({ page: 1, limit: 1000 });
      const items = res.data || [];

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
    if (isMockMode()) {
      const found = MOCK_POS.find(p => p.id === id);
      return formatResponse({ ok: !!found, data: found });
    }

    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, purchase_order_items(*)')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        const found = MOCK_POS.find(p => p.id === id);
        return formatResponse({ ok: !!found, data: found });
      }

      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Membuat Purchase Order baru beserta item-itemnya
   */
  async create({ no_po, tanggal, supplier_id = null, supplier_nama = '', status = 'draft', catatan = '', items = [] }) {
    try {
      let created_by = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) created_by = authData.user.id;
      } catch (_) {}

      const autoNo = no_po && no_po.trim() !== '' ? no_po.trim() : this.generateNoPO();

      // Hitung total dari items
      let grandTotal = 0;
      const formattedItems = (items || []).map((it, idx) => {
        const qty = Math.max(1, Number(it.qty) || 1);
        const harga = Math.max(0, Number(it.harga) || 0);
        const subtotal = qty * harga;
        grandTotal += subtotal;
        return {
          id: `poi-${Date.now()}-${idx}`,
          product_id: it.product_id || null,
          product_nama: it.product_nama || `Barang #${idx + 1}`,
          qty,
          harga,
          subtotal
        };
      });

      const poPayload = {
        no_po: autoNo,
        tanggal: tanggal || new Date().toISOString().slice(0, 10),
        supplier_id: supplier_id || null,
        status: status || 'draft',
        total: grandTotal,
        catatan: catatan ? catatan.trim() : (supplier_nama ? `Supplier: ${supplier_nama}` : null),
        created_by,
        created_at: new Date().toISOString()
      };

      if (!isMockMode()) {
        const { data: insertedPO, error: poErr } = await supabase
          .from('purchase_orders')
          .insert([poPayload])
          .select()
          .single();

        if (!poErr && insertedPO) {
          if (formattedItems.length > 0) {
            const itemsPayload = formattedItems.map(it => ({
              po_id: insertedPO.id,
              product_id: it.product_id,
              qty: it.qty,
              harga: it.harga,
              subtotal: it.subtotal,
              created_at: new Date().toISOString()
            }));

            await supabase.from('purchase_order_items').insert(itemsPayload);
          }

          return formatResponse({
            ok: true,
            data: { ...insertedPO, items: formattedItems, supplier_nama }
          });
        }
      }

      const mockNew = {
        id: `po-${Date.now()}`,
        supplier_nama: supplier_nama || 'Supplier Umum',
        ...poPayload,
        items: formattedItems
      };
      MOCK_POS.unshift(mockNew);
      return formatResponse({ ok: true, data: mockNew });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Mengupdate data PO
   */
  async update(id, updates) {
    try {
      if (!isMockMode()) {
        const { data, error } = await supabase
          .from('purchase_orders')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          return formatResponse({ ok: true, data });
        }
      }

      const idx = MOCK_POS.findIndex(p => p.id === id);
      if (idx !== -1) {
        MOCK_POS[idx] = { ...MOCK_POS[idx], ...updates };
        return formatResponse({ ok: true, data: MOCK_POS[idx] });
      }

      return formatResponse({ ok: false, error: { message: 'PO tidak ditemukan' } });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Mengupdate status PO secara instan
   */
  async updateStatus(id, newStatus) {
    return this.update(id, { status: newStatus });
  },

  /**
   * Menghapus PO (otomatis cascade menghapus items di PostgreSQL)
   */
  async delete(id) {
    try {
      if (!isMockMode()) {
        const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
        if (!error) {
          return formatResponse({ ok: true, data: { id } });
        }
      }

      MOCK_POS = MOCK_POS.filter(p => p.id !== id);
      return formatResponse({ ok: true, data: { id } });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Helper internal untuk memfilter mock data
   */
  _getMockData({ page = 1, limit = 50, status = null, search = '', startDate = null, endDate = null }) {
    let list = [...MOCK_POS];

    if (status && status !== 'ALL') {
      list = list.filter(p => p.status === status.toLowerCase());
    }

    if (startDate) {
      list = list.filter(p => (p.tanggal || '') >= startDate);
    }
    if (endDate) {
      list = list.filter(p => (p.tanggal || '') <= endDate);
    }

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        (p.no_po && p.no_po.toLowerCase().includes(q)) ||
        (p.supplier_nama && p.supplier_nama.toLowerCase().includes(q)) ||
        (p.catatan && p.catatan.toLowerCase().includes(q))
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

export default po;
