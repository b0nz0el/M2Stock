/* ═══════════════════════════════════════════════════
   Aquastock Pro — rbac-ui.js
   Read-Only UI Enforcement for Role-Based Access
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
  'button.btn-receive-po',
  'button.btn-complete-return',
  'button.btn-delete-po',
  'button.btn-delete-return',
  'button.btn-edit-role',
  '#btn-auto-restock-po',
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

export const STAFF_DELETE_SELECTORS = [
  '[data-action="delete"]',
  '[data-action="bulk-delete"]',
  '.btn-delete',
  '.btn-delete-po',
  '.btn-delete-return',
  '.bulk-action-btn--danger'
];

export const READ_ONLY_PAGES = {
  VIEWER: ['po', 'return'],
  STAFF: ['users', 'audit', 'backup', 'settings']
};

const READONLY_SELECTOR_STRING = READONLY_SELECTORS.join(', ');
const STAFF_DELETE_SELECTOR_STRING = STAFF_DELETE_SELECTORS.join(', ');

function hideMatchingElements(root, selector) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll(selector).forEach(el => {
    el.style.display = 'none';
    if ('disabled' in el) el.disabled = true;
  });
}

function disableMatchingElements(root, selector) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll(selector).forEach(el => {
    if ('disabled' in el) el.disabled = true;
  });
}

function applyRoleRestrictions(role) {
  if (role === 'VIEWER' && typeof document !== 'undefined') {
    document.body.classList.add('rbac-hidden');
    hideMatchingElements(document, READONLY_SELECTOR_STRING);
  } else if (typeof document !== 'undefined') {
    document.body.classList.remove('rbac-hidden');
  }

  if (role === 'STAFF' && typeof document !== 'undefined') {
    hideMatchingElements(document, STAFF_DELETE_SELECTOR_STRING);
  }

  const readOnlyPages = READ_ONLY_PAGES[role] || [];
  readOnlyPages.forEach(pageId => {
    const page = document.getElementById(`page-${pageId}`);
    if (!page) return;

    hideMatchingElements(page, READONLY_SELECTOR_STRING);

    if (pageId === 'backup') {
      hideMatchingElements(page, 'button, input, select, textarea');
    } else if (pageId === 'settings') {
      hideMatchingElements(page, 'button:not(.settings-tab-btn)');
      disableMatchingElements(page, 'input, select, textarea');
    }
  });
}

/**
 * Menyembunyikan aksi yang tidak diizinkan untuk role pengguna aktif
 * @returns {Promise<string>} Role pengguna saat ini
 */
export async function applyReadOnlyUI() {
  const role = await getUserRole();
  if (typeof document === 'undefined') return role;

  const effectiveRole = role || 'VIEWER';
  document.body.dataset.rbacRole = effectiveRole;
  applyRoleRestrictions(effectiveRole);

  if (typeof window !== 'undefined' && !window._rbacObserverInstalled && typeof MutationObserver !== 'undefined') {
    window._rbacObserverInstalled = true;
    const observer = new MutationObserver(() => {
      const currentRole = document.body.dataset.rbacRole || effectiveRole;
      applyRoleRestrictions(currentRole);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return role;
}

if (typeof window !== 'undefined') {
  window.applyReadOnlyUI = applyReadOnlyUI;
}
