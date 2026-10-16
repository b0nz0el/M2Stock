(function () {
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const MAX_ROWS = 2000;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const source = String(text || '').replace(/^\uFEFF/, '');

    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (character === '"' && source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          cell += character;
        }
      } else if (character === '"' && cell === '') {
        quoted = true;
      } else if (character === ',') {
        row.push(cell);
        cell = '';
      } else if (character === '\n' || character === '\r') {
        if (character === '\r' && source[index + 1] === '\n') index += 1;
        row.push(cell);
        if (row.some(value => value.trim() !== '')) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += character;
      }
    }
    if (quoted) throw new Error('CSV memiliki tanda kutip yang tidak berpasangan.');
    row.push(cell);
    if (row.some(value => value.trim() !== '')) rows.push(row);
    return rows;
  }

  function showToast(message, type) {
    if (typeof window.showToast === 'function') window.showToast(message, type);
  }

  function downloadTemplate(config) {
    if (typeof window.exportToCSV !== 'function') {
      showToast('Fitur unduh template belum siap. Muat ulang halaman dan coba lagi.', 'error');
      return;
    }
    window.exportToCSV(config.templateName, config.templateRows || [], config.headers, { allowEmpty: true });
  }

  function isValidIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function openInitialModal(config) {
    document.getElementById('csv-import-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'csv-import-modal';
    modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm';

    const reqSet = new Set((config.requiredHeaders || []).map(h => h.toLowerCase()));
    const sampleHeaders = config.headers || [];
    const sampleRows = config.templateRows && config.templateRows.length ? config.templateRows : [];

    const tableHeadersHtml = sampleHeaders.map(h => {
      const isReq = reqSet.has(h.toLowerCase());
      return `
        <th class="whitespace-nowrap px-3.5 py-2.5 text-[11px] font-semibold text-[#A0A0A5]">
          <div class="flex items-center gap-1.5">
            <span class="text-white">${escapeHtml(h)}</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded font-medium ${isReq ? 'bg-[#FF453A]/20 text-[#FF8A84]' : 'bg-white/10 text-[#A0A0A5]'}">
              ${isReq ? 'Wajib' : 'Opsional'}
            </span>
          </div>
        </th>
      `;
    }).join('');

    const tableRowsHtml = sampleRows.length ? sampleRows.map((row) => {
      const cells = Array.isArray(row) ? row : Object.values(row);
      return `
        <tr class="border-b border-white/5 hover:bg-white/[0.02]">
          ${cells.map(val => `<td class="px-3.5 py-2 text-xs text-[#D1D1D6] whitespace-nowrap font-mono">${escapeHtml(val || '-')}</td>`).join('')}
        </tr>
      `;
    }).join('') : `
      <tr>
        <td colspan="${sampleHeaders.length}" class="px-3.5 py-4 text-center text-xs text-[#A0A0A5]">Belum ada contoh data.</td>
      </tr>
    `;

    const instructionsHtml = (config.instructions && config.instructions.length) ? `
      <div class="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs space-y-2">
        <div class="flex items-center gap-2 text-white font-semibold">
          <i data-lucide="info" class="w-4 h-4 text-[#32ADE6]"></i>
          <span>Petunjuk & Aturan Pengisian:</span>
        </div>
        <ul class="list-disc list-inside space-y-1 text-[#A0A0A5] pl-1 leading-relaxed">
          ${config.instructions.map(ins => `<li>${escapeHtml(ins)}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    modal.innerHTML = `
      <section class="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-labelledby="csv-import-title">
        <header class="flex items-center justify-between border-b border-white/10 px-5 py-4 flex-shrink-0">
          <div>
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-lg bg-[#0088CC]/20 text-[#32ADE6]">
                <i data-lucide="file-spreadsheet" class="w-5 h-5"></i>
              </span>
              <h2 id="csv-import-title" class="text-base font-semibold text-white">Import ${escapeHtml(config.title)}</h2>
            </div>
            <p class="mt-1 text-xs text-[#A0A0A5]">Format file .CSV dan contoh baris data untuk impor massal.</p>
          </div>
          <button type="button" data-close-import aria-label="Tutup" class="rounded-lg p-2 text-[#A0A0A5] hover:bg-white/5 hover:text-white transition">
            <i data-lucide="x" class="h-5 w-5" aria-hidden="true"></i>
          </button>
        </header>

        <div class="space-y-4 overflow-y-auto p-5 flex-1 max-h-[calc(92vh-140px)]">
          <!-- Dropzone Area -->
          <div id="csv-dropzone" class="border-2 border-dashed border-white/15 hover:border-[#0088CC] bg-white/[0.02] hover:bg-[#0088CC]/5 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group">
            <div class="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-[#0088CC]/20 flex items-center justify-center text-[#A0A0A5] group-hover:text-[#32ADE6] transition">
              <i data-lucide="upload-cloud" class="w-6 h-6"></i>
            </div>
            <p class="text-sm font-medium text-white">Tarik & letakkan file <span class="text-[#32ADE6]">.CSV</span> di sini, atau klik untuk memilih file</p>
            <p class="text-xs text-[#A0A0A5]">Format CSV (UTF-8), pemisah koma, maksimal ${MAX_ROWS} baris (5 MB)</p>
            <input type="file" id="csv-hidden-file-input" accept=".csv,text/csv" class="hidden">
          </div>

          <!-- Contoh Format Table Card -->
          <div class="rounded-2xl border border-white/10 bg-[#161618] overflow-hidden">
            <div class="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <i data-lucide="table" class="w-4 h-4 text-[#32ADE6]"></i>
                <span class="text-xs font-semibold text-white uppercase tracking-wider">Contoh Format Data di CSV</span>
              </div>
              <span class="text-[11px] text-[#32ADE6] font-medium">Kolom wajib bertanda merah</span>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-left">
                <thead class="bg-white/5 border-b border-white/10">
                  <tr>${tableHeadersHtml}</tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  ${tableRowsHtml}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Petunjuk Khusus -->
          ${instructionsHtml}
        </div>

        <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 flex-shrink-0 bg-[#19191B]">
          <button type="button" data-download-template class="rounded-xl border border-white/10 hover:border-[#32ADE6]/40 px-3.5 py-2 text-xs font-medium text-white hover:bg-white/5 flex items-center gap-2 transition">
            <i data-lucide="download" class="w-4 h-4 text-[#32ADE6]"></i>
            <span>Unduh Template CSV (+ Contoh)</span>
          </button>
          <div class="ml-auto flex gap-2">
            <button type="button" data-close-import class="rounded-xl bg-white/5 px-4 py-2 text-xs font-medium text-white hover:bg-white/10 transition">Batal</button>
            <button type="button" id="btn-trigger-picker" class="rounded-xl bg-[#0088CC] hover:bg-[#0077BB] px-4 py-2 text-xs font-semibold text-white flex items-center gap-2 shadow-lg shadow-[#0088CC]/20 transition">
              <i data-lucide="folder-open" class="w-4 h-4"></i>
              <span>Pilih File CSV</span>
            </button>
          </div>
        </footer>
      </section>
    `;

    document.body.appendChild(modal);
    window.refreshIcons?.(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close-import]').forEach(b => b.addEventListener('click', close));
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.querySelector('[data-download-template]').addEventListener('click', () => downloadTemplate(config));

    const fileInput = modal.querySelector('#csv-hidden-file-input');
    const dropzone = modal.querySelector('#csv-dropzone');
    const triggerBtn = modal.querySelector('#btn-trigger-picker');

    triggerBtn.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-[#0088CC]', 'bg-[#0088CC]/10');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-[#0088CC]', 'bg-[#0088CC]/10');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-[#0088CC]', 'bg-[#0088CC]/10');
      const file = e.dataTransfer?.files?.[0];
      if (file) handleProcessSelectedFile(config, file, modal);
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) handleProcessSelectedFile(config, file, modal);
    });
  }

  async function handleProcessSelectedFile(config, file, initialModal) {
    if (!file) return;
    try {
      if (file.size > MAX_FILE_SIZE) throw new Error('Ukuran file maksimal 5 MB.');
      const parsedRows = parseCsv(await file.text());
      if (parsedRows.length < 2) throw new Error('CSV harus berisi header dan minimal satu baris data.');
      if (parsedRows.length - 1 > MAX_ROWS) throw new Error(`Maksimal ${MAX_ROWS} baris per file.`);

      const csvHeaders = parsedRows[0].map(header => header.trim().toLowerCase());
      if (new Set(csvHeaders).size !== csvHeaders.length) throw new Error('CSV memiliki nama kolom yang berulang.');
      if (parsedRows.slice(1).some(cells => cells.length > csvHeaders.length)) {
        throw new Error('Ada baris CSV dengan kolom tambahan. Periksa pemisah koma atau tanda kutip.');
      }
      const missing = config.requiredHeaders
        .filter(header => !csvHeaders.includes(header.toLowerCase()));
      if (missing.length) throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(', ')}. Unduh template untuk format yang benar.`);

      const records = parsedRows.slice(1).map(cells => {
        const record = {};
        config.headers.forEach(header => {
          const columnIndex = csvHeaders.indexOf(header.toLowerCase());
          record[header] = columnIndex >= 0 ? String(cells[columnIndex] ?? '').trim() : '';
        });
        return record;
      });
      const validation = await config.validate(records);
      if (!validation || !Array.isArray(validation.errors) || !Array.isArray(validation.rows)) {
        throw new Error('Validasi file gagal menghasilkan hasil yang benar.');
      }

      initialModal?.remove();

      if (config.preventReimport && !window.crypto?.subtle) {
        throw new Error('Browser tidak mendukung verifikasi file import. Gunakan browser terbaru melalui HTTPS.');
      }
      const fileHash = config.preventReimport
        ? Array.from(new Uint8Array(await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer())))
          .map(byte => byte.toString(16).padStart(2, '0')).join('')
        : null;

      openPreview(config, file, records, validation, fileHash);
    } catch (error) {
      console.error(`File import ${config.title} tidak valid:`, error);
      showToast(error.message || 'Tidak dapat membaca file CSV.', 'error');
    }
  }

  function openPreview(config, file, records, validation, fileHash) {
    document.getElementById('csv-import-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'csv-import-modal';
    modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm';

    const errors = validation.errors || [];
    const previewHeaders = config.headers || [];
    const previewRows = records.slice(0, 10);
    const preview = previewRows.map(record => `
      <tr class="border-b border-white/5 hover:bg-white/[0.02]">
        ${previewHeaders.map(header => `<td class="px-3.5 py-2 text-xs text-[#D1D1D6] whitespace-nowrap font-mono">${escapeHtml(record[header] || '-')}</td>`).join('')}
      </tr>`).join('');
    const errorList = errors.slice(0, 20).map(error => `
      <li>Baris ${escapeHtml(error.row)}: ${escapeHtml(error.message)}</li>`).join('');
    const summary = errors.length
      ? `${records.length} baris ditemukan, ${errors.length} masalah. Tidak ada data yang akan disimpan.`
      : `${records.length} baris siap diimpor. Periksa pratinjau sebelum melanjutkan.`;

    modal.innerHTML = `
      <section class="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-labelledby="csv-import-title">
        <header class="flex items-center justify-between border-b border-white/10 px-5 py-4 flex-shrink-0">
          <div>
            <h2 id="csv-import-title" class="text-base font-semibold text-white">Pratinjau Impor: ${escapeHtml(config.title)}</h2>
            <p class="mt-1 text-xs text-[#A0A0A5]">${escapeHtml(file.name)}</p>
          </div>
          <button type="button" data-close-import aria-label="Tutup" class="rounded-lg p-2 text-[#A0A0A5] hover:bg-white/5 hover:text-white">
            <i data-lucide="x" class="h-5 w-5" aria-hidden="true"></i>
          </button>
        </header>
        <div class="max-h-[calc(90vh-144px)] space-y-4 overflow-y-auto p-5">
          <div class="rounded-xl border ${errors.length ? 'border-[#FF453A]/30 bg-[#FF453A]/10 text-[#FF8A84]' : 'border-[#30D158]/30 bg-[#30D158]/10 text-[#70E08A]'} px-4 py-3 text-sm" role="status" aria-live="polite">${escapeHtml(summary)}</div>
          ${errors.length ? `
            <div class="rounded-xl border border-[#FF453A]/20 bg-black/20 p-4 text-sm text-[#FF8A84]">
              <p class="mb-2 font-semibold">Perbaiki masalah berikut lalu pilih file kembali:</p>
              <ul class="list-inside list-disc space-y-1 text-xs">${errorList}</ul>
              ${errors.length > 20 ? `<p class="mt-2 text-xs">dan ${errors.length - 20} masalah lainnya.</p>` : ''}
            </div>` : ''}
          <div class="overflow-x-auto rounded-xl border border-white/10">
            <table class="min-w-full text-left">
              <thead class="bg-white/5"><tr>${previewHeaders.map(header => `<th class="whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase text-[#A0A0A5]">${escapeHtml(header)}</th>`).join('')}</tr></thead>
              <tbody>${preview || `<tr><td colspan="${previewHeaders.length}" class="px-3 py-4 text-center text-sm text-[#A0A0A5]">File tidak memiliki baris data.</td></tr>`}</tbody>
            </table>
          </div>
          ${records.length > 8 ? `<p class="text-xs text-[#A0A0A5]">Menampilkan 8 dari ${records.length} baris.</p>` : ''}
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
          <button type="button" data-back-to-guide class="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-[#D1D1D6] hover:bg-white/5 flex items-center gap-1.5 transition">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            <span>Kembali ke Panduan</span>
          </button>
          <div class="ml-auto flex gap-2">
            <button type="button" data-close-import class="rounded-lg bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10">Batal</button>
            <button type="button" data-confirm-import ${errors.length || !records.length ? 'disabled' : ''} class="rounded-lg bg-[#0088CC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0077BB] disabled:cursor-not-allowed disabled:opacity-40">Import ${records.length} baris</button>
          </div>
        </footer>
      </section>`;

    document.body.appendChild(modal);
    window.refreshIcons?.(modal);
    const close = () => modal.remove();
    modal.querySelectorAll('[data-close-import]').forEach(button => button.addEventListener('click', close));
    modal.addEventListener('click', event => {
      if (event.target === modal) close();
    });
    modal.querySelector('[data-back-to-guide]')?.addEventListener('click', () => {
      modal.remove();
      openInitialModal(config);
    });

    const confirmButton = modal.querySelector('[data-confirm-import]');
    confirmButton.addEventListener('click', async () => {
      if (confirmButton.disabled) return;
      confirmButton.disabled = true;
      confirmButton.textContent = 'Mengimpor…';
      try {
        const result = await config.commit(validation.rows, fileHash);
        if (!result || result.ok === false) {
          throw new Error(result?.error?.message || 'Import gagal. Tidak ada baris yang disimpan.');
        }
        close();
        showToast(`Berhasil mengimpor ${records.length} baris ${config.title}.`, 'success');
        try {
          await config.onComplete?.(result);
        } catch (error) {
          console.error(`Data ${config.title} berhasil diimpor, tetapi tampilan gagal diperbarui:`, error);
          showToast('Import berhasil, tetapi data di layar gagal dimuat ulang. Silakan refresh halaman.', 'error');
        }
      } catch (error) {
        console.error(`Gagal mengimpor ${config.title}:`, error);
        showToast(error.message || 'Import gagal. Tidak ada baris yang disimpan.', 'error');
        confirmButton.disabled = false;
        confirmButton.textContent = `Import ${records.length} baris`;

        // Tampilkan pesan error di dalam modal agar jelas terbaca oleh pengguna
        const bodyEl = modal.querySelector('div.space-y-4');
        if (bodyEl) {
          const existingErr = bodyEl.querySelector('#csv-import-runtime-error');
          if (existingErr) existingErr.remove();
          const errDiv = document.createElement('div');
          errDiv.id = 'csv-import-runtime-error';
          errDiv.className = 'rounded-xl border border-[#FF453A]/40 bg-[#FF453A]/15 p-4 text-sm text-[#FF8A84] flex items-start gap-3';
          errDiv.innerHTML = `
            <div class="mt-0.5"><i data-lucide="alert-circle" class="w-5 h-5 text-[#FF453A]"></i></div>
            <div class="flex-1">
              <p class="font-bold text-white mb-0.5">Import Gagal:</p>
              <p class="text-xs text-[#FF8A84] leading-relaxed">${escapeHtml(error.message || 'Terjadi kesalahan saat menyimpan data ke database.')}</p>
            </div>
          `;
          bodyEl.prepend(errDiv);
          window.refreshIcons?.(errDiv);
        }
      }
    });
  }

  async function startCsvImport(config) {
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      showToast('Import aman memerlukan koneksi HTTPS.', 'error');
      return;
    }
    openInitialModal(config);
  }

  window.startCsvImport = startCsvImport;
  window.isValidCsvImportDate = isValidIsoDate;
  window.parseCsvImportText = parseCsv;
})();
