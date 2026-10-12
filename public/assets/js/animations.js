/* ═══════════════════════════════════════════════════
   aQuaStock Pro — animations.js
   Animation engine (entrance, stagger, number ticker)
   ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   ANIMATION ENGINE
   ═══════════════════════════════════════════════ */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animateActivePage() {
  document.querySelectorAll('.page.active .card').forEach((card, i) => {
    card.classList.remove('animate-in', 'stagger-1', 'stagger-2', 'stagger-3', 'stagger-4');
    void card.offsetWidth;
    card.classList.add('animate-in');
    card.classList.add('stagger-' + Math.min(i % 4 + 1, 4));
  });

  document.querySelectorAll('.page.active .card-stat p.text-3xl, .page.active .card-stat p.text-2xl').forEach(function(el) {
    const text = el.textContent.trim();
    if (!/\d/.test(text)) return;
    const num = parseIndonesianNumber(text);
    if (num === 0) return;
    const mult = detectMultiplier(text);
    const prefix = /Rp/i.test(text) ? 'Rp ' : '';
    const suffix = /jt|juta/i.test(text) ? 'jt' : (/rb|ribu/i.test(text) ? 'rb' : '');
    // Bagi dengan multiplier supaya tampil singkat
    const displayNum = num / mult;
    el.classList.add('ticker-glow');
    animateNumber(el, displayNum, 1200, prefix, suffix);
    setTimeout(() => el.classList.remove('ticker-glow'), 900);
  });

  if (window.lucide) lucide.createIcons();
}
