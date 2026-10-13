import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('mock-actions.js whitelist', () => {
  let toasts = [];

  beforeEach(async () => {
    toasts = [];
    globalThis.showToast = vi.fn((msg, type) => {
      toasts.push({ msg, type });
    });

    // Reset module and document
    document.body.innerHTML = '';
    // Load mock-actions.js into jsdom environment
    await import('../public/assets/js/mock-actions.js');
  });

  afterEach(() => {
    toasts = [];
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('tidak memicu mock toast untuk tombol di dalam #page-suppliers', () => {
    document.body.innerHTML = `
      <div id="page-suppliers">
        <button id="btn-add" data-action="add-supplier">Tambah</button>
        <button id="btn-edit" data-action="edit">Edit</button>
        <button id="btn-del" data-action="delete">Hapus</button>
      </div>
    `;

    document.getElementById('btn-add').click();
    document.getElementById('btn-edit').click();
    document.getElementById('btn-del').click();

    expect(toasts.length).toBe(0);
  });

  it('tidak memicu mock toast untuk tombol di dalam #page-customers', () => {
    document.body.innerHTML = `
      <div id="page-customers">
        <button id="btn-add-cust" data-action="add-customer">Tambah Customer</button>
        <button id="btn-filter" data-action="filter">Filter</button>
      </div>
    `;

    document.getElementById('btn-add-cust').click();
    document.getElementById('btn-filter').click();

    expect(toasts.length).toBe(0);
  });

  it('tidak memicu mock toast untuk tombol di dalam #page-users', () => {
    document.body.innerHTML = `
      <div id="page-users">
        <button id="btn-role" data-action="edit-profile">Ubah Role</button>
      </div>
    `;

    document.getElementById('btn-role').click();

    expect(toasts.length).toBe(0);
  });

  it('tidak memicu mock toast untuk tombol modal (save, cancel, hapus)', () => {
    document.body.innerHTML = `
      <div id="modal-supplier" role="dialog">
        <button id="modal-cancel">Batal</button>
        <button id="modal-save" data-action="add">Simpan Supplier</button>
      </div>
      <div id="modal-delete-supplier" role="dialog">
        <button id="modal-del-confirm" data-action="delete">Hapus</button>
      </div>
    `;

    document.getElementById('modal-cancel').click();
    document.getElementById('modal-save').click();
    document.getElementById('modal-del-confirm').click();

    expect(toasts.length).toBe(0);
  });

  it('tidak memicu mock toast untuk tombol header add-supplier dan add-customer', () => {
    document.body.innerHTML = `
      <header>
        <button id="header-add-sup" data-action="add-supplier">Tambah Supplier</button>
        <button id="header-add-cust" data-action="add-customer">Tambah Customer</button>
      </header>
    `;

    document.getElementById('header-add-sup').click();
    document.getElementById('header-add-cust').click();

    expect(toasts.length).toBe(0);
  });

  it('tetap memicu mock toast untuk tombol mock di halaman yang belum memiliki backend (mis. backup)', () => {
    document.body.innerHTML = `
      <div id="page-backup">
        <button id="btn-backup-import" data-action="import">Import</button>
      </div>
    `;

    document.getElementById('btn-backup-import').click();

    expect(toasts.length).toBe(1);
    expect(toasts[0].msg).toBe('Import file akan segera hadir');
  });

  it('tidak memicu mock toast untuk tombol dengan disabled atau .btn-disabled', () => {
    document.body.innerHTML = `
      <div id="page-backup">
        <button id="btn-backup-now" data-action="backup-now" disabled class="btn-disabled">Backup Sekarang</button>
        <button id="btn-backup-wrap" data-action="history" class="btn-disabled">Riwayat</button>
      </div>
    `;

    document.getElementById('btn-backup-now').click();
    document.getElementById('btn-backup-wrap').click();

    expect(toasts.length).toBe(0);
  });
});
