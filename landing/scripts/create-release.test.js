import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Tests for create-release.js
 *
 * Run: node --test landing/scripts/create-release.test.js
 *
 * Tests the guards (missing credentials, non-production env),
 * the API payload structure, and error handling.
 */

// Save original env
const originalEnv = { ...process.env };

// Track console output
let logs = [];
let warns = [];
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
  // Reset env
  delete process.env.POSTHOG_PERSONAL_API_KEY;
  delete process.env.POSTHOG_CLI_ENV_ID;
  delete process.env.POSTHOG_HOST;
  delete process.env.VERCEL_ENV;
  delete process.env.CI;
  delete process.env.VERCEL;
  delete process.env.GITHUB_ACTIONS;
  logs = [];
  warns = [];
  console.log = (...args) => logs.push(args.join(' '));
  console.warn = (...args) => warns.push(args.join(' '));
  console.error = () => {};
});

afterEach(() => {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
  Object.assign(process.env, originalEnv);
});

describe('create-release.js guards', () => {
  it('should skip when POSTHOG_PERSONAL_API_KEY is missing', async () => {
    process.env.POSTHOG_CLI_ENV_ID = '87621';

    // Import fresh module (node --test isolates)
    const exitMock = mock.fn();
    const origExit = process.exit;
    process.exit = exitMock;

    try {
      await import('./create-release.js?skip1');
    } catch {
      // Module may throw or exit
    }

    process.exit = origExit;

    assert.ok(
      logs.some((l) => l.includes('not configured') || l.includes('Skipping')),
      'Should log skip message when API key is missing',
    );
  });

  it('should skip when POSTHOG_CLI_ENV_ID is missing', async () => {
    process.env.POSTHOG_PERSONAL_API_KEY = 'phx_test';

    const exitMock = mock.fn();
    const origExit = process.exit;
    process.exit = exitMock;

    try {
      await import('./create-release.js?skip2');
    } catch {
      // Module may throw or exit
    }

    process.exit = origExit;

    assert.ok(
      logs.some((l) => l.includes('not configured') || l.includes('Skipping')),
      'Should log skip message when ENV_ID is missing',
    );
  });

  it('should skip on non-production Vercel deploy', async () => {
    process.env.POSTHOG_PERSONAL_API_KEY = 'phx_test';
    process.env.POSTHOG_CLI_ENV_ID = '87621';
    process.env.VERCEL_ENV = 'preview';

    const exitMock = mock.fn();
    const origExit = process.exit;
    process.exit = exitMock;

    try {
      await import('./create-release.js?skip3');
    } catch {
      // Module may throw or exit
    }

    process.exit = origExit;

    assert.ok(
      logs.some((l) => l.includes('Non-production') || l.includes('skipping')),
      'Should log skip message for preview deploys',
    );
  });
});

describe('create-release.js API call', () => {
  it('should call PostHog API with correct payload structure', async () => {
    process.env.POSTHOG_PERSONAL_API_KEY = 'phx_test_key';
    process.env.POSTHOG_CLI_ENV_ID = '87621';
    process.env.POSTHOG_HOST = 'https://test.posthog.com';
    process.env.VERCEL_ENV = 'production';

    let capturedUrl = '';
    let capturedOptions = {};

    // Mock global fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return { ok: true, json: async () => ({}) };
    };

    const exitMock = mock.fn();
    const origExit = process.exit;
    process.exit = exitMock;

    try {
      await import('./create-release.js?api1');
      // Give the async main() time to complete
      await new Promise((r) => setTimeout(r, 100));
    } catch {
      // Module may throw
    }

    process.exit = origExit;
    globalThis.fetch = originalFetch;

    // Verify URL
    assert.ok(
      capturedUrl.includes('/api/projects/87621/error_tracking/releases/'),
      `URL should target project 87621, got: ${capturedUrl}`,
    );
    assert.ok(
      capturedUrl.startsWith('https://test.posthog.com'),
      `URL should use custom host, got: ${capturedUrl}`,
    );

    // Verify headers
    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
    assert.equal(capturedOptions.headers['Authorization'], 'Bearer phx_test_key');

    // Verify payload
    const body = JSON.parse(capturedOptions.body);
    assert.ok(body.version.startsWith('landing-'), `Version should start with "landing-", got: ${body.version}`);
    assert.ok(body.hash_id, 'Should include hash_id');
  });

  it('should handle API errors gracefully (non-blocking)', async () => {
    process.env.POSTHOG_PERSONAL_API_KEY = 'phx_test_key';
    process.env.POSTHOG_CLI_ENV_ID = '87621';
    process.env.VERCEL_ENV = 'production';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    const exitMock = mock.fn();
    const origExit = process.exit;
    process.exit = exitMock;

    try {
      await import('./create-release.js?api2');
      await new Promise((r) => setTimeout(r, 100));
    } catch {
      // Module may throw
    }

    process.exit = origExit;
    globalThis.fetch = originalFetch;

    // Should warn but not crash
    assert.ok(
      warns.some((w) => w.includes('Release creation failed')),
      'Should warn about failure, not crash',
    );
    // process.exit should NOT have been called (non-blocking)
    assert.equal(exitMock.mock.callCount(), 0, 'Should not exit on API error');
  });
});
