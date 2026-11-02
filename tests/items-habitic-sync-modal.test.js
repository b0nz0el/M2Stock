import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboardHtml = readFileSync(resolve(process.cwd(), 'public/dashboard/index.html'), 'utf8');
const itemsScript = readFileSync(resolve(process.cwd(), 'public/dashboard/items.js'), 'utf8');

describe('Master Barang — modal konfirmasi sinkronisasi Habitic', () => {
  it('menyediakan modal UI dengan relasi aksesibilitas dialog yang lengkap', () => {
    expect(dashboardHtml).toContain('id="modal-habitic-sync-confirm"');
    expect(dashboardHtml).toContain('role="dialog"');
    expect(dashboardHtml).toContain('aria-modal="true"');
    expect(dashboardHtml).toContain('aria-labelledby="modal-habitic-sync-title"');
    expect(dashboardHtml).toContain('aria-describedby="modal-habitic-sync-description"');
    expect(dashboardHtml).toContain('id="btn-cancel-habitic-sync"');
    expect(dashboardHtml).toContain('id="btn-confirm-habitic-sync"');
  });

  it('mengonfirmasi melalui modal kustom tanpa dialog native dan mendukung Escape', () => {
    expect(itemsScript).toContain('if (!await requestHabiticSyncConfirmation()) return;');
    expect(itemsScript).toContain("event.key === 'Escape'");
    expect(itemsScript).toContain("closeHabiticSyncConfirmation(false)");
    expect(itemsScript).not.toContain('window.confirm(');
  });
});
