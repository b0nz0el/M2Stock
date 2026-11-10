/* ═══════════════════════════════════════════════════
   M2Stock — utils.js
   Helper global (toast, format/parse angka, animasi angka)
   ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   TOAST NOTIFICATION (STANDAR INTERNASIONAL)
   Hover-to-pause, swipe-to-dismiss, action button,
   stacking limit, & spring physics.
   ═══════════════════════════════════════════════════ */
function playNotificationChime(type) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!window._notifAudioCtx) {
      window._notifAudioCtx = new AudioCtx();
    }
    const ctx = window._notifAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // Nada lembut naik ala fintech kelas dunia (C6 -> G6)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, now);
      osc.frequency.exponentialRampToValueAtTime(1567.98, now + 0.08);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'error') {
      // Nada lembut turun
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(311.13, now + 0.1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.24);
    }
  } catch (_) {
    // Silent fail jika browser melarang autoplay audio sebelum gesture
  }
}

function showToast(msg, type = 'success', durationOrOptions = (type === 'loading' ? 8000 : 3000)) {
  const variants = {
    success: { icon: 'check', role: 'status' },
    error: { icon: 'alert-circle', role: 'alert' },
    info: { icon: 'info', role: 'status' },
    warning: { icon: 'alert-triangle', role: 'status' },
    loading: { icon: 'loader-2', role: 'status', spinning: true }
  };
  const variant = variants[type] || variants.info;
  const container = document.getElementById('toast-container') || document.body;

  // Parsing parameter fleksibel (angka durasi atau options object)
  let duration = type === 'loading' ? 8000 : 3000;
  let actionConfig = null;
  let enableSound = false;

  if (typeof durationOrOptions === 'number') {
    duration = durationOrOptions;
  } else if (durationOrOptions && typeof durationOrOptions === 'object') {
    if (typeof durationOrOptions.duration === 'number') duration = durationOrOptions.duration;
    if (durationOrOptions.action && typeof durationOrOptions.action === 'object') actionConfig = durationOrOptions.action;
    if (durationOrOptions.sound === true) enableSound = true;
  }

  // Jika memanggil status final (success/error/warning) saat ada loading toast, transisikan dengan mulus
  if (type !== 'loading') {
    const existingLoading = container.querySelectorAll('.toast--loading');
    existingLoading.forEach(el => {
      if (el._dismissTimer) clearTimeout(el._dismissTimer);
      el.classList.add('toast--leaving');
      setTimeout(() => el.remove(), 200);
    });
  }

  // Stacking limit: jaga agar maksimal hanya ada 3 toast aktif di layar secara bersamaan
  const activeToasts = container.querySelectorAll('.toast:not(.toast--leaving)');
  if (activeToasts.length >= 3) {
    const oldest = activeToasts[0];
    if (oldest._dismissTimer) clearTimeout(oldest._dismissTimer);
    oldest.classList.add('toast--leaving');
    setTimeout(() => oldest.remove(), 200);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${variants[type] ? type : 'info'}`;
  toast.setAttribute('role', variant.role);
  toast.setAttribute('aria-live', variant.role === 'alert' ? 'assertive' : 'polite');

  const iconWrap = document.createElement('span');
  iconWrap.className = 'toast__icon';
  iconWrap.setAttribute('aria-hidden', 'true');
  const iconEl = document.createElement('i');
  iconEl.setAttribute('data-lucide', variant.icon);
  iconEl.className = variant.spinning ? 'w-4 h-4 toast__spinner animate-spin text-[#32ADE6]' : 'w-4 h-4';
  iconWrap.appendChild(iconEl);

  const textSpan = document.createElement('span');
  textSpan.className = 'toast__message';
  textSpan.textContent = msg;

  toast.append(iconWrap, textSpan);

  // Optional Action Button (misal: "Undo", "Lihat", "Buka")
  if (actionConfig && actionConfig.label) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'toast__action';
    actionBtn.textContent = actionConfig.label;
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof actionConfig.onClick === 'function') {
        actionConfig.onClick(toast);
      }
      dismissToast();
    });
    toast.appendChild(actionBtn);
  }

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'toast__close';
  closeButton.setAttribute('aria-label', 'Tutup notifikasi');
  closeButton.innerHTML = '<i data-lucide="x" class="w-4 h-4" aria-hidden="true"></i>';

  function dismissToast() {
    if (toast._dismissTimer) clearTimeout(toast._dismissTimer);
    toast.classList.add('toast--leaving');
    setTimeout(() => toast.remove(), 250);
  }

  closeButton.addEventListener('click', () => {
    if (toast._dismissTimer) clearTimeout(toast._dismissTimer);
    toast.remove();
  });
  toast.appendChild(closeButton);
  container.appendChild(toast);

  // Sound feedback halus opsional
  if (enableSound || type === 'error') {
    playNotificationChime(type);
  }

  if (typeof window !== 'undefined' && typeof window.refreshIcons === 'function') {
    window.refreshIcons(toast);
  } else if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }

  // Hover-to-pause & Swipe-to-dismiss engine
  if (duration > 0) {
    let remainingTime = duration;
    let timerStart = Date.now();

    function startTimer() {
      timerStart = Date.now();
      toast._dismissTimer = setTimeout(dismissToast, remainingTime);
    }

    function pauseTimer() {
      clearTimeout(toast._dismissTimer);
      remainingTime -= (Date.now() - timerStart);
      if (remainingTime < 800) remainingTime = 800; // Beri minimal 800ms jika user melepas hover
    }

    startTimer();

    // Mouse hover to pause
    toast.addEventListener('mouseenter', pauseTimer);
    toast.addEventListener('mouseleave', startTimer);

    // Touch swipe-to-dismiss di mobile
    let touchStartY = 0;
    let touchDiffY = 0;

    toast.addEventListener('touchstart', (e) => {
      pauseTimer();
      touchStartY = e.touches[0].clientY;
      touchDiffY = 0;
    }, { passive: true });

    toast.addEventListener('touchmove', (e) => {
      const currentY = e.touches[0].clientY;
      touchDiffY = currentY - touchStartY;
      if (touchDiffY < 0) {
        toast.style.transform = `translateY(${touchDiffY}px)`;
        toast.style.opacity = `${Math.max(0.2, 1 + touchDiffY / 100)}`;
      }
    }, { passive: true });

    toast.addEventListener('touchend', () => {
      if (touchDiffY < -35) {
        dismissToast();
      } else {
        toast.style.transform = '';
        toast.style.opacity = '';
        startTimer();
      }
    });
  }

  return toast;
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

/* ═══════════════════════════════════════════════
   FUZZY & TYPO-TOLERANT SEARCH ENGINE
   Mendukung pencarian cerdas tahan typo:
   - Multi-token (semua kata query dicocokkan)
   - Exact substring match (skor tertinggi)
   - Subsequence matching
   - Damerau-Levenshtein distance (typo 1-2 karakter & huruf tertukar)
   - Normalisasi fonetik ringan (k/c, batre/baterai, double letters)
   ═══════════════════════════════════════════════ */

function calculateLevenshteinDistance(a, b) {
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  let prevPrevRow = new Array(lenB + 1);
  let prevRow = new Array(lenB + 1);
  let currRow = new Array(lenB + 1);

  for (let j = 0; j <= lenB; j++) {
    prevRow[j] = j;
    prevPrevRow[j] = j;
  }

  for (let i = 1; i <= lenA; i++) {
    currRow[0] = i;
    const charA = a[i - 1];
    for (let j = 1; j <= lenB; j++) {
      const charB = b[j - 1];
      const cost = charA === charB ? 0 : 1;
      let min = Math.min(
        currRow[j - 1] + 1,     // insertion
        prevRow[j] + 1,         // deletion
        prevRow[j - 1] + cost   // substitution
      );
      // Damerau transposition: jika 2 karakter bersebelahan tertukar (misal 'fliter' <-> 'filter')
      if (i > 1 && j > 1 && charA === b[j - 2] && a[i - 2] === charB) {
        min = Math.min(min, prevPrevRow[j - 2] + 1);
      }
      currRow[j] = min;
    }
    const temp = prevPrevRow;
    prevPrevRow = prevRow;
    prevRow = currRow;
    currRow = temp;
  }
  return prevRow[lenB];
}

function normalizeSearchText(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isSubsequence(sub, str) {
  let i = 0;
  let j = 0;
  while (i < sub.length && j < str.length) {
    if (sub[i] === str[j]) i++;
    j++;
  }
  return i === sub.length;
}

const INDO_SLANG_MAP = {
  'batre': 'baterai',
  'bateray': 'baterai',
  'skreper': 'scraper',
  'kanister': 'canister',
  'aquariun': 'aquarium',
  'erator': 'aerator'
};

/**
 * Menghitung skor kecocokan fuzzy antara kata kunci (query) dan teks target.
 * Mengembalikan angka skor:
 * - 0 jika tidak cocok sama sekali.
 * - > 0 jika cocok, dengan nilai semakin tinggi jika semakin akurat.
 */
function fuzzyScore(query, targetText) {
  if (!query || !targetText) return 0;

  const cleanQuery = normalizeSearchText(query);
  const cleanTarget = normalizeSearchText(targetText);

  if (!cleanQuery || !cleanTarget) return 0;

  // Jika persis sama
  if (cleanTarget === cleanQuery) return 10000;

  // Jika target diawali query (prefix match)
  if (cleanTarget.startsWith(cleanQuery)) return 5000 + (cleanQuery.length * 10);

  // Jika target mengandung substring query secara utuh
  const substringIdx = cleanTarget.indexOf(cleanQuery);
  if (substringIdx !== -1) {
    return 3000 - Math.min(substringIdx, 1000) + (cleanQuery.length * 10);
  }

  // Multi-token matching: pisahkan query menjadi kata-kata
  const queryTokens = cleanQuery.split(/[\s,+/_-]+/).filter(Boolean);
  if (queryTokens.length === 0) return 0;

  const targetWords = cleanTarget.split(/[\s,+/_-]+/).filter(Boolean);

  let totalScore = 0;

  for (const token of queryTokens) {
    const tLen = token.length;
    let bestTokenScore = 0;

    // Cek jika seluruh teks target mengandung token secara langsung
    const tokenSubIdx = cleanTarget.indexOf(token);
    if (tokenSubIdx !== -1) {
      bestTokenScore = 1000 - Math.min(tokenSubIdx, 200) + (tLen * 10);
    } else {
      // Cek alias slang lokal
      const mappedToken = INDO_SLANG_MAP[token] || token;

      // Cek terhadap setiap kata di target
      for (const word of targetWords) {
        const wLen = word.length;

        // 1. Prefix match pada kata: misal "skr" pada "scraper"
        if (word.startsWith(token) || word.startsWith(mappedToken)) {
          const score = 800 + (tLen * 5);
          if (score > bestTokenScore) bestTokenScore = score;
          continue;
        }

        // 2. Substring match pada kata
        if (word.includes(token) || word.includes(mappedToken)) {
          const score = 600 + (tLen * 5);
          if (score > bestTokenScore) bestTokenScore = score;
          continue;
        }

        // 3. Subsequence match (misal 'crbon' di 'carbon', 'coton' di 'cotton')
        if (tLen >= 3 && isSubsequence(token, word) && (wLen - tLen) <= 2) {
          const score = 450 + (tLen * 5);
          if (score > bestTokenScore) bestTokenScore = score;
          continue;
        }

        // 4. Typo Tolerance (Levenshtein / Damerau Distance)
        if (tLen >= 3 && wLen >= 3) {
          let maxDist = 1;
          if (tLen >= 6 || wLen >= 6) maxDist = 2;

          const dist = Math.min(
            calculateLevenshteinDistance(token, word),
            calculateLevenshteinDistance(mappedToken, word)
          );

          if (dist <= maxDist) {
            const score = 400 - (dist * 100) + Math.max(0, 50 - Math.abs(tLen - wLen) * 10);
            if (score > bestTokenScore) bestTokenScore = score;
            continue;
          }

          // 5. Normalisasi fonetik ringan / double-letter compression
          const phonetize = (s) => s
            .replace(/(.)\1+/g, '$1') // kompres huruf ganda (tt -> t, oo -> o)
            .replace(/c/g, 'k')       // samakan c dan k
            .replace(/(ai|ay|e)$/g, 'i'); // batre/bateray/baterai -> batri

          const pToken = phonetize(token);
          const pWord = phonetize(word);

          if (pWord === pToken || pWord.includes(pToken) || isSubsequence(pToken, pWord)) {
            const score = 350 + (tLen * 5);
            if (score > bestTokenScore) bestTokenScore = score;
            continue;
          }

          const pDist = calculateLevenshteinDistance(pToken, pWord);
          if (pDist <= maxDist) {
            const score = 300 - (pDist * 80);
            if (score > bestTokenScore) bestTokenScore = score;
          }
        }
      }
    }

    if (bestTokenScore <= 0) {
      return 0;
    }

    totalScore += bestTokenScore;
  }

  return totalScore;
}

function fuzzyMatch(query, targetText) {
  return fuzzyScore(query, targetText) > 0;
}

if (typeof window !== 'undefined') {
  window.exportToCSV = exportToCSV;
  window.generateSKU = generateSKU;
  window.calculateLevenshteinDistance = calculateLevenshteinDistance;
  window.normalizeSearchText = normalizeSearchText;
  window.fuzzyScore = fuzzyScore;
  window.fuzzyMatch = fuzzyMatch;
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
    generateSKU,
    calculateLevenshteinDistance,
    normalizeSearchText,
    fuzzyScore,
    fuzzyMatch
  };
}
