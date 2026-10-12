/* ═══════════════════════════════════════════════════
   aQuaStock Pro — app.js
   Inisialisasi aplikasi, konversi tabel→card, bulk selection, shortcut
   ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════ */
if (typeof refreshIcons === 'function') {
  refreshIcons();
} else if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
  lucide.createIcons();
}

/* ═══════════════════════════════════════════════
   CUSTOM EVENT LISTENERS (Web Components)
   ═══════════════════════════════════════════════ */
document.addEventListener('app-sidebar:navigate', function(e) {
  if (e.detail && e.detail.pageId && typeof showPage === 'function') {
    showPage(e.detail.pageId);
  }
});

/* ═══════════════════════════════════════════════
   AUTO-CONVERT TABLE → CARD (data-label)
   ═══════════════════════════════════════════════ */
const MOBILE_BREAKPOINT = 1024;

/**
 * Sync data-label ke semua <td> dalam tabel .card
 * Berdasarkan header <thead> yang ada di table tersebut.
 * Panggil fungsi ini SETIAP KALI render rows baru (dynamic dari Supabase).
 */
function syncTableLabels() {
  document.querySelectorAll('.card table').forEach(function(table) {
    const headers = [];
    table.querySelectorAll('thead th').forEach(function(th) {
      headers.push(th.textContent.trim().toUpperCase());
    });

    table.querySelectorAll('tbody tr').forEach(function(row) {
      row.querySelectorAll('td').forEach(function(td, index) {
        const label = headers[index] || '';
        if (label) {
          td.setAttribute('data-label', label);
        } else {
          td.removeAttribute('data-label');
        }
      });
    });
  });
}

// Expose ke global supaya bisa dipanggil dari script lain
window.syncTableLabels = syncTableLabels;

document.addEventListener('DOMContentLoaded', function() {
  syncTableLabels();

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
  // ESC tutup sidebar & notif dropdown
  if (e.key === 'Escape') {
    closeSidebar();
    const panel = document.getElementById('notif-dropdown-panel');
    if (panel) panel.remove();
  }
});

/* ═══════════════════════════════════════════════
   NOTIFICATION DROPDOWN PANEL
   ═══════════════════════════════════════════════ */
function initNotificationDropdown() {
  document.addEventListener('click', function(e) {
    const notifBtn = e.target.closest && e.target.closest('[data-action="notif"]');
    const existingDropdown = document.getElementById('notif-dropdown-panel');

    if (notifBtn) {
      e.preventDefault();
      e.stopPropagation();

      if (existingDropdown) {
        existingDropdown.remove();
        return;
      }

      const rect = notifBtn.getBoundingClientRect();
      const panel = document.createElement('div');
      panel.id = 'notif-dropdown-panel';
      panel.className = 'fixed z-50 bg-[#1C1C1E] border border-white/10 rounded-2xl shadow-2xl p-4 w-80 max-w-[calc(100vw-32px)] backdrop-blur-xl';
      
      const rightOffset = Math.max(16, window.innerWidth - rect.right);
      panel.style.top = `${rect.bottom + 8}px`;
      panel.style.right = `${rightOffset}px`;

      panel.innerHTML = `
        <div class="flex items-center justify-between pb-3 border-b border-white/5">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-bold text-white">Notifikasi</h4>
            <span class="text-[10px] font-semibold bg-[#0088CC]/20 text-[#32ADE6] px-2 py-0.5 rounded-full">0 Baru</span>
          </div>
          <button type="button" id="btn-close-notif-panel" aria-label="Tutup notifikasi" class="p-1 hover:bg-white/5 rounded-lg text-[#A0A0A5] hover:text-white transition">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="py-7 text-center space-y-2">
          <div class="w-11 h-11 rounded-full bg-white/5 grid place-items-center mx-auto text-[#A0A0A5]">
            <i data-lucide="bell" class="w-5 h-5 opacity-60"></i>
          </div>
          <p class="text-sm font-semibold text-white">Belum ada notifikasi</p>
          <p class="text-xs text-[#A0A0A5] max-w-[220px] mx-auto leading-relaxed">
            Notifikasi penting seputar transaksi, stok kritis, dan aktivitas akun akan muncul di sini.
          </p>
        </div>
        <div class="pt-3 border-t border-white/5 text-center">
          <a href="/dashboard/notif/" class="text-xs font-semibold text-[#32ADE6] hover:underline inline-flex items-center gap-1">
            Lihat Semua Notifikasi <i data-lucide="arrow-right" class="w-3 h-3"></i>
          </a>
        </div>
      `;

      document.body.appendChild(panel);
      if (typeof window.refreshIcons === 'function') window.refreshIcons(panel);

      const closeBtn = panel.querySelector('#btn-close-notif-panel');
      if (closeBtn) {
        closeBtn.onclick = () => panel.remove();
      }
      return;
    }

    if (existingDropdown && !existingDropdown.contains(e.target)) {
      existingDropdown.remove();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotificationDropdown);
} else {
  initNotificationDropdown();
}

/* Card hover lift */
document.querySelectorAll('.card').forEach(card => card.classList.add('card-hover'));

/* Initial animation */
setTimeout(animateActivePage, 100);

/* Welcome toast — hanya 1x per session (pindah halaman tidak mengulang) */
if (!sessionStorage.getItem('welcomeShown')) {
  sessionStorage.setItem('welcomeShown', 'true');
  setTimeout(() => showToast('Selamat datang di aQuaStock Pro 3.0', 'success'), 500);
}

console.log('%c✨ aQuaStock Pro v3.0 — Fully Responsive', 'color: #32ADE6; font-weight: bold; font-size: 14px;');
