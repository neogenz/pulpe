import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright Configuration 2025
 * Optimized for maximum parallelization, stability, and modern patterns
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e/tests',
  
  // Maximum parallelization for CI/CD
  fullyParallel: true,
  workers: process.env.CI ? '100%' : '80%', // Use all available cores
  
  // Strict mode: fail on any test.only() in CI
  forbidOnly: !!process.env.CI,
  
  // Retries only in CI for flaky network issues
  retries: process.env.CI ? 1 : 0,
  
  // Timeouts optimized for modern apps
  timeout: 15_000, // 15s per test (reduced from 30s)
  expect: {
    timeout: 5_000, // 5s for assertions
  },
  
  // Reporter configuration
  reporter: process.env.CI 
    ? [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'test-results.json' }],
        ['junit', { outputFile: 'junit.xml' }],
      ]
    : [
        ['list'],
        ['html', { open: 'on-failure' }],
      ],
  
  // Global test configuration
  use: {
    // Base URL for all tests
    baseURL: process.env.BASE_URL || 'http://localhost:4200',
    
    // Artifact collection on failure only
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Modern browser settings
    actionTimeout: 5_000, // 5s for actions (click, fill, etc.)
    navigationTimeout: 10_000, // 10s for page navigation
    
    // Viewport for consistent testing
    viewport: { width: 1280, height: 720 },
    
    // Permissions and features
    permissions: ['clipboard-read', 'clipboard-write'],
    
    // Emulate a logged-in user for most tests
    storageState: process.env.SKIP_AUTH ? undefined : 'playwright/.auth/user.json',
    
    // Modern browser context options
    ignoreHTTPSErrors: true,
    bypassCSP: true,
    
    // Locale for consistent testing
    locale: 'fr-FR',
    timezoneId: 'Europe/Zurich',
    
    // Device emulation
    ...devices['Desktop Chrome'],
    
    // Custom test attributes
    testIdAttribute: 'data-testid',
  },

  // Project configuration for different test suites
  projects: [
    // Authentication setup (runs first)
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        storageState: undefined, // Start with clean state
      },
    },

    // Main test suite - Desktop Chrome
    {
      name: 'desktop-chrome',
      dependencies: process.env.SKIP_AUTH ? [] : ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
      grep: /@desktop|@all/,
      grepInvert: /@mobile|@skip/,
    },

    // Mobile test suite - iPhone
    {
      name: 'mobile-safari',
      dependencies: process.env.SKIP_AUTH ? [] : ['auth-setup'],
      use: {
        ...devices['iPhone 14'],
      },
      grep: /@mobile|@all/,
      grepInvert: /@desktop|@skip/,
    },

    // Accessibility testing with screen reader
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        // Force high contrast mode for a11y testing
        colorScheme: 'dark',
        forcedColors: 'active',
      },
      testMatch: /.*\.a11y\.spec\.ts/,
    },

    // API testing (no browser needed)
    {
      name: 'api',
      use: {
        baseURL: process.env.API_URL || 'http://localhost:3000',
        // No browser context for API tests
        storageState: undefined,
      },
      testMatch: /.*\.api\.spec\.ts/,
    },
  ],

  // Web server configuration
  webServer: {
    command: process.env.CI 
      ? 'pnpm run build && pnpm run preview'
      : 'pnpm run dev',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000, // 2 minutes to start
  },

  // Output folder for test artifacts
  outputDir: 'test-results',

  // Global setup and teardown
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: undefined, // No global teardown needed

  // Preserve output for debugging
  preserveOutput: 'failures-only',

  // Update snapshots in CI with specific flag
  updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true' ? 'all' : 'missing',

  // Modern Playwright features
  reportSlowTests: {
    max: 5,
    threshold: 10_000, // Report tests slower than 10s
  },

  // Shard configuration for distributed testing
  shard: process.env.SHARD 
    ? {
        current: parseInt(process.env.SHARD.split('/')[0]),
        total: parseInt(process.env.SHARD.split('/')[1]),
      }
    : undefined,

  // Metadata for reporting
  metadata: {
    browser: 'chromium',
    platform: process.platform,
    headless: process.env.HEADLESS !== 'false',
    video: process.env.CI ? 'on-failure' : 'off',
    trace: process.env.CI ? 'on-failure' : 'off',
  },
});

/**
 * Environment Variables:
 * - CI: Set in CI environment for optimized settings
 * - BASE_URL: Override base URL (default: http://localhost:4200)
 * - API_URL: API base URL (default: http://localhost:3000)
 * - SKIP_AUTH: Skip authentication setup
 * - HEADLESS: Run in headless mode (default: true)
 * - UPDATE_SNAPSHOTS: Update all snapshots
 * - SHARD: Shard configuration (e.g., "1/4" for first of 4 shards)
 * 
 * Test Tags:
 * - @all: Run on all platforms
 * - @desktop: Desktop only tests
 * - @mobile: Mobile only tests
 * - @skip: Skip this test
 * - @smoke: Quick smoke tests
 * - @critical: Critical user paths
 */