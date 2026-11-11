/* ═══════════════════════════════════════════════════
   M2Stock — api/transactions.js
   Domain Transaksi Barang Masuk & Keluar, PO, & Retur
   ═══════════════════════════════════════════════════ */

import { isSupabaseAvailable, formatResponse, handleError, apiRequest, logAudit, notifyOwner } from './_client.js';

function notifyProductsUpdated(detail = {}) {
  if (typeof window.emitDataChanged === 'function') {
    window.emitDataChanged?.('products', detail);
    window.emitDataChanged?.('transactions', detail);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('m2stock:products-updated', { detail }));
    window.dispatchEvent(new CustomEvent('aquastock:products-updated', { detail }));
  }
}

function mapTransaction(row) {
  const qty = Number(row.qty ?? row.quantity) || 0;
  let price = Number(row.price ?? row.unit_price) || 0;
  // Sinkronisasi otomatis: Jika transaksi barang masuk tercatat Rp 0 / null, ambil harga modal produk
  if (price <= 0 && (row.type === 'in' || !row.type) && row.products && Number(row.products.cost_price) > 0) {
    price = Number(row.products.cost_price);
  }
  const note = row.note ?? row.notes ?? null;
  const created_by = row.created_by ?? row.user_id ?? null;
  const noteStr = String(note || '');

  const invoice_no = row.invoice_no || ((noteStr.match(/\[((?:INV|SPX|TKP)-[^\]]+)\]/i) || [])[1]) || null;
  const discount_amount = Number(row.discount_amount ?? (noteStr.match(/\|AQ_DISCOUNT=([0-9.]+)/) || [])[1]) || 0;
  const tax_amount = Number(row.tax_amount ?? (noteStr.match(/\|AQ_TAX=([0-9.]+)/) || [])[1]) || 0;
  const final_total = Number(row.final_total ?? (noteStr.match(/\|AQ_TOTAL=([0-9.]+)/) || [])[1]) || (Number(row.total_price) > 0 ? Number(row.total_price) : (qty * price));
  const subtotal_amount = (Number(row.subtotal_amount) > 0 ? Number(row.subtotal_amount) : (Number(row.total_price) > 0 ? Number(row.total_price) : (qty * price)));

  return {
    ...row,
    qty,
    quantity: qty,
    price,
    unit_price: price,
    total_price: (Number(row.total_price) > 0 ? Number(row.total_price) : (qty * price)),
    note,
    notes: note,
    created_by,
    user_id: created_by,
    channel: row.channel || 'Offline',
    invoice_no,
    discount_amount,
    tax_amount,
    subtotal_amount,
    final_total,
    payment_method: row.payment_method || 'Cash',
    payment_status: row.payment_status || 'Lunas'
  };
}

