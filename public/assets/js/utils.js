/* ═══════════════════════════════════════════════════
   aQuaStock Pro — utils.js
   Helper global (toast, format/parse angka, animasi angka)
   ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════ */
function showToast(msg, type = 'success') {
  const colors = { success: '#34C759', error: '#FF3B30', info: '#0088CC' };
  const container = document.getElementById('toast-container') || document.body;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.gap = '10px';

  const dot = document.createElement('span');
  dot.style.width = '8px';
  dot.style.height = '8px';
  dot.style.background = colors[type] || colors.info;
  dot.style.borderRadius = '50%';
  dot.style.flexShrink = '0';

  const textSpan = document.createElement('span');
  textSpan.style.fontSize = '14px';
  textSpan.style.fontWeight = '500';
  textSpan.textContent = msg;

  wrapper.appendChild(dot);
  wrapper.appendChild(textSpan);
  toast.appendChild(wrapper);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
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

/* Export untuk unit testing (Vitest/Node) tanpa mengganggu browser runtime */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showToast,
    parseIndonesianNumber,
    detectMultiplier,
    animateNumber,
    focusProgrammatically
  };
}
