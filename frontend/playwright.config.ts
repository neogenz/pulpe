import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Angular e2e tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 20000,
  workers: process.env.CI ? '50%' : '75%',
  reporter: [['json', { outputFile: 'test-results.json' }], ['list']],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 5000,
    navigationTimeout: 10000,
  },

  testDir: './e2e',
  
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'Chromium - Critical Path',
      dependencies: ['setup'],
      testMatch: '**/critical-path/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
    },
    {
      name: 'Chromium - Features (Mocked)',
      dependencies: ['setup'],
      testMatch: '**/features/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
    },
    {
      name: 'Chromium - Smoke',
      dependencies: ['setup'],
      testMatch: '**/smoke/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
    },
  ],

  webServer: {
    command: process.env.CI ? 'pnpm run start:ci' : 'pnpm run start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
  },
});