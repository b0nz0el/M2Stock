/* ═══════════════════════════════════════════════════
   Aquastock Pro — rbac-ui.js
   Read-Only UI Enforcement for VIEWER Role
   ═══════════════════════════════════════════════════ */

import { getUserRole } from './rbac.js';

export const READONLY_SELECTORS = [
  'button[data-action="add"]',
  'button[data-action="create"]',
  'button[data-action="edit"]',
  'button[data-action="delete"]',
  'button[data-action="import"]',
  'button[data-action="bulk-edit"]',
  'button[data-action="bulk-delete"]',
  'button[data-action="add-item"]',
  'button[data-action="add-in"]',
  'button[data-action="add-out"]',
  'button[data-action="add-po"]',
  'button[data-action="add-return"]',
  'button[data-action="add-supplier"]',
  'button[data-action="add-customer"]',
  'button[data-action="add-cash"]',
  'button[data-action="add-debt"]',
  'a[href*="/new"]',
  'a[href*="/create"]',
  'a[href*="/add"]',
  'a[href*="/edit"]',
  '[data-requires-role="OWNER,STAFF"]',
  '.btn-add',
  '.btn-create',
  '.btn-edit',
  '.btn-delete',
  '.btn-import',
  '.action-btn',
  'input[type="checkbox"][data-select-row]',
  'input[type="checkbox"][data-select-all]',
  '[data-select-all]',
  '[data-select-row]',
  '#select-all-header',
  '#bulk-bar',
  '#bulk-actions-bar'
];

/**
 * Menyembunyikan tombol-tombol aksi/CRUD untuk role VIEWER (Read-Only)
 * @returns {Promise<string>} Role pengguna saat ini
 */
export async function applyReadOnlyUI() {
  const role = await getUserRole();

  if (role === 'VIEWER') {
    if (typeof document !== 'undefined') {
      document.body.classList.add('rbac-hidden');

      const selectorString = READONLY_SELECTORS.join(', ');
      const elements = document.querySelectorAll(selectorString);
      elements.forEach(el => {
        el.style.display = 'none';
        if ('disabled' in el) {
          el.disabled = true;
        }
      });

      // Observer untuk elemen dinamis yang di-render JS setelah load awal (seperti baris tabel)
      if (!window._rbacObserverInstalled && typeof MutationObserver !== 'undefined') {
        window._rbacObserverInstalled = true;
        const observer = new MutationObserver(() => {
          if (document.body.classList.contains('rbac-hidden')) {
            const dynamicEls = document.querySelectorAll(selectorString);
            dynamicEls.forEach(el => {
              if (el.style.display !== 'none') {
                el.style.display = 'none';
                if ('disabled' in el) {
                  el.disabled = true;
                }
              }
            });
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }
  } else {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('rbac-hidden');
    }
  }

  return role;
}

if (typeof window !== 'undefined') {
  window.applyReadOnlyUI = applyReadOnlyUI;
}
