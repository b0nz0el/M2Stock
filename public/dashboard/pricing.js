/* ═══════════════════════════════════════════════════
   Aquastock Pro — dashboard/pricing.js
   Modul Simulasi & Strategi Harga Marketplace
   ═══════════════════════════════════════════════════ */

import { Api } from '../assets/js/api/index.js';

(function () {
  'use strict';

  // State modul simulasi
  const state = {
    items: [],
    loading: false,
    selectedIds: new Set(),
    preset: 'shopee_star_plus',
    adminFeePercent: 14.5,
    fixedFee: 1250,
    defaultPacking: 500,
    targetMargin: 20,
    searchQuery: '',
    statusFilter: 'all', // 'all' | 'AMAN' | 'TIPIS' | 'RUGI'
    categoryFilter: 'all',
    // Map item.id -> { coretPrice, diskonPrice, qty, packing }
    simulationData: new Map()
  };

  const PRESETS = {
    shopee_star_plus: { name: 'Shopee Star+ (14,5% + Rp 1.250)', fee: 14.5, fixed: 1250 },
    shopee_star:      { name: 'Shopee Star (12,0% + Rp 1.250)', fee: 12.0, fixed: 1250 },
    shopee_non_star:  { name: 'Shopee Non-Star (10,0% + Rp 1.250)', fee: 10.0, fixed: 1250 },
    tiktok_shop:      { name: 'TikTok Shop (12,0% + Rp 1.000)', fee: 12.0, fixed: 1000 },
    tokopedia:        { name: 'Tokopedia (10,0% + Rp 1.000)', fee: 10.0, fixed: 1000 },
    custom:           { name: 'Custom / Kustom Sendiri', fee: 14.5, fixed: 1250 }
  };

  function formatRupiah(num) {
    const val = Number(num);
    if (!Number.isFinite(val)) return 'Rp 0';
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function calculateRowMetrics(item, rowSim) {
    const cost = Number(item.cost_price) || 0;
    const offlinePrice = Number(item.sell_price) || 0;
    const qty = Math.max(1, parseInt(rowSim.qty, 10) || 1);
    const packing = Math.max(0, Number(rowSim.packing) || 0);
    const diskonPrice = Math.max(0, Number(rowSim.diskonPrice) || 0);
    const coretPrice = Math.max(diskonPrice, Number(rowSim.coretPrice) || diskonPrice);

    const feePercent = (Number(state.adminFeePercent) || 0) / 100;
    const fixedFee = Number(state.fixedFee) || 0;

    const totalOmset = diskonPrice * qty;
    const totalCost = cost * qty;
    const potonganAdmin = Math.round((totalOmset * feePercent) + fixedFee);
    const totalLaba = Math.round(totalOmset - potonganAdmin - totalCost - packing);
    const labaPerUnit = Math.round(totalLaba / qty);
    const marginPercent = totalOmset > 0 ? Math.round((totalLaba / totalOmset) * 10000) / 100 : 0;
    const diskonTokoPercent = coretPrice > 0 ? Math.round(((coretPrice - diskonPrice) / coretPrice) * 1000) / 10 : 0;

    // Hitung rekomendasi harga minimum per unit agar mencapai target margin
    const targetMarginRatio = (Number(state.targetMargin) || 20) / 100;
    const divisor = 1 - feePercent - targetMarginRatio;
    let rekomendasiMinUnit = diskonPrice;
    if (divisor > 0.05) {
      const requiredOmset = (totalCost + fixedFee + packing) / divisor;
      rekomendasiMinUnit = Math.ceil((requiredOmset / qty) / 100) * 100; // bulatkan ke ratusan terdekat
    }

    let status = 'AMAN';
    let statusClass = 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/30';
    if (totalLaba <= 0 || marginPercent < 5) {
      status = 'RUGI';
      statusClass = 'bg-[#FF3B30]/15 text-[#FF3B30] border-[#FF3B30]/30';
    } else if (marginPercent < state.targetMargin) {
      status = 'TIPIS';
      statusClass = 'bg-[#FFCC00]/15 text-[#FFCC00] border-[#FFCC00]/30';
    }

    return {
      cost,
      offlinePrice,
      qty,
      packing,
      diskonPrice,
      coretPrice,
      totalOmset,
      totalCost,
      potonganAdmin,
      totalLaba,
      labaPerUnit,
      marginPercent,
      diskonTokoPercent,
      rekomendasiMinUnit,
      status,
      statusClass
    };
  }

  async function loadItems() {
    const tbody = document.getElementById('pricing-tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="15" class="py-12 text-center text-[#A0A0A5]">
            <div class="inline-flex items-center gap-2">
              <svg class="animate-spin h-5 w-5 text-[#0088CC]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Memuat data produk untuk simulasi...</span>
            </div>
          </td>
        </tr>`;
    }

    state.loading = true;
    try {
      let list = [];
      const fetchFn = (typeof Api !== 'undefined' && Api.items && typeof Api.items.getAll === 'function')
        ? Api.items.getAll
        : (typeof Api !== 'undefined' && Api.items && typeof Api.items.list === 'function' ? Api.items.list : null);

      if (typeof fetchFn === 'function') {
        const res = await fetchFn();
        list = res?.data || [];
      } else if (typeof window !== 'undefined' && window.supabase) {
        const { data, error } = await window.supabase.from('products').select('*, categories(name)').order('name');
        if (!error && Array.isArray(data)) {
          list = data;
        }
      }
      state.items = list;

      // Inisialisasi simulasi untuk setiap item jika belum ada
      list.forEach(item => {
        if (!state.simulationData.has(String(item.id))) {
          const cost = Number(item.cost_price) || 0;
          const offlinePrice = Number(item.sell_price) || 0;
          let diskonPrice = Number(item.online_sell_price);
          if (!Number.isFinite(diskonPrice) || diskonPrice <= 0) {
            diskonPrice = offlinePrice > 0 ? offlinePrice : Math.round(cost * 1.5);
          }
          // Harga coret default: 2.5x atau min 1.4x diskon price
          let coretPrice = Math.round(diskonPrice * 2.5);
          if (coretPrice < 15000 && diskonPrice <= 5000) coretPrice = 15000;

          state.simulationData.set(String(item.id), {
            diskonPrice,
            coretPrice,
            qty: 1,
            packing: state.defaultPacking
          });
        }
      });

      renderSummaryCounters();
      renderTable();
      populateCategoryFilter();
    } catch (err) {
      console.error('[Pricing] Gagal memuat produk:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="15" class="py-8 text-center text-[#FF3B30]">
              Gagal memuat data produk. Pastikan koneksi dan login aktif.
            </td>
          </tr>`;
      }
    } finally {
      state.loading = false;
    }
  }

  function populateCategoryFilter() {
    const sel = document.getElementById('pricing-filter-category');
    if (!sel) return;
    const cats = Array.from(new Set(state.items.map(i => i.category || 'Umum'))).sort();
    sel.innerHTML = '<option value="all">Semua Kategori</option>' +
      cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function renderSummaryCounters() {
    let countAman = 0;
    let countTipis = 0;
    let countRugi = 0;

    state.items.forEach(item => {
      const rowSim = state.simulationData.get(String(item.id)) || {
        diskonPrice: Number(item.online_sell_price) || 0,
        coretPrice: (Number(item.online_sell_price) || 0) * 2,
        qty: 1,
        packing: state.defaultPacking
      };
      const metrics = calculateRowMetrics(item, rowSim);
      if (metrics.status === 'AMAN') countAman++;
      else if (metrics.status === 'TIPIS') countTipis++;
      else if (metrics.status === 'RUGI') countRugi++;
    });

    const elTotal = document.getElementById('pricing-count-total');
    const elAman = document.getElementById('pricing-count-aman');
    const elTipis = document.getElementById('pricing-count-tipis');
    const elRugi = document.getElementById('pricing-count-rugi');

    if (elTotal) elTotal.textContent = state.items.length;
    if (elAman) elAman.textContent = countAman;
    if (elTipis) elTipis.textContent = countTipis;
    if (elRugi) elRugi.textContent = countRugi;
  }

  function getFilteredItems() {
    const q = state.searchQuery.toLowerCase().trim();
    return state.items.filter(item => {
      // Filter kategori
      if (state.categoryFilter !== 'all' && (item.category || 'Umum') !== state.categoryFilter) {
        return false;
      }
      // Filter search
      if (q) {
        const name = (item.name || '').toLowerCase();
        const sku = (item.sku || '').toLowerCase();
        const brand = (item.brand || '').toLowerCase();
        if (!name.includes(q) && !sku.includes(q) && !brand.includes(q)) return false;
      }
      // Filter status
      if (state.statusFilter !== 'all') {
        const rowSim = state.simulationData.get(String(item.id)) || {
          diskonPrice: Number(item.online_sell_price) || 0,
          coretPrice: (Number(item.online_sell_price) || 0) * 2,
          qty: 1,
          packing: state.defaultPacking
        };
        const metrics = calculateRowMetrics(item, rowSim);
        if (metrics.status !== state.statusFilter) return false;
      }
      return true;
    });
  }

  function renderTable() {
    const tbody = document.getElementById('pricing-tbody');
    if (!tbody) return;

    const filtered = getFilteredItems();
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="15" class="py-12 text-center text-[#A0A0A5]">
            Tidak ada produk yang cocok dengan filter.
          </td>
        </tr>`;
      return;
    }

    const rowsHtml = filtered.map((item, idx) => {
      const id = String(item.id);
      const isChecked = state.selectedIds.has(id);
      const rowSim = state.simulationData.get(id) || {
        diskonPrice: Number(item.online_sell_price) || 0,
        coretPrice: (Number(item.online_sell_price) || 0) * 2,
        qty: 1,
        packing: state.defaultPacking
      };
      const m = calculateRowMetrics(item, rowSim);

      return `
        <tr class="table-row border-b border-white/5 hover:bg-white/[0.02] transition ${isChecked ? 'bg-[#0088CC]/5' : ''}" data-item-id="${id}">
          <td class="px-3.5 py-3 w-10 text-center">
            <input type="checkbox"
                   data-select-pricing="${id}"
                   ${isChecked ? 'checked' : ''}
                   class="accent-[#0088CC] w-4 h-4 cursor-pointer">
          </td>
          <td class="px-3.5 py-3 text-xs text-[#A0A0A5] font-mono whitespace-nowrap">${escapeHtml(item.sku || '-')}</td>
          <td class="px-3.5 py-3 max-w-[220px]">
            <div class="font-medium text-white text-sm truncate" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
            <div class="text-[11px] text-[#A0A0A5] flex items-center gap-1.5 mt-0.5">
              <span>${escapeHtml(item.brand || 'Lokal')}</span>
              <span>•</span>
              <span class="text-[#32ADE6]">${escapeHtml(item.category || 'Umum')}</span>
            </div>
          </td>
          <td class="px-3.5 py-3 text-right text-xs whitespace-nowrap text-[#A0A0A5]">${formatRupiah(m.cost)}</td>
          <td class="px-3.5 py-3 text-right text-xs whitespace-nowrap font-medium">${formatRupiah(m.offlinePrice)}</td>
          
          <!-- Harga Coret Input -->
          <td class="px-3.5 py-3 text-right whitespace-nowrap">
            <input type="number" step="500" min="0"
                   data-input-field="coretPrice"
                   data-item-id="${id}"
                   value="${m.coretPrice}"
                   class="w-24 bg-[#1C1C1E] border border-white/10 rounded-lg px-2 py-1 text-right text-xs text-white focus:border-[#0088CC] focus:outline-none font-mono">
          </td>

          <!-- Harga Setelah Diskon Input (Highlight Kuning) -->
          <td class="px-3.5 py-3 text-right whitespace-nowrap">
            <input type="number" step="500" min="0"
                   data-input-field="diskonPrice"
                   data-item-id="${id}"
                   value="${m.diskonPrice}"
                   class="w-24 bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-lg px-2 py-1 text-right text-xs font-semibold text-[#FFCC00] focus:border-[#FFCC00] focus:outline-none font-mono">
          </td>

          <!-- Qty per Resi Input -->
          <td class="px-3.5 py-3 text-right whitespace-nowrap">
            <input type="number" step="1" min="1" max="99"
                   data-input-field="qty"
                   data-item-id="${id}"
                   value="${m.qty}"
                   class="w-14 bg-[#FF9500]/10 border border-[#FF9500]/30 rounded-lg px-1.5 py-1 text-center text-xs font-semibold text-[#FF9500] focus:border-[#FF9500] focus:outline-none font-mono">
          </td>

          <!-- Biaya Packing Input -->
          <td class="px-3.5 py-3 text-right whitespace-nowrap">
            <input type="number" step="100" min="0"
                   data-input-field="packing"
                   data-item-id="${id}"
                   value="${m.packing}"
                   class="w-20 bg-[#32ADE6]/10 border border-[#32ADE6]/30 rounded-lg px-2 py-1 text-right text-xs font-semibold text-[#32ADE6] focus:border-[#32ADE6] focus:outline-none font-mono">
          </td>

          <!-- Diskon Toko (%) -->
          <td class="px-3.5 py-3 text-right text-xs whitespace-nowrap text-[#A0A0A5] font-mono">${m.diskonTokoPercent}%</td>

          <!-- Potongan Admin MP -->
          <td class="px-3.5 py-3 text-right text-xs whitespace-nowrap text-[#FF3B30] font-mono font-medium">-${formatRupiah(m.potonganAdmin)}</td>

          <!-- Total Laba Bersih -->
          <td class="px-3.5 py-3 text-right whitespace-nowrap font-bold text-xs ${m.totalLaba >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'} font-mono">
            ${formatRupiah(m.totalLaba)}
            ${m.qty > 1 ? `<span class="block text-[10px] text-[#A0A0A5] font-normal">(@ ${formatRupiah(m.labaPerUnit)})</span>` : ''}
          </td>

          <!-- Margin Bersih (%) -->
          <td class="px-3.5 py-3 text-right whitespace-nowrap font-bold text-xs ${m.marginPercent >= 20 ? 'text-[#34C759]' : (m.marginPercent >= 5 ? 'text-[#FFCC00]' : 'text-[#FF3B30]')} font-mono">
            ${m.marginPercent}%
          </td>

          <!-- Status Badge -->
          <td class="px-3.5 py-3 text-center whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${m.statusClass}">
              ${m.status}
            </span>
          </td>

          <!-- Rekomendasi Min -->
          <td class="px-3.5 py-3 text-right whitespace-nowrap text-xs font-semibold text-[#32ADE6] font-mono" title="Harga minimum per pcs agar target margin ${state.targetMargin}% tercapai">
            ${formatRupiah(m.rekomendasiMinUnit)}
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
    updateBatchApplyButton();
  }

  function updateBatchApplyButton() {
    const btn = document.getElementById('pricing-btn-apply');
    const selectAllCb = document.getElementById('pricing-select-all');
    const count = state.selectedIds.size;

    if (btn) {
      if (count > 0) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.innerHTML = `<i data-lucide="check-check" class="w-4 h-4"></i> Terapkan ke Master (${count} Produk)`;
      } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        btn.innerHTML = `<i data-lucide="check-check" class="w-4 h-4"></i> Terapkan ke Master Data`;
      }
    }

    if (selectAllCb) {
      const filtered = getFilteredItems();
      const allSelected = filtered.length > 0 && filtered.every(i => state.selectedIds.has(String(i.id)));
      selectAllCb.checked = allSelected;
    }

    if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function attachEventListeners() {
    const container = document.getElementById('page-pricing');
    if (!container || container.dataset.listenersAttached) return;
    container.dataset.listenersAttached = 'true';

    // Preset Marketplace Dropdown
    const presetSelect = document.getElementById('pricing-preset-select');
    if (presetSelect) {
      presetSelect.addEventListener('change', e => {
        const val = e.target.value;
        state.preset = val;
        if (PRESETS[val]) {
          state.adminFeePercent = PRESETS[val].fee;
          state.fixedFee = PRESETS[val].fixed;
          const feeInput = document.getElementById('pricing-fee-percent');
          const fixedInput = document.getElementById('pricing-fixed-fee');
          if (feeInput) feeInput.value = state.adminFeePercent;
          if (fixedInput) fixedInput.value = state.fixedFee;
        }
        renderSummaryCounters();
        renderTable();
      });
    }

    // Input Fee Persen & Fixed Fee
    const feeInput = document.getElementById('pricing-fee-percent');
    if (feeInput) {
      feeInput.addEventListener('input', e => {
        state.adminFeePercent = Number(e.target.value) || 0;
        renderSummaryCounters();
        renderTable();
      });
    }

    const fixedInput = document.getElementById('pricing-fixed-fee');
    if (fixedInput) {
      fixedInput.addEventListener('input', e => {
        state.fixedFee = Number(e.target.value) || 0;
        renderSummaryCounters();
        renderTable();
      });
    }

    // Target Margin Min Input
    const targetMarginInput = document.getElementById('pricing-target-margin');
    if (targetMarginInput) {
      targetMarginInput.addEventListener('input', e => {
        state.targetMargin = Number(e.target.value) || 20;
        renderSummaryCounters();
        renderTable();
      });
    }

    // Default Packing Input (Batch Update to rows that use default)
    const defaultPackingInput = document.getElementById('pricing-default-packing');
    if (defaultPackingInput) {
      defaultPackingInput.addEventListener('change', e => {
        const val = Math.max(0, Number(e.target.value) || 0);
        state.defaultPacking = val;
        // Update all items packing
        state.simulationData.forEach(sim => {
          sim.packing = val;
        });
        renderSummaryCounters();
        renderTable();
      });
    }

    // Search Input
    const searchInput = document.getElementById('pricing-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        state.searchQuery = e.target.value;
        renderTable();
      });
    }

    // Category Filter
    const catSelect = document.getElementById('pricing-filter-category');
    if (catSelect) {
      catSelect.addEventListener('change', e => {
        state.categoryFilter = e.target.value;
        renderTable();
      });
    }

    // Status Filter Chips
    const statusChips = container.querySelectorAll('[data-status-filter]');
    statusChips.forEach(chip => {
      chip.addEventListener('click', () => {
        statusChips.forEach(c => c.classList.remove('active', 'bg-[#0088CC]', 'text-white'));
        chip.classList.add('active', 'bg-[#0088CC]', 'text-white');
        state.statusFilter = chip.getAttribute('data-status-filter') || 'all';
        renderTable();
      });
    });

    // Select All Checkbox
    const selectAllCb = document.getElementById('pricing-select-all');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', e => {
        const checked = e.target.checked;
        const filtered = getFilteredItems();
        filtered.forEach(i => {
          if (checked) state.selectedIds.add(String(i.id));
          else state.selectedIds.delete(String(i.id));
        });
        renderTable();
      });
    }

    // Delegasi Event Tabel (Checkbox & Input Field)
    const tbody = document.getElementById('pricing-tbody');
    if (tbody) {
      tbody.addEventListener('change', e => {
        const cb = e.target.closest('[data-select-pricing]');
        if (cb) {
          const id = cb.getAttribute('data-select-pricing');
          if (cb.checked) state.selectedIds.add(id);
          else state.selectedIds.delete(id);
          updateBatchApplyButton();
          const tr = cb.closest('tr');
          if (tr) tr.classList.toggle('bg-[#0088CC]/5', cb.checked);
          return;
        }

        const input = e.target.closest('[data-input-field]');
        if (input) {
          const id = input.getAttribute('data-item-id');
          const field = input.getAttribute('data-input-field');
          const val = Number(input.value) || 0;
          if (state.simulationData.has(id)) {
            const rowSim = state.simulationData.get(id);
            rowSim[field] = val;
            renderSummaryCounters();
            renderTable();
          }
        }
      });
    }

    // Tombol Terapkan ke Master Data
    const btnApply = document.getElementById('pricing-btn-apply');
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        openApplyConfirmModal();
      });
    }

    // Tombol Export CSV
    const btnExport = document.getElementById('pricing-btn-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        exportSimulationCsv();
      });
    }
  }

  function openApplyConfirmModal() {
    const selected = state.items.filter(i => state.selectedIds.has(String(i.id)));
    if (selected.length === 0) return;

    let modal = document.getElementById('pricing-apply-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pricing-apply-modal';
      modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-3 sm:p-6 overflow-y-auto';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'pricing-apply-modal-title');
      document.body.appendChild(modal);
    }

    let changedCount = 0;
    let unchangedCount = 0;
    selected.forEach(item => {
      const rowSim = state.simulationData.get(String(item.id));
      const oldPrice = Number(item.online_sell_price) || 0;
      const newPrice = Math.round(Number(rowSim?.diskonPrice) || 0);
      if (oldPrice !== newPrice) changedCount++;
      else unchangedCount++;
    });

    const itemsSummary = selected.map(item => {
      const rowSim = state.simulationData.get(String(item.id));
      const oldPrice = Number(item.online_sell_price) || 0;
      const newPrice = Math.round(Number(rowSim?.diskonPrice) || 0);
      const isPriceChanged = oldPrice !== newPrice;

      return `
        <div class="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-white/[0.02] transition text-xs">
          <div class="min-w-0 pr-3 flex-1">
            <span class="font-medium text-white truncate block text-xs" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
            <span class="text-[#A0A0A5] font-mono text-[10px]">${escapeHtml(item.sku || '-')}</span>
          </div>
          <div class="text-right shrink-0">
            ${isPriceChanged
              ? `<span class="text-[#A0A0A5] line-through text-[11px] mr-1">${formatRupiah(oldPrice)}</span>
                 <span class="text-[#34C759] font-bold font-mono text-xs">-> ${formatRupiah(newPrice)}</span>`
              : `<span class="text-[#A0A0A5] font-mono text-xs">${formatRupiah(oldPrice)}</span>
                 <span class="text-[10px] text-[#77777D] ml-1">(Tetap)</span>`
            }
          </div>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div id="pricing-apply-card" class="bg-[#1C1C1E] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150" style="max-height: calc(100vh - 48px); max-height: calc(100dvh - 48px); box-sizing: border-box;">
        <div class="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#1C1C1E]">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-[#0088CC]/15 grid place-items-center text-[#32ADE6] shrink-0">
              <i data-lucide="check-check" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <h3 id="pricing-apply-modal-title" class="font-bold text-base text-white truncate">Terapkan Harga ke Master Barang</h3>
              <p class="text-xs text-[#A0A0A5] truncate">Sinkronkan harga online hasil simulasi ke database</p>
            </div>
          </div>
          <button type="button" id="btn-close-pricing-apply-x" class="text-[#A0A0A5] hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition shrink-0 ml-2" aria-label="Tutup modal">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <div class="px-4 sm:px-5 py-2.5 bg-black/30 border-b border-white/5 flex items-center justify-between text-xs text-[#A0A0A5] shrink-0">
          <span>Total dipilih: <strong class="text-white">${selected.length} produk</strong></span>
          <span>Perubahan: <strong class="text-[#34C759]">${changedCount} berubah</strong> / <strong class="text-[#A0A0A5]">${unchangedCount} tetap</strong></span>
        </div>

        <div class="p-3 sm:p-4 overflow-y-auto space-y-1 flex-1 divide-y divide-white/5 bg-[#1C1C1E]" style="max-height: 48vh; min-height: 120px;">
          ${itemsSummary}
        </div>

        <div class="p-4 bg-black/40 border-t border-white/5 flex items-center justify-between shrink-0">
          <button type="button" id="btn-cancel-pricing-apply" class="px-4 py-2 rounded-xl text-xs font-semibold text-[#A0A0A5] hover:text-white hover:bg-white/5 transition">
            Batal
          </button>
          <button type="button" id="btn-confirm-apply-pricing" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0088CC] hover:bg-[#0077BB] text-white flex items-center gap-1.5 shadow-lg shadow-[#0088CC]/25 transition">
            <i data-lucide="save" class="w-4 h-4"></i> Konfirmasi & Simpan
          </button>
        </div>
      </div>
    `;

    if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

    const closeModal = () => {
      if (modal) modal.remove();
      window.removeEventListener('keydown', handleKeyDown);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKeyDown);

    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    const closeBtnX = document.getElementById('btn-close-pricing-apply-x');
    if (closeBtnX) closeBtnX.addEventListener('click', closeModal);

    const cancelBtn = document.getElementById('btn-cancel-pricing-apply');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    const confirmBtn = document.getElementById('btn-confirm-apply-pricing');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `
          <svg class="animate-spin h-4 w-4 text-white inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg> Menyimpan...`;

        const updates = selected.map(item => {
          const rowSim = state.simulationData.get(String(item.id));
          return {
            id: String(item.id),
            online_sell_price: Math.round(Number(rowSim?.diskonPrice) || 0)
          };
        });

        try {
          const res = await Api.items.bulkUpdatePrice(updates);
          if (res && res.ok) {
            closeModal();
            showToastSuccess(`Berhasil menerapkan ${updates.length} harga online ke Master Barang!`);
            state.selectedIds.clear();
            // Reload data
            await loadItems();
            if (typeof window.loadItemsFromBackend === 'function') window.loadItemsFromBackend();
          } else {
            alert('Gagal memperbarui harga: ' + (res?.error?.message || 'Terjadi kesalahan'));
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Coba Lagi';
          }
        } catch (err) {
          console.error(err);
          alert('Terjadi error koneksi: ' + err.message);
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = 'Coba Lagi';
        }
      });
    }
  }

  function showToastSuccess(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, 'success');
      return;
    }
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'bg-[#34C759] text-black font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-bounce-in';
    toast.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> ${escapeHtml(msg)}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
    if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function exportSimulationCsv() {
    const itemsToExport = getFilteredItems();
    if (itemsToExport.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const headers = [
      'No', 'SKU', 'Nama Barang', 'Brand', 'Kategori',
      'Harga Modal (Rp)', 'Harga Jual Offline (Rp)', 'Harga Coret Online (Rp)',
      'Fee (%)', 'Harga Setelah Diskon (Rp)', 'Qty per Resi (Pcs)',
      'Biaya Packing (Rp)', 'Diskon Toko (%)', 'Potongan Admin Shopee (Rp)',
      'Laba Bersih per Unit (Rp)', 'Total Laba per Resi (Rp)',
      'Margin Bersih (%)', 'Status', 'Rekomendasi Min (Rp)'
    ];

    const rows = itemsToExport.map((item, idx) => {
      const rowSim = state.simulationData.get(String(item.id)) || {
        diskonPrice: Number(item.online_sell_price) || 0,
        coretPrice: (Number(item.online_sell_price) || 0) * 2,
        qty: 1,
        packing: state.defaultPacking
      };
      const m = calculateRowMetrics(item, rowSim);

      return [
        idx + 1,
        `"${escapeHtml(item.sku || '')}"`,
        `"${escapeHtml(item.name || '').replace(/"/g, '""')}"`,
        `"${escapeHtml(item.brand || '')}"`,
        `"${escapeHtml(item.category || '')}"`,
        m.cost,
        m.offlinePrice,
        m.coretPrice,
        state.adminFeePercent,
        m.diskonPrice,
        m.qty,
        m.packing,
        m.diskonTokoPercent,
        m.potonganAdmin,
        m.labaPerUnit,
        m.totalLaba,
        m.marginPercent,
        m.status,
        m.rekomendasiMinUnit
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SIMULASI_HARGA_MARKETPLACE_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Global entrypoint called by navigation.js
  window.initPricingSimulation = async function () {
    attachEventListeners();

    let retries = 0;
    while ((typeof Api === 'undefined' || !Api.items) && retries < 25) {
      await new Promise(r => setTimeout(r, 40));
      retries++;
    }

    await loadItems();
  };

  // Auto-init jika halaman dibuka langsung di URL /dashboard/pricing/
  if (typeof window !== 'undefined') {
    const isPricingPage = window.location.pathname.includes('/pricing') ||
      window.location.search.includes('page=pricing') ||
      Boolean(document.getElementById('page-pricing')?.classList.contains('active'));

    if (isPricingPage) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.initPricingSimulation);
      } else {
        window.initPricingSimulation();
      }
    }
  }

})();
