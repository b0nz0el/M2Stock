/**
 * tailwind.config.js
 * -----------------------------------------------------------------------------
 * aQuaStock Pro saat ini memakai Tailwind via CDN (https://cdn.tailwindcss.com),
 * jadi file ini OPSIONAL dan belum dipakai oleh halaman karena memakai CDN.
 *
 * File ini disiapkan untuk migrasi ke Tailwind CLI/build step di masa depan:
 *   1. `npm i -D tailwindcss`
 *   2. `npx tailwindcss -i ./src/input.css -o ./public/assets/css/tailwind.css --minify`
 *   3. Hapus <script src="https://cdn.tailwindcss.com"></script> dari halaman.
 * -----------------------------------------------------------------------------
 */
module.exports = {
  content: [
    './public/**/*.html',
    './public/assets/js/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        // Palet aQuaStock Pro (dipakai via arbitrary values di HTML)
        brand: {
          DEFAULT: '#0088CC',
          light: '#32ADE6',
          dark: '#0077BB'
        },
        surface: {
          DEFAULT: '#1C1C1E',
          alt: '#2C2C2E'
        },
        success: '#34C759',
        danger: '#FF3B30',
        warning: '#FFCC00',
        muted: '#A0A0A5'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
