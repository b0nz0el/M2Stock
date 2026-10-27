/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/transactions.js
   Domain Transaksi Barang Masuk & Keluar, PO, & Retur
   ═══════════════════════════════════════════════════ */

import { isSupabaseAvailable, formatResponse, handleError, apiRequest, logAudit, notifyOwner } from './_client.js';

function mapTransaction(row) {
  const qty = Number(row.qty ?? row.quantity) || 0;
  const price = Number(row.price ?? row.unit_price) || 0;
  const note = row.note ?? row.notes ?? null;
  const created_by = row.created_by ?? row.user_id ?? null;

  return {
    ...row,
    qty,
    quantity: qty,
    price,
    unit_price: price,
    total_price: Number(row.total_price) || (qty * price),
    note,
    notes: note,
    created_by,
    user_id: created_by,
    channel: row.channel || 'Offline',
    payment_method: row.payment_method || 'Cash',
    payment_status: row.payment_status || 'Lunas'
  };
}

export const transactions = {
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

      // Generate Invoice Code jika belum ada
      const now = new Date();
      const datePart = now.toISOString().slice(2, 10).replace(/-/g, '');
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      const invoiceNo = commonData.invoice_no || `INV-${datePart}-${randomPart}`;

      const createdTxs = [];
      let totalAmount = 0;

      for (const item of cartItems) {
        const qty = Number(item.qty ?? item.quantity);
        const price = Number(item.price ?? item.unit_price);
        totalAmount += qty * price;

        const customNote = item.note || commonData.note || '';
        const itemNote = `[${invoiceNo}] ${customNote}`.trim();

        const res = await transactions.createOut({
          product_id: item.product_id,
          qty: qty,
          price: price,
          channel: commonData.channel || 'Offline',
          customer_id: commonData.customer_id || null,
          payment_method: commonData.payment_method || 'Cash',
          payment_status: commonData.payment_status || (commonData.payment_method === 'Tempo' ? 'Belum Lunas' : 'Lunas'),
          note: itemNote,
          created_by: commonData.created_by || null
        }, opts);

        if (!res.ok) {
          return formatResponse({
            ok: false,
            error: {
              code: res.error?.code || 'BATCH_ITEM_ERROR',
              message: `Gagal memproses item ${item.name || item.product_id}: ${res.error?.message || 'Kesalahan database'}`,
              details: res.error
            }
          });
        }
        createdTxs.push(res.data);
      }

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
            link: '/out'
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
          const unitPrice = Number(data.price ?? data.unit_price);
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

          // Ambil stok produk sebelum transaksi untuk verifikasi mutasi stok
          let productBefore = null;
          try {
            if (typeof window.supabase.from === 'function') {
              const { data: pData } = await window.supabase
                .from('products')
                .select('id, stock')
                .eq('id', productId)
                .maybeSingle();
              if (pData) productBefore = pData;
            }
          } catch (_) {}

          let query = window.supabase
            .from('transactions')
            .insert([baseRow])
            .select('*, products(id, name, sku, brand, stock), suppliers(id, name), customers(id, name)');

          if (opts && opts.signal) {
            query = query.abortSignal(opts.signal);
          }

          let { data: inserted, error } = await query;

          // If the schema expects modern column names (quantity, unit_price, notes, user_id, total_price)
          if (error && (error.code === 'PGRST204' || error.message?.includes('total_price') || error.message?.includes('notes') || error.message?.includes('quantity'))) {
            const modernRow = {
              type: data.type,
              product_id: productId,
              quantity,
              unit_price: unitPrice,
              total_price: quantity * unitPrice,
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

          // Sinkronisasi mutasi stok fallback jika trigger PostgreSQL belum aktif di database Supabase
          if (productBefore && typeof window.supabase.from === 'function') {
            try {
              const { data: pAfter } = await window.supabase
                .from('products')
                .select('id, stock')
                .eq('id', productId)
                .maybeSingle();

              if (pAfter) {
                const stockBefore = Number(productBefore.stock || 0);
                const stockAfter = Number(pAfter.stock || 0);

                // Jika stok produk di database belum berubah sama sekali setelah transaksi berhasil disimpan
                if (stockBefore === stockAfter) {
                  const targetStock = data.type === 'in'
                    ? stockBefore + quantity
                    : Math.max(0, stockBefore - quantity);

                  await window.supabase
                    .from('products')
                    .update({ stock: targetStock, updated_at: new Date().toISOString() })
                    .eq('id', productId);
                }
              }
            } catch (syncErr) {
              console.warn('Fallback stock update warning:', syncErr);
            }
          }

          // Catat audit log dan notifikasi jika bukan bagian dari transaksi kasir multi-item (batch POS)
          const isPosBatchItem = Boolean((data.note || '').includes('[INV-'));
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
                  link: data.type === 'in' ? '/in' : '/out'
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
                    link: '/items'
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

          // Ambil rincian transaksi sebelum dihapus untuk sinkronisasi pengembalian stok
          let txRow = null;
          let prodBefore = null;
          try {
            if (typeof window.supabase.from === 'function') {
              const { data: tData } = await window.supabase
                .from('transactions')
                .select('id, type, product_id, qty, quantity')
                .eq('id', targetId)
                .maybeSingle();
              if (tData) {
                txRow = tData;
                const pId = isNaN(Number(txRow.product_id)) ? txRow.product_id : Number(txRow.product_id);
                const { data: pData } = await window.supabase
                  .from('products')
                  .select('id, stock')
                  .eq('id', pId)
                  .maybeSingle();
                if (pData) prodBefore = pData;
              }
            }
          } catch (_) {}

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

          // Sinkronisasi pengembalian stok fallback jika trigger AFTER DELETE belum aktif
          if (txRow && prodBefore && typeof window.supabase.from === 'function') {
            try {
              const pId = isNaN(Number(txRow.product_id)) ? txRow.product_id : Number(txRow.product_id);
              const txQty = Number(txRow.qty ?? txRow.quantity) || 0;
              const { data: pAfter } = await window.supabase
                .from('products')
                .select('id, stock')
                .eq('id', pId)
                .maybeSingle();

              if (pAfter && txQty > 0) {
                const stockBefore = Number(prodBefore.stock || 0);
                const stockAfter = Number(pAfter.stock || 0);

                if (stockBefore === stockAfter) {
                  const targetStock = txRow.type === 'in'
                    ? Math.max(0, stockBefore - txQty)
                    : stockBefore + txQty;

                  await window.supabase
                    .from('products')
                    .update({ stock: targetStock, updated_at: new Date().toISOString() })
                    .eq('id', pId);
                }
              }
            } catch (delSyncErr) {
              console.warn('Fallback delete stock sync warning:', delSyncErr);
            }
          }

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
