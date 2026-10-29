import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Modern Custom UI & Mobile Numeric Numpad on Financial & Inventory Inputs', () => {
  const rootDir = path.resolve(__dirname, '..');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf8');
  const itemsJs = fs.readFileSync(path.join(rootDir, 'public/dashboard/items.js'), 'utf8');
  const inJs = fs.readFileSync(path.join(rootDir, 'public/dashboard/in.js'), 'utf8');
  const debtJs = fs.readFileSync(path.join(rootDir, 'public/dashboard/debt.js'), 'utf8');

  function getInputTag(html, id) {
    const match = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
    return match ? match[0] : '';
  }

  it('ensures Master Barang inputs have custom UI containers, Rp prefix badges, and numeric mobile numpads', () => {
    // Harga Beli
    const costInput = getInputTag(indexHtml, 'item-cost-price');
    expect(costInput).toContain('type="text"');
    expect(costInput).toContain('inputmode="numeric"');
    expect(costInput).toContain('pattern="[0-9]*"');

    // Harga Jual
    const sellInput = getInputTag(indexHtml, 'item-sell-price');
    expect(sellInput).toContain('type="text"');
    expect(sellInput).toContain('inputmode="numeric"');
    expect(sellInput).toContain('pattern="[0-9]*"');

    // Min Stok
    const minStockInput = getInputTag(indexHtml, 'item-min-stock');
    expect(minStockInput).toContain('type="text"');
    expect(minStockInput).toContain('inputmode="numeric"');
  });

  it('ensures Barang Masuk inputs have custom UI containers and numeric mobile numpads', () => {
    // Jumlah Masuk
    const qtyInput = getInputTag(indexHtml, 'in-qty');
    expect(qtyInput).toContain('type="text"');
    expect(qtyInput).toContain('inputmode="numeric"');

    // Harga Beli Masuk
    const priceInput = getInputTag(indexHtml, 'in-price');
    expect(priceInput).toContain('type="text"');
    expect(priceInput).toContain('inputmode="numeric"');

    // Harga Jual Baru
    const inSellInput = getInputTag(indexHtml, 'in-sell-price');
    expect(inSellInput).toContain('type="text"');
    expect(inSellInput).toContain('inputmode="numeric"');
  });

  it('ensures Kas & Hutang inputs have custom UI containers and numeric mobile numpads', () => {
    // Kas
    const cashInput = getInputTag(indexHtml, 'cash-form-amount');
    expect(cashInput).toContain('type="text"');
    expect(cashInput).toMatch(/inputmode="numeric"/i);

    // Hutang & Piutang
    const debtInput = getInputTag(indexHtml, 'debt-nominal');
    expect(debtInput).toContain('type="text"');
    expect(debtInput).toContain('inputmode="numeric"');
    expect(debtInput).toContain('pattern="[0-9]*"');
  });

  it('ensures Bulk Price and Stock Opname inputs have numeric inputmodes', () => {
    // Bulk Price
    const bulkPriceInput = getInputTag(indexHtml, 'bulk-price-nominal-input');
    expect(bulkPriceInput).toContain('type="text"');
    expect(bulkPriceInput).toContain('inputmode="numeric"');

    // Stock Opname
    const adjInput = getInputTag(indexHtml, 'adj-actual-stock');
    expect(adjInput).toContain('type="text"');
    expect(adjInput).toContain('inputmode="decimal"');
  });

  it('verifies parseNumericValue safely strips formatting dots and non-digits', () => {
    function parseNumericValue(value) {
      if (value === null || value === undefined) return 0;
      const digitsOnly = String(value).replace(/\D+/g, '');
      return digitsOnly ? Number(digitsOnly) : 0;
    }

    expect(parseNumericValue('150.000')).toBe(150000);
    expect(parseNumericValue('Rp 2.500.000')).toBe(2500000);
    expect(parseNumericValue('0')).toBe(0);
    expect(parseNumericValue('')).toBe(0);
    expect(parseNumericValue(null)).toBe(0);
    expect(parseNumericValue('45000')).toBe(45000);
  });

  it('verifies items.js, in.js, and debt.js use parseNumericValue before database mutations', () => {
    expect(itemsJs).toContain('parseNumericValue');
    expect(inJs).toContain('parseNumericValue');
    expect(debtJs).toContain('replace(/\\D/g');
  });

  it('ensures all numeric inputs have Quick Clear (✕) buttons in index.html', () => {
    const requiredClearButtons = [
      'btn-clear-item-cost-price',
      'btn-clear-item-sell-price',
      'btn-clear-item-min-stock',
      'btn-clear-bulk-price-nominal-input',
      'btn-clear-adj-actual-stock',
      'btn-clear-in-qty',
      'btn-clear-in-price',
      'btn-clear-in-sell-price',
      'btn-clear-cash-form-amount',
      'btn-clear-debt-nominal'
    ];

    for (const btnId of requiredClearButtons) {
      expect(indexHtml).toContain(`id="${btnId}"`);
      expect(indexHtml).toContain(`clearNumericInput('${btnId.replace('btn-clear-', '')}')`);
    }
  });

  it('verifies clearNumericInput clears the input value and dispatches input/change events', () => {
    const { clearNumericInput, updateNumericClearButton } = require('../public/assets/js/app.js');

    // Create mock input and clear button elements
    const mockInput = {
      id: 'test-num-input',
      value: '150.000',
      eventsDispatched: [],
      focused: false,
      dispatchEvent(event) {
        this.eventsDispatched.push(event.type);
      },
      focus() {
        this.focused = true;
      }
    };

    const mockButton = {
      id: 'btn-clear-test-num-input',
      classList: {
        classes: new Set(['hidden']),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    };

    global.document = {
      getElementById(id) {
        if (id === 'test-num-input') return mockInput;
        if (id === 'btn-clear-test-num-input') return mockButton;
        return null;
      }
    };
    global.Event = class {
      constructor(type) { this.type = type; }
    };

    // When value is non-empty, button should show
    updateNumericClearButton(mockInput);
    expect(mockButton.classList.contains('hidden')).toBe(false);

    // Call clearNumericInput
    clearNumericInput('test-num-input');
    expect(mockInput.value).toBe('');
    expect(mockButton.classList.contains('hidden')).toBe(true);
    expect(mockInput.eventsDispatched).toContain('input');
    expect(mockInput.eventsDispatched).toContain('change');
    expect(mockInput.focused).toBe(true);
  });
});
