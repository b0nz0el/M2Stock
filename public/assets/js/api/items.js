/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/items.js
   Domain Items / Master Barang
   ═══════════════════════════════════════════════════ */

import { isSupabaseAvailable, formatResponse, handleError, apiRequest } from './_client.js';

export const items = {
    getAll: async (params, opts) => {
      if (isSupabaseAvailable()) {
        try {
          let query = window.supabase
            .from('products')
            .select('*, categories(name), units(name)')
            .order('created_at', { ascending: false });

          if (params && params.category_id) {
            query = query.eq('category_id', Number(params.category_id));
          }
          if (params && params.search) {
            query = query.or('name.ilike.%' + params.search + '%,sku.ilike.%' + params.search + '%,barcode.ilike.%' + params.search + '%');
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
                message: error.message || 'Gagal mengambil data produk',
                details: error
              }
            });
          }

          const mapped = (data || []).map(function (item) {
            return {
              id: item.id,
              sku: item.sku || '',
              barcode: item.barcode || '',
              name: item.name || '',
              brand: item.brand || '-',
              category_id: item.category_id,
              category: (item.categories && item.categories.name) || 'Umum',
              unit_id: item.unit_id,
              unit: (item.units && item.units.name) || 'pcs',
              stock: Number(item.stock) || 0,
              minStock: Number(item.min_stock) || 0,
              min_stock: Number(item.min_stock) || 0,
              costPrice: Number(item.cost_price) || 0,
              cost_price: Number(item.cost_price) || 0,
              sellPrice: Number(item.sell_price) || 0,
              sell_price: Number(item.sell_price) || 0,
              unitPrice: Number(item.sell_price) || 0,
              image_url: item.image_url || null,
              created_at: item.created_at,
              updated_at: item.updated_at
            };
          });

          return formatResponse({
            ok: true,
            data: mapped,
            meta: { total: mapped.length, source: 'supabase' }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/items?' + new URLSearchParams(params || {}).toString(), { ...opts });
    },

    getById: async (id, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const idValue = String(id).trim();
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idValue);
          const isNumericId = /^\d+$/.test(idValue);
          let query = window.supabase
            .from('products')
            .select('*, categories(name), units(name)');

          if (isUuid || isNumericId) {
            query = query.eq('id', idValue);
          } else {
            query = query.eq('sku', idValue);
          }

          if (opts && opts.signal) {
            query = query.abortSignal(opts.signal);
          }

          const { data, error } = await query.single();
          if (error) {
            return formatResponse({
              ok: false,
              error: {
                code: error.code === 'PGRST116' ? 'NOT_FOUND' : (error.code || 'SUPABASE_ERROR'),
                message: error.code === 'PGRST116' ? 'Produk tidak ditemukan' : (error.message || 'Gagal mengambil produk'),
                details: error
              }
            });
          }

          const mapped = {
            id: data.id,
            sku: data.sku || '',
            barcode: data.barcode || '',
            name: data.name || '',
            brand: data.brand || '-',
            category_id: data.category_id,
            category: (data.categories && data.categories.name) || 'Umum',
            unit_id: data.unit_id,
            unit: (data.units && data.units.name) || 'pcs',
            stock: Number(data.stock) || 0,
            minStock: Number(data.min_stock) || 0,
            min_stock: Number(data.min_stock) || 0,
            costPrice: Number(data.cost_price) || 0,
            cost_price: Number(data.cost_price) || 0,
            sellPrice: Number(data.sell_price) || 0,
            sell_price: Number(data.sell_price) || 0,
            unitPrice: Number(data.sell_price) || 0,
            image_url: data.image_url || null,
            created_at: data.created_at,
            updated_at: data.updated_at
          };

          return formatResponse({
            ok: true,
            data: mapped,
            meta: { source: 'supabase' }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest(`/items/${id}`, { ...opts });
    },

    create: async (data, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const row = {
            name: data.name,
            sku: data.sku || data.code || null,
            barcode: data.barcode == null ? null : (String(data.barcode).trim() || null),
            category_id: data.category_id ? Number(data.category_id) : null,
            unit_id: data.unit_id ? Number(data.unit_id) : 1,
            brand: data.brand || null,
            stock: data.stock !== undefined ? Number(data.stock) : 0,
            min_stock: (data.min_stock !== undefined ? data.min_stock : data.minStock) !== undefined ? Number(data.min_stock || data.minStock) : 0,
            cost_price: (data.cost_price !== undefined ? data.cost_price : data.costPrice) !== undefined ? Number(data.cost_price || data.costPrice) : 0,
            sell_price: (data.sell_price !== undefined ? data.sell_price : (data.sellPrice || data.unitPrice)) !== undefined ? Number(data.sell_price || data.sellPrice || data.unitPrice) : 0,
            image_url: data.image_url || null
          };

          let query = window.supabase
            .from('products')
            .insert([row])
            .select();

          if (opts && opts.signal) {
            query = query.abortSignal(opts.signal);
          }

          const { data: inserted, error } = await query;
          if (error) {
            return formatResponse({
              ok: false,
              error: {
                code: error.code || 'SUPABASE_ERROR',
                message: error.message || 'Gagal menambahkan produk',
                details: error
              }
            });
          }

          return formatResponse({
            ok: true,
            data: inserted && inserted[0] ? inserted[0] : null,
            meta: { message: 'Produk berhasil ditambahkan' }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest('/items', { method: 'POST', body: data, ...opts });
    },

    update: async (id, data, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const row = { ...data };
          delete row.stock;
          if (row.minStock !== undefined) { row.min_stock = row.minStock; delete row.minStock; }
          if (row.costPrice !== undefined) { row.cost_price = row.costPrice; delete row.costPrice; }
          if (row.sellPrice !== undefined) { row.sell_price = row.sellPrice; delete row.sellPrice; }
          if (row.unitPrice !== undefined && row.sell_price === undefined) { row.sell_price = row.unitPrice; delete row.unitPrice; }
          if (row.stock !== undefined) row.stock = Number(row.stock);
          if (row.min_stock !== undefined) row.min_stock = Number(row.min_stock);
          if (row.cost_price !== undefined) row.cost_price = Number(row.cost_price);
          if (row.sell_price !== undefined) row.sell_price = Number(row.sell_price);
          if (row.category_id !== undefined) row.category_id = row.category_id ? Number(row.category_id) : null;
          if (row.unit_id !== undefined) row.unit_id = Number(row.unit_id);
          delete row.id;
          delete row.categories;
          delete row.units;
          delete row.unit;
          delete row.created_at;
          delete row.updated_at;
          delete row.category;

          let query = window.supabase
            .from('products')
            .update(row)
            .eq('id', id)
            .select();

          if (opts && opts.signal) {
            query = query.abortSignal(opts.signal);
          }

          const { data: updated, error } = await query;
          if (error) {
            return formatResponse({
              ok: false,
              error: {
                code: error.code || 'SUPABASE_ERROR',
                message: error.message || 'Gagal memperbarui produk',
                details: error
              }
            });
          }

          return formatResponse({
            ok: true,
            data: updated && updated[0] ? updated[0] : null,
            meta: { message: 'Produk berhasil diperbarui' }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest(`/items/${id}`, { method: 'PUT', body: data, ...opts });
    },

    delete: async (id, opts) => {
      if (opts && opts.force) {
        return items.forceDelete(id, opts);
      }
      if (isSupabaseAvailable()) {
        try {
          // Pre-check apakah produk tercatat pada transaksi, PO, atau Retur
          const checkRes = await items.checkDeletable([id], opts);
          if (checkRes.ok && checkRes.data && checkRes.data.skippedIds && checkRes.data.skippedIds.includes(String(id))) {
            return formatResponse({
              ok: false,
              error: {
                code: 'RELATION_CONSTRAINT',
                message: 'Produk tidak dapat dihapus karena masih tercatat dalam riwayat transaksi, Purchase Order, atau Retur.'
              }
            });
          }

          let query = window.supabase
            .from('products')
            .delete()
            .eq('id', id);

          if (opts && opts.signal) {
            query = query.abortSignal(opts.signal);
          }

          const { error } = await query;
          if (error) {
            const isFkViolation = error.code === '23503' ||
              (error.message && error.message.includes('foreign key constraint')) ||
              (error.message && error.message.includes('fk_poi_product')) ||
              (error.message && error.message.includes('fk_returns_product'));

            return formatResponse({
              ok: false,
              error: {
                code: isFkViolation ? 'RELATION_CONSTRAINT' : (error.code || 'SUPABASE_ERROR'),
                message: isFkViolation
                  ? 'Produk tidak dapat dihapus karena masih tercatat dalam riwayat Purchase Order, transaksi, atau Retur.'
                  : (error.message || 'Gagal menghapus produk'),
                details: error
              }
            });
          }

          return formatResponse({
            ok: true,
            data: { success: true, id },
            meta: { message: 'Produk berhasil dihapus' }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest(`/items/${id}`, { method: 'DELETE', ...opts });
    },

    forceDelete: async (id, opts) => {
      if (isSupabaseAvailable()) {
        try {
          // Bersihkan data relasi terkait data uji coba
          await Promise.all([
            window.supabase.from('transactions').delete().eq('product_id', id),
            window.supabase.from('purchase_order_items').delete().eq('product_id', id),
            window.supabase.from('returns').delete().eq('produk_id', id)
          ]);

          let query = window.supabase
            .from('products')
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
                message: error.message || 'Gagal menghapus produk secara permanen',
                details: error
              }
            });
          }

          return formatResponse({
            ok: true,
            data: { success: true, id },
            meta: { message: 'Produk dan seluruh relasi berhasil dibersihkan' }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      return apiRequest(`/items/${id}?force=true`, { method: 'DELETE', ...opts });
    },

    checkDeletable: async (ids, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const productIds = (ids || []).map(id => String(id)).filter(Boolean);
          if (!productIds.length) {
            return formatResponse({ ok: true, data: { deletableIds: [], skippedIds: [] } });
          }

          // Periksa 3 relasi utama: transactions, purchase_order_items, dan returns
          let txQuery = window.supabase
            .from('transactions')
            .select('product_id')
            .in('product_id', productIds);

          let poiQuery = window.supabase
            .from('purchase_order_items')
            .select('product_id')
            .in('product_id', productIds);

          let retQuery = window.supabase
            .from('returns')
            .select('produk_id')
            .in('produk_id', productIds);

          if (opts && opts.signal) {
            txQuery = txQuery.abortSignal(opts.signal);
            poiQuery = poiQuery.abortSignal(opts.signal);
            retQuery = retQuery.abortSignal(opts.signal);
          }

          const [txRes, poiRes, retRes] = await Promise.all([
            txQuery.then(r => r).catch(() => ({ data: [] })),
            poiQuery.then(r => r).catch(() => ({ data: [] })),
            retQuery.then(r => r).catch(() => ({ data: [] }))
          ]);

          const usedSet = new Set();
          if (txRes && txRes.data) {
            txRes.data.forEach(t => { if (t.product_id != null) usedSet.add(String(t.product_id)); });
          }
          if (poiRes && poiRes.data) {
            poiRes.data.forEach(p => { if (p.product_id != null) usedSet.add(String(p.product_id)); });
          }
          if (retRes && retRes.data) {
            retRes.data.forEach(r => { if (r.produk_id != null) usedSet.add(String(r.produk_id)); });
          }

          const deletableIds = productIds.filter(id => !usedSet.has(id));
          const skippedIds = productIds.filter(id => usedSet.has(id));
          return formatResponse({
            ok: true,
            data: { deletableIds, skippedIds, totalRequested: productIds.length }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      return formatResponse({ ok: true, data: { deletableIds: ids, skippedIds: [] } });
    },

    bulkDelete: async (ids, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const productIds = (ids || []).map(id => String(id)).filter(Boolean);
          if (!productIds.length) {
            return formatResponse({ ok: false, error: { message: 'Tidak ada produk yang dipilih untuk dihapus' } });
          }

          const checkRes = await items.checkDeletable(productIds, opts);
          if (!checkRes.ok) return checkRes;

          const { deletableIds, skippedIds } = checkRes.data;

          if (deletableIds.length === 0) {
            return formatResponse({
              ok: false,
              error: {
                code: 'ALL_REFERENCED',
                message: 'Semua produk yang dipilih tidak dapat dihapus karena memiliki riwayat transaksi, Purchase Order, atau Retur'
              },
              data: { deletedIds: [], skippedIds, deletedCount: 0, skippedCount: skippedIds.length }
            });
          }

          let deleteQuery = window.supabase
            .from('products')
            .delete()
            .in('id', deletableIds);

          if (opts && opts.signal) deleteQuery = deleteQuery.abortSignal(opts.signal);
          const { error: delError } = await deleteQuery;
          if (delError) {
            return formatResponse({
              ok: false,
              error: { code: delError.code || 'SUPABASE_ERROR', message: delError.message || 'Gagal menghapus produk terpilih' }
            });
          }

          return formatResponse({
            ok: true,
            data: {
              deletedIds: deletableIds,
              skippedIds: skippedIds,
              deletedCount: deletableIds.length,
              skippedCount: skippedIds.length
            },
            meta: {
              message: skippedIds.length > 0
                ? `${deletableIds.length} berhasil dihapus, ${skippedIds.length} dilewati (memiliki riwayat transaksi/PO/Retur)`
                : `${deletableIds.length} produk berhasil dihapus`
            }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      return formatResponse({
        ok: true,
        data: { deletedIds: ids, skippedIds: [], deletedCount: ids.length, skippedCount: 0 }
      });
    },

    bulkUpdatePrice: async (updates, opts) => {
      if (isSupabaseAvailable()) {
        try {
          if (!updates || !updates.length) {
            return formatResponse({ ok: false, error: { message: 'Tidak ada data harga untuk diperbarui' } });
          }

          const results = [];
          const failures = [];
          for (let i = 0; i < updates.length; i++) {
            const u = updates[i];
            const productId = String(u.id);
            const newPrice = Math.max(0, Math.round(Number(u.sell_price) || 0));

            let query = window.supabase
              .from('products')
              .update({ sell_price: newPrice })
              .eq('id', productId);

            if (opts && opts.signal) query = query.abortSignal(opts.signal);
            const { error } = await query;
            if (error) {
              console.error(`Gagal update harga produk ID ${productId}:`, error);
              failures.push({ id: productId, code: error.code || 'SUPABASE_ERROR', message: error.message || 'Gagal memperbarui harga' });
            } else {
              results.push(productId);
            }
          }

          if (failures.length) {
            return formatResponse({
              ok: false,
              error: {
                code: 'PARTIAL_UPDATE',
                message: `${results.length} produk berhasil diperbarui, ${failures.length} gagal.`,
                details: failures
              },
              data: { updatedIds: results, failedIds: failures.map(failure => failure.id), updatedCount: results.length }
            });
          }

          return formatResponse({
            ok: true,
            data: { updatedIds: results, updatedCount: results.length },
            meta: { message: `${results.length} produk berhasil diperbarui harganya` }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      return formatResponse({ ok: true, data: { updatedCount: (updates || []).length } });
    }
};

export default items;
