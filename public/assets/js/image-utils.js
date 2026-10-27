/* ═══════════════════════════════════════════════════
   Aquastock Pro — image-utils.js
   Client-Side Image Compression (Canvas API native)
   Target: WebP < 500 KB, Max 1200x1200 px
   ═══════════════════════════════════════════════════ */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ImageUtils = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_WIDTH = 1200;
  const MAX_HEIGHT = 1200;
  const MAX_RAW_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
  const TARGET_SIZE_BYTES = 500 * 1024;       // 500 KB
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

  function formatFileSize(bytes) {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function validateImageFile(file) {
    if (!file) {
      throw new Error('Tidak ada file gambar yang dipilih');
    }
    if (file.size > MAX_RAW_SIZE_BYTES) {
      throw new Error(`Ukuran file melebihi batas 5 MB (${formatFileSize(file.size)})`);
    }
    const type = (file.type || '').toLowerCase();
    const isAllowed = ALLOWED_MIME_TYPES.some(t => type.includes(t)) ||
      /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '');
    if (!isAllowed) {
      throw new Error('Format file tidak didukung. Harap pilih JPG, PNG, atau WebP');
    }
    return true;
  }

  function calculateTargetDimensions(width, height, maxW, maxH) {
    let targetW = width;
    let targetH = height;

    if (targetW > maxW || targetH > maxH) {
      const ratio = Math.min(maxW / targetW, maxH / targetH);
      targetW = Math.round(targetW * ratio);
      targetH = Math.round(targetH * ratio);
    }
    return { width: targetW, height: targetH };
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || typeof Image === 'undefined') {
        return reject(new Error('Canvas / Image API tidak tersedia di lingkungan ini'));
      }
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Gagal memproses file gambar. File mungkin rusak'));
      };
      img.src = objectUrl;
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Gagal mengonversi canvas ke Blob WebP'));
          }
        },
        'image/webp',
        quality
      );
    });
  }

  /**
   * Mengompresi file gambar secara adaptif ke format WebP
   * @param {File|Blob} file File gambar asli
   * @returns {Promise<{ blob: Blob, previewUrl: string, originalSize: number, compressedSize: number, width: number, height: number }>}
   */
  async function compressImage(file) {
    validateImageFile(file);

    const img = await loadImage(file);
    const { width, height } = calculateTargetDimensions(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      MAX_WIDTH,
      MAX_HEIGHT
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Gagal menginisialisasi Canvas 2D context');
    }

    // Gambar ke canvas dengan dimensi terhitung
    ctx.drawImage(img, 0, 0, width, height);

    // Kompresi iteratif hingga ukuran < 500 KB (atau minimal quality 0.5)
    let quality = 0.90;
    let blob = await canvasToBlob(canvas, quality);

    while (blob.size > TARGET_SIZE_BYTES && quality > 0.5) {
      quality -= 0.10;
      blob = await canvasToBlob(canvas, Math.max(0.5, quality));
    }

    const previewUrl = URL.createObjectURL(blob);

    return {
      blob: blob,
      previewUrl: previewUrl,
      originalSize: file.size,
      compressedSize: blob.size,
      originalSizeText: formatFileSize(file.size),
      compressedSizeText: formatFileSize(blob.size),
      width: width,
      height: height,
      quality: quality
    };
  }

  return {
    compressImage: compressImage,
    formatFileSize: formatFileSize,
    validateImageFile: validateImageFile,
    calculateTargetDimensions: calculateTargetDimensions,
    MAX_WIDTH: MAX_WIDTH,
    MAX_HEIGHT: MAX_HEIGHT,
    MAX_RAW_SIZE_BYTES: MAX_RAW_SIZE_BYTES,
    TARGET_SIZE_BYTES: TARGET_SIZE_BYTES
  };
});
