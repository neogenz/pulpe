import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Angular e2e tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
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
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
    },
    {
      name: 'Chromium - Features (Mocked)',
      testDir: './e2e/tests/features',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: {
    command: 'pnpm run start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
  },
});
