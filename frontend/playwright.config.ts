import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Angular e2e tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: process.env.CI ? 60000 : 30000,
  // 🚀 Optimisation CI : 4 workers pour accélérer l'exécution
  workers: process.env.CI ? 4 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'Chromium - Critical Path',
      dependencies: ['setup'],
      testDir: './e2e/tests/critical-path',
      workers: process.env.CI ? 2 : undefined,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
    },
    {
      name: 'Chromium - Features (Mocked)',
      testDir: './e2e/tests/features',
      workers: process.env.CI ? 4 : undefined,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: {
    command: process.env.CI ? 'pnpm run start:ci' : 'pnpm run start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
  },
});
