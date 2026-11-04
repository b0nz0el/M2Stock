import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Purchase Order Search Engine Combobox & Typo Search Contract', () => {
  const rootDir = process.cwd();
  const poJs = fs.readFileSync(path.join(rootDir, 'public/dashboard/po.js'), 'utf8');
  const itemsJs = fs.readFileSync(path.join(rootDir, 'public/dashboard/items.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
  const componentsCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/components.css'), 'utf8');

  it('memastikan createItemRow di po.js menggunakan input search engine combobox dual-state', () => {
    expect(poJs).toContain('item-search-input');
    expect(poJs).toContain('po-search-state');
    expect(poJs).toContain('po-selected-state');
    expect(poJs).toContain('btn-change-item');
    expect(poJs).toContain('btn-clear-selection');
    expect(poJs).toContain('po-floating-search-dropdown');
    expect(poJs).toContain('openPoDropdown');
    expect(poJs).toContain('closePoDropdown');
    expect(poJs).toContain('selectProductInRow');
  });

  it('memastikan PO Combobox mendukung keyboard navigation dan integrasi fuzzy matching', () => {
    expect(poJs).toContain("e.key === 'ArrowDown'");
    expect(poJs).toContain("e.key === 'ArrowUp'");
    expect(poJs).toContain("e.key === 'Enter'");
    expect(poJs).toContain("e.key === 'Escape'");
    expect(poJs).toContain('fuzzyScore');
  });

  it('memastikan sinkronisasi ke selectEl untuk kompatibilitas penuh handleSubmitForm', () => {
    expect(poJs).toContain('const selectEl = row.querySelector(\'.item-select\');');
    expect(poJs).toContain('selectEl.dispatchEvent(new Event(\'change\', { bubbles: true }));');
    expect(poJs).toContain('handleSubmitForm');
    expect(poJs).toContain('row._updateRowSubtotal');
  });

  it('memastikan input search-items dan global-search mematikan browser autofill popup', () => {
    expect(indexHtml).toMatch(/id="search-items"[^>]*autocomplete="off"/);
    expect(indexHtml).toMatch(/id="search-items"[^>]*autocorrect="off"/);
    expect(indexHtml).toMatch(/id="search-items"[^>]*spellcheck="false"/);

    expect(indexHtml).toMatch(/id="global-search"[^>]*autocomplete="off"/);
  });

  it('memastikan filterItems di items.js menggunakan fuzzyScore dengan relevansi ranking', () => {
    expect(itemsJs).toContain('window.fuzzyScore');
    expect(itemsJs).toContain('item._searchScore = score;');
    expect(itemsJs).toContain('const scoreDiff = (b._searchScore || 0) - (a._searchScore || 0);');
  });

  it('memastikan styling dropdown elevated dan scrollbar tersedia di components.css', () => {
    expect(componentsCss).toContain('#po-floating-search-dropdown');
    expect(componentsCss).toContain('.po-dropdown-item.is-highlighted');
  });
});
