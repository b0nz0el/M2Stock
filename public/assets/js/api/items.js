/* ═══════════════════════════════════════════════════
   Aquastock Pro — api/items.js
   Domain Items / Master Barang
   ═══════════════════════════════════════════════════ */

import { isSupabaseAvailable, formatResponse, handleError, apiRequest, logAudit } from './_client.js';

export function parseItemImages(rawImageUrl, rawImages) {
  if (Array.isArray(rawImages) && rawImages.length > 0) {
    return rawImages.filter(Boolean);
  }
  if (!rawImageUrl) return [];
  if (Array.isArray(rawImageUrl)) return rawImageUrl.filter(Boolean);
  if (typeof rawImageUrl === 'string') {
    const trimmed = rawImageUrl.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (_) {}
    }
    if (trimmed.includes('|||')) {
      return trimmed.split('|||').map(s => s.trim()).filter(Boolean);
    }
    return [trimmed];
  }
  return [];
}

export function parseItemChannels(rawChannel, rawChannelLink, localMeta) {
  // 1. Cek dari localMeta.channels jika sudah ada array
  if (localMeta && Array.isArray(localMeta.channels) && localMeta.channels.length > 0) {
    return localMeta.channels.filter(c => c && typeof c === 'object' && c.channel);
  }

  // 2. Cek jika rawChannelLink berupa JSON array
  if (typeof rawChannelLink === 'string') {
    const trimmed = rawChannelLink.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(c => c && typeof c === 'object' && c.channel);
        }
      } catch (_) {}
    }
  }

  // 3. Fallback jika ada channel_link atau rawChannel tunggal
  const effectiveCh = (rawChannel && rawChannel !== 'Offline') ? rawChannel : ((localMeta && localMeta.channel) || rawChannel || 'Offline');
  const effectiveLk = (typeof rawChannelLink === 'string' && !rawChannelLink.startsWith('[') ? rawChannelLink : (localMeta && localMeta.channel_link)) || '';

  if (effectiveLk || (effectiveCh && effectiveCh !== 'Offline')) {
    return [{ channel: effectiveCh, link: effectiveLk }];
  }

  return [];
}

export function getLocalChannelMeta(id, sku) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('aquastock_product_channels');
    if (!raw) return null;
    const map = JSON.parse(raw);
    if (!map || typeof map !== 'object') return null;
    let entry = null;
    if (id && map[String(id)]) entry = map[String(id)];
    if (!entry && sku && map['sku:' + String(sku).trim().toLowerCase()]) entry = map['sku:' + String(sku).trim().toLowerCase()];
    if (entry && !Array.isArray(entry.channels)) {
      entry.channels = entry.channel ? [{ channel: entry.channel, link: entry.channel_link || '' }] : [];
    }
    return entry;
  } catch (_) {
    return null;
  }
}

export function saveLocalChannelMeta(id, sku, channel, channel_link, channels = null) {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem('aquastock_product_channels');
    const map = raw ? JSON.parse(raw) : {};

    let formattedChannels = Array.isArray(channels) ? channels.filter(c => c && c.channel) : null;
    if (!formattedChannels && channel_link && typeof channel_link === 'string' && channel_link.startsWith('[')) {
      try {
        const parsed = JSON.parse(channel_link);
        if (Array.isArray(parsed)) formattedChannels = parsed;
      } catch (_) {}
    }
    if (!formattedChannels && (channel || channel_link)) {
      formattedChannels = [{ channel: channel || 'Offline', link: channel_link || '' }];
    }

    const primaryChannel = (formattedChannels && formattedChannels[0]?.channel) || channel || 'Offline';
    const primaryLink = (formattedChannels && formattedChannels[0]?.link) || (typeof channel_link === 'string' && !channel_link.startsWith('[') ? channel_link : '');

    const entry = {
      channel: primaryChannel,
      channel_link: primaryLink,
      channels: formattedChannels || [],
      updated_at: Date.now()
    };
    if (id) map[String(id)] = entry;
    if (sku) map['sku:' + String(sku).trim().toLowerCase()] = entry;
    localStorage.setItem('aquastock_product_channels', JSON.stringify(map));
  } catch (_) {}
}

