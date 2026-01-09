/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, './projects/webapp/src/app/core'),
      '@ui': resolve(__dirname, './projects/webapp/src/app/ui'),
      '@features': resolve(__dirname, './projects/webapp/src/app/feature'),
      '@env': resolve(__dirname, './projects/webapp/src/environments'),
      '@layout': resolve(__dirname, './projects/webapp/src/app/layout'),
      '@pattern': resolve(__dirname, './projects/webapp/src/app/pattern'),
      '@app': resolve(__dirname, './projects/webapp/src/app'),
      'pulpe-shared': resolve(__dirname, '../shared/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['projects/webapp/src/test-setup.ts'],

    include: [
      'projects/webapp/src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['projects/webapp/src/**/*.ts'],
      exclude: [
        'projects/webapp/src/**/*.spec.ts',
        'projects/webapp/src/**/*.test.ts',
        'projects/webapp/src/main.ts',
        'projects/webapp/src/environments/**',
      ],
    },

    // Suppress all stderr output during tests
    onConsoleLog(log, type) {
      // Suppress all stderr logs (console.error, etc.)
      if (type === 'stderr') {
        return false;
      }

      return true; // Allow stdout logs through (console.log, etc.)
    },
  },
});
