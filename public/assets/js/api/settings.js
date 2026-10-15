/* ═══════════════════════════════════════════════════
   aQuaStock Pro — settings.js (API Layer)
   Koneksi langsung ke Supabase 'app_settings'
   ANTI-MOCK: Data live dari database
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
      const { data, error } = await supabase
        .from('app_settings')
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
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || null;

      const payload = {
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: currentUserId
      };

      const { data, error } = await supabase
        .from('app_settings')
        .upsert(payload, { onConflict: 'key' })
        .select()
        .single();

      if (error) throw error;
      return { ok: true, data: data ? data.value : value };
    } catch (err) {
      console.error(`settingsApi.save(${key}) error:`, err);
      return { ok: false, error: err };
    }
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

      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      return { ok: true, data };
    } catch (err) {
      console.error('settingsApi.updateProfile error:', err);
      return { ok: false, error: err };
    }
  }
};
