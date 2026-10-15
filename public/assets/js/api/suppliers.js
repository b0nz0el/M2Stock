/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/suppliers.js
   Domain Suppliers / Master Supplier
   ═══════════════════════════════════════════════════ */

import { isSupabaseAvailable, formatResponse, handleError, apiRequest } from './_client.js';

export const suppliers = {
    getAll: async (params, opts) => {
      if (isSupabaseAvailable()) {
        try {
          let query = window.supabase.from('suppliers').select('*').order('name');
          if (params?.status === 'active') {
            query = query.eq('is_active', true);
          } else if (params?.status === 'inactive') {
            query = query.eq('is_active', false);
          }
          if (params?.search && params.search.trim()) {
            query = query.ilike('name', `%${params.search.trim()}%`);
          }
          const { data, error } = await query;
          if (error) {
            return formatResponse({
              ok: false,
              error: { code: error.code || 'SUPABASE_ERROR', message: error.message }
            });
          }
          return formatResponse({ ok: true, data: data || [] });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/suppliers?' + new URLSearchParams(params || {}).toString(), { ...opts });
    },
    getById: async (id, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await window.supabase.from('suppliers').select('*').eq('id', id).single();
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
      return apiRequest('/suppliers/' + id, { ...opts });
    },
    create: async (data, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const payload = {
            name: data.name ? data.name.trim() : '',
            phone: data.phone ? data.phone.trim() : null,
            address: data.address ? data.address.trim() : null,
            is_active: data.is_active !== undefined ? Boolean(data.is_active) : true
          };
          if (!payload.name) {
            return formatResponse({
              ok: false,
              error: { code: 'VALIDATION_ERROR', message: 'Nama supplier wajib diisi' }
            });
          }
          const { data: inserted, error } = await window.supabase.from('suppliers').insert([payload]).select().single();
          if (error) {
            return formatResponse({
              ok: false,
              error: { code: error.code || 'SUPABASE_ERROR', message: error.message }
            });
          }
          return formatResponse({ ok: true, data: inserted, meta: { message: 'Supplier berhasil ditambahkan' } });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/suppliers', { method: 'POST', body: data, ...opts });
    },
    update: async (id, data, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const payload = {};
          if (data.name !== undefined) payload.name = data.name.trim();
          if (data.phone !== undefined) payload.phone = data.phone ? data.phone.trim() : null;
          if (data.address !== undefined) payload.address = data.address ? data.address.trim() : null;
          if (data.is_active !== undefined) payload.is_active = Boolean(data.is_active);

          const { data: updated, error } = await window.supabase.from('suppliers').update(payload).eq('id', id).select().single();
          if (error) {
            return formatResponse({
              ok: false,
              error: { code: error.code || 'SUPABASE_ERROR', message: error.message }
            });
          }
          return formatResponse({ ok: true, data: updated, meta: { message: 'Supplier berhasil diperbarui' } });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/suppliers/' + id, { method: 'PUT', body: data, ...opts });
    },
    delete: async (id, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const { data: relatedTx, error: checkErr } = await window.supabase
            .from('transactions')
            .select('id')
            .eq('supplier_id', id)
            .limit(1);
          if (!checkErr && relatedTx && relatedTx.length > 0) {
            return formatResponse({
              ok: false,
              error: {
                code: 'RELATION_CONSTRAINT',
                message: 'Supplier tidak dapat dihapus karena masih tercatat pada transaksi masuk.'
              }
            });
          }
          const { error } = await window.supabase.from('suppliers').delete().eq('id', id);
          if (error) {
            return formatResponse({
              ok: false,
              error: { code: error.code || 'SUPABASE_ERROR', message: error.message }
            });
          }
          return formatResponse({ ok: true, data: { id }, meta: { message: 'Supplier berhasil dihapus' } });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/suppliers/' + id, { method: 'DELETE', ...opts });
    }
};

export default suppliers;
