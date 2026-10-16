/* ═══════════════════════════════════════════════════
   aQuaStock Pro — command-palette.js
   Linear/MD3 Standard Global Command Palette (⌘K / Ctrl+K)
   Navigasi instan, aksi cepat kasir & pencarian produk/barcode
   ═══════════════════════════════════════════════════ */

(function initCommandPalette() {
  if (typeof window === 'undefined') return;

  const COMMANDS = [
    { id: 'pos', title: 'Buka Kasir POS (Multi-Item)', category: 'Aksi Cepat', icon: 'shopping-bag', action: () => navigateTo('/dashboard/out/') },
    { id: 'add-item', title: 'Tambah Barang Baru', category: 'Aksi Cepat', icon: 'package-plus', action: () => navigateTo('/dashboard/items/') },
    { id: 'in-stock', title: 'Catat Barang Masuk (Restock)', category: 'Aksi Cepat', icon: 'arrow-down-circle', action: () => navigateTo('/dashboard/in/') },
    { id: 'create-po', title: 'Buat Purchase Order (PO)', category: 'Aksi Cepat', icon: 'clipboard-list', action: () => navigateTo('/dashboard/po/') },
    { id: 'cash-entry', title: 'Catat Arus Kas Baru', category: 'Aksi Cepat', icon: 'banknote', action: () => navigateTo('/dashboard/cash/') },
    
    // Navigasi Modul
    { id: 'nav-dashboard', title: 'Dashboard Utama', category: 'Navigasi', icon: 'layout-dashboard', action: () => navigateTo('/dashboard/') },
    { id: 'nav-items', title: 'Master Barang & Stok', category: 'Navigasi', icon: 'package', action: () => navigateTo('/dashboard/items/') },
    { id: 'nav-in', title: 'Riwayat Barang Masuk', category: 'Navigasi', icon: 'arrow-down-circle', action: () => navigateTo('/dashboard/in/') },
    { id: 'nav-out', title: 'Barang Keluar / POS', category: 'Navigasi', icon: 'arrow-up-circle', action: () => navigateTo('/dashboard/out/') },
    { id: 'nav-po', title: 'Purchase Order (PO)', category: 'Navigasi', icon: 'clipboard-list', action: () => navigateTo('/dashboard/po/') },
    { id: 'nav-return', title: 'Retur Pembelian & Penjualan', category: 'Navigasi', icon: 'undo-2', action: () => navigateTo('/dashboard/return/') },
    { id: 'nav-cash', title: 'Buku Kas & Keuangan', category: 'Navigasi', icon: 'wallet', action: () => navigateTo('/dashboard/cash/') },
    { id: 'nav-debt', title: 'Buku Hutang & Piutang', category: 'Navigasi', icon: 'scale', action: () => navigateTo('/dashboard/debt/') },
    { id: 'nav-report', title: 'Laporan & Valuasi Aset', category: 'Navigasi', icon: 'line-chart', action: () => navigateTo('/dashboard/report/') },
    { id: 'nav-customers', title: 'Daftar Pelanggan', category: 'Navigasi', icon: 'users', action: () => navigateTo('/dashboard/customers/') },
    { id: 'nav-suppliers', title: 'Daftar Pemasok / Supplier', category: 'Navigasi', icon: 'truck', action: () => navigateTo('/dashboard/suppliers/') },
    { id: 'nav-settings', title: 'Pengaturan Toko & Profil', category: 'Navigasi', icon: 'settings', action: () => navigateTo('/dashboard/settings/') },
    { id: 'nav-audit', title: 'Jejak Audit Log', category: 'Navigasi', icon: 'shield-check', action: () => navigateTo('/dashboard/audit/') },
    { id: 'nav-backup', title: 'Backup & Restore Database', category: 'Navigasi', icon: 'database-backup', action: () => navigateTo('/dashboard/backup/') }
  ];

  let modalEl = null;
  let inputEl = null;
  let resultsContainer = null;
  let selectedIndex = 0;
  let currentItemsList = [];
  let searchTimeout = null;

  function navigateTo(url) {
    closeCommandPalette();
    window.location.href = url;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.id = 'command-palette-modal';
    modalEl.className = 'fixed inset-0 z-50 bg-black/80 backdrop-blur-md hidden flex items-start justify-center pt-16 sm:pt-24 px-4 transition-all duration-200';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-label', 'Command Palette');

    modalEl.innerHTML = `
      <div class="bg-[#1C1C1E] border border-white/10 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in fade-in zoom-in-95 duration-150">
        <!-- Search Header -->
        <div class="p-3.5 border-b border-white/10 flex items-center gap-3">
          <i data-lucide="search" class="w-5 h-5 text-[#0088CC] flex-shrink-0" aria-hidden="true"></i>
          <input type="text" id="command-palette-input" autocomplete="off" spellcheck="false"
                 placeholder="Ketik perintah, nama produk, barcode, atau halaman..."
                 class="w-full bg-transparent text-sm sm:text-base text-white placeholder-white/40 focus:outline-none">
          <kbd class="hidden sm:inline-block text-[10px] text-[#A0A0A5] bg-white/5 px-2 py-0.5 rounded border border-white/10 font-mono">ESC</kbd>
        </div>

        <!-- Results List -->
        <div id="command-palette-results" class="overflow-y-auto flex-1 p-2 space-y-1 divide-y divide-white/[0.03]">
          <!-- Dinamis -->
        </div>

        <!-- Footer -->
        <div class="px-4 py-2 bg-white/[0.02] border-t border-white/5 flex items-center justify-between text-[11px] text-[#A0A0A5]">
          <span class="flex items-center gap-2">
            <span>Gunakan <kbd class="px-1 py-0.5 bg-white/5 rounded border border-white/10 text-[9px]">↑</kbd> <kbd class="px-1 py-0.5 bg-white/5 rounded border border-white/10 text-[9px]">↓</kbd> untuk memilih</span>
            <span>·</span>
            <span><kbd class="px-1 py-0.5 bg-white/5 rounded border border-white/10 text-[9px]">↵</kbd> untuk buka</span>
          </span>
          <span class="text-[#0088CC] font-semibold">aQuaStock Pro</span>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);
    inputEl = modalEl.querySelector('#command-palette-input');
    resultsContainer = modalEl.querySelector('#command-palette-results');

    // Click backdrop to close
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeCommandPalette();
    });

    // Input listener
    inputEl.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => filterPalette(q), 100);
    });

    // Keydown navigation
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(selectedIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(selectedIndex - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        executeSelected();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCommandPalette();
      }
    });

    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons(modalEl);
    }

    return modalEl;
  }

  async function filterPalette(query) {
    selectedIndex = 0;
    currentItemsList = [];

    if (!query) {
      currentItemsList = COMMANDS.map(c => ({ ...c, type: 'command' }));
      renderResults();
      return;
    }

    const q = query.toLowerCase();
    const matchedCommands = COMMANDS.filter(c => 
      c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    ).map(c => ({ ...c, type: 'command' }));

    // Cek pencarian produk dari Supabase atau cache jika ada
    let matchedProducts = [];
    if (q.length >= 2) {
      try {
        if (typeof window.Api !== 'undefined' && window.Api.items) {
          const res = await window.Api.items.getAll({ search: q });
          if (res.ok && Array.isArray(res.data)) {
            matchedProducts = res.data.slice(0, 6).map(item => ({
              id: 'prod-' + item.id,
              type: 'product',
              title: item.name,
              sku: item.sku || '-',
              barcode: item.barcode || '-',
              stock: item.stock || 0,
              price: item.sell_price || item.sellPrice || 0,
              category: 'Produk Master',
              icon: 'package',
              action: () => navigateTo('/dashboard/items/')
            }));
          }
        }
      } catch (_) {}
    }

    currentItemsList = [...matchedProducts, ...matchedCommands];
    renderResults();
  }

  function renderResults() {
    if (!resultsContainer) return;

    if (currentItemsList.length === 0) {
      resultsContainer.innerHTML = `
        <div class="py-10 text-center text-[#A0A0A5]">
          <i data-lucide="search-x" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
          <p class="text-xs font-semibold text-white">Tidak ada hasil yang cocok</p>
          <p class="text-[11px] text-[#A0A0A5]/70 mt-0.5">Coba gunakan kata kunci nama barang, SKU, atau halaman lain</p>
        </div>
      `;
      if (typeof window.refreshIcons === 'function') window.refreshIcons(resultsContainer);
      return;
    }

    let html = '';
    currentItemsList.forEach((item, index) => {
      const isSelected = index === selectedIndex;
      const activeClass = isSelected ? 'bg-[#0088CC]/15 border-[#0088CC]/30 text-white' : 'hover:bg-white/5 border-transparent text-white/90';

      if (item.type === 'product') {
        const priceStr = 'Rp ' + Number(item.price).toLocaleString('id-ID');
        html += `
          <div data-palette-index="${index}" class="cursor-pointer p-2.5 rounded-xl border flex items-center justify-between transition ${activeClass}">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-8 h-8 rounded-lg bg-white/5 grid place-items-center flex-shrink-0 text-[#32ADE6]">
                <i data-lucide="${item.icon}" class="w-4 h-4" aria-hidden="true"></i>
              </div>
              <div class="min-w-0">
                <p class="text-xs sm:text-sm font-semibold truncate text-white">${escapeHtml(item.title)}</p>
                <p class="text-[10px] text-[#A0A0A5] truncate">SKU: ${escapeHtml(item.sku)} · Barcode: ${escapeHtml(item.barcode)}</p>
              </div>
            </div>
            <div class="text-right flex-shrink-0 pl-2">
              <span class="text-xs font-bold text-[#34C759] tabular-nums">${priceStr}</span>
              <p class="text-[10px] text-[#A0A0A5]">Stok: <strong class="text-white">${item.stock}</strong></p>
            </div>
          </div>
        `;
      } else {
        html += `
          <div data-palette-index="${index}" class="cursor-pointer p-2.5 rounded-xl border flex items-center justify-between transition ${activeClass}">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-white/5 grid place-items-center flex-shrink-0 text-[#A0A0A5]">
                <i data-lucide="${item.icon}" class="w-4 h-4" aria-hidden="true"></i>
              </div>
              <div>
                <p class="text-xs sm:text-sm font-medium text-white">${escapeHtml(item.title)}</p>
                <p class="text-[10px] text-[#A0A0A5]">${escapeHtml(item.category)}</p>
              </div>
            </div>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-white/30 flex-shrink-0" aria-hidden="true"></i>
          </div>
        `;
      }
    });

    resultsContainer.innerHTML = html;

    // Attach click events
    resultsContainer.querySelectorAll('[data-palette-index]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-palette-index'), 10);
        if (currentItemsList[idx] && typeof currentItemsList[idx].action === 'function') {
          currentItemsList[idx].action();
        }
      });
    });

    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons(resultsContainer);
    }
  }

  function setSelectedIndex(newIndex) {
    if (currentItemsList.length === 0) return;
    if (newIndex < 0) newIndex = currentItemsList.length - 1;
    if (newIndex >= currentItemsList.length) newIndex = 0;
    selectedIndex = newIndex;

    const items = resultsContainer.querySelectorAll('[data-palette-index]');
    items.forEach((el, idx) => {
      const isSelected = idx === selectedIndex;
      if (isSelected) {
        el.classList.add('bg-[#0088CC]/15', 'border-[#0088CC]/30');
        el.classList.remove('hover:bg-white/5', 'border-transparent');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('bg-[#0088CC]/15', 'border-[#0088CC]/30');
        el.classList.add('border-transparent');
      }
    });
  }

  function executeSelected() {
    if (currentItemsList[selectedIndex] && typeof currentItemsList[selectedIndex].action === 'function') {
      currentItemsList[selectedIndex].action();
    }
  }

  function openCommandPalette() {
    ensureModal();
    modalEl.classList.remove('hidden');
    inputEl.value = '';
    filterPalette('');
    setTimeout(() => inputEl.focus(), 50);
  }

  function closeCommandPalette() {
    if (modalEl) {
      modalEl.classList.add('hidden');
    }
  }

  // Keyboard shortcut listener global
  window.addEventListener('keydown', (e) => {
    // ⌘K (Mac) or Ctrl+K (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (modalEl && !modalEl.classList.contains('hidden')) {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
    }
  });

  // Hubungkan ke input header global-search
  document.addEventListener('click', (e) => {
    const searchTrigger = e.target.closest('#global-search');
    if (searchTrigger) {
      e.preventDefault();
      searchTrigger.blur();
      openCommandPalette();
    }
  });

  // Ekspor API
  window.openCommandPalette = openCommandPalette;
  window.closeCommandPalette = closeCommandPalette;
})();

