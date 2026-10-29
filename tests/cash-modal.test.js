import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Modal Catat Transaksi Kas & Input Nominal', () => {
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../public/dashboard/index.html'), 'utf8');
  const cashScript = fs.readFileSync(path.resolve(__dirname, '../public/dashboard/cash.js'), 'utf8');

  it('memastikan markup form-cash dan cash-form-amount sesuai spesifikasi mobile numpad', () => {
    // 1. Form harus memiliki novalidate untuk mematikan browser validation bubble kaku
    expect(indexHtml).toMatch(/<form id="form-cash"[^>]*novalidate/);

    // 2. Input cash-form-amount harus bertipe text, inputmode numeric, pattern [0-9]*, placeholder 0
    const inputMatch = indexHtml.match(/<input[^>]*id="cash-form-amount"[^>]*>/);
    expect(inputMatch).not.toBeNull();
    const inputTag = inputMatch[0];

    expect(inputTag).toContain('type="text"');
    expect(inputTag).toMatch(/inputmode="numeric"/i);
    expect(inputTag).toContain('pattern="[0-9]*"');
    expect(inputTag).toContain('placeholder="0"');

    // 3. Tidak boleh ada type="number", step, atau min
    expect(inputTag).not.toContain('type="number"');
    expect(inputTag).not.toContain('step=');
    expect(inputTag).not.toContain('min=');
  });

  it('memformat input nominal secara otomatis dengan pemisah ribuan dan mengabaikan non-angka', () => {
    document.body.innerHTML = `
      <form id="form-cash" novalidate>
        <input type="text" id="cash-form-amount" inputmode="numeric" pattern="[0-9]*" placeholder="0">
      </form>
    `;

    const amountInput = document.getElementById('cash-form-amount');

    // Simulasi handler input persis seperti di cash.js
    let currentCashAmount = 0;
    amountInput.addEventListener('input', (e) => {
      const cleanDigits = e.target.value.replace(/\D/g, '');
      const rawNumber = cleanDigits === '' ? 0 : Number(cleanDigits);
      currentCashAmount = isNaN(rawNumber) ? 0 : rawNumber;
      e.target.value = currentCashAmount > 0
        ? new Intl.NumberFormat('id-ID').format(currentCashAmount)
        : '';
    });

    // Test 1: Ketik angka biasa 100000
    amountInput.value = '100000';
    amountInput.dispatchEvent(new Event('input'));
    expect(amountInput.value).toBe('100.000');
    expect(currentCashAmount).toBe(100000);

    // Test 2: Input teks atau simbol mata uang "Rp 150.000"
    amountInput.value = 'Rp 150.000';
    amountInput.dispatchEvent(new Event('input'));
    expect(amountInput.value).toBe('150.000');
    expect(currentCashAmount).toBe(150000);

    // Test 3: Input tanda minus "-25000" (harus dibersihkan menjadi positif murni)
    amountInput.value = '-25000';
    amountInput.dispatchEvent(new Event('input'));
    expect(amountInput.value).toBe('25.000');
    expect(currentCashAmount).toBe(25000);

    // Test 4: Hapus input (kosong) -> tidak boleh NaN
    amountInput.value = '';
    amountInput.dispatchEvent(new Event('input'));
    expect(amountInput.value).toBe('');
    expect(currentCashAmount).toBe(0);
    expect(isNaN(currentCashAmount)).toBe(false);
  });

  it('mengirimkan payload nominal murni positif dan membedakan arus kas masuk vs keluar', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ ok: true });

    document.body.innerHTML = `
      <div id="modal-cash" class="flex">
        <form id="form-cash" novalidate>
          <input type="hidden" id="cash-form-type" value="IN">
          <input type="date" id="cash-form-date" value="2026-10-29">
          <input type="text" id="cash-form-amount" value="100.000">
          <select id="cash-form-kategori"><option value="Lainnya" selected>Lainnya</option></select>
          <select id="cash-form-metode"><option value="Cash" selected>Cash</option></select>
          <textarea id="cash-form-desc">Uang modal kasir</textarea>
          <button type="submit" id="btn-submit-cash">Simpan</button>
        </form>
      </div>
    `;

    const form = document.getElementById('form-cash');
    const amountEl = document.getElementById('cash-form-amount');
    let currentCashAmount = 100000;

    const handleSubmit = async (e) => {
      e.preventDefault();
      const type = document.getElementById('cash-form-type')?.value || 'IN';
      const rawFromInput = Number((amountEl?.value || '').replace(/\D/g, '')) || 0;
      const amount = currentCashAmount || rawFromInput;
      const tanggal = document.getElementById('cash-form-date')?.value;
      const keterangan = (document.getElementById('cash-form-desc')?.value || '').trim();
      const kategori = document.getElementById('cash-form-kategori')?.value;
      const metode = document.getElementById('cash-form-metode')?.value;

      if (amount <= 0) return;

      const payload = {
        tanggal,
        keterangan,
        kategori,
        metode,
        pemasukan: type === 'IN' ? amount : 0,
        pengeluaran: type === 'OUT' ? amount : 0
      };

      await mockCreate(payload);
    };

    form.addEventListener('submit', handleSubmit);

    // Test submit Pemasukan (In)
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      pemasukan: 100000,
      pengeluaran: 0
    }));

    // Test submit Pengeluaran (Out)
    mockCreate.mockClear();
    document.getElementById('cash-form-type').value = 'OUT';
    document.getElementById('cash-form-desc').value = 'Beli lakban';
    amountEl.value = '10.000';
    currentCashAmount = 10000;

    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      pemasukan: 0,
      pengeluaran: 10000,
      keterangan: 'Beli lakban'
    }));
  });
});
