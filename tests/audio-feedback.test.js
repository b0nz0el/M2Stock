import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isAudioFeedbackEnabled,
  setAudioFeedbackEnabled,
  toggleAudioFeedback,
  updateAudioFeedbackUI,
  playAudioFeedback,
  playNotificationChime
} from '../public/assets/js/utils.js';

describe('Audio Feedback Engine (Web Audio API)', () => {
  let mockStorage = {};
  let mockOscillator;
  let mockGain;
  let mockAudioContext;

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => mockStorage[key] ?? null),
      setItem: vi.fn((key, val) => {
        mockStorage[key] = String(val);
      }),
      removeItem: vi.fn((key) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      })
    });

    mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };

    mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    };

    mockAudioContext = {
      currentTime: 10,
      state: 'running',
      resume: vi.fn().mockResolvedValue(),
      createOscillator: vi.fn(() => ({ ...mockOscillator, frequency: { ...mockOscillator.frequency } })),
      createGain: vi.fn(() => ({ ...mockGain, gain: { ...mockGain.gain } })),
      destination: {}
    };

    vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext));
    if (typeof window !== 'undefined') {
      window._m2AudioCtx = mockAudioContext;
      window.AudioContext = vi.fn(() => mockAudioContext);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (typeof window !== 'undefined') {
      delete window._m2AudioCtx;
    }
  });

  describe('Audio State Management', () => {
    it('mengembalikan true secara default jika belum pernah diset di localStorage', () => {
      expect(isAudioFeedbackEnabled()).toBe(true);
    });

    it('mengembalikan false jika di localStorage di-set "false"', () => {
      localStorage.setItem('m2stock_sound_enabled', 'false');
      expect(isAudioFeedbackEnabled()).toBe(false);
    });

    it('setAudioFeedbackEnabled menyimpan preferensi dan men-trigger custom event', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      setAudioFeedbackEnabled(false);
      expect(localStorage.setItem).toHaveBeenCalledWith('m2stock_sound_enabled', 'false');
      expect(isAudioFeedbackEnabled()).toBe(false);
      expect(dispatchSpy).toHaveBeenCalled();

      setAudioFeedbackEnabled(true);
      expect(isAudioFeedbackEnabled()).toBe(true);
    });

    it('toggleAudioFeedback membalikkan status suara on/off', () => {
      setAudioFeedbackEnabled(true);
      const next1 = toggleAudioFeedback();
      expect(next1).toBe(false);
      expect(isAudioFeedbackEnabled()).toBe(false);

      const next2 = toggleAudioFeedback();
      expect(next2).toBe(true);
      expect(isAudioFeedbackEnabled()).toBe(true);
    });
  });

  describe('UI Syncing (updateAudioFeedbackUI)', () => {
    it('mengubah icon data-lucide dan kelas tombol suara di UI', () => {
      document.body.innerHTML = `
        <button id="btn-toggle-sound-pos" class="btn-toggle-sound-ui text-[#34C759]">
          <i data-lucide="volume-2"></i>
          <span class="sound-toggle-label">Suara: ON</span>
        </button>
      `;

      updateAudioFeedbackUI(false);
      const btn = document.getElementById('btn-toggle-sound-pos');
      expect(btn.dataset.soundState).toBe('off');
      expect(btn.classList.contains('text-[#8E8E93]')).toBe(true);
      expect(btn.querySelector('i').getAttribute('data-lucide')).toBe('volume-x');
      expect(btn.querySelector('.sound-toggle-label').textContent).toBe('Suara: OFF');

      updateAudioFeedbackUI(true);
      expect(btn.dataset.soundState).toBe('on');
      expect(btn.classList.contains('text-[#34C759]')).toBe(true);
      expect(btn.querySelector('i').getAttribute('data-lucide')).toBe('volume-2');
      expect(btn.querySelector('.sound-toggle-label').textContent).toBe('Suara: ON');
    });
  });

  describe('Tone Synthesizer (playAudioFeedback)', () => {
    it('tidak memutar audio jika suara dinonaktifkan', () => {
      setAudioFeedbackEnabled(false);
      playAudioFeedback('scan');
      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    });

    it('membuat oscillator dan memanggil start untuk tone "scan"', () => {
      setAudioFeedbackEnabled(true);
      playAudioFeedback('scan');
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('dapat mensintesis tone "input" tanpa melempar error', () => {
      setAudioFeedbackEnabled(true);
      expect(() => playAudioFeedback('input')).not.toThrow();
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });

    it('dapat mensintesis nada ganda peringatan "warning"', () => {
      setAudioFeedbackEnabled(true);
      expect(() => playAudioFeedback('warning')).not.toThrow();
      // warning menghasilkan 2 oscillator untuk 2 nada rendah berurutan
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);
    });

    it('dapat mensintesis denting register kasir "cash"', () => {
      setAudioFeedbackEnabled(true);
      expect(() => playAudioFeedback('cash')).not.toThrow();
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);
    });

    it('dapat mensintesis melodi sukses "success"', () => {
      setAudioFeedbackEnabled(true);
      expect(() => playAudioFeedback('success')).not.toThrow();
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(3);
    });

    it('playNotificationChime memanggil playAudioFeedback dengan sukses', () => {
      setAudioFeedbackEnabled(true);
      expect(() => playNotificationChime('success')).not.toThrow();
      expect(() => playNotificationChime('error')).not.toThrow();
    });

    it('berjalan mulus jika AudioContext tidak didukung oleh browser/environment', () => {
      window._m2AudioCtx = null;
      window.AudioContext = undefined;
      window.webkitAudioContext = undefined;
      delete global.AudioContext;

      expect(() => playAudioFeedback('scan')).not.toThrow();
    });
  });
});

