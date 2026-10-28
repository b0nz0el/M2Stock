import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const outScript = readFileSync(resolve(process.cwd(), 'public/dashboard/out.js'), 'utf8');

describe('Barang Keluar delete modal', () => {
  afterEach(() => {
    delete window.Api;
    delete window.RBAC;
    delete window.showToast;
    document.body.innerHTML = '';
  });

  it('exposes the inline modal handlers and deletes the selected transaction', async () => {
    document.body.innerHTML = `
      <div id="modal-delete-out" class="hidden"></div>
      <button id="btn-confirm-delete-out"><span>Hapus</span></button>
    `;
    window.Api = {
      transactions: {
        delete: vi.fn().mockResolvedValue({ ok: true, data: { success: true } }),
        getByType: vi.fn().mockResolvedValue({ ok: true, data: [] })
      },
      items: { getAll: vi.fn().mockResolvedValue({ ok: true, data: [] }) },
      customers: { getAll: vi.fn().mockResolvedValue({ ok: true, data: [] })
      }
    };
    window.RBAC = { getUserRole: vi.fn().mockResolvedValue('OWNER') };
    window.showToast = vi.fn();

    window.eval(outScript);
    window.openDeleteOutModal('transaction-123');
    await window.confirmDeleteOut();

    expect(window.Api.transactions.delete).toHaveBeenCalledWith('transaction-123');
    expect(window.showToast).toHaveBeenCalledWith(
      'Transaksi berhasil dihapus & stok dikembalikan',
      'success'
    );
    expect(document.getElementById('modal-delete-out').classList.contains('hidden')).toBe(true);
  });
});
