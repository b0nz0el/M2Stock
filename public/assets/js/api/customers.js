/* ═══════════════════════════════════════════════════
   Aquastock Pro — api/customers.js
   Domain Customers / Master Customer
   ═══════════════════════════════════════════════════ */

import { isSupabaseAvailable, formatResponse, handleError, apiRequest } from './_client.js';

export const customers = {
    getAll: async (params, opts) => {
      if (isSupabaseAvailable()) {
        try {
          let query = window.supabase.from('customers').select('*').order('name');
          if (params?.search && params.search.trim()) {
            query = query.ilike('name', `%${params.search.trim()}%`);
          }
          const { data: custList, error: custErr } = await query;
          if (custErr) {
            return formatResponse({
              ok: false,
              error: { code: custErr.code || 'SUPABASE_ERROR', message: custErr.message }
            });
          }

          // Ambil transaksi 'out' untuk menghitung total belanja & jumlah transaksi
          const { data: txList, error: txErr } = await window.supabase
            .from('transactions')
            .select('id, customer_id, qty, price, created_at')
            .eq('type', 'out');
          if (txErr) {
            return formatResponse({
              ok: false,
              error: { code: txErr.code || 'SUPABASE_ERROR', message: txErr.message || 'Gagal menghitung transaksi customer' }
            });
          }

          const txByCust = {};
          if (txList) {
            for (const tx of txList) {
              if (!tx.customer_id) continue;
              if (!txByCust[tx.customer_id]) {
                txByCust[tx.customer_id] = {
                  totalSpent: 0,
                  totalOrders: 0,
                  lastOrderAt: null
                };
              }
              const sub = (Number(tx.qty ?? tx.quantity) || 0) * (Number(tx.price ?? tx.unit_price) || 0);
              txByCust[tx.customer_id].totalSpent += sub;
              txByCust[tx.customer_id].totalOrders += 1;
              if (!txByCust[tx.customer_id].lastOrderAt || new Date(tx.created_at) > new Date(txByCust[tx.customer_id].lastOrderAt)) {
                txByCust[tx.customer_id].lastOrderAt = tx.created_at;
              }
            }
          }

          const enriched = (custList || []).map(c => {
            const stats = txByCust[c.id] || { totalSpent: 0, totalOrders: 0, lastOrderAt: null };
            return {
              ...c,
              total_spent: stats.totalSpent,
              total_transactions: stats.totalOrders,
              last_transaction_at: stats.lastOrderAt
            };
          });

          return formatResponse({ ok: true, data: enriched });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/customers?' + new URLSearchParams(params || {}).toString(), { ...opts });
    },
    getById: async (id, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await window.supabase.from('customers').select('*').eq('id', id).single();
          if (error) {
            return formatResponse({
              ok: false,
              error: { code: error.code || 'SUPABASE_ERROR', message: error.message }
            });
          }
          return formatResponse({ ok: true, data });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/customers/' + id, { ...opts });
    },
    create: async (data, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const payload = {
            name: data.name ? data.name.trim() : '',
            phone: data.phone ? data.phone.trim() : null,
            email: data.email ? data.email.trim() : null,
            city: data.city ? data.city.trim() : null
          };
          if (!payload.name) {
            return formatResponse({
              ok: false,
              error: { code: 'VALIDATION_ERROR', message: 'Nama customer wajib diisi' }
            });
          }
          const { data: inserted, error } = await window.supabase.from('customers').insert([payload]).select().single();
          if (error) {
            return formatResponse({
              ok: false,
              error: { code: error.code || 'SUPABASE_ERROR', message: error.message }
            });
          }
          window.emitDataChanged?.('customers');
          return formatResponse({ ok: true, data: inserted, meta: { message: 'Customer berhasil ditambahkan' } });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/customers', { method: 'POST', body: data, ...opts });
    },
    update: async (id, data, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const payload = {};
          if (data.name !== undefined) payload.name = data.name.trim();
          if (data.phone !== undefined) payload.phone = data.phone ? data.phone.trim() : null;
          if (data.email !== undefined) payload.email = data.email ? data.email.trim() : null;
          if (data.city !== undefined) payload.city = data.city ? data.city.trim() : null;

          const { data: updated, error } = await window.supabase.from('customers').update(payload).eq('id', id).select().single();
          if (error) {
            return formatResponse({
              ok: false,
              error: { code: error.code || 'SUPABASE_ERROR', message: error.message }
            });
          }
          window.emitDataChanged?.('customers');
          return formatResponse({ ok: true, data: updated, meta: { message: 'Customer berhasil diperbarui' } });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/customers/' + id, { method: 'PUT', body: data, ...opts });
    },
    delete: async (id, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const { data: relatedTx, error: checkErr } = await window.supabase
            .from('transactions')
            .select('id')
            .eq('customer_id', id)
            .limit(1);
          if (!checkErr && relatedTx && relatedTx.length > 0) {
            return formatResponse({
              ok: false,
              error: {
                code: 'RELATION_CONSTRAINT',
                message: 'Customer tidak dapat dihapus karena masih tercatat pada transaksi keluar.'
              }
            });
          }
          const { error } = await window.supabase.from('customers').delete().eq('id', id);
          if (error) {
            return formatResponse({
              ok: false,
              error: { code: error.code || 'SUPABASE_ERROR', message: error.message }
            });
          }
          window.emitDataChanged?.('customers');
          return formatResponse({ ok: true, data: { id }, meta: { message: 'Customer berhasil dihapus' } });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/customers/' + id, { method: 'DELETE', ...opts });
    }
};

export default customers;
