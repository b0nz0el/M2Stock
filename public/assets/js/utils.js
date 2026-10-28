/* ═══════════════════════════════════════════════════
   Aquastock Pro — utils.js
   Helper global (toast, format/parse angka, animasi angka)
   ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════ */
function showToast(msg, type = 'success') {
  const variants = {
    success: { icon: 'check', role: 'status' },
    error: { icon: 'alert-circle', role: 'alert' },
    info: { icon: 'info', role: 'status' },
    warning: { icon: 'alert-triangle', role: 'status' }
  };
  const variant = variants[type] || variants.info;
  const container = document.getElementById('toast-container') || document.body;
  const toast = document.createElement('div');
  toast.className = `toast toast--${variants[type] ? type : 'info'}`;
  toast.setAttribute('role', variant.role);
  toast.setAttribute('aria-live', variant.role === 'alert' ? 'assertive' : 'polite');

  const iconWrap = document.createElement('span');
  iconWrap.className = 'toast__icon';
  iconWrap.setAttribute('aria-hidden', 'true');
  const iconEl = document.createElement('i');
  iconEl.setAttribute('data-lucide', variant.icon);
  iconEl.className = 'w-4 h-4';
  iconWrap.appendChild(iconEl);

  const textSpan = document.createElement('span');
  textSpan.className = 'toast__message';
  textSpan.textContent = msg;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'toast__close';
  closeButton.setAttribute('aria-label', 'Tutup notifikasi');
  closeButton.innerHTML = '<i data-lucide="x" class="w-4 h-4" aria-hidden="true"></i>';
  closeButton.addEventListener('click', () => toast.remove());

  toast.append(iconWrap, textSpan, closeButton);
  container.appendChild(toast);

  if (typeof window !== 'undefined' && typeof window.refreshIcons === 'function') {
    window.refreshIcons(toast);
  } else if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }

  setTimeout(() => {
    toast.classList.add('toast--leaving');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ═══════════════════════════════════════════════════
   CONFIRM DIALOG (MODAL IN-APP PENGGANTI BROWSER CONFIRM)
   ═══════════════════════════════════════════════════ */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Menampilkan Dialog Konfirmasi Modal Modern in-app (menggantikan window.confirm bawaan browser)
 * @param {Object} options
 * @param {string} [options.title='Konfirmasi Tindakan'] - Judul modal
 * @param {string} options.message - Pesan penjelasan / pertanyaan konfirmasi
 * @param {string} [options.confirmText='Hapus'] - Label tombol konfirmasi
 * @param {string} [options.cancelText='Batal'] - Label tombol batal
 * @param {'danger'|'warning'|'primary'} [options.type='danger'] - Tipe gaya (merah untuk delete, biru untuk aksi biasa)
 * @returns {Promise<boolean>} Resolve true jika dikonfirmasi, false jika batal
 */
function showConfirmDialog({
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmText = 'Hapus',
  cancelText = 'Batal',
  type = 'danger'
} = {}) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(true);
      return;
    }

    const existing = document.getElementById('aquastock-confirm-dialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'aquastock-confirm-dialog';
    overlay.className = 'fixed inset-0 bg-black/75 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-150';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'confirm-dialog-title');
    overlay.setAttribute('aria-describedby', 'confirm-dialog-message');

    const isDanger = type === 'danger';
    const iconColor = isDanger ? 'text-[#FF3B30]' : 'text-[#32ADE6]';
    const iconBg = isDanger ? 'bg-[#FF3B30]/15' : 'bg-[#0088CC]/15';
    const btnBg = isDanger 
      ? 'bg-[#FF3B30] hover:bg-[#E02D22] text-white shadow-lg shadow-[#FF3B30]/20' 
      : 'bg-[#0088CC] hover:bg-[#0077BB] text-white shadow-lg shadow-[#0088CC]/20';

    overlay.innerHTML = `
      <div class="bg-[#1C1C1E] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 my-auto animate-in zoom-in-95 duration-150">
        <div class="flex items-start gap-3.5">
          <div class="w-10 h-10 rounded-xl ${iconBg} ${iconColor} grid place-items-center shrink-0 mt-0.5">
            <i data-lucide="${isDanger ? 'alert-triangle' : 'info'}" class="w-5 h-5" aria-hidden="true"></i>
          </div>
          <div class="min-w-0 flex-1">
            <h3 id="confirm-dialog-title" class="text-base font-bold text-white tracking-tight">${escapeHtml(title)}</h3>
            <p id="confirm-dialog-message" class="text-xs text-[#A0A0A5] leading-relaxed mt-1.5">${escapeHtml(message)}</p>
          </div>
        </div>
        <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
          <button type="button" id="confirm-dialog-btn-cancel" class="px-4 py-2 rounded-xl border border-white/10 text-xs font-medium text-[#A0A0A5] hover:text-white hover:bg-white/5 transition active:scale-95 cursor-pointer">
            ${escapeHtml(cancelText)}
          </button>
          <button type="button" id="confirm-dialog-btn-confirm" class="px-4 py-2 rounded-xl text-xs font-semibold ${btnBg} transition active:scale-95 cursor-pointer">
            ${escapeHtml(confirmText)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    if (typeof window !== 'undefined' && typeof window.refreshIcons === 'function') {
      window.refreshIcons(overlay);
    } else if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }

    let settled = false;
    const cleanup = (result) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', handleKeydown);
      overlay.remove();
      resolve(result);
    };

    const cancelBtn = overlay.querySelector('#confirm-dialog-btn-cancel');
    const confirmBtn = overlay.querySelector('#confirm-dialog-btn-confirm');

    cancelBtn?.addEventListener('click', () => cleanup(false));
    confirmBtn?.addEventListener('click', () => cleanup(true));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        cleanup(false);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    confirmBtn?.focus();
  });
}

if (typeof window !== 'undefined') {
  window.escapeHtml = escapeHtml;
  window.showConfirmDialog = showConfirmDialog;
}

/* ═══════════════════════════════════════════════
   ANGKA & ANIMASI HELPERS
   ═══════════════════════════════════════════════ */
function parseIndonesianNumber(text) {
  if (!text || typeof text !== 'string') return 0;
  // Ambil angka dengan pemisah ribuan titik
  const cleaned = text.replace(/[^\d]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function detectMultiplier(text) {
  if (!text || typeof text !== 'string') return 1;
  if (/jt|juta/i.test(text)) return 1000000;
  if (/rb|ribu/i.test(text)) return 1000;
  return 1;
}

function animateNumber(el, target, duration = 1200, prefix = '', suffix = '') {
  if (!el) return;
  const isReducedMotion = (typeof prefersReducedMotion !== 'undefined' && prefersReducedMotion) ||
    (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  if (isReducedMotion) {
    el.textContent = prefix + target.toLocaleString('id-ID') + suffix;
    return;
  }
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(target * eased);
    el.textContent = prefix + current.toLocaleString('id-ID') + suffix;
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = prefix + target.toLocaleString('id-ID') + suffix;
  }
  requestAnimationFrame(tick);
}

/* ═══════════════════════════════════════════════
   AKSESIBILITAS / FOCUS HELPERS
   ═══════════════════════════════════════════════ */
function focusProgrammatically(el) {
  if (!el || typeof el.focus !== 'function') return;
  el.setAttribute('data-programmatic-focus', 'true');
  el.focus();
  el.addEventListener('blur', function onBlur() {
    el.removeAttribute('data-programmatic-focus');
    el.removeEventListener('blur', onBlur);
  }, { once: true });
}

/* ═══════════════════════════════════════════════
   EXPORT CSV
   ═══════════════════════════════════════════════ */
function exportToCSV(filename, rows, headers, options = {}) {
  if ((!rows || !rows.length) && !(options.allowEmpty && headers && headers.length)) {
    if (typeof showToast === 'function') showToast('Tidak ada data untuk diekspor', 'info');
    return null;
  }

  function escapeCell(val) {
    if (val === null || val === undefined) return '""';
    var str = String(val).replace(/"/g, '""');
    return '"' + str + '"';
  }

  var lines = [];
  if (headers && headers.length) {
    lines.push(headers.map(escapeCell).join(','));
  }

  rows = rows || [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var cells = Array.isArray(row) ? row : Object.values(row);
    lines.push(cells.map(escapeCell).join(','));
  }

  var csvString = '\uFEFF' + lines.join('\r\n');
  if (typeof document !== 'undefined' && typeof Blob !== 'undefined') {
    var blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      var url = URL.createObjectURL(blob);
      link.href = url;
      link.setAttribute('download', filename || ('export-' + new Date().toISOString().slice(0, 10) + '.csv'));
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  if (typeof showToast === 'function') {
    showToast(rows.length
      ? 'Berhasil mengekspor ' + rows.length + ' baris data ke CSV'
      : 'Template CSV berhasil diunduh',
    'success');
  }
  return csvString;
}

/* ═══════════════════════════════════════════════
   SKU GENERATOR
   Format: Kategori(3)-Brand(3)-Nomor(3+)
   Contoh: generateSKU('Pakan', 'Lokal', 46) => 'PAK-LOK-047'
   ═══════════════════════════════════════════════ */
function generateSKU(kategori, brand, idTerakhir) {
  function getCode(str, defaultCode) {
    if (!str || typeof str !== 'string') return defaultCode;
    const clean = str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length === 0) return defaultCode;
    if (clean.length < 3) return clean.padEnd(3, 'X');
    return clean.slice(0, 3);
  }

  const catCode = getCode(kategori, 'UMU');
  const brandCode = getCode(brand, 'LOK');

  let lastIdNum = 0;
  if (typeof idTerakhir === 'number') {
    lastIdNum = idTerakhir;
  } else if (typeof idTerakhir === 'string') {
    const match = idTerakhir.match(/(\d+)$/);
    if (match) {
      lastIdNum = parseInt(match[1], 10);
    } else {
      lastIdNum = parseInt(idTerakhir, 10) || 0;
    }
  }

  const nextNum = Math.max(0, lastIdNum) + 1;
  const numStr = String(nextNum).padStart(3, '0');

  return `${catCode}-${brandCode}-${numStr}`;
}

if (typeof window !== 'undefined') {
  window.exportToCSV = exportToCSV;
  window.generateSKU = generateSKU;
}

/* Export untuk unit testing (Vitest/Node) tanpa mengganggu browser runtime */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showToast,
    escapeHtml,
    showConfirmDialog,
    parseIndonesianNumber,
    detectMultiplier,
    animateNumber,
    focusProgrammatically,
    exportToCSV,
    generateSKU
  };
}
