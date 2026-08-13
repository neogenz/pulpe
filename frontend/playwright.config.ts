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
  maxFailures: process.env.CI ? 10 : undefined, // Limite les échecs en CI
  expect: {
    timeout: 10000, // Timeout for expect assertions
  },
  reporter: process.env.CI
    ? [
        ['blob'],
        ['github'],
        ['junit', { outputFile: 'test-results/junit.xml' }],
      ]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    // The app resolves its language from the browser when nothing is stored.
    // 109 assertions across 35 spec files read literal French copy, so a runner
    // whose Chromium defaults to English would drop all of them at once — as
    // opaque locator timeouts, never as "wrong language".
    locale: 'fr-FR',
    trace: 'retain-on-failure', // Capture trace for all failures, not just retries
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 10000,
  },
  reportSlowTests: {
    max: 5,
    threshold: 10000,
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
    command: 'DOTENV_CONFIG_PATH=.env.e2e pnpm run start:ci',
    port: 4200,
    // Never adopt a server already on :4200 - it may belong to another project, or
    // to `pnpm dev`, neither of which runs prestart:ci to build config.json from .env.e2e.
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    // Environment variables are now loaded via dotenv from .env.test
    // This fixes the issue where webServer.env variables weren't passed to npm scripts chained
    timeout: 120000,
    cwd: __dirname,
    env: {
      NODE_ENV: process.env.NODE_ENV || 'test',
    },
  },
});
