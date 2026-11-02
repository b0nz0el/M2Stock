import { describe, expect, it, vi } from 'vitest';

vi.mock('../public/assets/js/utils/rbac.js', () => ({
  getUserRole: vi.fn().mockResolvedValue('STAFF')
}));

import { applyReadOnlyUI } from '../public/assets/js/utils/rbac-ui.js';

describe('role-based UI updates', () => {
  it('restricts newly added STAFF controls without rescanning the whole document', async () => {
    document.body.innerHTML = `
      <section id="page-settings" class="page">
        <button class="settings-tab-btn">Tab</button>
        <button data-action="edit">Edit settings</button>
        <input>
      </section>
      <section id="page-items" class="page">
        <button data-action="delete">Delete item</button>
        <button data-rbac-owner-only>Stock opname</button>
      </section>
    `;
    window._rbacObserverInstalled = false;

    await applyReadOnlyUI();

    expect(document.querySelector('#page-settings [data-action="edit"]').style.display).toBe('none');
    expect(document.querySelector('#page-settings input').disabled).toBe(true);
    expect(document.querySelector('#page-settings .settings-tab-btn').style.display).not.toBe('none');
    expect(document.querySelector('#page-items [data-action="delete"]').style.display).toBe('none');
    expect(document.querySelector('#page-items [data-rbac-owner-only]').style.display).toBe('none');

    const queryDocument = vi.spyOn(document, 'querySelectorAll');
    const settingsButton = document.createElement('button');
    settingsButton.dataset.action = 'create';
    document.querySelector('#page-settings').append(settingsButton);

    const itemCreateButton = document.createElement('button');
    itemCreateButton.dataset.action = 'create';
    document.querySelector('#page-items').append(itemCreateButton);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(settingsButton.style.display).toBe('none');
    expect(itemCreateButton.style.display).not.toBe('none');
    expect(queryDocument).not.toHaveBeenCalled();
  });
});
