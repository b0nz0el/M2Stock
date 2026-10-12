/* ═══════════════════════════════════════════════════
   aQuaStock Pro — mock-actions.js
   Memberi "mock feedback" (toast) untuk tombol yang belum
   punya handler/backend. Aktif via:
     - attribute  data-action="..."   (mis. edit, delete, add-item)
     - class      .btn-mock
   Semua aksi hanya menampilkan toast — tidak mengubah data.
   ═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Label ramah untuk aksi generik (dipakai pesan fallback) */
  var LABELS = {
    'notif': 'Notifikasi',
    'mobile-preview': 'Preview mobile',
    'refresh': 'Refresh',
    'print': 'Cetak',
    'filter': 'Filter',
    'detail': 'Detail',
    'mark-read': 'Tandai dibaca',
    'history': 'Riwayat',
    'bulk-input': 'Bulk Input',
    'restock': 'Restock',
    'report-type': 'Jenis laporan',
    'role-co-owner': 'Role Co-Owner',
    'role-staff': 'Role Staff',
    'role-viewer': 'Role Viewer',
    'edit-profile': 'Edit profil',
    'change-password': 'Ganti password',
    'suspend': 'Suspend',
    'logout-all': 'Logout dari semua device',
    'page': 'Navigasi halaman',
    'page-prev': 'Halaman sebelumnya',
    'page-next': 'Halaman berikutnya',
    'toggle-session': 'Session timeout'
  };

  function titleCase(s) {
    return s.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function labelFor(action) {
    return LABELS[action] || titleCase(action);
  }

  function give(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type || 'info');
  }

  var SUFFIX = ' akan hadir setelah backend';

  /* Toggle visual untuk switch (knob kiri/kanan + warna track) */
  function toggleSwitch(el, action) {
    var knob = el.querySelector('span');
    var wasOn = !!(knob && knob.classList.contains('right-0.5'));

    if (knob) {
      if (wasOn) {
        knob.classList.remove('right-0.5');
        knob.classList.add('left-0.5');
      } else {
        knob.classList.remove('left-0.5');
        knob.classList.add('right-0.5');
      }
    }

    // Warna track: hijau saat ON, putih transparan saat OFF
    if (wasOn) {
      el.classList.remove('bg-[#34C759]');
      el.classList.add('bg-white/10');
    } else {
      el.classList.remove('bg-white/10');
      el.classList.add('bg-[#34C759]');
    }

    if (action === 'toggle-2fa') {
      give(wasOn ? '2FA dinonaktifkan (mock)' : '2FA diaktifkan (mock)', 'success');
    } else {
      give('Pengaturan diubah (mock)', 'success');
    }
  }

  /* Whitelist aksi yang sudah di-handle oleh komponen Web/UI (jangan beri mock toast) */
  var SKIP_ACTIONS = [
    'close-sidebar', 'toggle-sidebar', 'open-menu', 'close-menu',
    'notif',
    'add-supplier', 'add-customer', 'add-item', 'add-in', 'add-out',
    'refresh', 'refresh-items', 'refresh-in', 'refresh-out', 'refresh-suppliers', 'refresh-customers',
    'export', 'export-items', 'export-pdf', 'export-csv',
    'print', 'edit-bulk', 'delete-bulk', 'page', 'page-prev', 'page-next', 'bulk-input'
  ];

  function handle(action, el) {
    if (!action || SKIP_ACTIONS.indexOf(action) !== -1) return;

    if (
      action === 'notif' ||
      action === 'refresh' || action === 'refresh-items' || action === 'refresh-in' ||
      action === 'refresh-out' || action === 'refresh-suppliers' || action === 'refresh-customers'
    ) {
      return;
    }

    // Aksi CRUD live pada suppliers, customers, users, items, in, out ditangani langsung oleh backend CRUD
    if (
      action === 'add-supplier' || action === 'add-customer' ||
      action === 'add-item' || action === 'add-in' || action === 'add-out'
    ) {
      return;
    }

    if (action === 'add' && (
      document.getElementById('page-suppliers') ||
      document.getElementById('page-customers') ||
      document.getElementById('page-users') ||
      document.getElementById('page-items') ||
      document.getElementById('page-in') ||
      document.getElementById('page-out')
    )) {
      return;
    }

    if (el && el.closest && (
      el.closest('#page-suppliers, #page-customers, #page-users, #page-items, #page-in, #page-out') ||
      el.closest('[role="dialog"], [id^="modal-"], .modal')
    )) {
      return;
    }

    if (action === 'add' || action.indexOf('add-') === 0) {
      give('Fitur Tambah akan hadir setelah backend'); return;
    }
    if (action.indexOf('edit') === 0) {
      give('Fitur Edit akan hadir setelah backend'); return;
    }
    if (action.indexOf('delete') === 0) {
      give('Fitur Hapus akan hadir setelah backend'); return;
    }
    if (action === 'import') {
      give('Import file akan hadir setelah backend'); return;
    }
    if (action.indexOf('export') === 0) {
      give('Export akan hadir setelah backend'); return;
    }
    if (action === 'backup-now') {
      give('Backup sedang berjalan...');
      window.setTimeout(function () { give('Backup selesai! (mock)', 'success'); }, 2000);
      return;
    }
    if (action === 'restore') {
      give('Restore akan hadir setelah backend'); return;
    }
    if (action.indexOf('toggle-') === 0) {
      toggleSwitch(el, action); return;
    }
    if (action === 'save-settings') {
      give('Pengaturan disimpan (mock)', 'success'); return;
    }

    give(labelFor(action) + SUFFIX);
  }

  document.addEventListener('click', function (e) {
    // 1. Lewati menu item navigasi dengan data-page
    if (e.target && e.target.closest && e.target.closest('.menu-item[data-page]')) {
      return;
    }

    // 2. Whitelist semua tombol di halaman Master Data & live CRUD (#page-suppliers, #page-customers, #page-users, dll)
    if (e.target && e.target.closest && e.target.closest(
      '#page-suppliers, #page-customers, #page-users, #page-items, #page-in, #page-out'
    )) {
      return;
    }

    // 3. Whitelist semua tombol di dalam modal apapun (save, cancel, hapus, close)
    if (e.target && e.target.closest && e.target.closest(
      '[role="dialog"], [id^="modal-"], .modal'
    )) {
      return;
    }

    // 4. Whitelist semua tombol refresh & notifikasi (baik di header navbar maupun di dalam halaman)
    if (e.target && e.target.closest && e.target.closest(
      '[id^="btn-refresh"], [data-action^="refresh"], button[title*="Refresh"], button[aria-label*="Refresh"], button[title*="Muat ulang"], [data-action="notif"]'
    )) {
      return;
    }

    var el = e.target && e.target.closest
      ? e.target.closest('[data-action], .btn-mock')
      : null;
    if (!el) return;

    var action = el.getAttribute('data-action') || '';
    if (SKIP_ACTIONS.indexOf(action) !== -1) {
      return;
    }

    // 4. Tombol Tambah di header halaman live CRUD
    if (
      action === 'add-supplier' || action === 'add-customer' ||
      action === 'add-item' || action === 'add-in' || action === 'add-out'
    ) {
      return;
    }

    if (action === 'add' && (
      document.getElementById('page-suppliers') ||
      document.getElementById('page-customers') ||
      document.getElementById('page-users') ||
      document.getElementById('page-items') ||
      document.getElementById('page-in') ||
      document.getElementById('page-out')
    )) {
      return;
    }

    if (!action) {
      var text = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ');
      give((text ? text + ' ' : 'Fitur ini ') + 'akan hadir setelah backend');
      return;
    }
    handle(action, el);
  });

  // Ekspos untuk keperluan test/manual: window.MockActions.handle('edit')
  window.MockActions = { handle: handle };
})();
