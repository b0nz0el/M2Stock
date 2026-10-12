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

    vi.advanceTimersByTime(100);
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
});
