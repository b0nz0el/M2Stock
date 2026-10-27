const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const iconsList = [
  'activity', 'alert-circle', 'alert-triangle', 'arrow-down-circle', 'arrow-right',
  'arrow-up-circle', 'banknote', 'bar-chart-3', 'bell', 'calendar', 'calendar-days',
  'check', 'check-check', 'chevron-left', 'chevron-right', 'clipboard-list', 'clock',
  'crown', 'database-backup', 'download', 'eye', 'eye-off', 'factory', 'file-archive',
  'file-text', 'fish', 'history', 'key', 'layers', 'layout-dashboard', 'lightbulb',
  'line-chart', 'list-plus', 'lock', 'log-out', 'mail', 'menu', 'package', 'pause',
  'pencil', 'piggy-bank', 'pill', 'plus', 'printer', 'receipt', 'redo-2', 'refresh-cw',
  'rotate-ccw', 'ruler', 'scroll-text', 'search', 'settings', 'sheet', 'shield-check',
  'shopping-bag', 'shopping-cart', 'smartphone', 'store', 'tag', 'tags', 'thermometer',
  'trash-2', 'trending-down', 'trending-up', 'trophy', 'truck', 'undo-2', 'upload',
  'upload-cloud', 'user-cog', 'user-plus', 'users', 'wallet', 'x'
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/dashboard/');

  const extracted = await page.evaluate((icons) => {
    const toPascal = str => str.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const map = {};
    for (const name of icons) {
      let pascal = toPascal(name);
      let def = window.lucide[pascal];
      if (!def && pascal.endsWith('3') && window.lucide[pascal.replace('3', '')]) {
        def = window.lucide[pascal.replace('3', '')];
      }
      if (def) {
        map[name] = def.map(([tag, attrs]) => {
          const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
          return `<${tag} ${attrStr}></${tag}>`;
        }).join('');
      }
    }
    return map;
  }, iconsList);

  await browser.close();

  const code = `/* ═══════════════════════════════════════════════════
   Aquastock Pro — icons.js
   Local Lucide SVG Subset (${Object.keys(extracted).length} icons)
   ═══════════════════════════════════════════════════ */
(function() {
  const ICONS = ${JSON.stringify(extracted, null, 2)};

  function refreshIcons(root) {
    const container = root && root.querySelectorAll ? root : document;
    const elements = container.querySelectorAll('[data-lucide]');
    elements.forEach(function(el) {
      const name = el.getAttribute('data-lucide');
      const inner = ICONS[name];
      if (!inner) return;

      if (el.tagName.toLowerCase() === 'svg') {
        el.innerHTML = inner;
        const baseClass = (el.getAttribute('class') || '').replace(/\\blucide(-\\S+)?\\b/g, '').trim();
        el.setAttribute('class', ('lucide lucide-' + name + ' ' + baseClass).trim());
        return;
      }

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('width', '24');
      svg.setAttribute('height', '24');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('data-lucide', name);

      const existingClass = el.getAttribute('class') || '';
      const finalClass = ('lucide lucide-' + name + ' ' + existingClass).trim();
      svg.setAttribute('class', finalClass);

      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        if (attr.name !== 'class' && attr.name !== 'data-lucide') {
          svg.setAttribute(attr.name, attr.value);
        }
      }

      svg.innerHTML = inner;
      el.replaceWith(svg);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { refreshIcons(); });
  } else {
    refreshIcons();
  }

  window.refreshIcons = refreshIcons;
  window.lucide = window.lucide || {};
  window.lucide.createIcons = refreshIcons;
})();
`;

  const targetPath = path.resolve(__dirname, '../public/assets/js/icons.js');
  fs.writeFileSync(targetPath, code, 'utf8');
  console.log(`Generated ${targetPath} with ${Object.keys(extracted).length} icons.`);
})();
