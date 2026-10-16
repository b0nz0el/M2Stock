/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/transactions.js
   Domain Transaksi Barang Masuk & Keluar, PO, & Retur
   ═══════════════════════════════════════════════════ */

import { isSupabaseAvailable, formatResponse, handleError, apiRequest } from './_client.js';

function mapTransaction(row) {
  return {
    ...row,
    qty: Number(row.quantity ?? row.qty) || 0,
    price: Number(row.unit_price ?? row.price) || 0,
    note: row.notes ?? row.note ?? null,
    created_by: row.user_id ?? row.created_by ?? null,
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

    create: async (data, opts) => {
      if (isSupabaseAvailable()) {
        try {
          let userId = data.created_by || data.user_id || null;
          if (!userId) {
            try {
              const userRes = await window.supabase.auth.getUser();
              userId = userRes?.data?.user?.id || null;
            } catch (error) {
              console.warn('Pengguna transaksi tidak dapat diverifikasi:', error);
            }
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

          const row = {
            type: data.type,
            product_id: data.product_id,
            quantity,
            unit_price: unitPrice,
            total_price: quantity * unitPrice,
            customer_id: data.customer_id || null,
            supplier_id: data.supplier_id || null,
            channel: data.channel || 'Offline',
            notes: data.note ?? data.notes ?? null,
            user_id: userId
          };

          if (data.payment_method) {
            row.payment_method = data.payment_method;
          }
          if (data.payment_status) {
            row.payment_status = data.payment_status;
          }

          let query = window.supabase
            .from('transactions')
            .insert([row])
            .select('*, products(id, name, sku, brand, stock), suppliers(id, name), customers(id, name)');

          if (opts && opts.signal) {
            query = query.abortSignal(opts.signal);
          }

          const { data: inserted, error } = await query;
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
          let query = window.supabase
            .from('transactions')
            .delete()
            .eq('id', id);

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
