/* ═══════════════════════════════════════════════════
   M2Stock — api/po.js
   Layer API untuk Modul Purchase Order & PO Items
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError, logAudit, notifyOwner } from './_client.js';

function getMonthKey(dateInput = new Date()) {
  if (typeof dateInput === 'string') {
    const match = dateInput.trim().match(/^(\d{4})-?(\d{2})/);
    if (match) {
      return `${match[1]}${match[2]}`;
    }
  }
  const dateObj = dateInput instanceof Date && !Number.isNaN(dateInput.getTime())
    ? dateInput
    : new Date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

function getLocalDateISO(dateInput = new Date()) {
  const dateObj = dateInput instanceof Date && !Number.isNaN(dateInput.getTime())
    ? dateInput
    : new Date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function findNextGapSequence(existingPOs = [], seqPattern) {
  const usedNumbers = new Set();
  const list = Array.isArray(existingPOs) ? existingPOs : [];

  list.forEach((entry) => {
    const rawNo = typeof entry === 'string' ? entry : entry?.no_po;
    if (typeof rawNo !== 'string') return;
    const match = rawNo.trim().match(seqPattern);
    if (!match) return;
    const num = Number.parseInt(match[1], 10);
    if (Number.isInteger(num) && num >= 1) {
      usedNumbers.add(num);
    }
  });

  let nextSeq = 1;
  while (usedNumbers.has(nextSeq)) {
    nextSeq += 1;
  }
  return nextSeq;
}

export const po = {
  getMonthKey(dateInput = new Date()) {
    return getMonthKey(dateInput);
  },

  /**
   * Helper auto-generator nomor Purchase Order berurutan per bulan (mulai dari 001).
   * Contoh: PO-202611-001, PO-202611-002, dst.
   * Jika ada PO yang dihapus atau belum tersimpan, otomatis menggunakan urutan terkecil yang tersedia dari 001.
   */
  generateNoPO(existingPOs = [], dateInput = new Date()) {
    const ym = getMonthKey(dateInput);
    const seqPattern = new RegExp(`^PO-${ym}-(\\d+)$`, 'i');
    const nextSeq = findNextGapSequence(existingPOs, seqPattern);
    return `PO-${ym}-${String(nextSeq).padStart(3, '0')}`;
  },

  /**
   * Helper Auto-Generator Nomor Auto-PO dengan Gap-Filling mulai dari 001.
   * Format: PO-{YYYYMM}-AUTO{NNN} (contoh: PO-202611-AUTO001).
   * Reset ke 001 otomatis setiap ganti bulan.
   */
  generateAutoNoPO(existingPOs = [], dateInput = new Date()) {
    const ym = getMonthKey(dateInput);
    const seqPattern = new RegExp(`^PO-${ym}-AUTO(\\d+)$`, 'i');
    const nextSeq = findNextGapSequence(existingPOs, seqPattern);
    return `PO-${ym}-AUTO${String(nextSeq).padStart(3, '0')}`;
  },

  /**
   * Mengagregasi penjualan bersih 7/30/90 hari per product_id dari riwayat transaksi.
   * Mengecualikan: transaksi non-'out', koreksi [STOCK OPNAME], retur supplier, dan transaksi pembatalan/reversal.
   */
  aggregateSalesVelocity(txRows = [], nowInput = new Date()) {
    const rows = Array.isArray(txRows) ? txRows : [];
    const nowDate = nowInput instanceof Date && !Number.isNaN(nowInput.getTime()) ? nowInput : new Date();
    const nowMs = nowDate.getTime();
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    const ms30d = 30 * 24 * 60 * 60 * 1000;
    const ms90d = 90 * 24 * 60 * 60 * 1000;

    const reversedOriginalIds = new Set();
    rows.forEach((tx) => {
      if (tx?.reversal_of_id) {
        reversedOriginalIds.add(String(tx.reversal_of_id).trim());
      }
    });

    const velocityMap = new Map();
    rows.forEach((tx) => {
      if (!tx || String(tx.type || '').toLowerCase() !== 'out') return;
      if (tx.reversal_of_id) return;
      if (tx.id !== undefined && tx.id !== null && reversedOriginalIds.has(String(tx.id).trim())) return;
      if (tx.return_id) return;
      if (String(tx.channel || '').trim().toLowerCase() === 'retur') return;

      const noteText = String(tx.note || '').trim() || String(tx.notes || '').trim();
      if (/\[STOCK\s+OPNAME\]/i.test(noteText)) return;

      const pid = tx.product_id !== undefined && tx.product_id !== null ? String(tx.product_id).trim() : '';
      if (!pid) return;

      const txMs = tx.created_at ? new Date(tx.created_at).getTime() : nowMs;
      if (!Number.isFinite(txMs)) return;
      const ageMs = nowMs - txMs;
      if (ageMs > ms90d || ageMs < -86400000) return;

      const qtyVal = Math.max(0, Number(tx.quantity ?? tx.qty ?? 0) || 0);
      if (qtyVal <= 0) return;

      if (!velocityMap.has(pid)) {
        velocityMap.set(pid, { sold_7d: 0, sold_30d: 0, sold_90d: 0 });
      }
      const bucket = velocityMap.get(pid);
      bucket.sold_90d += qtyVal;
      if (ageMs <= ms30d) bucket.sold_30d += qtyVal;
      if (ageMs <= ms7d) bucket.sold_7d += qtyVal;
    });

    return velocityMap;
  },

  /**
   * Menghitung saran pesanan "Auto Cerdas" berbasis Demand Velocity 7/30/90 hari.
   * Prioritas:
   * 1. Target eksplisit pemilik (target_stock / max_stock > 0)
   * 2. Demand Velocity (Weighted ADS * coverageDays, outlier cap 2.5x ADS 30h)
   * 3. Zero-Velocity Cap (<= 5 unit / min_stock) bila belum ada penjualan 90 hari
   */
  computeAutoOrderDetails(product = {}, salesMetrics = null, options = {}) {
    const rawStock = Number(product?.stock) || 0;
    const effectiveStock = Math.max(0, rawStock);
    const minStock = Math.max(0, Number(product?.min_stock) || 0);
    const rawTarget = Number(product?.target_stock);
    const rawMax = Number(product?.max_stock);
    const targetOrMax = Number.isFinite(rawTarget) && rawTarget > 0
      ? rawTarget
      : (Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 0);

    const parsedCoverage = Number(options?.coverageDays);
    const coverageDays = Number.isFinite(parsedCoverage) && parsedCoverage >= 1
      ? Math.min(90, Math.round(parsedCoverage))
      : 18;

    const raw7d = Math.max(0, Number(salesMetrics?.sold_7d ?? product?.sold_7d ?? 0) || 0);
    const raw30d = Math.max(raw7d, Math.max(0, Number(salesMetrics?.sold_30d ?? product?.sold_30d ?? 0) || 0));
    const raw90d = Math.max(raw30d, Math.max(0, Number(salesMetrics?.sold_90d ?? product?.sold_90d ?? 0) || 0));

    if (targetOrMax > 0) {
      const qty = Math.max(1, Math.ceil(targetOrMax - effectiveStock));
      return {
        qty,
        effectiveStock,
        weightedAds: 0,
        sold_7d: raw7d,
        sold_30d: raw30d,
        sold_90d: raw90d,
        targetQty: Math.ceil(targetOrMax),
        coverageDays,
        mode: 'explicit_target',
        reason: `Stok: ${rawStock} • Target manual: ${Math.ceil(targetOrMax)}`
      };
    }

    const ads7d = raw7d / 7.0;
    const ads30d = raw30d / 30.0;
    const ads90d = raw90d / 90.0;

    let weightedAds = 0;
    if (raw30d > 0) {
      const ads7dCapped = Math.min(ads7d, ads30d * 2.5);
      weightedAds = (0.45 * ads7dCapped) + (0.40 * ads30d) + (0.15 * ads90d);
    } else if (raw90d > 0) {
      weightedAds = ads90d * 0.75;
    }

    if (weightedAds > 0) {
      const demandTarget = Math.max(1, Math.ceil(weightedAds * coverageDays));
      const qty = Math.max(1, demandTarget - effectiveStock);
      const soldLabel = raw30d > 0 ? `Terjual 30h: ${Math.round(raw30d)}` : `Terjual 90h: ${Math.round(raw90d)}`;
      return {
        qty,
        effectiveStock,
        weightedAds: Number(weightedAds.toFixed(4)),
        sold_7d: raw7d,
        sold_30d: raw30d,
        sold_90d: raw90d,
        targetQty: demandTarget,
        coverageDays,
        mode: 'demand_velocity',
        reason: `Stok: ${rawStock} • ${soldLabel} • Saran ${coverageDays}h`
      };
    }

    const conservativeTarget = Math.min(Math.max(1, Math.ceil(minStock)), 5);
    const qty = Math.max(1, conservativeTarget - effectiveStock);
    return {
      qty,
      effectiveStock,
      weightedAds: 0,
      sold_7d: raw7d,
      sold_30d: raw30d,
      sold_90d: raw90d,
      targetQty: conservativeTarget,
      coverageDays,
      mode: 'zero_velocity_cap',
      reason: `Stok: ${rawStock} • Belum ada penjualan 90h`
    };
  },

  calculateAutoOrderQty(product = {}, salesMetrics = null, options = {}) {
    return this.computeAutoOrderDetails(product, salesMetrics, options).qty;
  },

  async _fetchAutoPoCoverageDays() {
    try {
      const base = supabase.from('app_settings')?.select('value');
      let q = base;
      if (typeof q?.eq === 'function') q = q.eq('key', 'stock_config');
      const { data, error } = typeof q?.maybeSingle === 'function'
        ? await q.maybeSingle()
        : await q;
      const val = Array.isArray(data) ? data[0]?.value : data?.value;
      if (!error && val) {
        const days = Number(val.auto_po_coverage_days ?? val.target_coverage_days);
        if (Number.isFinite(days) && days >= 1) {
          return Math.min(90, Math.round(days));
        }
      }
    } catch (_) {}
    return 18;
  },

  async _fetchSalesVelocityMap(productIds = null, nowInput = new Date()) {
    try {
      const nowDate = nowInput instanceof Date && !Number.isNaN(nowInput.getTime()) ? nowInput : new Date();
      const ninetyDaysAgoIso = new Date(nowDate.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      let q = supabase.from('transactions')?.select('*');
      if (!q) return new Map();
      if (Array.isArray(productIds) && productIds.length > 0 && typeof q.in === 'function') {
        q = q.in('product_id', productIds);
      }
      if (typeof q.gte === 'function') {
        q = q.gte('created_at', ninetyDaysAgoIso);
      }
      if (typeof q.limit === 'function') {
        q = q.limit(10000);
      }
      const { data, error } = await q;
      if (error || !Array.isArray(data)) return new Map();
      return this.aggregateSalesVelocity(data, nowDate);
    } catch (_) {
      return new Map();
    }
  },

  async getRestockInsightsForProducts(products = [], nowInput = new Date()) {
    const prodList = (Array.isArray(products) ? products : []).filter(p => p && p.id !== undefined && p.id !== null);
    const productIds = prodList.map(p => p.id);
    const [coverageDays, velocityMap] = await Promise.all([
      this._fetchAutoPoCoverageDays(),
      productIds.length > 0 ? this._fetchSalesVelocityMap(productIds, nowInput) : Promise.resolve(new Map())
    ]);
    const insights = new Map();
    prodList.forEach(p => {
      const metrics = velocityMap.get(String(p.id)) || null;
      insights.set(String(p.id), this.computeAutoOrderDetails(p, metrics, { coverageDays }));
    });
    return insights;
  },

  async _fetchMonthNoPOs(prefix, fallbackPOs = []) {
    try {
      const baseQuery = supabase
        .from('purchase_orders')
        .select('no_po')
        .ilike('no_po', `${prefix}%`);
      const { data, error } = typeof baseQuery?.limit === 'function'
        ? await baseQuery.limit(5000)
        : await baseQuery;

      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (_) {}
    return Array.isArray(fallbackPOs) ? fallbackPOs : [];
  },

  /**
   * Mengambil nomor PO manual berikutnya secara akurat dari database Supabase untuk bulan terkait.
   */
  async getNextNoPO(dateInput = new Date(), fallbackPOs = []) {
    const ym = getMonthKey(dateInput);
    const rows = await this._fetchMonthNoPOs(`PO-${ym}-`, fallbackPOs);
    return this.generateNoPO(rows, dateInput);
  },

  /**
   * Mengambil nomor Auto-PO berikutnya secara akurat dari database Supabase untuk bulan terkait.
   */
  async getNextAutoNoPO(dateInput = new Date(), fallbackPOs = []) {
    const ym = getMonthKey(dateInput);
    const rows = await this._fetchMonthNoPOs(`PO-${ym}-AUTO`, fallbackPOs);
    return this.generateAutoNoPO(rows, dateInput);
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
        .select(`
          *,
          suppliers (id, name, phone, address),
          purchase_order_items (
            id,
            po_id,
            product_id,
            product_name,
            qty,
            harga,
            subtotal,
            products (id, name, sku, brand)
          )
        `, { count: 'exact' });

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
        .select(`
          *,
          suppliers (id, name, phone, address),
          purchase_order_items (
            *,
            products (id, name, sku, brand)
          )
        `)
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

      const autoNo = no_po && no_po.trim() !== ''
        ? no_po.trim()
        : await this.getNextNoPO(tanggal || new Date());

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

      try {
        if (typeof logAudit === 'function') {
          logAudit('CREATE', `Buat Purchase Order: ${autoNo} (Supplier: ${supplier_nama || '-'})`);
        }
        if (typeof notifyOwner === 'function') {
          notifyOwner({
            tipe: 'info',
            judul: 'Purchase Order Baru',
            pesan: `PO ${autoNo} telah dibuat untuk supplier ${supplier_nama || '-'}.`,
            link: '/dashboard/po/'
          });
        }
      } catch (_) {}

      window.emitDataChanged?.('po');
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
      window.emitDataChanged?.('po');
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
          window.emitDataChanged?.('po');
          window.emitDataChanged?.('products');
          window.emitDataChanged?.('transactions');
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
      const { data, error } = await supabase.rpc('generate_draft_po_from_low_stock_v2', {
        p_supplier_id: supplierId ? String(supplierId) : null
      });
      if (error) {
        // Fallback resilient: jika RPC v2 belum dieksekusi di database atau belum reload schema cache
        const isMissingRpc = error.code === 'PGRST202' ||
          (error.message && error.message.includes('schema cache')) ||
          (error.message && error.message.includes('Could not find the function'));

        if (isMissingRpc) {
          console.warn('RPC generate_draft_po_from_low_stock_v2 belum ada di schema cache. Menggunakan generator klien...');
          return await this._generateFromLowStockFallback(supplierId);
        }
        return formatResponse({ ok: false, error });
      }
      window.emitDataChanged?.('po');
      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Generator Restock Assistant per supplier dengan anti-duplikat & gap-filling AUTO001
   */
  async _generateFromLowStockFallback(supplierId = null) {
    try {
      const { data: prods, error: prodErr } = await supabase
        .from('products')
        .select('*');
      if (prodErr) throw prodErr;

      const { data: openPOs } = await supabase
        .from('purchase_orders')
        .select('id, no_po, status, supplier_id, supplier_name, total')
        .in('status', ['draft', 'dikirim']);

      const safeOpenPOs = Array.isArray(openPOs) ? openPOs : [];
      const openPoIds = safeOpenPOs.map(p => p.id).filter(Boolean);
      const excludedProductIds = new Set();

      if (openPoIds.length > 0) {
        const { data: openItems } = await supabase
          .from('purchase_order_items')
          .select('po_id, product_id, qty, harga, subtotal')
          .in('po_id', openPoIds);
        (openItems || []).forEach(it => {
          if (it.product_id) excludedProductIds.add(String(it.product_id));
        });
      }

      const targetSupStr = supplierId !== null && supplierId !== undefined && String(supplierId).trim() !== ''
        ? String(supplierId).trim()
        : null;

      const lowStockProducts = (prods || []).filter(p => {
        if (p?.is_active === false) return false;
        const stock = Number(p.stock) || 0;
        const minStock = Math.max(0, Number(p.min_stock) || 0);
        if (stock > minStock) return false;
        if (excludedProductIds.has(String(p.id))) return false;
        if (targetSupStr && String(p.supplier_id || '') !== targetSupStr) return false;
        return true;
      });

      if (lowStockProducts.length === 0) {
        return formatResponse({
          ok: true,
          data: {
            ok: true,
            created: false,
            po_count: 0,
            created_count: 0,
            updated_count: 0,
            message: 'Semua barang berstatus stok aman atau sudah memiliki PO aktif (Draft/Ordered).'
          }
        });
      }

      // Resolve supplier names efficiently (gracefully supports full table query or single lookup fallback)
      const supplierNameMap = new Map();
      try {
        const { data: supRows, error: supErr } = await supabase
          .from('suppliers')
          .select('id, name');
        if (!supErr && Array.isArray(supRows)) {
          supRows.forEach(s => {
            if (s?.id !== undefined && s?.id !== null && s?.name) {
              supplierNameMap.set(String(s.id), s.name);
            }
          });
        }
      } catch (_) {}

      const resolveSupplierName = async (supKey) => {
        if (supKey === '__NONE__') return 'Tanpa Supplier';
        if (supplierNameMap.has(supKey)) return supplierNameMap.get(supKey);
        try {
          const { data: sup } = await supabase
            .from('suppliers')
            .select('name')
            .eq('id', supKey)
            .maybeSingle();
          if (sup?.name) {
            supplierNameMap.set(supKey, sup.name);
            return sup.name;
          }
        } catch (_) {}
        return 'Supplier';
      };

      const now = new Date();
      const [coverageDays, velocityMap] = await Promise.all([
        this._fetchAutoPoCoverageDays(),
        this._fetchSalesVelocityMap(lowStockProducts.map(p => p.id), now)
      ]);

      // Group low-stock products by supplier
      const groupedBySupplier = new Map();
      lowStockProducts.forEach(p => {
        const supKey = p.supplier_id !== null && p.supplier_id !== undefined && String(p.supplier_id).trim() !== ''
          ? String(p.supplier_id).trim()
          : '__NONE__';
        if (!groupedBySupplier.has(supKey)) {
          groupedBySupplier.set(supKey, {
            rawSupplierId: supKey === '__NONE__' ? null : p.supplier_id,
            supKey,
            items: [],
            reasons: []
          });
        }
        const salesMetrics = velocityMap.get(String(p.id)) || null;
        const details = this.computeAutoOrderDetails(p, salesMetrics, { coverageDays });
        const qty = details.qty;
        const harga = Math.max(0, Number(p.cost_price ?? p.buy_price ?? p.price ?? 0));
        groupedBySupplier.get(supKey).items.push({
          product_id: p.id,
          product_name: p.name,
          qty,
          harga,
          subtotal: qty * harga
        });
        groupedBySupplier.get(supKey).reasons.push({
          product_id: p.id,
          product_name: p.name,
          qty,
          stock: Number(p.stock) || 0,
          sold_7d: details.sold_7d,
          sold_30d: details.sold_30d,
          sold_90d: details.sold_90d,
          weighted_ads: details.weightedAds,
          coverage_days: details.coverageDays,
          mode: details.mode,
          reason: details.reason
        });
      });
      const ym = getMonthKey(now);
      const todayStr = getLocalDateISO(now);
      const fetchedMonthNoPOs = await this._fetchMonthNoPOs(`PO-${ym}-AUTO`, safeOpenPOs);
      const usedAutoNoPOs = [...fetchedMonthNoPOs];
      safeOpenPOs.forEach(poRow => {
        if (poRow?.no_po) usedAutoNoPOs.push({ no_po: poRow.no_po });
      });

      const findOpenDraftForSupplier = (supKey) => {
        const candidates = safeOpenPOs.filter(poRow => {
          if (poRow?.status !== 'draft') return false;
          const rowSup = poRow?.supplier_id !== null && poRow?.supplier_id !== undefined && String(poRow.supplier_id).trim() !== ''
            ? String(poRow.supplier_id).trim()
            : '__NONE__';
          return rowSup === supKey;
        });
        if (candidates.length === 0) return null;
        return candidates.find(c => new RegExp(`^PO-${ym}-AUTO\\d+$`, 'i').test(String(c.no_po || ''))) || candidates[0];
      };

      const processedPOs = [];
      let createdCount = 0;
      let updatedCount = 0;

      for (const [supKey, group] of groupedBySupplier.entries()) {
        const supplierName = await resolveSupplierName(supKey);
        const addedTotal = group.items.reduce((sum, it) => sum + it.subtotal, 0);
        const existingDraft = findOpenDraftForSupplier(supKey);

        if (existingDraft) {
          const itemRows = group.items.map(it => ({
            po_id: existingDraft.id,
            product_id: it.product_id,
            product_name: it.product_name,
            qty: it.qty,
            harga: it.harga,
            subtotal: it.subtotal
          }));
          const { error: addItemsErr } = await supabase
            .from('purchase_order_items')
            .insert(itemRows);
          if (addItemsErr) return formatResponse({ ok: false, error: addItemsErr });

          const updatedTotal = (Number(existingDraft.total) || 0) + addedTotal;
          const { error: updHeaderErr } = await supabase
            .from('purchase_orders')
            .update({
              total: updatedTotal,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingDraft.id);
          if (updHeaderErr) return formatResponse({ ok: false, error: updHeaderErr });

          existingDraft.total = updatedTotal;
          updatedCount += 1;
          processedPOs.push({
            id: existingDraft.id,
            no_po: existingDraft.no_po,
            supplier_id: group.rawSupplierId,
            supplier_name: existingDraft.supplier_name || supplierName,
            action: 'updated',
            item_count: group.items.length,
            total: updatedTotal,
            item_reasons: group.reasons
          });
          continue;
        }

        let no_po = this.generateAutoNoPO(usedAutoNoPOs, now);
        usedAutoNoPOs.push({ no_po });

        let createRes = await this.create({
          no_po,
          tanggal: todayStr,
          supplier_id: group.rawSupplierId,
          supplier_nama: supplierName,
          status: 'draft',
          catatan: 'Restock Otomatis',
          items: group.items
        });

        // Retry once cleanly if another session concurrently grabbed the same AUTO sequence
        if (!createRes.ok && createRes.error?.code === '23505') {
          const freshRows = await this._fetchMonthNoPOs(`PO-${ym}-AUTO`, usedAutoNoPOs);
          freshRows.forEach(r => usedAutoNoPOs.push(r));
          no_po = this.generateAutoNoPO(usedAutoNoPOs, now);
          usedAutoNoPOs.push({ no_po });
          createRes = await this.create({
            no_po,
            tanggal: todayStr,
            supplier_id: group.rawSupplierId,
            supplier_nama: supplierName,
            status: 'draft',
            catatan: 'Restock Otomatis',
            items: group.items
          });
        }

        if (!createRes.ok) {
          return createRes;
        }

        createdCount += 1;
        processedPOs.push({
          id: createRes.data?.id,
          no_po,
          supplier_id: group.rawSupplierId,
          supplier_name: supplierName,
          action: 'created',
          item_count: group.items.length,
          total: addedTotal,
          item_reasons: group.reasons
        });
      }

      const firstPO = processedPOs[0] || {};
      const totalItemsAdded = processedPOs.reduce((sum, p) => sum + (p.item_count || 0), 0);
      const totalValueAll = processedPOs.reduce((sum, p) => sum + (p.total || 0), 0);
      const allReasons = processedPOs.flatMap(p => Array.isArray(p.item_reasons) ? p.item_reasons : []);

      window.emitDataChanged?.('po');
      return formatResponse({
        ok: true,
        data: {
          ok: true,
          created: createdCount > 0 || updatedCount > 0,
          id: firstPO.id,
          no_po: firstPO.no_po,
          total: totalValueAll,
          item_count: totalItemsAdded,
          po_count: processedPOs.length,
          created_count: createdCount,
          updated_count: updatedCount,
          coverage_days: coverageDays,
          no_po_list: processedPOs.map(p => p.no_po),
          item_reasons: allReasons,
          pos: processedPOs
        }
      });
    } catch (fallbackErr) {
      return handleError(fallbackErr);
    }
  },

  /**
   * Menyimpan perubahan item (qty, harga, hapus baris) & opsional status pada Draft PO.
   */
  async updateDraftPO(poId, items = [], options = {}) {
    try {
      if (!poId) {
        return formatResponse({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'ID Purchase Order tidak valid' }
        });
      }

      const cleanItems = (Array.isArray(items) ? items : [])
        .map(it => {
          const qty = Math.max(1, Math.round(Number(it?.qty) || 1));
          const harga = Math.max(0, Number(it?.harga) || 0);
          return {
            po_id: poId,
            product_id: it?.product_id || null,
            product_name: String(it?.product_name || 'Barang').trim() || 'Barang',
            qty,
            harga,
            subtotal: qty * harga
          };
        });

      if (cleanItems.length === 0) {
        return formatResponse({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Minimal harus ada 1 item pada Draft PO' }
        });
      }

      const { data: existingPO, error: checkErr } = await supabase
        .from('purchase_orders')
        .select('id, status')
        .eq('id', poId)
        .maybeSingle();

      if (checkErr) return formatResponse({ ok: false, error: checkErr });
      if (!existingPO) {
        return formatResponse({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Purchase Order tidak ditemukan' }
        });
      }
      if (existingPO.status !== 'draft') {
        return formatResponse({
          ok: false,
          error: { code: 'PO_LOCKED', message: 'Hanya PO berstatus Draft yang dapat diubah itemnya' }
        });
      }

      // Backup existing items before replacing so we can restore if insert fails
      const { data: prevItems } = await supabase
        .from('purchase_order_items')
        .select('po_id, product_id, product_name, qty, harga, subtotal')
        .eq('po_id', poId);

      const { error: delErr } = await supabase
        .from('purchase_order_items')
        .delete()
        .eq('po_id', poId);
      if (delErr) return formatResponse({ ok: false, error: delErr });

      const { data: insertedItems, error: insErr } = await supabase
        .from('purchase_order_items')
        .insert(cleanItems)
        .select();

      if (insErr) {
        if (Array.isArray(prevItems) && prevItems.length > 0) {
          try {
            await supabase.from('purchase_order_items').insert(prevItems);
          } catch (_) {}
        }
        return formatResponse({ ok: false, error: insErr });
      }

      const newTotal = cleanItems.reduce((sum, it) => sum + it.subtotal, 0);
      const nextStatus = options?.status || 'draft';
      const headerPatch = {
        total: newTotal,
        status: nextStatus,
        updated_at: new Date().toISOString()
      };

      const { data: updatedHeader, error: updErr } = await supabase
        .from('purchase_orders')
        .update(headerPatch)
        .eq('id', poId)
        .select()
        .single();

      if (updErr) return formatResponse({ ok: false, error: updErr });

      if (!options?.silent) {
        window.emitDataChanged?.('po');
      }

      return formatResponse({
        ok: true,
        data: {
          ...updatedHeader,
          items: Array.isArray(insertedItems) && insertedItems.length > 0 ? insertedItems : cleanItems
        }
      });
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
      try {
        if (typeof logAudit === 'function') {
          logAudit('DELETE', `Hapus Purchase Order ID: ${id}`);
        }
      } catch (_) {}

      window.emitDataChanged?.('po');
      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  }
};

export default po;
