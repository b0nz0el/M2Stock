import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  openMenuDrawer,
  toggleSidebar,
  closeSidebar,
  updateSidebarAria,
  trapSidebarFocus,
  syncActiveState
} from '../public/assets/js/navigation.js';

describe('navigation.js a11y', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <header>
        <button onclick="toggleSidebar()" aria-label="Buka menu" class="toggle-btn"></button>
      </header>
      <aside aria-label="Menu utama">
        <button onclick="closeSidebar()" class="close-btn" aria-label="Tutup"></button>
        <button class="menu-item" onclick="showPage('dashboard', this)">Dashboard</button>
        <button class="menu-item" onclick="showPage('items', this)">Barang</button>
      </aside>
      <nav class="bottom-nav">
        <button type="button" class="bottom-nav-item" data-tab="dashboard"></button>
        <button type="button" class="bottom-nav-item" data-tab="items"></button>
        <button type="button" class="bottom-nav-item" data-tab="in"></button>
        <button type="button" class="bottom-nav-item" data-tab="out"></button>
        <button type="button" class="bottom-nav-item" data-tab="menu" onclick="openMenuDrawer(event)"></button>
      </nav>
      <main>
        <h2 id="main-heading">Dashboard</h2>
      </main>
    `;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('mengisi aria-label otomatis pada item bottom nav jika belum ada', () => {
    syncActiveState();
    const items = document.querySelectorAll('.bottom-nav-item');
    expect(items[0].getAttribute('aria-label')).toBe('Dashboard');
    expect(items[1].getAttribute('aria-label')).toBe('Barang');
    expect(items[2].getAttribute('aria-label')).toBe('Barang Masuk');
    expect(items[3].getAttribute('aria-label')).toBe('Barang Keluar');
    expect(items[4].getAttribute('aria-label')).toBe('Menu navigasi');
  });

  it('mengatur aria-expanded dan aria-hidden saat sidebar dibuka dan ditutup', () => {
    const triggerBtn = document.querySelector('.toggle-btn');
    triggerBtn.focus();

    toggleSidebar({ currentTarget: triggerBtn });

    const aside = document.querySelector('aside');
    expect(aside.classList.contains('open')).toBe(true);
    expect(aside.getAttribute('aria-hidden')).toBe('false');
    expect(triggerBtn.getAttribute('aria-expanded')).toBe('true');

    // Menutup sidebar
    closeSidebar();
    expect(aside.classList.contains('open')).toBe(false);
    expect(aside.getAttribute('aria-hidden')).toBe('true');
    expect(triggerBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('mengembalikan fokus ke tombol trigger saat sidebar ditutup', () => {
    const triggerBtn = document.querySelector('.toggle-btn');
    triggerBtn.focus();

    toggleSidebar({ currentTarget: triggerBtn });
    vi.advanceTimersByTime(100);

    // Saat ditutup
    closeSidebar();
    expect(document.activeElement).toBe(triggerBtn);
  });

  it('melakukan focus trap saat Tab ditekan di dalam sidebar', () => {
    const aside = document.querySelector('aside');
    aside.classList.add('open');

    const focusables = aside.querySelectorAll('button');
    const firstBtn = focusables[0];
    const lastBtn = focusables[focusables.length - 1];

    // Shift + Tab pada elemen pertama -> pindah ke elemen terakhir
    firstBtn.focus();
    const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    trapSidebarFocus(shiftTabEvent);
    expect(shiftTabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(lastBtn);

    // Tab pada elemen terakhir -> pindah ke elemen pertama
    lastBtn.focus();
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, cancelable: true });
    trapSidebarFocus(tabEvent);
    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(firstBtn);
  });

  it('menutup sidebar saat tombol Escape ditekan', () => {
    const aside = document.querySelector('aside');
    aside.classList.add('open');

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    trapSidebarFocus(escEvent);

    expect(escEvent.defaultPrevented).toBe(true);
    expect(aside.classList.contains('open')).toBe(false);
  });
});
