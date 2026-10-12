/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api.js
   Wrapper fetch terpusat, envelope standar, error handling, & AbortController
   ═══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const API_BASE = '/api';

  /* Konfigurasi state API */
  const config = {
    mockMode: false, // false: gunakan backend Supabase jika tersedia
    defaultTimeout: 15000 // 15 detik timeout default
  };

  /**
   * Helper pemeriksaan ketersediaan klien Supabase global
   */
  function isSupabaseAvailable() {
    return typeof window !== 'undefined' && Boolean(window.supabase);
  }

  /**
   * Helper pembuat AbortController baru
   */
  function createAbortController() {
    return new AbortController();
  }

  /**
   * Helper pembuat respons standar
   */
  function formatResponse({ ok = true, data = null, error = null, meta = {} }) {
    return {
      ok: Boolean(ok),
      data: data,
      error: error ? {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Terjadi kesalahan sistem',
        details: error.details !== undefined ? error.details : null
      } : null,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  /**
   * Error handler terpusat untuk fetch & exceptions
   */
  function handleError(err, defaultCode = 'NETWORK_ERROR') {
    if (err && (err.name === 'AbortError' || err.code === 'REQUEST_ABORTED')) {
      return formatResponse({
        ok: false,
        error: {
          code: 'REQUEST_ABORTED',
          message: 'Permintaan dibatalkan oleh pengguna atau timeout',
          details: null
        }
      });
    }

    return formatResponse({
      ok: false,
      error: {
        code: (err && err.code) || defaultCode,
        message: (err && err.message) || 'Koneksi ke server gagal atau tidak tersedia',
        details: (err && err.details) !== undefined ? err.details : null
      }
    });
  }

  /**
   * Mock Data Store untuk sistem aQuaStock Pro (Jaquris)
   */
  const MOCK_DATA = {
    items: [
      { id: 'ITM-001', name: 'Filter Hang-on 501', category: 'Filter', stock: 18, minStock: 5, unitPrice: 85000 },
      { id: 'ITM-002', name: 'Lampu LED Aquascape 60cm', category: 'Lampu', stock: 12, minStock: 4, unitPrice: 450000 },
      { id: 'ITM-003', name: 'Pompa Udara 2 Lubang AC/DC', category: 'Aerator', stock: 9, minStock: 3, unitPrice: 135000 },
      { id: 'ITM-004', name: 'Pasir Silika Hitam 1kg', category: 'Substrat', stock: 54, minStock: 10, unitPrice: 12000 },
      { id: 'ITM-005', name: 'Batu Seiryu Stone', category: 'Hardscape', stock: 25, minStock: 5, unitPrice: 35000 }
    ],
    user: {
      id: 'USR-01',
      name: 'Mr David',
      username: 'david@jaquris.com',
      role: 'OWNER'
    }
  };

  /**
   * Eksekusi request API via fetch
   */
  async function apiRequest(path, options = {}) {
    // 1. Handle Mock Mode jika aktif
    if (config.mockMode) {
      return executeMockRequest(path, options);
    }

    // 2. Setup sinyal pembatalan & timeout
    const controller = options.signal ? null : new AbortController();
    const signal = options.signal || controller.signal;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), options.timeout || config.defaultTimeout)
      : null;

    try {
      const url = API_BASE + path;
      const fetchOptions = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(options.headers || {})
        },
        credentials: 'same-origin',
        signal: signal
      };

      if (options.body && typeof options.body === 'object') {
        fetchOptions.body = JSON.stringify(options.body);
      } else if (options.body) {
        fetchOptions.body = options.body;
      }

      const res = await fetch(url, fetchOptions);

      // Parse JSON atau fallback text
      let body;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await res.json();
      } else {
        const text = await res.text();
        body = { message: text };
      }

      if (!res.ok) {
        const errorCode = mapHttpStatusToCode(res.status);
        return formatResponse({
          ok: false,
          error: {
            code: (body && body.error && body.error.code) || errorCode,
            message: (body && body.error && body.error.message) || body.message || `HTTP ${res.status}: Gagal memproses permintaan`,
            details: (body && body.error && body.error.details) || body
          },
          meta: { status: res.status }
        });
      }

      // Jika response sudah berbentuk envelope standar
      if (body && typeof body === 'object' && 'ok' in body && ('data' in body || 'error' in body)) {
        return body;
      }

      // Bungkus ke dalam envelope standar
      return formatResponse({
        ok: true,
        data: body,
        meta: { status: res.status }
      });
    } catch (err) {
      return handleError(err);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  function mapHttpStatusToCode(status) {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 422: return 'VALIDATION_ERROR';
      case 500: return 'INTERNAL_SERVER_ERROR';
      case 502: return 'BAD_GATEWAY';
      case 503: return 'SERVICE_UNAVAILABLE';
      default: return 'HTTP_ERROR_' + status;
    }
  }

  /**
   * Router Mock Request internal
   */
  async function executeMockRequest(path, options = {}) {
    // Delay simulasi latensi jaringan
    await new Promise(resolve => setTimeout(resolve, options.mockDelay || 150));

    // Periksa sinyal abort
    if (options.signal && options.signal.aborted) {
      return handleError({ name: 'AbortError' });
    }

    const cleanPath = path.split('?')[0];

    // Auth
    if (cleanPath === '/auth/login') {
      return formatResponse({
        ok: true,
        data: { token: 'mock-jwt-token-david', user: MOCK_DATA.user },
        meta: { message: 'Login mock berhasil' }
      });
    }
    if (cleanPath === '/auth/logout') {
      return formatResponse({ ok: true, data: { success: true }, meta: { message: 'Logout berhasil' } });
    }

    // Items
    if (cleanPath === '/items') {
      return formatResponse({
        ok: true,
        data: MOCK_DATA.items,
        meta: { total: MOCK_DATA.items.length }
      });
    }

    // Generic fallback mock untuk modul lain
    return formatResponse({
      ok: true,
      data: { message: `Endpoint ${cleanPath} siap terhubung backend` },
      meta: { mock: true, path: cleanPath }
    });
  }

  /* ═══════════════════════════════════════════════
     API CLIENT INTERFACE
     ═══════════════════════════════════════════════ */
  const Api = {
    // Helpers
    createAbortController,
    formatResponse,
    handleError,
    setMockMode: (val) => { config.mockMode = Boolean(val); },
    isMockMode: () => config.mockMode,

    // Raw Request
    request: apiRequest,

    // 1. Auth Module
    auth: {
      login: async (credentials, opts) => {
        if (!config.mockMode && isSupabaseAvailable()) {
          try {
            const { data, error } = await window.supabase.auth.signInWithPassword({
              email: credentials.username || credentials.email,
              password: credentials.password
            });
            if (error) {
              return formatResponse({
                ok: false,
                error: {
                  code: error.code || 'AUTH_ERROR',
                  message: error.message || 'Login gagal',
                  details: error
                }
              });
            }
            return formatResponse({
              ok: true,
              data: { token: data.session ? data.session.access_token : null, user: data.user, session: data.session },
              meta: { message: 'Login berhasil' }
            });
          } catch (err) {
            return handleError(err);
          }
        }
        return apiRequest('/auth/login', { method: 'POST', body: credentials, ...opts });
      },
      logout: async (opts) => {
        if (!config.mockMode && isSupabaseAvailable()) {
          try {
            const { error } = await window.supabase.auth.signOut();
            if (error) {
              return formatResponse({
                ok: false,
                error: { code: error.code || 'AUTH_ERROR', message: error.message, details: error }
              });
            }
            return formatResponse({ ok: true, data: { success: true }, meta: { message: 'Logout berhasil' } });
          } catch (err) {
            return handleError(err);
          }
        }
        return apiRequest('/auth/logout', { method: 'POST', ...opts });
      },
      me: async (opts) => {
        if (!config.mockMode && isSupabaseAvailable()) {
          try {
            const { data, error } = await window.supabase.auth.getUser();
            if (error) {
              return formatResponse({
                ok: false,
                error: { code: error.code || 'AUTH_ERROR', message: error.message, details: error }
              });
            }
            return formatResponse({ ok: true, data: data.user, meta: {} });
          } catch (err) {
            return handleError(err);
          }
        }
        return apiRequest('/auth/me', { ...opts });
      }
    },

    // 2. Items / Master Barang
    items: {
      getAll: async (params, opts) => {
        if (!config.mockMode && isSupabaseAvailable()) {
          try {
            let query = window.supabase
              .from('products')
              .select('*, categories(name)')
              .order('created_at', { ascending: false });

            if (params && params.category_id) {
              query = query.eq('category_id', Number(params.category_id));
            }
            if (params && params.search) {
              query = query.or('name.ilike.%' + params.search + '%,sku.ilike.%' + params.search + '%');
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
                name: item.name || '',
                brand: item.brand || '-',
                category_id: item.category_id,
                category: (item.categories && item.categories.name) || 'Umum',
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
        if (!config.mockMode && isSupabaseAvailable()) {
          try {
            const numId = Number(id);
            let query = window.supabase
              .from('products')
              .select('*, categories(name)');

            if (!isNaN(numId) && Number.isInteger(numId) && String(numId) === String(id).trim()) {
              query = query.eq('id', numId);
            } else {
              query = query.eq('sku', String(id).trim());
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
              name: data.name || '',
              brand: data.brand || '-',
              category_id: data.category_id,
              category: (data.categories && data.categories.name) || 'Umum',
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
        if (!config.mockMode && isSupabaseAvailable()) {
          try {
            const row = {
              name: data.name,
              sku: data.sku || data.code || null,
              category_id: data.category_id ? Number(data.category_id) : null,
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
        if (!config.mockMode && isSupabaseAvailable()) {
          try {
            const numId = Number(id);
            const row = { ...data };
            if (row.minStock !== undefined) { row.min_stock = row.minStock; delete row.minStock; }
            if (row.costPrice !== undefined) { row.cost_price = row.costPrice; delete row.costPrice; }
            if (row.sellPrice !== undefined) { row.sell_price = row.sellPrice; delete row.sellPrice; }
            if (row.unitPrice !== undefined && row.sell_price === undefined) { row.sell_price = row.unitPrice; delete row.unitPrice; }
            if (row.stock !== undefined) row.stock = Number(row.stock);
            if (row.min_stock !== undefined) row.min_stock = Number(row.min_stock);
            if (row.cost_price !== undefined) row.cost_price = Number(row.cost_price);
            if (row.sell_price !== undefined) row.sell_price = Number(row.sell_price);
            if (row.category_id !== undefined) row.category_id = row.category_id ? Number(row.category_id) : null;
            delete row.id;
            delete row.categories;
            delete row.created_at;
            delete row.updated_at;
            delete row.category;

            let query = window.supabase
              .from('products')
              .update(row)
              .eq('id', numId)
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
        if (!config.mockMode && isSupabaseAvailable()) {
          try {
            const numId = Number(id);
            let query = window.supabase
              .from('products')
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
                  message: error.message || 'Gagal menghapus produk',
                  details: error
                }
              });
            }

            return formatResponse({
              ok: true,
              data: { success: true },
              meta: { message: 'Produk berhasil dihapus' }
            });
          } catch (err) {
            return handleError(err);
          }
        }
        return apiRequest(`/items/${id}`, { method: 'DELETE', ...opts });
      }
    },

    // 3. Transaksi Barang Masuk & Keluar
    transactions: {
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
        return Api.transactions.getAll({ ...(params || {}), type: type }, opts);
      },

      getByPeriod: async (startDate, endDate, type, opts) => {
        return Api.transactions.getAll({ startDate, endDate, type }, opts);
      },

      getIn: (params, opts) => {
        if (!config.mockMode && !isSupabaseAvailable()) {
          return apiRequest('/transactions/in?' + new URLSearchParams(params || {}).toString(), { ...opts });
        }
        return Api.transactions.getByType('in', params, opts);
      },

      createIn: (data, opts) => {
        if (!config.mockMode && !isSupabaseAvailable()) {
          return apiRequest('/transactions/in', { method: 'POST', body: data, ...opts });
        }
        return Api.transactions.create({ ...(data || {}), type: 'in' }, opts);
      },

      getOut: (params, opts) => {
        if (!config.mockMode && !isSupabaseAvailable()) {
          return apiRequest('/transactions/out?' + new URLSearchParams(params || {}).toString(), { ...opts });
        }
        return Api.transactions.getByType('out', params, opts);
      },

      createOut: (data, opts) => {
        if (!config.mockMode && !isSupabaseAvailable()) {
          return apiRequest('/transactions/out', { method: 'POST', body: data, ...opts });
        }
        return Api.transactions.create({ ...(data || {}), type: 'out' }, opts);
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
    },

    // 4. Purchase Order (PO) & Retur
    po: {
      getAll: (params, opts) => apiRequest('/po?' + new URLSearchParams(params || {}).toString(), { ...opts }),
      create: (data, opts) => apiRequest('/po', { method: 'POST', body: data, ...opts })
    },
    return: {
      getAll: (params, opts) => apiRequest('/return?' + new URLSearchParams(params || {}).toString(), { ...opts }),
      create: (data, opts) => apiRequest('/return', { method: 'POST', body: data, ...opts })
    },

    // 5. Relasi Master (Supplier & Customer)
    suppliers: {
      getAll: async (params, opts) => {
        if (!config.mockMode && isSupabaseAvailable()) {
          try {
            const { data, error } = await window.supabase
              .from('suppliers')
              .select('*')
              .order('name');
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
      }
    },
    customers: {
      getAll: async (params, opts) => {
        if (!config.mockMode && isSupabaseAvailable()) {
          try {
            const { data, error } = await window.supabase
              .from('customers')
              .select('*')
              .order('name');
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
        return apiRequest('/customers?' + new URLSearchParams(params || {}).toString(), { ...opts });
      }
    },

    // 6. Keuangan (Kas, Hutang, Piutang)
    finance: {
      getCash: (params, opts) => apiRequest('/finance/cash?' + new URLSearchParams(params || {}).toString(), { ...opts }),
      getDebt: (params, opts) => apiRequest('/finance/debt?' + new URLSearchParams(params || {}).toString(), { ...opts })
    },

    // 7. Laporan
    reports: {
      getReport: (params, opts) => apiRequest('/reports?' + new URLSearchParams(params || {}).toString(), { ...opts })
    },

    // 8. Sistem (Users, Audit, Notif, Backup, Settings)
    system: {
      getUsers: (opts) => apiRequest('/system/users', { ...opts }),
      getAuditLogs: (opts) => apiRequest('/system/audit', { ...opts }),
      getNotifications: (opts) => apiRequest('/system/notifications', { ...opts }),
      backupNow: (opts) => apiRequest('/system/backup', { method: 'POST', ...opts }),
      getSettings: (opts) => apiRequest('/system/settings', { ...opts }),
      saveSettings: (data, opts) => apiRequest('/system/settings', { method: 'POST', body: data, ...opts })
    },

    // 9. Storage (Supabase Storage: bucket product-images)
    storage: {
      uploadImage: async (fileOrBlob, path, opts) => {
        if (!config.mockMode && isSupabaseAvailable()) {
          try {
            const { data, error } = await window.supabase.storage
              .from('product-images')
              .upload(path, fileOrBlob, {
                contentType: 'image/webp',
                upsert: true,
                ...(opts || {})
              });

            if (error) {
              return formatResponse({
                ok: false,
                error: {
                  code: error.code || 'STORAGE_UPLOAD_ERROR',
                  message: error.message || 'Gagal mengunggah foto produk ke storage',
                  details: error
                }
              });
            }

            const publicUrl = window.supabase.storage
              .from('product-images')
              .getPublicUrl(path).data?.publicUrl;

            return formatResponse({
              ok: true,
              data: { path: data.path, publicUrl: publicUrl },
              meta: { message: 'Foto produk berhasil diunggah' }
            });
          } catch (err) {
            return handleError(err);
          }
        }

        return formatResponse({
          ok: true,
          data: {
            path: path,
            publicUrl: `https://mock.storage/product-images/${path}`
          },
          meta: { message: 'Mock upload berhasil' }
        });
      },

      getImageUrl: (path) => {
        if (!config.mockMode && isSupabaseAvailable()) {
          try {
            const { data } = window.supabase.storage
              .from('product-images')
              .getPublicUrl(path);
            return data?.publicUrl || null;
          } catch (_) {
            return null;
          }
        }
        return `https://mock.storage/product-images/${path}`;
      },

      deleteImage: async (path, opts) => {
        if (!config.mockMode && isSupabaseAvailable()) {
          try {
            const { data, error } = await window.supabase.storage
              .from('product-images')
              .remove([path]);

            if (error) {
              return formatResponse({
                ok: false,
                error: {
                  code: error.code || 'STORAGE_DELETE_ERROR',
                  message: error.message || 'Gagal menghapus foto dari storage',
                  details: error
                }
              });
            }

            return formatResponse({
              ok: true,
              data: data,
              meta: { message: 'Foto berhasil dihapus dari storage' }
            });
          } catch (err) {
            return handleError(err);
          }
        }

        return formatResponse({
          ok: true,
          data: { path: path },
          meta: { message: 'Mock delete berhasil' }
        });
      }
    }
  };

  // Ekspos ke global window browser
  if (typeof window !== 'undefined') {
    window.Api = Api;
  }

  // Ekspos untuk Node / Vitest testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Api;
  }

})(typeof window !== 'undefined' ? window : globalThis);
