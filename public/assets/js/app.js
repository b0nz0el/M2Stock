/* ═══════════════════════════════════════════════════
   aQuaStock Pro — app.js
   Inisialisasi aplikasi, konversi tabel→card, bulk selection, shortcut
   ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════ */
lucide.createIcons();

/* ═══════════════════════════════════════════════
   AUTO-CONVERT TABLE → CARD (data-label)
   ═══════════════════════════════════════════════ */
const MOBILE_BREAKPOINT = 1024;

document.addEventListener('DOMContentLoaded', function() {
  // Field yang disembunyikan di mobile (tersier)
  const HIDDEN_FIELDS = ['NO. TRANSAKSI', 'NO. RESI', 'NO. PO', 'NO. RETUR'];

  document.querySelectorAll('.card table').forEach(function(table) {
    const headers = [];
    table.querySelectorAll('thead th').forEach(function(th) {
      headers.push(th.textContent.trim().toUpperCase());
    });
    table.querySelectorAll('tbody tr').forEach(function(row) {
      row.querySelectorAll('td').forEach(function(td, index) {
        const label = headers[index] || '';
        if (label) td.setAttribute('data-label', label);
      });
    });
  });

  // Pilih semua checkbox
  const selectAll = document.getElementById('select-all-items');
  if (selectAll) {
    selectAll.addEventListener('change', function(e) {
      document.querySelectorAll('.card table tbody input[type="checkbox"]').forEach(c => {
        c.checked = e.target.checked;
      });
      updateBulkBar();
    });
  }
});

/* ═══════════════════════════════════════════════
   BULK SELECTION
   ═══════════════════════════════════════════════ */
function updateBulkBar() {
  const checked = document.querySelectorAll('.card table tbody input[type="checkbox"]:checked');
  const bar = document.getElementById('bulk-bar');
  const count = document.getElementById('bulk-count');
  if (!bar) return;

  if (checked.length > 0) {
    bar.classList.remove('hidden');
    bar.classList.add('flex');
    count.textContent = checked.length + ' dipilih';
  } else {
    bar.classList.add('hidden');
    bar.classList.remove('flex');
  }
}

function clearSelection() {
  document.querySelectorAll('.card table tbody input[type="checkbox"]').forEach(c => c.checked = false);
  const selectAll = document.getElementById('select-all-items');
  if (selectAll) selectAll.checked = false;
  updateBulkBar();
}

document.addEventListener('change', function(e) {
  if (e.target.matches('.card table tbody input[type="checkbox"]')) {
    updateBulkBar();
  }
});

/* ═══════════════════════════════════════════════
   KEYBOARD SHORTCUT CMD+K
   ═══════════════════════════════════════════════ */
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
      showToast('Pencarian aktif — ketik untuk mencari', 'info');
    }
  }
  // ESC tutup sidebar
  if (e.key === 'Escape') closeSidebar();
});

/* Card hover lift */
document.querySelectorAll('.card').forEach(card => card.classList.add('card-hover'));

/* Initial animation */
setTimeout(animateActivePage, 300);

/* Welcome toast — hanya 1x per session (pindah halaman tidak mengulang) */
if (!sessionStorage.getItem('welcomeShown')) {
  sessionStorage.setItem('welcomeShown', 'true');
  setTimeout(() => showToast('Selamat datang di aQuaStock Pro 3.0', 'success'), 500);
}

console.log('%c✨ aQuaStock Pro v3.0 — Fully Responsive', 'color: #32ADE6; font-weight: bold; font-size: 14px;');
