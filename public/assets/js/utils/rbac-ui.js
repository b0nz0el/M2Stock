/* ═══════════════════════════════════════════════════
   M2Stock — rbac-ui.js
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

export const OWNER_ONLY_SELECTORS = [
  '[data-rbac-owner-only]'
];

export const READ_ONLY_PAGES = {
  VIEWER: ['po', 'return'],
  STAFF: ['users', 'audit', 'backup', 'settings']
};

const READONLY_SELECTOR_STRING = READONLY_SELECTORS.join(', ');
const STAFF_DELETE_SELECTOR_STRING = STAFF_DELETE_SELECTORS.join(', ');
const OWNER_ONLY_SELECTOR_STRING = OWNER_ONLY_SELECTORS.join(', ');

function hideMatchingElements(root, selector) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  if (root.nodeType === 1 && root.matches(selector)) {
    root.style.display = 'none';
    if ('disabled' in root) root.disabled = true;
  }
  root.querySelectorAll(selector).forEach(el => {
    el.style.display = 'none';
    if ('disabled' in el) el.disabled = true;
  });
}

function disableMatchingElements(root, selector) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  if (root.nodeType === 1 && root.matches(selector) && 'disabled' in root) {
    root.disabled = true;
  }
  root.querySelectorAll(selector).forEach(el => {
    if ('disabled' in el) el.disabled = true;
  });
}

function applyPageRestrictions(pageId, root, role) {
  hideMatchingElements(root, READONLY_SELECTOR_STRING);

  if (pageId === 'backup') {
    hideMatchingElements(root, 'button, input, select, textarea');
  } else if (pageId === 'settings') {
    hideMatchingElements(root, 'button:not(.settings-tab-btn)');
    disableMatchingElements(root, 'input, select, textarea');
  }
}

function applyRoleRestrictions(role, root = document) {
  if (!root || typeof document === 'undefined') return;

  if (role !== 'OWNER') {
    hideMatchingElements(root, OWNER_ONLY_SELECTOR_STRING);
    if (root.nodeType === 1) {
      const ownerOnlyParent = root.closest('[data-rbac-owner-only]');
      if (ownerOnlyParent) {
        ownerOnlyParent.style.display = 'none';
        if ('disabled' in ownerOnlyParent) ownerOnlyParent.disabled = true;
      }
    }
  }

  if (root === document) {
    if (role === 'VIEWER') {
      document.body.classList.add('rbac-hidden');
    } else {
      document.body.classList.remove('rbac-hidden');
    }
  }

  if (role === 'VIEWER') {
    hideMatchingElements(root, READONLY_SELECTOR_STRING);
  } else if (role === 'STAFF') {
    hideMatchingElements(root, STAFF_DELETE_SELECTOR_STRING);
  }

  const readOnlyPages = READ_ONLY_PAGES[role] || [];

  if (root === document) {
    readOnlyPages.forEach(pageId => {
      const page = document.getElementById(`page-${pageId}`);
      if (page) applyPageRestrictions(pageId, page, role);
    });
    return;
  }

  const applyToAddedContent = (node) => {
    if (node.nodeType !== 1) return;
    const page = node.matches('.page') ? node : node.closest('.page');
    const pageId = page?.id.startsWith('page-') ? page.id.slice(5) : null;
    if (pageId && readOnlyPages.includes(pageId)) {
      applyPageRestrictions(pageId, node, role);
      return;
    }

    node.querySelectorAll('.page').forEach(childPage => {
      const childPageId = childPage.id.startsWith('page-') ? childPage.id.slice(5) : null;
      if (childPageId && readOnlyPages.includes(childPageId)) {
        applyPageRestrictions(childPageId, childPage, role);
      }
    });
  };

  applyToAddedContent(root);
}

function installRoleObserver(role) {
  if (typeof window === 'undefined' || window._rbacObserverInstalled || typeof MutationObserver === 'undefined') {
    return;
  }

  window._rbacObserverInstalled = true;
  const observer = new MutationObserver((mutations) => {
    const currentRole = document.body.dataset.rbacRole || role;
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => applyRoleRestrictions(currentRole, node));
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
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
  installRoleObserver(effectiveRole);

  return role;
}

if (typeof window !== 'undefined') {
  window.applyReadOnlyUI = applyReadOnlyUI;
}