if (typeof window !== 'undefined') {
  window.parseItemChannels = parseItemChannels;
  window.getLocalChannelMeta = getLocalChannelMeta;
  window.saveLocalChannelMeta = saveLocalChannelMeta;
}

export const items = {
  getLocalChannelMeta,
  saveLocalChannelMeta,
  parseItemChannels,
    getAll: async (params, opts) => {
      if (isSupabaseAvailable()) {
        try {
          const orderCol = (params && params.order) || 'name';
          const ascending = params && typeof params.ascending === 'boolean' ? params.ascending : true;
          let query = window.supabase
            .from('products')
            .select('*, categories(name), units(name)')
            .order(orderCol, { ascending });

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
            const itemImages = parseItemImages(item.image_url, item.images);
            const primaryImageUrl = itemImages[0] || (typeof item.image_url === 'string' && !item.image_url.startsWith('[') ? item.image_url : null);
            const localMeta = getLocalChannelMeta(item.id, item.sku);
            const channels = parseItemChannels(item.channel, item.channel_link, localMeta);
            const effectiveChannel = (channels[0]?.channel) || ((item.channel && item.channel !== 'Offline') ? item.channel : ((localMeta && localMeta.channel) || item.channel || 'Offline'));
            const effectiveLink = (channels[0]?.link) || (typeof item.channel_link === 'string' && !item.channel_link.startsWith('[') ? item.channel_link : (localMeta && localMeta.channel_link)) || '';
            return {
              id: item.id,
              sku: item.sku || '',
              barcode: item.barcode || '',
              name: item.name || '',
              brand: item.brand || '-',
              category_id: item.category_id,
              supplier_id: item.supplier_id ?? null,
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
              channel: effectiveChannel,
              channel_link: effectiveLink,
              channels: channels,
              image_url: primaryImageUrl,
              images: itemImages,
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

          const itemImages = parseItemImages(data.image_url, data.images);
          const primaryImageUrl = itemImages[0] || (typeof data.image_url === 'string' && !data.image_url.startsWith('[') ? data.image_url : null);
          const localMeta = getLocalChannelMeta(data.id, data.sku);
          const channels = parseItemChannels(data.channel, data.channel_link, localMeta);
          const effectiveChannel = (channels[0]?.channel) || ((data.channel && data.channel !== 'Offline') ? data.channel : ((localMeta && localMeta.channel) || data.channel || 'Offline'));
          const effectiveLink = (channels[0]?.link) || (typeof data.channel_link === 'string' && !data.channel_link.startsWith('[') ? data.channel_link : (localMeta && localMeta.channel_link)) || '';
          const mapped = {
            id: data.id,
            sku: data.sku || '',
            barcode: data.barcode || '',
            name: data.name || '',
            brand: data.brand || '-',
            category_id: data.category_id,
            supplier_id: data.supplier_id ?? null,
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
            channel: effectiveChannel,
            channel_link: effectiveLink,
            channels: channels,
            image_url: primaryImageUrl,
            images: itemImages,
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
          let resolvedImageUrl = data.image_url !== undefined ? data.image_url : null;
          if (!resolvedImageUrl && Array.isArray(data.images) && data.images.length > 0) {
            resolvedImageUrl = data.images.length === 1 ? data.images[0] : JSON.stringify(data.images);
          }

          const formattedChannels = Array.isArray(data.channels) ? data.channels.filter(c => c && c.channel) : null;
          const primaryChannel = (formattedChannels && formattedChannels[0]?.channel) || data.channel || 'Offline';
          const primaryChannelLink = (formattedChannels && formattedChannels.length > 1)
            ? JSON.stringify(formattedChannels)
            : ((formattedChannels && formattedChannels[0]?.link) || data.channel_link || null);
          const minStock = data.min_stock !== undefined ? data.min_stock : data.minStock;
          const costPrice = data.cost_price !== undefined ? data.cost_price : data.costPrice;
          const sellPrice = data.sell_price !== undefined ? data.sell_price : (data.sellPrice !== undefined ? data.sellPrice : data.unitPrice);

          const row = {
            name: data.name,
            sku: data.sku || data.code || null,
            barcode: data.barcode == null ? null : (String(data.barcode).trim() || null),
            category_id: data.category_id ? Number(data.category_id) : null,
            unit_id: data.unit_id ? Number(data.unit_id) : 1,
            supplier_id: data.supplier_id == null || data.supplier_id === '' ? null : Number(data.supplier_id),
            brand: data.brand || null,
            channel: primaryChannel,
            channel_link: primaryChannelLink,
            stock: data.stock !== undefined ? Number(data.stock) : 0,
            min_stock: minStock !== undefined ? Number(minStock) : 0,
            cost_price: costPrice !== undefined ? Number(costPrice) : 0,
            sell_price: sellPrice !== undefined ? Number(sellPrice) : 0,
            image_url: resolvedImageUrl
          };

          let query = window.supabase
            .from('products')
            .insert([row])
            .select();

          if (opts && opts.signal) {
            query = query.abortSignal(opts.signal);
          }

          let { data: inserted, error } = await query;
          if (error && (String(error.message || '').includes('channel_link') || String(error.message || '').includes('channel'))) {
            const fallbackRow = { ...row };
            delete fallbackRow.channel;
            delete fallbackRow.channel_link;
            let retryQuery = window.supabase.from('products').insert([fallbackRow]).select();
            if (opts && opts.signal) retryQuery = retryQuery.abortSignal(opts.signal);
            const retryRes = await retryQuery;
            if (!retryRes.error) {
              inserted = retryRes.data;
              error = null;
            }
          }
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

          const newProd = inserted && inserted[0] ? { ...inserted[0] } : null;
          saveLocalChannelMeta(newProd?.id, newProd?.sku || data.sku, primaryChannel, primaryChannelLink, formattedChannels);
          if (newProd) {
            newProd.channel = primaryChannel;
            newProd.channel_link = primaryChannelLink || '';
            newProd.channels = formattedChannels || [{ channel: primaryChannel, link: primaryChannelLink || '' }];
          }
          try {
            if (typeof logAudit === 'function') {
              logAudit('CREATE', `Tambah Produk Baru: ${newProd?.name || data.name || 'Produk'} (SKU: ${newProd?.sku || data.sku || '-'})`);
            }
          } catch (_) {}

          return formatResponse({
            ok: true,
            data: newProd,
            meta: { message: 'Produk berhasil ditambahkan' }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      const formattedChannels = Array.isArray(data.channels) ? data.channels.filter(c => c && c.channel) : null;
      const primaryChannel = (formattedChannels && formattedChannels[0]?.channel) || data.channel || 'Offline';
      const primaryChannelLink = (formattedChannels && formattedChannels.length > 1)
        ? JSON.stringify(formattedChannels)
        : ((formattedChannels && formattedChannels[0]?.link) || data.channel_link || null);
      saveLocalChannelMeta(data.id, data.sku, primaryChannel, primaryChannelLink, formattedChannels);
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
          if (row.supplier_id !== undefined) row.supplier_id = row.supplier_id == null || row.supplier_id === '' ? null : Number(row.supplier_id);
          if (row.images !== undefined) {
            if (!row.image_url && Array.isArray(row.images)) {
              row.image_url = row.images.length === 1 ? row.images[0] : JSON.stringify(row.images);
            }
            delete row.images;
          }

          const formattedChannels = Array.isArray(data.channels) ? data.channels.filter(c => c && c.channel) : null;
          if (formattedChannels) {
            row.channel = formattedChannels[0]?.channel || 'Offline';
            row.channel_link = formattedChannels.length > 1 ? JSON.stringify(formattedChannels) : (formattedChannels[0]?.link || null);
          }
          delete row.channels;

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

          let { data: updated, error } = await query;
          if (error && (String(error.message || '').includes('channel_link') || String(error.message || '').includes('channel'))) {
            const fallbackRow = { ...row };
            delete fallbackRow.channel;
            delete fallbackRow.channel_link;
            let retryQuery = window.supabase.from('products').update(fallbackRow).eq('id', id).select();
            if (opts && opts.signal) retryQuery = retryQuery.abortSignal(opts.signal);
            const retryRes = await retryQuery;
            if (!retryRes.error) {
              updated = retryRes.data;
              error = null;
            }
          }
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

          const updatedProd = updated && updated[0] ? { ...updated[0] } : null;
          if (!updatedProd) {
            return formatResponse({
              ok: false,
              error: {
                code: 'PRODUCT_NOT_UPDATED',
                message: 'Produk tidak ditemukan atau perubahan ditolak. Muat ulang data dan periksa akses akun Anda.'
              }
            });
          }
          const finalChannel = formattedChannels ? (formattedChannels[0]?.channel || 'Offline') : (row.channel || data.channel || 'Offline');
          const finalLink = formattedChannels ? (formattedChannels.length > 1 ? JSON.stringify(formattedChannels) : (formattedChannels[0]?.link || '')) : (row.channel_link || data.channel_link || '');
          saveLocalChannelMeta(id, data.sku, finalChannel, finalLink, formattedChannels);
          updatedProd.channel = finalChannel;
          updatedProd.channel_link = finalLink;
          updatedProd.channels = formattedChannels || parseItemChannels(updatedProd.channel, updatedProd.channel_link, { channel: finalChannel, channel_link: finalLink });
          try {
            if (typeof logAudit === 'function') {
              logAudit('UPDATE', `Update Produk: ${updatedProd.name || data.name || id}`);
            }
          } catch (_) {}

          return formatResponse({
            ok: true,
            data: updatedProd,
            meta: { message: 'Produk berhasil diperbarui' }
          });
        } catch (err) {
          return handleError(err);
        }
      }
      const formattedChannels = Array.isArray(data.channels) ? data.channels.filter(c => c && c.channel) : null;
      const finalChannel = formattedChannels ? (formattedChannels[0]?.channel || 'Offline') : (data.channel || 'Offline');
      const finalLink = formattedChannels ? (formattedChannels.length > 1 ? JSON.stringify(formattedChannels) : (formattedChannels[0]?.link || '')) : (data.channel_link || '');
      saveLocalChannelMeta(id, data.sku, finalChannel, finalLink, formattedChannels);
      return apiRequest(`/items/${id}`, { method: 'PUT', body: data, ...opts });
    },

    adjustStock: async (id, actualStock, reason = 'Stock Opname Fisik', notes = '', opts = {}) => {
      if (isSupabaseAvailable()) {
        try {
          const targetStock = Number(actualStock);
          if (!Number.isFinite(targetStock) || targetStock < 0) {
            return formatResponse({
              ok: false,
              error: { code: 'INVALID_STOCK', message: 'Stok fisik harus berupa angka nol atau lebih.' }
            });
          }

          if (typeof window.supabase?.rpc !== 'function') {
            return formatResponse({
              ok: false,
              error: { code: 'RPC_UNAVAILABLE', message: 'Penyesuaian stok atomik tidak tersedia. Perubahan stok dibatalkan.' }
            });
          }

          const { data: rpcRes, error: rpcErr } = await window.supabase.rpc('perform_stock_opname', {
            p_product_id: String(id),
            p_actual_stock: targetStock,
            p_reason: reason,
            p_notes: notes || ''
          });

          if (rpcErr) {
            return formatResponse({
              ok: false,
              error: {
                code: rpcErr.code || 'STOCK_ADJUSTMENT_ERROR',
                message: rpcErr.message || 'Gagal mencatat penyesuaian stok.',
                details: rpcErr
              }
            });
          }

          if (!rpcRes?.ok) {
            return formatResponse({
              ok: false,
              error: { code: 'STOCK_ADJUSTMENT_ERROR', message: 'Database tidak mengonfirmasi penyesuaian stok.' }
            });
          }

          const difference = Number(rpcRes.difference || 0);
          const previousStock = Number(rpcRes.previous_stock ?? targetStock);

          return formatResponse({
            ok: true,
            data: {
              id,
              stock: targetStock,
              adjustment_id: rpcRes.adjustment_id || null
            },
            meta: {
              message: rpcRes.message || `Stok produk berhasil disesuaikan menjadi ${targetStock}`,
              previousStock,
              difference
            }
          });
        } catch (err) {
          return handleError(err);
        }
      }

      return apiRequest(`/items/${id}/adjust-stock`, { method: 'POST', body: { actualStock, reason, notes }, ...opts });
    },

    getStockAdjustments: async (id, opts = {}) => {
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await window.supabase
            .from('stock_adjustments')
            .select('id, product_id, previous_stock, actual_stock, difference, reason, notes, created_by, created_at')
            .eq('product_id', id)
            .order('created_at', { ascending: false })
            .limit(50);

          if (error) return formatResponse({ ok: false, error });
          return formatResponse({ ok: true, data: data || [] });
        } catch (err) {
          return handleError(err);
        }
      }

      return apiRequest(`/items/${id}/stock-adjustments`, { ...opts });
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

          try {
            if (typeof logAudit === 'function') {
              logAudit('DELETE', `Hapus Produk ID: ${id}`);
            }
          } catch (_) {}

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

          try {
            if (typeof logAudit === 'function') {
              logAudit('DELETE', `Force Hapus Produk ID: ${id}`);
            }
          } catch (_) {}

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
    },

    bulkUpdateMeta: async (ids, metaData = {}, opts) => {
      if (!Array.isArray(ids) || ids.length === 0) {
        return formatResponse({ ok: false, error: { code: 'INVALID_INPUT', message: 'Pilih minimal 1 produk' } });
      }

      const payload = { updated_at: new Date().toISOString() };
      if (metaData.unit_id !== undefined && metaData.unit_id !== null && metaData.unit_id !== '') {
        payload.unit_id = Number(metaData.unit_id);
      }
      if (metaData.supplier_id !== undefined && metaData.supplier_id !== null && metaData.supplier_id !== '') {
        payload.supplier_id = Number(metaData.supplier_id);
      }

      if (Object.keys(payload).length <= 1) {
        return formatResponse({ ok: false, error: { code: 'INVALID_INPUT', message: 'Pilih satuan atau supplier yang ingin diubah' } });
      }

      if (isSupabaseAvailable()) {
        try {
          const results = [];
          const failures = [];
          for (let i = 0; i < ids.length; i++) {
            const pId = String(ids[i]);
            let query = window.supabase
              .from('products')
              .update(payload)
              .eq('id', pId);

            if (opts && opts.signal) query = query.abortSignal(opts.signal);
            const { error } = await query;
            if (error) {
              console.warn(`Gagal update metadata produk ID ${pId}:`, error);
              // Jika supplier_id belum ada di tabel products, coba update unit_id saja
              if (error.message?.includes('supplier_id') && payload.unit_id) {
                const { error: fallbackErr } = await window.supabase
                  .from('products')
                  .update({ unit_id: payload.unit_id, updated_at: payload.updated_at })
                  .eq('id', pId);
                if (!fallbackErr) {
                  results.push(pId);
                  continue;
                }
              }
              failures.push({ id: pId, error });
            } else {
              results.push(pId);
            }
          }

          if (failures.length && results.length === 0) {
            return formatResponse({
              ok: false,
              error: { code: failures[0]?.error?.code || 'SUPABASE_ERROR', message: failures[0]?.error?.message || 'Gagal memperbarui produk' }
            });
          }

          return formatResponse({
            ok: true,
            data: { updatedCount: results.length, failedCount: failures.length, updatedIds: results }
          });
        } catch (err) {
          return handleError(err);
        }
      }

      return apiRequest('/items/bulk-meta', {
        method: 'PATCH',
        body: JSON.stringify({ ids, ...metaData }),
        ...opts
      });
    }
};

export default items;
