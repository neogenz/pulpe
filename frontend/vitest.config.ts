/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',

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
  },
});
