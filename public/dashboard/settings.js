/* ═══════════════════════════════════════════════════
   Aquastock Pro — settings.js
   Controller Modul Pengaturan (/dashboard/settings/)
   Pengaturan dari Supabase app_settings & profiles
   ═══════════════════════════════════════════════════ */

import { settings as settingsApi } from '../assets/js/api/settings.js';
import { initBarcodeSettings } from './settings-barcode.js';
import { supabase } from '../assets/js/supabase-client.js';
import { applyReadOnlyUI } from '../assets/js/utils/rbac-ui.js';

(function () {
  'use strict';

  let currentSettings = {
    store_info: {
      name: 'JTMaquarium',
      slogan: 'Perlengkapan Aksesoris Aquarium',
      email: 'jtmaquarium@gmail.com',
      phone: '0812-9662-8052',
      address: 'Jl. Mangga No. 67, Jatimakmur, Pondok Gede, Kota Bekasi'
    },
    pos_config: {
      tax_rate: 11,
      service_rate: 0,
      default_payment: 'Cash',
      receipt_footer: 'Terima kasih telah berbelanja di JTMaquarium!'
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
  let catalogChannels = [];

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
      row.dataset.catalogId = String(entry.id);

      const name = document.createElement('span');
      name.className = 'font-medium text-white';
      name.textContent = entry.name;

      const actions = document.createElement('div');
      actions.className = 'flex shrink-0 items-center gap-2';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.dataset.catalogAction = 'edit';
      editButton.dataset.action = 'edit';
      editButton.className = 'rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#32ADE6] hover:bg-white/5';
      editButton.textContent = 'Edit';
      editButton.setAttribute('aria-label', `Edit ${entry.name}`);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.dataset.catalogAction = 'delete';
      deleteButton.dataset.action = 'delete';
      deleteButton.className = 'rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#FF6961] hover:bg-[#FF3B30]/10';
      deleteButton.textContent = 'Hapus';
      deleteButton.setAttribute('aria-label', `Hapus ${entry.name}`);

      const isProtectedUnit = elementId === 'setting-unit-list' && entry.name.trim().toLowerCase() === 'pcs';
      const isProtectedChannel = elementId === 'setting-channel-list' && entry.name.trim().toLowerCase() === 'offline';

      if (isProtectedUnit || isProtectedChannel) {
        const itemType = isProtectedUnit ? 'Satuan' : 'Channel';
        editButton.disabled = true;
        editButton.title = `${itemType} default tidak dapat diubah namanya.`;
        editButton.classList.add('cursor-not-allowed', 'opacity-40');
        deleteButton.disabled = true;
        deleteButton.title = `${itemType} default tidak dapat dihapus.`;
        deleteButton.classList.add('cursor-not-allowed', 'opacity-40');
      }

      actions.append(editButton, deleteButton);
      row.append(name, actions);
      list.appendChild(row);
    });
  }

  async function loadCatalogLists() {
    const [categoryResult, unitResult, channelList] = await Promise.all([
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('units').select('id, name').order('name'),
      settingsApi.getChannels ? settingsApi.getChannels() : Promise.resolve([])
    ]);
    if (categoryResult.error) throw categoryResult.error;
    if (unitResult.error) throw unitResult.error;

    catalogCategories = categoryResult.data || [];
    catalogUnits = unitResult.data || [];
    catalogChannels = channelList || [];
    renderCatalogList('setting-category-list', catalogCategories, 'Belum ada kategori.');
    renderCatalogList('setting-unit-list', catalogUnits, 'Belum ada satuan.');
    renderCatalogList('setting-channel-list', catalogChannels, 'Belum ada saluran penjualan.');
  }

  function getCatalogEntries(table) {
    if (table === 'categories') return catalogCategories;
    if (table === 'units') return catalogUnits;
    if (table === 'channels') return catalogChannels;
    return [];
  }

  function renderCatalogEntryEdit(row, entry, table, label) {
    row.replaceChildren();
    row.className = 'flex items-center gap-2 py-2';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = entry.name;
    input.maxLength = table === 'categories' ? 80 : 30;
    input.required = true;
    input.setAttribute('aria-label', `Nama ${label.toLowerCase()}`);
    input.className = 'min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-[#0088CC] focus:outline-none';

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'rounded-lg px-2.5 py-2 text-xs font-semibold text-[#34C759] hover:bg-white/5';
    saveButton.textContent = 'Simpan';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'rounded-lg px-2.5 py-2 text-xs font-medium text-[#A0A0A5] hover:bg-white/5';
    cancelButton.textContent = 'Batal';

    const cancel = () => renderCatalogList(
      table === 'categories' ? 'setting-category-list' : (table === 'units' ? 'setting-unit-list' : 'setting-channel-list'),
      getCatalogEntries(table),
      `Belum ada ${label.toLowerCase()}.`
    );
    const save = async () => {
      const name = input.value.trim();
      if (!name) {
        if (typeof showToast === 'function') showToast(`Nama ${label.toLowerCase()} wajib diisi.`, 'error');
        input.focus();
        return;
      }
      if (name.toLocaleLowerCase() !== entry.name.trim().toLocaleLowerCase()
        && getCatalogEntries(table).some(item =>
          String(item.id) !== String(entry.id)
          && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
        if (typeof showToast === 'function') showToast(`${label} "${name}" sudah terdaftar.`, 'error');
        input.focus();
        return;
      }

      saveButton.disabled = true;
      cancelButton.disabled = true;

      if (table === 'channels') {
        try {
          entry.name = name;
          await settingsApi.saveChannels(catalogChannels);
          await loadCatalogLists();
          if (typeof showToast === 'function') showToast(`${label} berhasil diperbarui.`, 'success');
        } catch (error) {
          console.error(`Gagal mengubah ${label.toLowerCase()}:`, error);
          if (typeof showToast === 'function') {
            showToast(error.message || `Gagal mengubah ${label.toLowerCase()}.`, 'error');
          }
          saveButton.disabled = false;
          cancelButton.disabled = false;
        }
        return;
      }

      try {
        const { error } = await supabase.from(table).update({ name }).eq('id', entry.id);
        if (error) {
          if (error.code === '23505') throw new Error(`${label} "${name}" sudah terdaftar.`);
          throw error;
        }
        await loadCatalogLists();
        if (typeof showToast === 'function') showToast(`${label} berhasil diperbarui.`, 'success');
      } catch (error) {
        console.error(`Gagal mengubah ${label.toLowerCase()}:`, error);
        if (typeof showToast === 'function') {
          showToast(error.message || `Gagal mengubah ${label.toLowerCase()}. Periksa hak akses Anda.`, 'error');
        }
        saveButton.disabled = false;
        cancelButton.disabled = false;
      }
    };

    saveButton.addEventListener('click', save);
    cancelButton.addEventListener('click', cancel);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        save();
      } else if (event.key === 'Escape') {
        cancel();
      }
    });
    row.append(input, saveButton, cancelButton);
    input.focus();
    input.select();
  }

  async function handleCatalogAction(event, table, label) {
    const button = event.target.closest('button[data-catalog-action]');
    if (!button) return;

    const entries = getCatalogEntries(table);
    const entry = entries.find(item => String(item.id) === button.closest('li')?.dataset.catalogId);
    if (!entry) return;

    if (table === 'channels') {
      if (button.dataset.catalogAction === 'edit') {
        if (entry.name.trim().toLowerCase() === 'offline') {
          if (typeof showToast === 'function') showToast('Channel default "Offline" tidak dapat diubah namanya.', 'error');
          return;
        }
        renderCatalogEntryEdit(button.closest('li'), entry, table, label);
        return;
      }

      if (entry.name.trim().toLowerCase() === 'offline') {
        if (typeof showToast === 'function') showToast('Channel default "Offline" tidak dapat dihapus.', 'error');
        return;
      }

      const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog({
            title: 'Hapus Saluran Penjualan',
            message: `Hapus saluran penjualan "${entry.name}"?`,
            confirmText: 'Hapus Saluran',
            type: 'danger'
          })
        : window.confirm(`Hapus saluran penjualan "${entry.name}"?`);
      if (!confirmed) return;
      button.disabled = true;
      try {
        catalogChannels = catalogChannels.filter(c => String(c.id) !== String(entry.id));
        await settingsApi.saveChannels(catalogChannels);
        await loadCatalogLists();
        if (typeof showToast === 'function') showToast(`${label} "${entry.name}" berhasil dihapus.`, 'success');
      } catch (error) {
        console.error('Gagal menghapus saluran penjualan:', error);
        if (typeof showToast === 'function') showToast('Gagal menghapus saluran penjualan.', 'error');
        button.disabled = false;
      }
      return;
    }

    if (button.dataset.catalogAction === 'edit') {
      if (table === 'units' && entry.name.trim().toLowerCase() === 'pcs') {
        if (typeof showToast === 'function') showToast('Satuan default "pcs" tidak dapat diubah namanya.', 'error');
        return;
      }
      renderCatalogEntryEdit(button.closest('li'), entry, table, label);
      return;
    }

    const isCat = table === 'categories';
    const deleteTitle = isCat ? 'Hapus Kategori' : 'Hapus Satuan Stok';
    const deleteMessage = isCat
      ? `Hapus kategori "${entry.name}"? Produk dalam kategori ini akan tetap ada, tetapi menjadi tanpa kategori.`
      : `Hapus satuan "${entry.name}"? Satuan yang masih dipakai produk tidak dapat dihapus.`;
    const confirmed = typeof window.showConfirmDialog === 'function'
      ? await window.showConfirmDialog({
          title: deleteTitle,
          message: deleteMessage,
          confirmText: isCat ? 'Hapus Kategori' : 'Hapus Satuan',
          type: 'danger'
        })
      : window.confirm(deleteMessage);
    if (!confirmed) return;

    button.disabled = true;
    try {
      const { error } = await supabase.from(table).delete().eq('id', entry.id);
      if (error) {
        if (error.code === '23503') {
          throw new Error(table === 'units'
            ? 'Satuan masih dipakai oleh produk. Ubah satuan produk terlebih dahulu.'
            : 'Kategori masih digunakan dan tidak dapat dihapus.');
        }
        throw error;
      }
      await loadCatalogLists();
      if (typeof showToast === 'function') showToast(`${label} "${entry.name}" berhasil dihapus.`, 'success');
    } catch (error) {
      console.error(`Gagal menghapus ${label.toLowerCase()}:`, error);
      if (typeof showToast === 'function') {
        showToast(error.message || `Gagal menghapus ${label.toLowerCase()}. Periksa hak akses Anda.`, 'error');
      }
      button.disabled = false;
    }
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

    const entries = getCatalogEntries(table);
    if (entries.some(entry => entry.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      if (typeof showToast === 'function') showToast(`${label} "${name}" sudah terdaftar.`, 'error');
      return;
    }

    if (table === 'channels') {
      if (button) button.disabled = true;
      try {
        catalogChannels.push({ id: Date.now(), name });
        await settingsApi.saveChannels(catalogChannels);
        if (input) input.value = '';
        await loadCatalogLists();
        if (typeof showToast === 'function') showToast(`${label} "${name}" berhasil ditambahkan.`, 'success');
      } catch (error) {
        console.error('Gagal menambahkan saluran penjualan:', error);
        if (typeof showToast === 'function') showToast('Gagal menambahkan saluran penjualan.', 'error');
      } finally {
        if (button) button.disabled = false;
      }
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
      if (currentSettings.appearance && typeof window.applyAppearance === 'function') {
        window.applyAppearance(currentSettings.appearance);
      }
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
    const shopLogo = document.getElementById('setting-shop-logo');
    const shopLogoPreview = document.getElementById('setting-shop-logo-preview');

    if (shopName) shopName.value = store.name || '';
    if (shopSlogan) shopSlogan.value = store.slogan || '';
    if (shopEmail) shopEmail.value = store.email || '';
    if (shopPhone) shopPhone.value = store.phone || '';
    if (shopAddress) shopAddress.value = store.address || '';
    const logoVal = store.logo_url || (String(store.name || '').toLowerCase().includes('habitic') ? '/assets/images/habitic-logo.png' : '/assets/images/habitic-logo.png');
    if (shopLogo) shopLogo.value = store.logo_url || '';
    if (shopLogoPreview) shopLogoPreview.src = logoVal;

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
        address: document.getElementById('setting-shop-address')?.value.trim() || '',
        logo_url: document.getElementById('setting-shop-logo')?.value.trim() || '/assets/images/habitic-logo.png'
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

      if (typeof window.applyAppearance === 'function') {
        window.applyAppearance(payload);
      }

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

  async function initSettings() {
    applyReadOnlyUI();

    // Tab buttons event listeners
    const tabButtons = document.querySelectorAll('.settings-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) switchTab(tab);
      });
    });

    // Live preview perubahan tema & kepadatan tabel
    const colorSelect = document.getElementById('setting-primary-color');
    const compactCheck = document.getElementById('setting-compact-mode');
    if (colorSelect) {
      colorSelect.addEventListener('change', () => {
        if (typeof window.applyAppearance === 'function') {
          window.applyAppearance({
            primary_color: colorSelect.value,
            compact_mode: compactCheck ? compactCheck.checked : false
          });
        }
      });
    }
    if (compactCheck) {
      compactCheck.addEventListener('change', () => {
        if (typeof window.applyAppearance === 'function') {
          window.applyAppearance({
            primary_color: colorSelect ? colorSelect.value : '#0088CC',
            compact_mode: compactCheck.checked
          });
        }
      });
    }

    // Forms event listeners
    const formStore = document.getElementById('form-setting-store');
    if (formStore) formStore.addEventListener('submit', handleSaveStore);

    const shopLogoInput = document.getElementById('setting-shop-logo');
    const shopLogoPreview = document.getElementById('setting-shop-logo-preview');
    const btnUseHabiticLogo = document.getElementById('btn-use-habitic-logo');

    if (shopLogoInput && shopLogoPreview) {
      shopLogoInput.addEventListener('input', () => {
        const val = shopLogoInput.value.trim();
        shopLogoPreview.src = val || '/assets/images/habitic-logo.png';
      });
      shopLogoPreview.addEventListener('error', () => {
        shopLogoPreview.src = '/assets/images/habitic-logo.png';
      });
    }

    if (btnUseHabiticLogo && shopLogoInput && shopLogoPreview) {
      btnUseHabiticLogo.addEventListener('click', () => {
        shopLogoInput.value = '/assets/images/habitic-logo.png';
        shopLogoPreview.src = '/assets/images/habitic-logo.png';
        if (typeof showToast === 'function') {
          showToast('Logo Habitic dipilih', 'info');
        }
      });
    }

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

    const formChannel = document.getElementById('form-add-channel');
    if (formChannel) {
      formChannel.addEventListener('submit', event => handleAddCatalogEntry(event, {
        table: 'channels',
        inputId: 'setting-channel-name',
        buttonId: 'btn-add-channel',
        label: 'Saluran Penjualan'
      }));
    }

    document.getElementById('setting-category-list')?.addEventListener('click', event => {
      handleCatalogAction(event, 'categories', 'Kategori');
    });
    document.getElementById('setting-unit-list')?.addEventListener('click', event => {
      handleCatalogAction(event, 'units', 'Satuan');
    });
    document.getElementById('setting-channel-list')?.addEventListener('click', event => {
      handleCatalogAction(event, 'channels', 'Saluran Penjualan');
    });

    // Initial load
    await loadSettings();
    try {
      await loadCatalogLists();
    } catch (error) {
      console.error('Gagal memuat kategori, satuan, dan saluran:', error);
      if (typeof showToast === 'function') {
        showToast('Katalog master gagal dimuat.', 'error');
      }
      renderCatalogList('setting-category-list', [], 'Kategori gagal dimuat.');
      renderCatalogList('setting-unit-list', [], 'Satuan gagal dimuat.');
      renderCatalogList('setting-channel-list', [], 'Saluran penjualan gagal dimuat.');
    }
    initBarcodeSettings();
  }

  if (typeof window !== 'undefined') {
    window.initSettings = initSettings;
    window.loadSettings = loadSettings;
  }

  document.addEventListener('DOMContentLoaded', initSettings);
})();
