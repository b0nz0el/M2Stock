import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['public/assets/js/utils.js'],
      thresholds: {
        lines: 90,
        branches: 80
      }
    }
  }
});
