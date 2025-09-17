import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Angular e2e tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? '50%' : undefined, // Use Playwright default for better performance
  reporter: process.env.CI
    ? [['blob'], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure', // Capture trace for all failures, not just retries
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 10000,
  },

  testDir: './e2e',

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'Critical User Journeys (Mocked)',
      dependencies: ['setup'],
      testMatch: '**/critical-path/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
    },
    {
      name: 'Feature Tests (Mocked)',
      testMatch: '**/features/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Features use authenticatedPage fixture, no storageState needed
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
    command: process.env.CI
      ? 'DOTENV_CONFIG_PATH=.env.e2e pnpm run start:ci'
      : 'DOTENV_CONFIG_PATH=.env.e2e pnpm run start',
    port: 4200,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    // Environment variables are now loaded via dotenv from .env.test
    // This fixes the issue where webServer.env variables weren't passed to npm scripts chained
    timeout: 120000,
    cwd: __dirname,
  },
});
