import { beforeEach, describe, expect, it, vi } from 'vitest';

const { catalogData, supabaseMock } = vi.hoisted(() => {
  const catalogData = {
    categories: [{ id: 1, name: 'Pakan' }],
    units: [{ id: 1, name: 'pcs' }, { id: 2, name: 'botol' }],
    channels: [{ id: 1, name: 'Shopee' }]
  };

  const supabaseMock = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(table => ({
      select: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: catalogData[table] || [], error: null })
      })),
      insert: vi.fn(async row => {
        catalogData[table].push({ id: Date.now(), ...row });
        return { error: null };
      }),
      update: vi.fn(row => ({
        eq: vi.fn(async (_column, id) => {
          Object.assign(catalogData[table].find(entry => entry.id === id), row);
          return { error: null };
        })
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(async (_column, id) => {
          const index = catalogData[table].findIndex(entry => entry.id === id);
          if (index >= 0) catalogData[table].splice(index, 1);
          return { error: null };
        })
      }))
    }))
  };

  return { catalogData, supabaseMock };
});

vi.mock('../public/assets/js/api/settings.js', () => ({
  settings: {
    getAll: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    getChannels: vi.fn().mockImplementation(() => Promise.resolve(catalogData.channels)),
    saveChannels: vi.fn().mockResolvedValue([])
  }
}));
vi.mock('../public/assets/js/supabase-client.js', () => ({ supabase: supabaseMock }));
vi.mock('../public/assets/js/utils/rbac-ui.js', () => ({ applyReadOnlyUI: vi.fn() }));

describe('settings catalog actions', () => {
  beforeEach(async () => {
    catalogData.categories.splice(0, catalogData.categories.length, { id: 1, name: 'Pakan' });
    catalogData.units.splice(0, catalogData.units.length, { id: 1, name: 'pcs' }, { id: 2, name: 'botol' });
    catalogData.channels.splice(0, catalogData.channels.length, { id: 1, name: 'Shopee' });
    document.body.innerHTML = `
      <button class="settings-tab-btn" data-tab="catalog"></button>
      <div id="tab-content-catalog" class="settings-tab-content"></div>
      <form id="form-add-category"><input id="setting-category-name"><button id="btn-add-category"></button></form>
      <form id="form-add-unit"><input id="setting-unit-name"><button id="btn-add-unit"></button></form>
      <ul id="setting-category-list"></ul>
      <ul id="setting-unit-list"></ul>
      <ul id="setting-channel-list"></ul>
    `;
    window.confirm = vi.fn(() => true);
    window.showToast = vi.fn();
    window.refreshIcons = vi.fn();
    await import('../public/dashboard/settings.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await vi.waitFor(() => {
      expect(document.querySelector('#setting-category-list li button')).not.toBeNull();
    });
  });

  it('edits a category and persists the updated name', async () => {
    document.querySelector('#setting-category-list [data-catalog-action="edit"]').click();
    const input = document.querySelector('#setting-category-list input');
    input.value = 'Pakan Ikan';
    document.querySelector('#setting-category-list button').click();

    await vi.waitFor(() => {
      expect(document.querySelector('#setting-category-list').textContent).toContain('Pakan Ikan');
    });
    expect(catalogData.categories[0].name).toBe('Pakan Ikan');
  });

  it('edits a non-default stock unit and persists the updated name', async () => {
    document.querySelectorAll('#setting-unit-list [data-catalog-action="edit"]')[1].click();
    const input = document.querySelector('#setting-unit-list input');
    input.value = 'liter';
    document.querySelector('#setting-unit-list input + button').click();

    await vi.waitFor(() => {
      expect(document.querySelector('#setting-unit-list').textContent).toContain('liter');
    });
    expect(catalogData.units[1].name).toBe('liter');
  });

  it('deletes a category after confirmation and updates the list', async () => {
    document.querySelector('#setting-category-list [data-catalog-action="delete"]').click();

    await vi.waitFor(() => {
      expect(document.querySelector('#setting-category-list').textContent).toContain('Belum ada kategori.');
    });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Produk dalam kategori ini akan tetap ada'));
    expect(catalogData.categories).toHaveLength(0);
  });

  it('protects the default stock unit from editing and deletion', () => {
    const buttons = document.querySelectorAll('#setting-unit-list li button');

    expect(buttons[0].disabled).toBe(true);
    expect(buttons[0].title).toContain('default');
    expect(buttons[1].disabled).toBe(true);
    expect(buttons[1].title).toContain('default');
  });

  it('shows marketplace and accessible action icons for channel settings', async () => {
    await vi.waitFor(() => {
      expect(document.querySelector('#setting-channel-list li')).not.toBeNull();
    });

    const channelList = document.querySelector('#setting-channel-list');
    const editButton = channelList.querySelector('[data-catalog-action="edit"]');
    const deleteButton = channelList.querySelector('[data-catalog-action="delete"]');

    expect(channelList.querySelector('[data-lucide="brand-shopee"]')).not.toBeNull();
    expect(editButton.querySelector('[data-lucide="pencil"]')).not.toBeNull();
    expect(editButton.getAttribute('aria-label')).toBe('Edit Shopee');
    expect(editButton.title).toBe('Edit Shopee');
    expect(deleteButton.querySelector('[data-lucide="trash-2"]')).not.toBeNull();
    expect(deleteButton.getAttribute('aria-label')).toBe('Hapus Shopee');
    expect(deleteButton.title).toBe('Hapus Shopee');
    expect(window.refreshIcons).toHaveBeenCalledWith(channelList);
  });
});
