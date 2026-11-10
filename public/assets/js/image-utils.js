/* ═══════════════════════════════════════════════════
   M2Stock — image-utils.js
   Client-Side Image Compression (Canvas API native)
   Target: WebP 500 KB – 1 MB (Maks. 1 MB), Max 1600x1600 px
   ═══════════════════════════════════════════════════ */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ImageUtils = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_WIDTH = 1600;
  const MAX_HEIGHT = 1600;
  const MAX_RAW_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB batas unggah mentah (mendukung foto kamera smartphone 48MP/50MP)
  const TARGET_SIZE_BYTES = 1024 * 1024;       // 1 MB batas maksimal target kompresi (500 KB – 1 MB)
  const MIN_TARGET_SIZE_BYTES = 500 * 1024;   // 500 KB batas bawah optimal kualitas
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
      throw new Error(`Ukuran file melebihi batas 30 MB (${formatFileSize(file.size)})`);
    }
    const type = (file.type || '').toLowerCase();
    const isAllowed = ALLOWED_MIME_TYPES.some(t => type.includes(t)) ||
      /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '');
    if (!isAllowed) {
      throw new Error('Format file tidak didukung. Harap pilih JPG, PNG, atau WebP');
    }
    return true;
  }

  function calculateTargetDimensions(width, height, maxW = MAX_WIDTH, maxH = MAX_HEIGHT) {
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
        resolve({ img, objectUrl });
      };
      img.onerror = () => {
        try { URL.revokeObjectURL(objectUrl); } catch (_) {}
        reject(new Error('Gagal memproses file gambar. File mungkin rusak atau format tidak didukung'));
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
   * Target ukuran: 500 KB – 1 MB (maksimum 1 MB)
   * @param {File|Blob} file File gambar asli
   * @returns {Promise<{ blob: Blob, previewUrl: string, originalSize: number, compressedSize: number, width: number, height: number }>}
   */
  async function compressImage(file) {
    validateImageFile(file);

    let drawable = null;
    let objectUrlToRevoke = null;
    let naturalW = 0;
    let naturalH = 0;

    // 1. Coba decode via createImageBitmap jika tersedia (lebih cepat, auto EXIF orientation, hemat memori)
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file);
        if (bitmap && bitmap.width > 0 && bitmap.height > 0) {
          drawable = bitmap;
          naturalW = bitmap.width;
          naturalH = bitmap.height;
        }
      } catch (_) {
        // Fallback ke Image element biasa
      }
    }

    // 2. Fallback via Image element jika createImageBitmap tidak tersedia/gagal
    if (!drawable) {
      const loaded = await loadImage(file);
      drawable = loaded.img;
      objectUrlToRevoke = loaded.objectUrl;
      naturalW = drawable.naturalWidth || drawable.width;
      naturalH = drawable.naturalHeight || drawable.height;
    }

    try {
      const { width, height } = calculateTargetDimensions(
        naturalW,
        naturalH,
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
      ctx.drawImage(drawable, 0, 0, width, height);

      // Kompresi adaptif: mulai dari kualitas sangat tinggi (0.92)
      // Turunkan bertahap hanya jika ukuran melebihi TARGET_SIZE_BYTES (1 MB)
      let quality = 0.92;
      let blob = await canvasToBlob(canvas, quality);

      while (blob.size > TARGET_SIZE_BYTES && quality > 0.55) {
        quality -= 0.08;
        blob = await canvasToBlob(canvas, Math.max(0.55, quality));
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
    } finally {
      // Bersihkan resource memori hanya setelah proses drawImage pada canvas selesai
      if (drawable && typeof drawable.close === 'function') {
        try { drawable.close(); } catch (_) {}
      }
      if (objectUrlToRevoke) {
        try { URL.revokeObjectURL(objectUrlToRevoke); } catch (_) {}
      }
    }
  }

  return {
    compressImage: compressImage,
    formatFileSize: formatFileSize,
    validateImageFile: validateImageFile,
    calculateTargetDimensions: calculateTargetDimensions,
    MAX_WIDTH: MAX_WIDTH,
    MAX_HEIGHT: MAX_HEIGHT,
    MAX_RAW_SIZE_BYTES: MAX_RAW_SIZE_BYTES,
    TARGET_SIZE_BYTES: TARGET_SIZE_BYTES,
    MIN_TARGET_SIZE_BYTES: MIN_TARGET_SIZE_BYTES
  };
});
