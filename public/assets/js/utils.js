/* ═══════════════════════════════════════════════════
   aQuaStock Pro — utils.js
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
    parseIndonesianNumber,
    detectMultiplier,
    animateNumber,
    focusProgrammatically,
    exportToCSV,
    generateSKU
  };
}
