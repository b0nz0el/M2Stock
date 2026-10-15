/* ═══════════════════════════════════════════════════
   aQuaStock Pro — settings.js
   Controller Modul Pengaturan (/dashboard/settings/)
   Pengaturan dari Supabase app_settings & profiles
   ═══════════════════════════════════════════════════ */

import { settings as settingsApi } from '../../assets/js/api/settings.js';
import { supabase } from '../../assets/js/supabase-client.js';
import { applyReadOnlyUI } from '../../assets/js/utils/rbac-ui.js';

(function () {
  'use strict';

  let currentSettings = {
    store_info: {
      name: 'Aquarium David',
      slogan: 'Solusi Lengkap Kebutuhan Akuarium & Ikan Hias',
      email: 'info@aquastock.pro',
      phone: '0812-3456-7890',
      address: 'Jl. Merdeka No. 123, Jakarta'
    },
    pos_config: {
      tax_rate: 11,
      service_rate: 0,
      default_payment: 'Cash',
      receipt_footer: 'Terima kasih telah berbelanja di Aquarium David!'
    },
    stock_config: {
      min_stock_alert: 5,
      auto_po_enabled: false
    },
    appearance: {
      theme: 'dark',
      primary_color: '#0088CC',
      compact_mode: false
    }
  };

  let currentUserProfile = null;
  let catalogCategories = [];
  let catalogUnits = [];

  function renderCatalogList(elementId, entries, emptyMessage) {
    const list = document.getElementById(elementId);
    if (!list) return;
    list.replaceChildren();

    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'py-3 text-sm text-[#A0A0A5]';
      empty.textContent = emptyMessage;
      list.appendChild(empty);
      return;
    }

    entries.forEach(entry => {
      const row = document.createElement('li');
      row.className = 'flex items-center justify-between gap-3 py-3 text-sm';

      const name = document.createElement('span');
      name.className = 'font-medium text-white';
      name.textContent = entry.name;

      const badge = document.createElement('span');
      badge.className = 'rounded-full bg-white/5 px-2.5 py-1 text-xs text-[#A0A0A5]';
      badge.textContent = 'Aktif';

      row.append(name, badge);
      list.appendChild(row);
    });
  }

  async function loadCatalogLists() {
    const [categoryResult, unitResult] = await Promise.all([
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('units').select('id, name').order('name')
    ]);
    if (categoryResult.error) throw categoryResult.error;
    if (unitResult.error) throw unitResult.error;

    catalogCategories = categoryResult.data || [];
    catalogUnits = unitResult.data || [];
    renderCatalogList('setting-category-list', catalogCategories, 'Belum ada kategori.');
    renderCatalogList('setting-unit-list', catalogUnits, 'Belum ada satuan.');
  }

  async function handleAddCatalogEntry(event, { table, inputId, buttonId, label }) {
    event.preventDefault();
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    const name = input?.value.trim();
    if (!name) {
      if (typeof showToast === 'function') showToast(`Nama ${label.toLowerCase()} wajib diisi.`, 'error');
      return;
    }

    const entries = table === 'categories' ? catalogCategories : catalogUnits;
    if (entries.some(entry => entry.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      if (typeof showToast === 'function') showToast(`${label} "${name}" sudah terdaftar.`, 'error');
      return;
    }

    if (button) button.disabled = true;
    try {
      const { error } = await supabase.from(table).insert({ name });
      if (error) {
        if (error.code === '23505') throw new Error(`${label} "${name}" sudah terdaftar.`);
        throw error;
      }

      if (input) input.value = '';
      await loadCatalogLists();
      if (typeof showToast === 'function') showToast(`${label} "${name}" berhasil ditambahkan.`, 'success');
    } catch (error) {
      console.error(`Gagal menambahkan ${label.toLowerCase()}:`, error);
      if (typeof showToast === 'function') {
        showToast(error.message || `Gagal menambahkan ${label.toLowerCase()}. Periksa koneksi dan hak akses Anda.`, 'error');
      }
    } finally {
      if (button) button.disabled = false;
    }
  }

  function switchTab(tabId) {
    const tabButtons = document.querySelectorAll('.settings-tab-btn');
    const tabContents = document.querySelectorAll('.settings-tab-content');

    tabButtons.forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabId;
      if (isTarget) {
        btn.classList.add('bg-white/10', 'text-white', 'border-white/20');
        btn.classList.remove('text-[#A0A0A5]', 'border-transparent');
      } else {
        btn.classList.remove('bg-white/10', 'text-white', 'border-white/20');
        btn.classList.add('text-[#A0A0A5]', 'border-transparent');
      }
    });

    tabContents.forEach(content => {
      if (content.id === `tab-content-${tabId}`) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    });

    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  async function loadSettings() {
    try {
      // 1. Fetch live app_settings
      const res = await settingsApi.getAll();
      if (res.ok && res.data) {
        currentSettings = { ...currentSettings, ...res.data };
      }

      // 2. Fetch current user & profile
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, role, email')
          .eq('id', user.id)
          .maybeSingle();

        currentUserProfile = {
          id: user.id,
          email: user.email || (profile ? profile.email : '-'),
          full_name: profile?.full_name || user.user_metadata?.full_name || 'Owner',
          role: profile?.role || user.user_metadata?.role || 'OWNER'
        };
      }

      populateForms();
    } catch (err) {
      console.error('Error loadSettings:', err);
      if (typeof showToast === 'function') {
        showToast('Gagal memuat pengaturan: ' + (err.message || 'Error server'), 'error');
      }
    }
  }

  function populateForms() {
    // 1. Store Info
    const store = currentSettings.store_info || {};
    const shopName = document.getElementById('setting-shop-name');
    const shopSlogan = document.getElementById('setting-shop-slogan');
    const shopEmail = document.getElementById('setting-shop-email');
    const shopPhone = document.getElementById('setting-shop-phone');
    const shopAddress = document.getElementById('setting-shop-address');

    if (shopName) shopName.value = store.name || '';
    if (shopSlogan) shopSlogan.value = store.slogan || '';
    if (shopEmail) shopEmail.value = store.email || '';
    if (shopPhone) shopPhone.value = store.phone || '';
    if (shopAddress) shopAddress.value = store.address || '';

    // 2. POS Config
    const pos = currentSettings.pos_config || {};
    const posTax = document.getElementById('setting-pos-tax');
    const posService = document.getElementById('setting-pos-service');
    const posPayment = document.getElementById('setting-pos-default-payment');
    const posReceipt = document.getElementById('setting-pos-receipt-footer');

    if (posTax) posTax.value = pos.tax_rate ?? 11;
    if (posService) posService.value = pos.service_rate ?? 0;
    if (posPayment) posPayment.value = pos.default_payment || 'Cash';
    if (posReceipt) posReceipt.value = pos.receipt_footer || '';

    // 3. Stock Config
    const stock = currentSettings.stock_config || {};
    const stockAlert = document.getElementById('setting-stock-min-alert');
    const stockAutoPo = document.getElementById('setting-stock-auto-po');

    if (stockAlert) stockAlert.value = stock.min_stock_alert ?? 5;
    if (stockAutoPo) stockAutoPo.checked = Boolean(stock.auto_po_enabled);

    // 4. Appearance
    const appearance = currentSettings.appearance || {};
    const themeSelect = document.getElementById('setting-theme');
    const colorSelect = document.getElementById('setting-primary-color');
    const compactCheck = document.getElementById('setting-compact-mode');

    if (themeSelect) themeSelect.value = appearance.theme || 'dark';
    if (colorSelect) colorSelect.value = appearance.primary_color || '#0088CC';
    if (compactCheck) compactCheck.checked = Boolean(appearance.compact_mode);

    // 5. Account Profile
    if (currentUserProfile) {
      const accEmail = document.getElementById('setting-account-email');
      const accRole = document.getElementById('setting-account-role');
      const accName = document.getElementById('setting-account-name');

      if (accEmail) accEmail.value = currentUserProfile.email || '-';
      if (accRole) accRole.textContent = currentUserProfile.role || 'OWNER';
      if (accName) accName.value = currentUserProfile.full_name || '';
    }
  }

  async function handleSaveStore(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-store');
    if (btn) btn.disabled = true;

    try {
      const payload = {
        name: document.getElementById('setting-shop-name')?.value.trim() || '',
        slogan: document.getElementById('setting-shop-slogan')?.value.trim() || '',
        email: document.getElementById('setting-shop-email')?.value.trim() || '',
        phone: document.getElementById('setting-shop-phone')?.value.trim() || '',
        address: document.getElementById('setting-shop-address')?.value.trim() || ''
      };

      const res = await settingsApi.save('store_info', payload);
      if (!res.ok) throw new Error(res.error?.message || 'Gagal menyimpan profil toko');

      currentSettings.store_info = payload;
      if (typeof showToast === 'function') {
        showToast('Profil toko berhasil disimpan ke database', 'success');
      } else {
        alert('Profil toko berhasil disimpan.');
      }
    } catch (err) {
      console.error('handleSaveStore error:', err);
      alert('Error: ' + (err.message || 'Gagal menyimpan'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleSavePOS(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-pos');
    if (btn) btn.disabled = true;

    try {
      const payload = {
        tax_rate: Number(document.getElementById('setting-pos-tax')?.value || 0),
        service_rate: Number(document.getElementById('setting-pos-service')?.value || 0),
        default_payment: document.getElementById('setting-pos-default-payment')?.value || 'Cash',
        receipt_footer: document.getElementById('setting-pos-receipt-footer')?.value.trim() || ''
      };

      const res = await settingsApi.save('pos_config', payload);
      if (!res.ok) throw new Error(res.error?.message || 'Gagal menyimpan konfigurasi POS');

      currentSettings.pos_config = payload;
      if (typeof showToast === 'function') {
        showToast('Pengaturan POS & Kasir berhasil diperbarui', 'success');
      } else {
        alert('Pengaturan POS & Kasir berhasil disimpan.');
      }
    } catch (err) {
      console.error('handleSavePOS error:', err);
      alert('Error: ' + (err.message || 'Gagal menyimpan'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleSaveStock(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-stock');
    if (btn) btn.disabled = true;

    try {
      const payload = {
        min_stock_alert: Number(document.getElementById('setting-stock-min-alert')?.value || 5),
        auto_po_enabled: Boolean(document.getElementById('setting-stock-auto-po')?.checked)
      };

      const res = await settingsApi.save('stock_config', payload);
      if (!res.ok) throw new Error(res.error?.message || 'Gagal menyimpan konfigurasi stok');

      currentSettings.stock_config = payload;
      if (typeof showToast === 'function') {
        showToast('Konfigurasi stok & notifikasi berhasil disimpan', 'success');
      } else {
        alert('Konfigurasi stok berhasil disimpan.');
      }
    } catch (err) {
      console.error('handleSaveStock error:', err);
      alert('Error: ' + (err.message || 'Gagal menyimpan'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleSaveAppearance(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-appearance');
    if (btn) btn.disabled = true;

    try {
      const payload = {
        theme: document.getElementById('setting-theme')?.value || 'dark',
        primary_color: document.getElementById('setting-primary-color')?.value || '#0088CC',
        compact_mode: Boolean(document.getElementById('setting-compact-mode')?.checked)
      };

      const res = await settingsApi.save('appearance', payload);
      if (!res.ok) throw new Error(res.error?.message || 'Gagal menyimpan preferensi tampilan');

      currentSettings.appearance = payload;
      if (typeof showToast === 'function') {
        showToast('Preferensi tema & tampilan berhasil diperbarui', 'success');
      } else {
        alert('Preferensi tampilan berhasil disimpan.');
      }
    } catch (err) {
      console.error('handleSaveAppearance error:', err);
      alert('Error: ' + (err.message || 'Gagal menyimpan'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleSaveAccount(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-account');
    if (btn) btn.disabled = true;

    try {
      const newName = document.getElementById('setting-account-name')?.value.trim();
      if (!newName) throw new Error('Nama lengkap tidak boleh kosong');

      const res = await settingsApi.updateProfile(newName);
      if (!res.ok) throw new Error(res.error?.message || 'Gagal memperbarui profil pengguna');

      if (currentUserProfile) currentUserProfile.full_name = newName;

      // Update header welcome name if present
      const welcomeEl = document.getElementById('welcome-name');
      if (welcomeEl) welcomeEl.textContent = newName;

      if (typeof showToast === 'function') {
        showToast('Profil akun berhasil diperbarui', 'success');
      } else {
        alert('Profil akun berhasil diperbarui.');
      }
    } catch (err) {
      console.error('handleSaveAccount error:', err);
      alert('Error: ' + (err.message || 'Gagal memperbarui profil'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    applyReadOnlyUI();

    // Tab buttons event listeners
    const tabButtons = document.querySelectorAll('.settings-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) switchTab(tab);
      });
    });

    // Forms event listeners
    const formStore = document.getElementById('form-setting-store');
    if (formStore) formStore.addEventListener('submit', handleSaveStore);

    const formPOS = document.getElementById('form-setting-pos');
    if (formPOS) formPOS.addEventListener('submit', handleSavePOS);

    const formStock = document.getElementById('form-setting-stock');
    if (formStock) formStock.addEventListener('submit', handleSaveStock);

    const formAppearance = document.getElementById('form-setting-appearance');
    if (formAppearance) formAppearance.addEventListener('submit', handleSaveAppearance);

    const formAccount = document.getElementById('form-setting-account');
    if (formAccount) formAccount.addEventListener('submit', handleSaveAccount);

    const formCategory = document.getElementById('form-add-category');
    if (formCategory) {
      formCategory.addEventListener('submit', event => handleAddCatalogEntry(event, {
        table: 'categories',
        inputId: 'setting-category-name',
        buttonId: 'btn-add-category',
        label: 'Kategori'
      }));
    }

    const formUnit = document.getElementById('form-add-unit');
    if (formUnit) {
      formUnit.addEventListener('submit', event => handleAddCatalogEntry(event, {
        table: 'units',
        inputId: 'setting-unit-name',
        buttonId: 'btn-add-unit',
        label: 'Satuan'
      }));
    }

    // Initial load
    await loadSettings();
    try {
      await loadCatalogLists();
    } catch (error) {
      console.error('Gagal memuat kategori dan satuan:', error);
      if (typeof showToast === 'function') {
        showToast('Kategori atau satuan gagal dimuat. Pastikan migrasi master satuan sudah diterapkan.', 'error');
      }
      renderCatalogList('setting-category-list', [], 'Kategori gagal dimuat.');
      renderCatalogList('setting-unit-list', [], 'Satuan gagal dimuat.');
    }
  });
})();
