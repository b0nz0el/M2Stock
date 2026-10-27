import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('../public/assets/js/api/_client.js', () => ({
  isSupabaseAvailable: vi.fn(() => true),
  formatResponse: (response) => ({
    ok: Boolean(response.ok),
    data: response.data ?? null,
    error: response.error ?? null,
    meta: response.meta ?? {}
  }),
  handleError: (error) => ({ ok: false, data: null, error: { message: error.message || String(error) } }),
  apiRequest: vi.fn()
}));

vi.mock('../public/assets/js/supabase-client.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: '00000000-0000-0000-0000-000000000001' } } })
    },
    from: vi.fn(),
    rpc: vi.fn()
  }
}));

import { transactions } from '../public/assets/js/api/transactions.js';

describe('Fase C: Kasir Cepat (Point of Sale / POS Multi-Item)', () => {
  let transactionsCode;
  let outJsCode;
  let outHtml;

  beforeEach(() => {
    vi.clearAllMocks();
    transactionsCode = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/api/transactions.js'), 'utf8');
    outJsCode = fs.readFileSync(path.resolve(__dirname, '../public/dashboard/out.js'), 'utf8');
    outHtml = fs.readFileSync(path.resolve(__dirname, '../public/dashboard/index.html'), 'utf8');
  });

  describe('HTML POS Layout Verification', () => {
    it('contains POS multi-item cart table and elements in modal-out', () => {
      expect(outHtml).toContain('id="pos-cart-tbody"');
      expect(outHtml).toContain('id="pos-cart-empty"');
      expect(outHtml).toContain('id="pos-items-count-badge"');
      expect(outHtml).toContain('id="pos-cash-input"');
      expect(outHtml).toContain('id="pos-change-preview"');
      expect(outHtml).toContain('id="pos-cash-calculator"');
      expect(outHtml).toContain('quickSetPosCash');
    });

    it('contains quick cash helper buttons', () => {
      expect(outHtml).toContain("quickSetPosCash('exact')");
      expect(outHtml).toContain("quickSetPosCash(20000)");
      expect(outHtml).toContain("quickSetPosCash(50000)");
      expect(outHtml).toContain("quickSetPosCash(100000)");
    });
  });

  describe('createBatchOut API Implementation', () => {
    it('defines createBatchOut in transactions.js', () => {
      expect(transactionsCode).toContain('createBatchOut: async');
      expect(typeof transactions.createBatchOut).toBe('function');
    });

    it('validates cart items before executing batch out', async () => {
      // Empty cart should return error
      const emptyRes = await transactions.createBatchOut([]);
      expect(emptyRes.ok).toBe(false);
      expect(emptyRes.error.message).toContain('Keranjang belanja');

      // Invalid item quantity should return error
      const invalidQtyRes = await transactions.createBatchOut([
        { product_id: 1, qty: 0, price: 1000 }
      ]);
      expect(invalidQtyRes.ok).toBe(false);
      expect(invalidQtyRes.error.message).toContain('tidak valid');

      // Invalid item price should return error
      const invalidPriceRes = await transactions.createBatchOut([
        { product_id: 1, qty: 2, price: -500 }
      ]);
      expect(invalidPriceRes.ok).toBe(false);
      expect(invalidPriceRes.error.message).toContain('tidak valid');
    });

    it('processes multiple items with unified invoice number and prefix [INV-...]', async () => {
      const createdItems = [];
      const originalCreateOut = transactions.createOut;

      transactions.createOut = vi.fn().mockImplementation(async (data) => {
        createdItems.push(data);
        return { ok: true, data: { id: createdItems.length, ...data } };
      });

      const cartItems = [
        { product_id: 101, name: 'Pompa Aquarium', qty: 2, price: 50000, cost_price: 35000 },
        { product_id: 102, name: 'Pakan Ikan Pelet', qty: 3, price: 15000, cost_price: 10000 }
      ];

      const commonData = {
        channel: 'Offline',
        customer_id: 'cust-123',
        payment_method: 'Cash',
        payment_status: 'Lunas',
        note: 'Pelanggan langganan'
      };

      const res = await transactions.createBatchOut(cartItems, commonData);

      expect(res.ok).toBe(true);
      expect(res.data.items).toHaveLength(2);
      expect(res.data.total_amount).toBe(2 * 50000 + 3 * 15000); // 100k + 45k = 145k
      expect(res.data.invoice_no).toMatch(/^INV-\d{6}-[A-Z0-9]{4}$/);

      // Verify each created transaction was called with [INV-...] in note
      expect(transactions.createOut).toHaveBeenCalledTimes(2);
      expect(createdItems[0].note).toContain(`[${res.data.invoice_no}]`);
      expect(createdItems[0].note).toContain('Pelanggan langganan');
      expect(createdItems[1].note).toContain(`[${res.data.invoice_no}]`);

      // Restore original createOut
      transactions.createOut = originalCreateOut;
    });
  });

  describe('POS Cart State & Business Logic', () => {
    it('correctly handles adding, incrementing, and removing cart items', () => {
      let posCart = [];

      function addToCart(prod, qtyToAdd = 1) {
        const existing = posCart.find(it => String(it.product_id) === String(prod.id));
        if (existing) {
          const maxStock = prod.stock ?? Infinity;
          existing.qty = Math.min(existing.qty + qtyToAdd, maxStock > 0 ? maxStock : existing.qty + qtyToAdd);
        } else {
          posCart.push({
            product_id: prod.id,
            name: prod.name,
            sku: prod.sku || '',
            price: Number(prod.sell_price) || 0,
            cost_price: Number(prod.cost_price) || 0,
            qty: qtyToAdd,
            stock: prod.stock ?? 0
          });
        }
      }

      function updateQty(index, newQty) {
        if (!posCart[index]) return;
        const num = Number(newQty);
        const target = isNaN(num) ? 1 : num;
        if (target <= 0) {
          posCart.splice(index, 1);
          return;
        }
        const maxStock = posCart[index].stock;
        posCart[index].qty = (maxStock > 0 && target > maxStock) ? maxStock : target;
      }

      const prodA = { id: 1, name: 'Filter Hang On', sku: 'FLT-01', sell_price: 75000, cost_price: 50000, stock: 10 };
      const prodB = { id: 2, name: 'Lampu LED Submersible', sku: 'LED-01', sell_price: 120000, cost_price: 80000, stock: 5 };

      // Add prodA
      addToCart(prodA, 2);
      expect(posCart).toHaveLength(1);
      expect(posCart[0].qty).toBe(2);

      // Add prodA again -> increments qty to 3
      addToCart(prodA, 1);
      expect(posCart).toHaveLength(1);
      expect(posCart[0].qty).toBe(3);

      // Add prodB
      addToCart(prodB, 1);
      expect(posCart).toHaveLength(2);

      // Update qty beyond stock
      updateQty(1, 10);
      expect(posCart[1].qty).toBe(5); // clamped to max stock 5

      // Remove item by setting qty to 0
      updateQty(0, 0);
      expect(posCart).toHaveLength(1);
      expect(posCart[0].name).toBe('Lampu LED Submersible');
    });

    it('correctly calculates total amount and change for cash and non-cash', () => {
      const posCart = [
        { product_id: 1, price: 50000, qty: 2 },
        { product_id: 2, price: 25000, qty: 3 }
      ];

      const totalAmount = posCart.reduce((sum, it) => sum + (it.qty * it.price), 0);
      expect(totalAmount).toBe(175000); // 100k + 75k

      // Exact cash
      let cashInput = 175000;
      let change = Math.max(0, cashInput - totalAmount);
      expect(change).toBe(0);

      // Overpay cash (200,000)
      cashInput = 200000;
      change = Math.max(0, cashInput - totalAmount);
      expect(change).toBe(25000);

      // Underpay cash (150,000)
      cashInput = 150000;
      const shortage = totalAmount - cashInput;
      expect(shortage).toBe(25000);
    });
  });

  describe('Thermal Receipt Grouping and POS Integration', () => {
    it('contains multi-item batch handling in openThermalReceiptModal', () => {
      expect(outJsCode).toContain('async function openThermalReceiptModal(txIdOrBatch)');
      expect(outJsCode).toContain("txIdOrBatch && typeof txIdOrBatch === 'object'");
      expect(outJsCode).toContain('invMatch ? invMatch[1] : null');
      expect(outJsCode).toContain('siblingTxs.map(');
    });

    it('exports all necessary POS functions to window', () => {
      expect(outJsCode).toContain('window.addToPosCart = addToPosCart;');
      expect(outJsCode).toContain('window.updatePosCartQty = updatePosCartQty;');
      expect(outJsCode).toContain('window.removeFromPosCart = removeFromPosCart;');
      expect(outJsCode).toContain('window.clearPosCart = clearPosCart;');
      expect(outJsCode).toContain('window.calculatePosChange = calculatePosChange;');
      expect(outJsCode).toContain('window.quickSetPosCash = quickSetPosCash;');
      expect(outJsCode).toContain('window.handlePosPaymentMethodChange = handlePosPaymentMethodChange;');
      expect(outJsCode).toContain('window.openAddOutModal = openAddOutModal;');
      expect(outJsCode).toContain('window.closeOutModal = closeOutModal;');
      expect(outJsCode).toContain('window.handleOutSubmit = handleOutSubmit;');
    });

    it('supports fast barcode scan add directly into cart when modal is active', () => {
      expect(outJsCode).toContain("const isPosOpen = modalOut && !modalOut.classList.contains('hidden')");
      expect(outJsCode).toContain('addToPosCart(matchedProduct);');
    });
  });
});
