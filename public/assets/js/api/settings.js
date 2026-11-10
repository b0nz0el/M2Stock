/* ═══════════════════════════════════════════════════
   M2Stock — settings.js (API Layer)
   Koneksi langsung ke Supabase 'app_settings'
   Pengaturan toko dari database
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';

export const settings = {
  /**
   * Mengambil semua pengaturan aplikasi
   * @returns {Promise<{ok: boolean, data?: Record<string, any>, error?: any}>}
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value, updated_at, updated_by');

      if (error) throw error;

      const map = {};
      (data || []).forEach(row => {
        map[row.key] = row.value;
      });

      return { ok: true, data: map };
    } catch (err) {
      console.error('settingsApi.getAll error:', err);
      return { ok: false, error: err };
    }
  },

  /**
   * Mengambil satu key pengaturan
   * @param {string} key
   * @returns {Promise<{ok: boolean, data?: any, error?: any}>}
   */
  async get(key) {
    try {
      const query = supabase?.from?.('app_settings');
      if (!query || typeof query.select !== 'function') {
        return { ok: false, error: new Error('Supabase client not initialized') };
      }
      const { data, error } = await query
        .select('value, updated_at, updated_by')
        .eq('key', key)
        .maybeSingle();

      if (error) throw error;
      return { ok: true, data: data ? data.value : null };
    } catch (err) {
      console.error(`settingsApi.get(${key}) error:`, err);
      return { ok: false, error: err };
    }
  },

  /**
   * Menyimpan / memperbarui satu key pengaturan (Upsert)
   * @param {string} key
   * @param {any} value
   * @returns {Promise<{ok: boolean, data?: any, error?: any}>}
   */
  async save(key, value) {
    try {
      const query = supabase?.from?.('app_settings');
      if (!query || typeof query.upsert !== 'function') {
        return { ok: false, error: new Error('Supabase client not initialized') };
      }

      let currentUserId = null;
      try {
        if (typeof supabase?.auth?.getUser === 'function') {
          const { data: authData } = await supabase.auth.getUser();
          currentUserId = authData?.user?.id || null;
        }
      } catch (_) {}

      const payload = {
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: currentUserId
      };

      const { data, error } = await query
        .upsert(payload, { onConflict: 'key' })
        .select()
        .single();

      if (error) throw error;

      if (key === 'store_info') {
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('aquastock_store_info', JSON.stringify(value));
          } catch (_) {}
        }
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(new CustomEvent('aquastock:store-info-updated', { detail: value }));
          } catch (_) {}
        }
      }

      if (key === 'appearance') {
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('aquastock_appearance', JSON.stringify(value));
          } catch (_) {}
        }
        if (typeof window !== 'undefined' && typeof window.applyAppearance === 'function') {
          try {
            window.applyAppearance(value);
          } catch (_) {}
        }
      }

      if (key === 'sales_channels') {
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('aquastock_channels', JSON.stringify(value));
          } catch (_) {}
        }
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(new CustomEvent('aquastock:channels-updated', { detail: value }));
          } catch (_) {}
        }
      }

      if (key === 'barcode_layout') {
        const layoutVal = typeof value === 'string' ? value : String(value || '');
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('aquastock_barcode_layout', layoutVal);
          } catch (_) {}
        }
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(new CustomEvent('aquastock:barcode-layout-updated', { detail: layoutVal }));
          } catch (_) {}
        }
      }

      return { ok: true, data: data ? data.value : value };
    } catch (err) {
      console.error(`settingsApi.save(${key}) error:`, err);
      return { ok: false, error: err };
    }
  },

  /**
   * Mengambil informasi profil toko terpusat untuk faktur penjualan, struk kasir, PO, dan retur
   * @returns {Promise<{name: string, slogan: string, email: string, phone: string, address: string}>}
   */
  async getStoreInfo() {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'store_info')
        .maybeSingle();

      if (!error && data?.value && data.value.name) {
        let logo = data.value.logo_url;
        if (!logo || String(logo).includes('habitic-logo')) {
          logo = '/assets/images/hasanah-pancing-logo.png';
        }
        const val = {
          ...data.value,
          logo_url: logo
        };
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('aquastock_store_info', JSON.stringify(val));
          } catch (_) {}
        }
        return val;
      }
    } catch (_) {}

    // Fallback ke localStorage jika koneksi Supabase gagal atau offline
    if (typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem('aquastock_store_info');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.name) {
            if (!parsed.logo_url || String(parsed.logo_url).includes('habitic-logo')) {
              parsed.logo_url = '/assets/images/hasanah-pancing-logo.png';
            }
            return parsed;
          }
        }
      } catch (_) {}
    }

    return {
      name: 'Hasanah Pancing',
      slogan: 'Perlengkapan Memancing & Akuarium',
      email: 'hasanahpancing1@gmail.com',
      phone: '0812-9662-8052',
      address: 'Jl. Mangga No. 67, Jatimakmur, Pondok Gede, Kota Bekasi',
      logo_url: '/assets/images/hasanah-pancing-logo.png'
    };
  },

  /**
   * Memperbarui profil akun user saat ini
   * @param {string} fullName
   * @returns {Promise<{ok: boolean, data?: any, error?: any}>}
   */
  async updateProfile(fullName) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) throw new Error('Pengguna tidak terotentikasi.');

      // 1. Update user metadata di Supabase Auth
      try {
        await supabase.auth.updateUser({
          data: { full_name: fullName, name: fullName }
        });
      } catch (_) {}

      // 2. Update tabel profiles di Supabase dengan dual-column fallback
      let updateResult = null;
      let updateError = null;

      // Coba update both full_name & name
      const attemptBoth = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          name: fullName
        })
        .eq('id', user.id)
        .select();

      if (!attemptBoth.error) {
        updateResult = attemptBoth.data?.[0] || { full_name: fullName, name: fullName };
      } else {
        // Jika kolom full_name belum ada di schema cache, coba update kolom name saja
        const attemptNameOnly = await supabase
          .from('profiles')
          .update({ name: fullName })
          .eq('id', user.id)
          .select();

        if (!attemptNameOnly.error) {
          updateResult = attemptNameOnly.data?.[0] || { name: fullName };
        } else {
          // Coba update full_name saja
          const attemptFullNameOnly = await supabase
            .from('profiles')
            .update({ full_name: fullName })
            .eq('id', user.id)
            .select();

          if (!attemptFullNameOnly.error) {
            updateResult = attemptFullNameOnly.data?.[0] || { full_name: fullName };
          } else {
            updateError = attemptFullNameOnly.error || attemptBoth.error;
          }
        }
      }

      if (updateError && !updateResult) {
        throw updateError;
      }

      // 3. Sinkronkan sesi auth_user di localStorage
      try {
        const cur = JSON.parse(localStorage.getItem('auth_user') || '{}');
        localStorage.setItem('auth_user', JSON.stringify({
          ...cur,
          id: user.id,
          full_name: fullName,
          name: fullName
        }));
      } catch (_) {}

      return { ok: true, data: updateResult || { full_name: fullName, name: fullName } };
    } catch (err) {
      console.error('settingsApi.updateProfile error:', err);
      return { ok: false, error: err };
    }
  },

  /**
   * Mengambil daftar saluran penjualan (channel) untuk POS & Laporan
   * @returns {Promise<Array<{id: string|number, name: string}>>}
   */
  async getChannels() {
    const DEFAULT_CHANNELS = ['Offline', 'Shopee', 'Tokopedia', 'TikTok', 'Lazada', 'WhatsApp'];

    // 1. Coba dari app_settings key 'sales_channels'
    try {
      const res = await this.get('sales_channels');
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        return res.data.map((c, idx) => (typeof c === 'string' ? { id: idx + 1, name: c } : c));
      }
    } catch (_) {}

    // 2. Coba dari cache localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem('aquastock_channels');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((c, idx) => (typeof c === 'string' ? { id: idx + 1, name: c } : c));
          }
        }
      } catch (_) {}
    }

    // 3. Fallback default channels
    return DEFAULT_CHANNELS.map((name, idx) => ({ id: idx + 1, name }));
  },

  /**
   * Menyimpan daftar saluran penjualan ke app_settings & localStorage
   * @param {Array<{id: string|number, name: string}|string>} channels
   */
  async saveChannels(channels) {
    const list = (channels || []).map(c => (typeof c === 'string' ? c.trim() : c.name.trim())).filter(Boolean);
    // Pastikan Offline selalu ada
    if (!list.some(n => n.toLowerCase() === 'offline')) {
      list.unshift('Offline');
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('aquastock_channels', JSON.stringify(list));
      } catch (_) {}
    }

    const res = await this.save('sales_channels', list);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aquastock:channels-updated', { detail: list }));
    }
    return res;
  }
};

