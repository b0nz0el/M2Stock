import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Load ImageUtils factory
const ImageUtils = require('../public/assets/js/image-utils.js');

describe('ImageUtils — Client-Side Image Compression (500 KB – 1 MB Target)', () => {
  describe('Constants & Configuration Budget', () => {
    it('enforces 1600px maximum resolution for sharp high-DPI display', () => {
      expect(ImageUtils.MAX_WIDTH).toBe(1600);
      expect(ImageUtils.MAX_HEIGHT).toBe(1600);
    });

    it('enforces 10 MB raw upload limit to support high-res smartphone camera photos', () => {
      expect(ImageUtils.MAX_RAW_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });

    it('sets compression target budget to 1 MB (1024 KB) and optimal floor to 500 KB', () => {
      expect(ImageUtils.TARGET_SIZE_BYTES).toBe(1024 * 1024);
      expect(ImageUtils.MIN_TARGET_SIZE_BYTES).toBe(500 * 1024);
    });
  });

  describe('formatFileSize helper', () => {
    it('formats bytes correctly into human-readable strings', () => {
      expect(ImageUtils.formatFileSize(0)).toBe('0 B');
      expect(ImageUtils.formatFileSize(null)).toBe('0 B');
      expect(ImageUtils.formatFileSize(500)).toBe('500 B');
      expect(ImageUtils.formatFileSize(1024)).toBe('1 KB');
      expect(ImageUtils.formatFileSize(500 * 1024)).toBe('500 KB');
      expect(ImageUtils.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(ImageUtils.formatFileSize(10 * 1024 * 1024)).toBe('10 MB');
    });
  });

  describe('validateImageFile', () => {
    it('throws error when no file is passed', () => {
      expect(() => ImageUtils.validateImageFile(null)).toThrow('Tidak ada file gambar yang dipilih');
      expect(() => ImageUtils.validateImageFile(undefined)).toThrow('Tidak ada file gambar yang dipilih');
    });

    it('throws error when file exceeds 10 MB', () => {
      const hugeFile = {
        name: 'huge-camera-photo.jpg',
        size: 11 * 1024 * 1024,
        type: 'image/jpeg'
      };
      expect(() => ImageUtils.validateImageFile(hugeFile)).toThrow('Ukuran file melebihi batas 10 MB');
    });

    it('accepts files within 10 MB raw limit', () => {
      const cameraPhoto = {
        name: 'camera-photo.jpg',
        size: 8 * 1024 * 1024,
        type: 'image/jpeg'
      };
      expect(ImageUtils.validateImageFile(cameraPhoto)).toBe(true);
    });

    it('validates supported image mime types and extensions (JPEG, PNG, WebP, HEIC)', () => {
      const validFiles = [
        { name: 'photo.jpg', size: 2 * 1024 * 1024, type: 'image/jpeg' },
        { name: 'photo.png', size: 1 * 1024 * 1024, type: 'image/png' },
        { name: 'photo.webp', size: 700 * 1024, type: 'image/webp' },
        { name: 'photo.heic', size: 3 * 1024 * 1024, type: 'image/heic' }
      ];

      for (const file of validFiles) {
        expect(ImageUtils.validateImageFile(file)).toBe(true);
      }
    });

    it('rejects unsupported file formats', () => {
      const invalidFiles = [
        { name: 'document.pdf', size: 1024, type: 'application/pdf' },
        { name: 'script.js', size: 1024, type: 'text/javascript' },
        { name: 'archive.zip', size: 1024, type: 'application/zip' }
      ];

      for (const file of invalidFiles) {
        expect(() => ImageUtils.validateImageFile(file)).toThrow('Format file tidak didukung');
      }
    });
  });

  describe('calculateTargetDimensions', () => {
    it('retains dimensions if image is already within 1600x1600', () => {
      const dims = ImageUtils.calculateTargetDimensions(800, 600, 1600, 1600);
      expect(dims).toEqual({ width: 800, height: 600 });
    });

    it('scales down square image exceeding 1600px proportionally', () => {
      const dims = ImageUtils.calculateTargetDimensions(3200, 3200, 1600, 1600);
      expect(dims).toEqual({ width: 1600, height: 1600 });
    });

    it('scales down landscape image preserving aspect ratio', () => {
      const dims = ImageUtils.calculateTargetDimensions(3200, 1600, 1600, 1600);
      expect(dims).toEqual({ width: 1600, height: 800 });
    });

    it('scales down portrait image preserving aspect ratio', () => {
      const dims = ImageUtils.calculateTargetDimensions(1600, 3200, 1600, 1600);
      expect(dims).toEqual({ width: 800, height: 1600 });
    });
  });
});
