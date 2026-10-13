/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/transactions.js
   Domain Transaksi Barang Masuk & Keluar, PO, & Retur
   ═══════════════════════════════════════════════════ */

import { config, isSupabaseAvailable, formatResponse, handleError, apiRequest } from './_client.js';

export const transactions = {
    getAll: async (params, opts) => {
      if (!config.mockMode && isSupabaseAvailable()) {
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
            data: data || [],
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
      if (!config.mockMode && !isSupabaseAvailable()) {
        return apiRequest('/transactions/in?' + new URLSearchParams(params || {}).toString(), { ...opts });
      }
      return transactions.getByType('in', params, opts);
    },

    createIn: (data, opts) => {
      if (!config.mockMode && !isSupabaseAvailable()) {
        return apiRequest('/transactions/in', { method: 'POST', body: data, ...opts });
      }
      return transactions.create({ ...(data || {}), type: 'in' }, opts);
    },

    getOut: (params, opts) => {
      if (!config.mockMode && !isSupabaseAvailable()) {
        return apiRequest('/transactions/out?' + new URLSearchParams(params || {}).toString(), { ...opts });
      }
      return transactions.getByType('out', params, opts);
    },

    createOut: (data, opts) => {
      if (!config.mockMode && !isSupabaseAvailable()) {
        return apiRequest('/transactions/out', { method: 'POST', body: data, ...opts });
      }
      return transactions.create({ ...(data || {}), type: 'out' }, opts);
    },

    create: async (data, opts) => {
      if (!config.mockMode && isSupabaseAvailable()) {
        try {
          let userId = data.created_by || null;
          if (!userId) {
            try {
              const userRes = await window.supabase.auth.getUser();
              userId = userRes?.data?.user?.id || null;
            } catch (_) {}
          }

          // Validasi foreign key profiles(id) agar tidak melanggar constraint jika tabel profiles kosong
          if (userId) {
            try {
              const { data: pData } = await window.supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
              if (!pData) {
                const upRes = await window.supabase.from('profiles').insert([{ id: userId }]).select();
                if (upRes.error) {
                  userId = null;
                }
              }
            } catch (_) {
              userId = null;
            }
          }

          const row = {
            type: data.type,
            product_id: Number(data.product_id),
            qty: Number(data.qty),
            price: Number(data.price),
            customer_id: data.customer_id ? Number(data.customer_id) : null,
            supplier_id: data.supplier_id ? Number(data.supplier_id) : null,
            channel: data.channel || 'Offline',
            note: data.note || null,
            created_by: userId
          };

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
            data: inserted && inserted[0] ? inserted[0] : null,
            meta: { message: 'Transaksi berhasil dicatat' }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest(`/transactions/${data.type || 'in'}`, { method: 'POST', body: data, ...opts });
    },

    delete: async (id, opts) => {
      if (!config.mockMode && isSupabaseAvailable()) {
        try {
          const numId = Number(id);
          let query = window.supabase
            .from('transactions')
            .delete()
            .eq('id', numId);

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
