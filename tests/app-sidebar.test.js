import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { focusProgrammatically } from '../public/assets/js/utils.js';
import '../public/assets/js/components/app-sidebar.js';

globalThis.focusProgrammatically = focusProgrammatically;

describe('<app-sidebar> Component', () => {
  let sidebar;

  beforeEach(() => {
    document.body.innerHTML = `
      <header>
        <button data-action="toggle-sidebar" aria-expanded="false">Toggle</button>
      </header>
      <app-sidebar></app-sidebar>
      <nav class="bottom-nav">
        <button data-action="open-menu" aria-expanded="false">Menu</button>
      </nav>
    `;
    sidebar = document.querySelector('app-sidebar');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('merender aside Light DOM dengan aria-label tanpa aria-hidden permanen', () => {
    const aside = sidebar.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside.getAttribute('aria-label')).toBe('Sidebar navigasi');
    expect(aside.getAttribute('aria-hidden')).toBeNull();
  });

  it('merender 16 item menu navigasi dengan atribut data-page', () => {
    const menuItems = sidebar.querySelectorAll('.menu-item[data-page]');
    expect(menuItems.length).toBe(16);
    expect(menuItems[0].getAttribute('data-page')).toBe('dashboard');
    expect(menuItems[1].getAttribute('data-page')).toBe('items');
  });

  it('menandai menu item aktif dengan class active dan aria-current="page"', () => {
    sidebar._highlightActiveMenu('items');
    const itemsBtn = sidebar.querySelector('.menu-item[data-page="items"]');
    const dashboardBtn = sidebar.querySelector('.menu-item[data-page="dashboard"]');

    expect(itemsBtn.classList.contains('active')).toBe(true);
    expect(itemsBtn.getAttribute('aria-current')).toBe('page');
    expect(dashboardBtn.classList.contains('active')).toBe(false);
    expect(dashboardBtn.getAttribute('aria-current')).toBeNull();
  });

  it('memancarkan custom event app-sidebar:navigate saat item menu diklik', () => {
    let receivedEvent = null;
    document.addEventListener('app-sidebar:navigate', (e) => {
      receivedEvent = e;
    });

    const itemsBtn = sidebar.querySelector('.menu-item[data-page="items"]');
    itemsBtn.click();

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.detail.pageId).toBe('items');
    expect(receivedEvent.bubbles).toBe(true);
  });

  it('membuka sidebar dan memperbarui aria-expanded pada tombol toggle', () => {
    const toggleBtn = document.querySelector('[data-action="toggle-sidebar"]');
    toggleBtn.focus();

    sidebar.open();

    const aside = sidebar.querySelector('aside');
    expect(aside.classList.contains('open')).toBe(true);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('menutup sidebar dan mengembalikan fokus ke elemen pemicu serta mengatur flag programmatic-focus', () => {
    const toggleBtn = document.querySelector('[data-action="toggle-sidebar"]');
    toggleBtn.focus();

    sidebar.open();
    vi.advanceTimersByTime(100);

    sidebar.close();

    const aside = sidebar.querySelector('aside');
    expect(aside.classList.contains('open')).toBe(false);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggleBtn);
    expect(toggleBtn.getAttribute('data-programmatic-focus')).toBe('true');

    toggleBtn.dispatchEvent(new Event('blur'));
    expect(toggleBtn.getAttribute('data-programmatic-focus')).toBeNull();
  });

  it('menutup sidebar saat tombol close diklik', () => {
    sidebar.open();
    const closeBtn = sidebar.querySelector('[data-action="close-sidebar"]');
    closeBtn.click();

    const aside = sidebar.querySelector('aside');
    expect(aside.classList.contains('open')).toBe(false);
  });

  it('menutup sidebar saat tombol Escape ditekan', () => {
    sidebar.open();
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    document.dispatchEvent(escEvent);

    const aside = sidebar.querySelector('aside');
    expect(aside.classList.contains('open')).toBe(false);
  });

  it('menerapkan focus trap saat Tab ditekan di dalam sidebar terbuka', () => {
    sidebar.open();
    const aside = sidebar.querySelector('aside');
    const focusables = aside.querySelectorAll('button:not([disabled])');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // Shift + Tab pada elemen pertama -> pindah ke elemen terakhir
    first.focus();
    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    document.dispatchEvent(shiftTab);
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    // Tab pada elemen terakhir -> pindah ke elemen pertama
    last.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('fokus leak guard mengembalikan fokus ke dalam sidebar jika aktif di luar', () => {
    sidebar.open();
    const outsideBtn = document.querySelector('[data-action="toggle-sidebar"]');
    outsideBtn.focus();

    const aside = sidebar.querySelector('aside');
    const first = aside.querySelectorAll('button:not([disabled])')[0];

    const tab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  describe('Dynamic Role Badge', () => {
    afterEach(() => {
      localStorage.clear();
      delete window.Auth;
      delete window.supabase;
    });

    it('merender badge role default OWNER dengan warna biru', () => {
      const roleEl = sidebar.querySelector('#sidebar-user-role');
      expect(roleEl).not.toBeNull();
      expect(roleEl.textContent).toBe('OWNER');
      expect(roleEl.className).toBe('badge bg-[#0088CC]/20 text-[#32ADE6]');
    });

    it('mengubah badge role menjadi STAFF dengan warna hijau melalui _applyRoleBadge', () => {
      sidebar._applyRoleBadge('STAFF');
      const roleEl = sidebar.querySelector('#sidebar-user-role');
      expect(roleEl.textContent).toBe('STAFF');
      expect(roleEl.className).toBe('badge bg-[#34C759]/20 text-[#34C759]');
    });

    it('mengubah badge role menjadi VIEWER dengan warna ungu melalui _applyRoleBadge', () => {
      sidebar._applyRoleBadge('VIEWER');
      const roleEl = sidebar.querySelector('#sidebar-user-role');
      expect(roleEl.textContent).toBe('VIEWER');
      expect(roleEl.className).toBe('badge bg-[#AF52DE]/20 text-[#AF52DE]');
    });

    it('mengubah badge role menjadi OWNER dengan warna biru melalui _applyRoleBadge', () => {
      sidebar._applyRoleBadge('STAFF');
      sidebar._applyRoleBadge('OWNER');
      const roleEl = sidebar.querySelector('#sidebar-user-role');
      expect(roleEl.textContent).toBe('OWNER');
      expect(roleEl.className).toBe('badge bg-[#0088CC]/20 text-[#32ADE6]');
    });

    it('memuat profil dan role dari localStorage cache secara instan', async () => {
      localStorage.setItem('auth_user', JSON.stringify({
        name: 'Staff User',
        email: 'staff@example.com',
        role: 'STAFF'
      }));

      await sidebar._loadUserProfile();

      const roleEl = sidebar.querySelector('#sidebar-user-role');
      const emailEl = sidebar.querySelector('#sidebar-user-email');
      const avatarEl = sidebar.querySelector('#sidebar-user-avatar');

      expect(roleEl.textContent).toBe('STAFF');
      expect(roleEl.className).toBe('badge bg-[#34C759]/20 text-[#34C759]');
      expect(emailEl.textContent).toBe('Staff User');
      expect(avatarEl.textContent).toBe('S');
    });

    it('mengambil role dari supabase profiles dan memperbarui role badge', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'STAFF', full_name: 'Test Staff' },
            error: null
          })
        })
      });

      window.supabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-staff-123', email: 'test@login.com' } }
          })
        },
        from: vi.fn().mockReturnValue({
          select: selectSpy
        })
      };

      await sidebar._loadUserProfile();

      expect(selectSpy).toHaveBeenCalledWith('role, full_name');
      const roleEl = sidebar.querySelector('#sidebar-user-role');
      const emailEl = sidebar.querySelector('#sidebar-user-email');
      expect(roleEl.textContent).toBe('STAFF');
      expect(roleEl.className).toBe('badge bg-[#34C759]/20 text-[#34C759]');
      expect(emailEl.textContent).toBe('Test Staff');

      // Pastikan cache diperbarui di localStorage
      const cached = JSON.parse(localStorage.getItem('auth_user'));
      expect(cached.role).toBe('STAFF');
      expect(cached.full_name).toBe('Test Staff');
      expect(cached.name).toBe('Test Staff');
    });
  });

  describe('Dynamic Badges (Anti-Mock)', () => {
    afterEach(() => {
      sessionStorage.clear();
      delete window.supabase;
    });

    it('merender badge items dengan id sidebar-items-badge dan default 0 (bukan hardcoded 10)', () => {
      const itemsBadge = sidebar.querySelector('#sidebar-items-badge');
      expect(itemsBadge).not.toBeNull();
      expect(itemsBadge.textContent).toBe('0');
      expect(itemsBadge.textContent).not.toBe('10');
    });

    it('merender badge notif dengan id sidebar-notif-badge tersembunyi (bukan hardcoded 3)', () => {
      const notifBadge = sidebar.querySelector('#sidebar-notif-badge');
      expect(notifBadge).not.toBeNull();
      expect(notifBadge.classList.contains('hidden')).toBe(true);
      expect(notifBadge.textContent).not.toBe('3');
    });

    it('memuat jumlah produk dari sessionStorage cache secara instan', async () => {
      sessionStorage.setItem('items_count', '42');
      await sidebar._loadBadgeCounts();
      const itemsBadge = sidebar.querySelector('#sidebar-items-badge');
      expect(itemsBadge.textContent).toBe('42');
    });

    it('memuat notifikasi unread dari sessionStorage cache dan menampilkan badge jika > 0', async () => {
      sessionStorage.setItem('notif_unread_count', '5');
      await sidebar._loadBadgeCounts();
      const notifBadge = sidebar.querySelector('#sidebar-notif-badge');
      expect(notifBadge.textContent).toBe('5');
      expect(notifBadge.classList.contains('hidden')).toBe(false);
    });

    it('mengambil live count dari Supabase dan memperbarui badge', async () => {
      window.supabase = {
        from: vi.fn((table) => {
          if (table === 'products') {
            return {
              select: vi.fn().mockResolvedValue({ count: 18, error: null })
            };
          }
          if (table === 'notifications') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 2, error: null })
              })
            };
          }
          return { select: vi.fn() };
        })
      };

      await sidebar._loadBadgeCounts();

      const itemsBadge = sidebar.querySelector('#sidebar-items-badge');
      const notifBadge = sidebar.querySelector('#sidebar-notif-badge');
      expect(itemsBadge.textContent).toBe('18');
      expect(notifBadge.textContent).toBe('2');
      expect(notifBadge.classList.contains('hidden')).toBe(false);
      expect(sessionStorage.getItem('items_count')).toBe('18');
      expect(sessionStorage.getItem('notif_unread_count')).toBe('2');
    });
  });
});