export function extractInvoiceSequence(inv) {
  if (!inv || typeof inv !== 'string') return 0;
  const m = inv.match(/INV-\d{6}-(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

export function formatSequentialInvoiceNo(seqNumber, txDate = new Date()) {
  const d = txDate instanceof Date ? txDate : new Date(txDate);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const seqStr = String(Math.max(1, Number(seqNumber) || 1)).padStart(4, '0');
  return `INV-${yy}${mm}${dd}-${seqStr}`;
}

export function getNextSequentialInvoiceNo(existingList = [], txDate = new Date()) {
  let maxSeq = 0;
  if (Array.isArray(existingList)) {
    for (const item of existingList) {
      const code = item?.invoice_no || item?.note || item?.notes || '';
      const seq = extractInvoiceSequence(code);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  return formatSequentialInvoiceNo(maxSeq + 1, txDate);
}

export const transactions = {
  extractInvoiceSequence,
  formatSequentialInvoiceNo,
  getNextSequentialInvoiceNo,
    getAll: async (params, opts) => {
      if (isSupabaseAvailable()) {
        try {
          let query = window.supabase
            .from('transactions')
            .select('*, products(id, name, sku, brand, stock, sell_price, cost_price), suppliers(id, name), customers(id, name)')
            .order('created_at', { ascending: false });

          if (params && params.type) {
            query = query.eq('type', params.type);
          }
          if (params && params.startDate) {
            query = query.gte('created_at', params.startDate);
          }
          if (params && params.endDate) {
            query = query.lte('created_at', params.endDate);
          }
          if (params && params.limit) {
            query = query.limit(Number(params.limit));
          }

          if (opts && opts.signal) {
            query = query.abortSignal(opts.signal);
          }

          const { data, error } = await query;
          if (error) {
            return formatResponse({
              ok: false,
              error: {
                code: error.code || 'SUPABASE_ERROR',
                message: error.message || 'Gagal mengambil data transaksi',
                details: error
              }
            });
          }

          return formatResponse({
            ok: true,
            data: (data || []).map(mapTransaction),
            meta: { total: (data || []).length }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/transactions?' + new URLSearchParams(params || {}).toString(), { ...opts });
    },

    getByType: async (type, params, opts) => {
      return transactions.getAll({ ...(params || {}), type: type }, opts);
    },

    getByPeriod: async (startDate, endDate, type, opts) => {
      return transactions.getAll({ startDate, endDate, type }, opts);
    },

    getIn: (params, opts) => {
      if (!isSupabaseAvailable()) {
        return apiRequest('/transactions/in?' + new URLSearchParams(params || {}).toString(), { ...opts });
      }
      return transactions.getByType('in', params, opts);
    },

    createIn: (data, opts) => {
      if (!isSupabaseAvailable()) {
        return apiRequest('/transactions/in', { method: 'POST', body: data, ...opts });
      }
      return transactions.create({ ...(data || {}), type: 'in' }, opts);
    },

    getOut: (params, opts) => {
      if (!isSupabaseAvailable()) {
        return apiRequest('/transactions/out?' + new URLSearchParams(params || {}).toString(), { ...opts });
      }
      return transactions.getByType('out', params, opts);
    },

    createOut: (data, opts) => {
      if (!isSupabaseAvailable()) {
        return apiRequest('/transactions/out', { method: 'POST', body: data, ...opts });
      }
      return transactions.create({ ...(data || {}), type: 'out' }, opts);
    },

    createBatchOut: async (cartItems, commonData = {}, opts = {}) => {
      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return formatResponse({
          ok: false,
          error: { code: 'EMPTY_CART', message: 'Keranjang belanja masih kosong.' }
        });
      }

      // Validasi awal semua item sebelum disimpan
      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        const qty = Number(item.qty ?? item.quantity);
        const price = Number(item.price ?? item.unit_price);
        if (!item.product_id || !Number.isInteger(qty) || qty <= 0 || isNaN(price) || price < 0) {
          return formatResponse({
            ok: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Item ke-${i + 1} (${item.name || 'Produk'}) memiliki jumlah atau harga tidak valid.`
            }
          });
        }
      }

      // Periksa apakah invoice_no sudah ditentukan secara spesifik
      let invoiceNo = commonData.invoice_no ? String(commonData.invoice_no).trim() : null;
      const payloadCommon = { ...commonData };
      if (invoiceNo) {
        payloadCommon.invoice_no = invoiceNo;
      } else {
        delete payloadCommon.invoice_no;
      }

      const discountAmount = Math.max(0, Math.min(
        cartItems.reduce((sum, item) => sum + (Number(item.qty ?? item.quantity) || 0) * (Number(item.price ?? item.unit_price) || 0), 0),
        Number(payloadCommon.discount_amount || 0)
      ));
      const taxAmount = Math.max(0, Number(payloadCommon.tax_amount || 0));

      // PRIORITAS 1: Eksekusi Atomik via Database RPC PostgreSQL (process_pos_checkout)
      if (isSupabaseAvailable() && typeof window !== 'undefined' && window.supabase && typeof window.supabase.rpc === 'function') {
        try {
          const rpcItems = cartItems.map(it => ({
            product_id: String(it.product_id),
            qty: Number(it.qty ?? it.quantity),
            price: Number(it.price ?? it.unit_price),
            note: it.note || ''
          }));

          const { data: rpcData, error: rpcErr } = await window.supabase.rpc('process_pos_checkout', {
            p_items: rpcItems,
            p_common: payloadCommon
          });

          if (!rpcErr && rpcData && (rpcData.ok || rpcData.success)) {
            const finalInvoiceNo = rpcData.invoice_no || invoiceNo || getNextSequentialInvoiceNo([], new Date());
            invoiceNo = finalInvoiceNo;
            notifyProductsUpdated({ type: 'out', invoice_no: invoiceNo });
            // Sukses atomik dari database
            try {
              if (typeof logAudit === 'function') {
                logAudit('CREATE', `Penjualan Kasir POS Atomik (${invoiceNo}): ${cartItems.length} item, Total Rp ${Number(rpcData.total_amount || 0).toLocaleString('id-ID')}`);
              }
              if (typeof notifyOwner === 'function') {
                notifyOwner({
                  tipe: 'success',
                  judul: 'Penjualan Kasir Baru',
                  pesan: `Transaksi kasir (${invoiceNo}) berhasil dicatat secara atomik: ${cartItems.length} item.`,
                  link: '/dashboard/out/'
                });
              }
            } catch (_) {}

            if (typeof window !== 'undefined' && typeof window.syncNotificationBadge === 'function') {
              setTimeout(window.syncNotificationBadge, 500);
            }

            return formatResponse({
              ok: true,
              data: {
                invoice_no: invoiceNo,
                total_amount: Math.max(0, cartItems.reduce((sum, item) => sum + Number(item.qty ?? item.quantity) * Number(item.price ?? item.unit_price), 0) - discountAmount + taxAmount),
                items_count: cartItems.length,
                transactions: rpcData.transactions || [],
                items: rpcData.transactions || []
              },
              meta: { message: `Penjualan kasir (${invoiceNo}) berhasil dicatat secara atomik!` }
            });
          }

          // Jika error adalah validasi bisnis (misal: stok kurang), lempar error langsung tanpa rollback fallback
          if (rpcErr && (rpcErr.code === '23514' || rpcErr.message?.includes('Stok tidak mencukupi'))) {
            return formatResponse({
              ok: false,
              error: {
                code: 'INSUFFICIENT_STOCK',
                message: rpcErr.message || 'Stok tidak mencukupi untuk salah satu item.',
                details: rpcErr
              }
            });
          }
        } catch (rpcCatchErr) {
          console.warn('RPC process_pos_checkout fallback ke klien resilient loop:', rpcCatchErr);
        }
      }

      // PRIORITAS 2 (Fallback): Client-side Loop dengan ATOMIC COMPENSATION ROLLBACK
      // Jika invoiceNo belum ditentukan, coba ambil nomor urut berikutnya secara terurut
      if (!invoiceNo) {
        if (isSupabaseAvailable() && typeof window !== 'undefined' && window.supabase && typeof window.supabase.rpc === 'function') {
          try {
            const { data: nextCode, error: seqErr } = await window.supabase.rpc('get_next_invoice_no');
            if (!seqErr && nextCode) {
              invoiceNo = nextCode;
            }
          } catch (_) {}
        }
      }

      // Jika get_next_invoice_no tidak tersedia / offline, cari nomor tertinggi dari riwayat transaksi
      if (!invoiceNo) {
        if (isSupabaseAvailable() && typeof window !== 'undefined' && window.supabase) {
          try {
            const { data: recentTxs } = await window.supabase
              .from('transactions')
              .select('invoice_no, note, notes')
              .order('created_at', { ascending: false })
              .limit(50);
            invoiceNo = getNextSequentialInvoiceNo(recentTxs || [], new Date());
          } catch (_) {
            invoiceNo = getNextSequentialInvoiceNo([], new Date());
          }
        } else {
          invoiceNo = getNextSequentialInvoiceNo([], new Date());
        }
      }

      const createdTxs = [];
      let subtotalAmount = 0;
      const receiptSubtotalAmount = cartItems.reduce((sum, item) =>
        sum + (Number(item.qty ?? item.quantity) || 0) * (Number(item.price ?? item.unit_price) || 0), 0);

      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        const qty = Number(item.qty ?? item.quantity);
        const price = Number(item.price ?? item.unit_price);
        subtotalAmount += qty * price;

        const customNote = item.note || commonData.note || '';
        const receiptMeta = [
          `AQ_DISCOUNT=${discountAmount}`,
          `AQ_TAX=${taxAmount}`,
          `AQ_TOTAL=${Math.max(0, receiptSubtotalAmount - discountAmount + taxAmount)}`
        ].join('|');
        const itemNote = `[${invoiceNo}] ${customNote} |${receiptMeta}`.trim();

        const res = await transactions.createOut({
          product_id: item.product_id,
          qty: qty,
          price: price,
          cost_price: Number(item.cost_price || 0),
          channel: commonData.channel || 'Offline',
          customer_id: commonData.customer_id || null,
          payment_method: commonData.payment_method || 'Cash',
          payment_status: commonData.payment_status || (commonData.payment_method === 'Tempo' ? 'Belum Lunas' : 'Lunas'),
          note: itemNote,
          created_by: commonData.created_by || null,
          idempotency_key: commonData.idempotency_key ? `${commonData.idempotency_key}-${item.product_id}` : null,
          invoice_no: invoiceNo,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          subtotal_amount: receiptSubtotalAmount,
          final_total: Math.max(0, receiptSubtotalAmount - discountAmount + taxAmount)
        }, opts);

        if (!res.ok) {
          // KOMPENSASI ROLLBACK ATOMIK: Batalkan seluruh item yang sempat tersimpan sebelumnya
          console.error(`Item ke-${i + 1} gagal (${item.name || item.product_id}). Membatalkan ${createdTxs.length} item sebelumnya...`);
          for (const savedTx of createdTxs) {
            try {
              if (savedTx?.id) {
                await transactions.delete(savedTx.id);
              }

            } catch (rbErr) {
              console.warn('Gagal membatalkan transaksi parsial:', rbErr);
            }
          }

          return formatResponse({
            ok: false,
            error: {
              code: res.error?.code || 'BATCH_ITEM_ERROR',
              message: `Gagal memproses item "${item.name || item.product_id}": ${res.error?.message || 'Kesalahan database'}. Seluruh transaksi invoice dibatalkan secara atomik agar tidak terjadi data parsial.`,
              details: res.error
            }
          });
        }
        createdTxs.push(res.data);
      }

      const totalAmount = Math.max(0, subtotalAmount - discountAmount + taxAmount);

      // 1. Catat Audit Log
      try {
        if (typeof logAudit === 'function') {
          logAudit('CREATE', `Penjualan Kasir POS (${invoiceNo}): ${cartItems.length} item, Total Rp ${Number(totalAmount || 0).toLocaleString('id-ID')}`);
        }
      } catch (_) {}

      // 2. Kirim Notifikasi ke Owner
      try {
        if (typeof notifyOwner === 'function') {
          notifyOwner({
            tipe: 'success',
            judul: 'Penjualan Kasir Baru',
            pesan: `Transaksi kasir (${invoiceNo}) berhasil dicatat: ${cartItems.length} item dengan total Rp ${Number(totalAmount || 0).toLocaleString('id-ID')}.`,
            link: '/dashboard/out/'
          });
        }
      } catch (_) {}

      // 3. Sinkronkan Badge Lonceng
      if (typeof window !== 'undefined' && typeof window.syncNotificationBadge === 'function') {
        setTimeout(window.syncNotificationBadge, 500);
      }

      return formatResponse({
        ok: true,
        data: {
          invoice_no: invoiceNo,
          total_amount: totalAmount,
          items_count: cartItems.length,
          transactions: createdTxs,
          items: createdTxs
        },
        meta: { message: `Penjualan kasir (${invoiceNo}) berhasil dicatat!` }
      });
    },

    create: async (data, opts) => {
      if (isSupabaseAvailable()) {
        try {
          let userId = data.created_by || data.user_id || null;
          if (!userId) {
            try {
              if (window.supabase?.auth && typeof window.supabase.auth.getUser === 'function') {
                const userRes = await window.supabase.auth.getUser();
                userId = userRes?.data?.user?.id || null;
              }
            } catch (_) {}
          }

          const quantity = Number(data.qty ?? data.quantity);
          let unitPrice = Number(data.price ?? data.unit_price);
          if (data.type === 'in' && unitPrice <= 0 && Number(data.cost_price) > 0) {
            unitPrice = Number(data.cost_price);
          }
          if (data.type === 'in' && unitPrice <= 0 && data.product_id && isSupabaseAvailable()) {
            try {
              const { data: prodData } = await window.supabase
                .from('products')
                .select('cost_price')
                .eq('id', isNaN(Number(data.product_id)) ? data.product_id : Number(data.product_id))
                .maybeSingle();
              if (prodData && Number(prodData.cost_price) > 0) {
                unitPrice = Number(prodData.cost_price);
              }
            } catch (_) {}
          }
          if (!['in', 'out'].includes(data.type)
            || !data.product_id
            || !Number.isInteger(quantity)
            || quantity <= 0
            || !Number.isFinite(unitPrice)
            || unitPrice < 0) {
            return formatResponse({
              ok: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Produk, jumlah bulat positif, dan harga satuan valid wajib diisi.'
              }
            });
          }

          const productId = isNaN(Number(data.product_id)) ? data.product_id : Number(data.product_id);
          const customerId = data.customer_id ? (isNaN(Number(data.customer_id)) ? data.customer_id : Number(data.customer_id)) : null;
          const supplierId = data.supplier_id ? (isNaN(Number(data.supplier_id)) ? data.supplier_id : Number(data.supplier_id)) : null;

          // Universal schema compatibility: primary row targets the live schema (qty, price, note, created_by)
          const baseRow = {
            type: data.type,
            product_id: productId,
            qty: quantity,
            price: unitPrice,
            customer_id: customerId,
            supplier_id: supplierId,
            channel: data.channel || 'Offline',
            note: data.note ?? data.notes ?? null,
            created_by: userId
          };

          if (data.payment_method) {
            baseRow.payment_method = data.payment_method;
          }
          if (data.payment_status) {
            baseRow.payment_status = data.payment_status;
          }
          if (data.cash_flow_id) {
            baseRow.cash_flow_id = data.cash_flow_id;
          }
          if (data.debt_id) {
            baseRow.debt_id = data.debt_id;
          }
          if (data.po_id) {
            baseRow.po_id = data.po_id;
          }
          if (data.return_id) {
            baseRow.return_id = data.return_id;
          }
          if (data.invoice_no) {
            baseRow.invoice_no = data.invoice_no;
          }
          if (data.discount_amount !== undefined) {
            baseRow.discount_amount = Number(data.discount_amount);
          }
          if (data.tax_amount !== undefined) {
            baseRow.tax_amount = Number(data.tax_amount);
          }
          if (data.subtotal_amount !== undefined) {
            baseRow.subtotal_amount = Number(data.subtotal_amount);
          }
          if (data.final_total !== undefined) {
            baseRow.final_total = Number(data.final_total);
          }

          // Ambil stok dan harga modal produk sebelum transaksi untuk verifikasi mutasi dan snapshot HPP
          let productBefore = null;
          try {
            if (typeof window.supabase.from === 'function') {
              const { data: pData } = await window.supabase
                .from('products')
                .select('id, stock, cost_price, name')
                .eq('id', productId)
                .maybeSingle();
              if (pData) productBefore = pData;
            }
          } catch (_) {}

          // Snapshot HPP Historis (IAS 2: Costing Snapshot)
          const snapshotCost = data.cost_price !== undefined
            ? Number(data.cost_price)
            : (data.type === 'in' ? unitPrice : Number(productBefore?.cost_price || 0));

          baseRow.cost_price = snapshotCost;
          if (data.idempotency_key) baseRow.idempotency_key = data.idempotency_key;
          if (data.reversal_of_id) baseRow.reversal_of_id = data.reversal_of_id;

          let query = window.supabase
            .from('transactions')
            .insert([baseRow])
            .select('*, products(id, name, sku, brand, stock, cost_price), suppliers(id, name), customers(id, name)');

          if (opts && opts.signal) {
            query = query.abortSignal(opts.signal);
          }

          let { data: inserted, error } = await query;

          // If the schema expects modern column names (quantity, unit_price, notes, user_id, total_price)
          if (error && (error.code === 'PGRST204' || error.message?.includes('total_price') || error.message?.includes('notes') || error.message?.includes('quantity') || error.message?.includes('cost_price'))) {
            const modernRow = {
              type: data.type,
              product_id: productId,
              quantity,
              unit_price: unitPrice,
              total_price: quantity * unitPrice,
              cost_price: snapshotCost,
              customer_id: customerId,
              supplier_id: supplierId,
              channel: data.channel || 'Offline',
              notes: data.note ?? data.notes ?? null,
              user_id: userId
            };
            if (data.payment_method) modernRow.payment_method = data.payment_method;
            if (data.payment_status) modernRow.payment_status = data.payment_status;
            if (data.cash_flow_id) modernRow.cash_flow_id = data.cash_flow_id;
            if (data.debt_id) modernRow.debt_id = data.debt_id;
            if (data.po_id) modernRow.po_id = data.po_id;
            if (data.return_id) modernRow.return_id = data.return_id;
            if (data.idempotency_key) modernRow.idempotency_key = data.idempotency_key;
            if (data.reversal_of_id) modernRow.reversal_of_id = data.reversal_of_id;
            if (data.invoice_no) modernRow.invoice_no = data.invoice_no;
            if (data.discount_amount !== undefined) modernRow.discount_amount = Number(data.discount_amount);
            if (data.tax_amount !== undefined) modernRow.tax_amount = Number(data.tax_amount);
            if (data.subtotal_amount !== undefined) modernRow.subtotal_amount = Number(data.subtotal_amount);
            if (data.final_total !== undefined) modernRow.final_total = Number(data.final_total);

            let retryQuery = window.supabase
              .from('transactions')
              .insert([modernRow])
              .select('*, products(id, name, sku, brand, stock), suppliers(id, name), customers(id, name)');

            if (opts && opts.signal) {
              retryQuery = retryQuery.abortSignal(opts.signal);
            }
            const retryRes = await retryQuery;
            inserted = retryRes.data;
            error = retryRes.error;
          }

          if (error) {
            return formatResponse({
              ok: false,
              error: {
                code: error.code || 'SUPABASE_ERROR',
                message: error.message || 'Gagal menyimpan transaksi',
                details: error
              }
            });
          }

          notifyProductsUpdated({ type: data.type, product_id: productId, quantity });

          // Stock is mutated by the PostgreSQL transaction trigger only. A client-side
          // fallback can race with the trigger and apply the same movement twice.
          // Catat audit log dan notifikasi jika bukan bagian dari transaksi kasir multi-item (batch POS)
          const isPosBatchItem = Boolean((data.note || '').includes('[INV-') || Boolean(data.invoice_no));
          if (!isPosBatchItem) {
            try {
              const txTypeLabel = data.type === 'in' ? 'Barang Masuk' : 'Barang Keluar';
              const prodName = productBefore?.name ? `(${productBefore.name})` : '';
              if (typeof logAudit === 'function') {
                logAudit('CREATE', `${txTypeLabel}: Produk ID ${productId} ${prodName} sebanyak ${quantity} item`);
              }

              if (typeof notifyOwner === 'function') {
                notifyOwner({
                  tipe: data.type === 'in' ? 'info' : 'success',
                  judul: `${txTypeLabel} Tercatat`,
                  pesan: `Transaksi ${txTypeLabel.toLowerCase()} produk ID ${productId} ${prodName} sebanyak ${quantity} item telah dicatat.`,
                  link: data.type === 'in' ? '/dashboard/in/' : '/dashboard/out/'
                });
              }
            } catch (_) {}
          }

          // Periksa apakah sisa stok berada di bawah batas minimum (Stok Kritis)
          if (data.type === 'out' && productBefore && typeof productBefore.min_stock === 'number') {
            try {
              const remainingStock = Number(productBefore.stock || 0) - quantity;
              if (remainingStock <= Number(productBefore.min_stock || 0)) {
                if (typeof notifyOwner === 'function') {
                  notifyOwner({
                    tipe: 'warning',
                    judul: 'Peringatan Stok Kritis!',
                    pesan: `Stok produk ${productBefore.name || productId} kini tersisa ${remainingStock} (batas minimum: ${productBefore.min_stock}). Segera lakukan restock!`,
                    link: '/dashboard/items/'
                  });
                }
              }
            } catch (_) {}
          }

          if (typeof window !== 'undefined' && typeof window.syncNotificationBadge === 'function') {
            setTimeout(window.syncNotificationBadge, 500);
          }

          return formatResponse({
            ok: true,
            data: inserted && inserted[0] ? mapTransaction(inserted[0]) : null,
            meta: { message: 'Transaksi berhasil dicatat' }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest(`/transactions/${data.type || 'in'}`, { method: 'POST', body: data, ...opts });
    },

    delete: async (id, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const targetId = isNaN(Number(id)) ? id : Number(id);

          let query = window.supabase
            .from('transactions')
            .delete()
            .eq('id', targetId);

          if (opts && opts.signal) {
            query = query.abortSignal(opts.signal);
          }

          const { error } = await query;
          if (error) {
            return formatResponse({
              ok: false,
              error: {
                code: error.code || 'SUPABASE_ERROR',
                message: error.message || 'Gagal menghapus transaksi',
                details: error
              }
            });
          }

          notifyProductsUpdated({ type: 'delete', id: targetId });
          try {
            if (typeof logAudit === 'function') {
              logAudit('DELETE', `Hapus Transaksi ID: ${targetId}`);
            }
          } catch (_) {}

          return formatResponse({
            ok: true,
            data: { success: true },
            meta: { message: 'Transaksi berhasil dihapus' }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest(`/transactions/${id}`, { method: 'DELETE', ...opts });
    },

    updateHistoryInByProduct: async (productId, { cost_price, supplier_id } = {}, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const pId = isNaN(Number(productId)) ? productId : Number(productId);
          const updates = {};
          if (cost_price !== undefined && cost_price !== null) {
            const numPrice = Math.max(0, Math.round(Number(cost_price) || 0));
            updates.price = numPrice;
            updates.cost_price = numPrice;
          }
          if (supplier_id !== undefined) {
            updates.supplier_id = supplier_id ? (isNaN(Number(supplier_id)) ? supplier_id : Number(supplier_id)) : null;
          }

          if (Object.keys(updates).length === 0) {
            return formatResponse({
              ok: true,
              data: { updatedCount: 0, transactions: [] },
              meta: { message: 'Tidak ada perubahan untuk riwayat transaksi' }
            });
          }

          let query = window.supabase
            .from('transactions')
            .update(updates)
            .eq('product_id', pId)
            .eq('type', 'in')
            .select('id, product_id, type, qty, price, cost_price, supplier_id');

          if (opts && opts.signal) {
            query = query.abortSignal(opts.signal);
          }

          let { data, error } = await query;

          // Fallback skema jika kolom cost_price tidak ada pada transactions
          if (error && (error.message?.includes('cost_price') || error.code === 'PGRST204')) {
            const fallbackUpdates = { ...updates };
            delete fallbackUpdates.cost_price;
            let retryQuery = window.supabase
              .from('transactions')
              .update(fallbackUpdates)
              .eq('product_id', pId)
              .eq('type', 'in')
              .select('id, product_id, type, qty, price, supplier_id');

            if (opts && opts.signal) retryQuery = retryQuery.abortSignal(opts.signal);
            const retryRes = await retryQuery;
            data = retryRes.data;
            error = retryRes.error;
          }

          if (error) {
            return formatResponse({
              ok: false,
              error: {
                code: error.code || 'SUPABASE_ERROR',
                message: error.message || 'Gagal memperbarui riwayat transaksi lama',
                details: error
              }
            });
          }

          const count = Array.isArray(data) ? data.length : 0;

          try {
            if (typeof logAudit === 'function') {
              logAudit('UPDATE', `Koreksi Riwayat Barang Masuk: Produk ID ${pId} (${count} transaksi diperbarui)`);
            }
          } catch (_) {}

          return formatResponse({
            ok: true,
            data: {
              updatedCount: count,
              transactions: data || []
            },
            meta: { message: `${count} riwayat transaksi Barang Masuk lama berhasil diperbarui` }
          });
        } catch (err) {
          return handleError(err);
        }
      }

      return apiRequest(`/transactions/in/product/${productId}`, {
        method: 'PATCH',
        body: { cost_price, supplier_id },
        ...opts
      });
    }
};

export const po = {
  getAll: (params, opts) => apiRequest('/po?' + new URLSearchParams(params || {}).toString(), { ...opts }),
  create: (data, opts) => apiRequest('/po', { method: 'POST', body: data, ...opts })
};

export const returnApi = {
  getAll: (params, opts) => apiRequest('/return?' + new URLSearchParams(params || {}).toString(), { ...opts }),
  create: (data, opts) => apiRequest('/return', { method: 'POST', body: data, ...opts })
};

export default transactions;
