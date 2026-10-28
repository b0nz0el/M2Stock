import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const suppliersScript = readFileSync(resolve(process.cwd(), 'public/dashboard/suppliers.js'), 'utf8');

describe('Supplier edit flow', () => {
  afterEach(() => {
    delete window.Api;
    delete window.RBAC;
    delete window.showToast;
    document.body.innerHTML = '';
  });

  it('opens and saves a supplier with a UUID identifier', async () => {
    const supplier = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Supplier Awal',
      phone: '08123456789',
      address: 'Jakarta',
      is_active: true
    };
    document.body.innerHTML = `
      <div id="metric-total-suppliers"></div>
      <div id="metric-active-suppliers"></div>
      <div id="metric-inactive-suppliers"></div>
      <div id="suppliers-pagination-wrap"></div>
      <div id="suppliers-pagination-buttons"></div>
      <div id="suppliers-pagination-info"></div>
      <table><tbody id="suppliers-table-body"></tbody></table>
      <div id="modal-supplier" class="hidden">
        <h2 id="modal-supplier-title"></h2>
        <form id="form-supplier">
          <input id="supplier-id">
          <input id="supplier-name">
          <input id="supplier-phone">
          <textarea id="supplier-address"></textarea>
          <select id="supplier-status">
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
          <button id="btn-save-supplier"></button>
        </form>
      </div>
    `;
    const update = vi.fn().mockResolvedValue({ ok: true, data: supplier });
    window.Api = {
      suppliers: {
        getAll: vi.fn().mockResolvedValue({ ok: true, data: [supplier] }),
        update
      }
    };
    window.RBAC = { getUserRole: vi.fn().mockResolvedValue('OWNER') };
    window.showToast = vi.fn();

    window.eval(suppliersScript);
    await window.loadSuppliers();

    const editButton = document.querySelector('[data-supplier-action="edit"]');
    expect(editButton.dataset.supplierId).toBe(supplier.id);
    editButton.click();
    expect(document.getElementById('supplier-id').value).toBe(supplier.id);
    expect(document.getElementById('supplier-name').value).toBe(supplier.name);

    document.getElementById('supplier-name').value = 'Supplier Diperbarui';
    await window.handleSupplierSubmit({ preventDefault: vi.fn() });

    expect(update).toHaveBeenCalledWith(supplier.id, {
      name: 'Supplier Diperbarui',
      phone: supplier.phone,
      address: supplier.address,
      is_active: true
    });
    expect(window.showToast).toHaveBeenCalledWith('Supplier berhasil diperbarui', 'success');
  });
});
