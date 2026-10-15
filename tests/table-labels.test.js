import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(process.cwd(), 'public/assets/js/app.js'), 'utf8');
const labelsStart = appSource.indexOf('const MOBILE_BREAKPOINT = 1024;');
const labelsEnd = appSource.indexOf('/* ═══════════════════════════════════════════════\n   BULK SELECTION', labelsStart);
const initializeTableLabels = new Function(
  'document',
  'window',
  'MutationObserver',
  appSource.slice(labelsStart, labelsEnd)
);

describe('mobile table labels', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('adds header labels to rows rendered after page initialization', async () => {
    document.body.innerHTML = `
      <div class="card">
        <table>
          <thead><tr><th>No. PO</th><th>Supplier</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    initializeTableLabels(document, window, window.MutationObserver);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    document.querySelector('tbody').innerHTML = '<tr><td>PO-001</td><td>Contoh Supplier</td></tr>';
    await new Promise(resolve => setTimeout(resolve, 0));

    const cells = document.querySelectorAll('tbody td');
    expect(cells[0].getAttribute('data-label')).toBe('NO. PO');
    expect(cells[1].getAttribute('data-label')).toBe('SUPPLIER');
  });
});
