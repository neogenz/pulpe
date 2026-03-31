const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

/**
 * Tests for upload-sourcemaps.js
 *
 * Run: node --test frontend/scripts/upload-sourcemaps.test.js
 *
 * Tests version extraction, CLI command construction,
 * environment validation, and error handling.
 */

describe('upload-sourcemaps: getVersion()', () => {
  it('should read version from frontend/package.json', () => {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    assert.ok(packageJson.version, 'package.json should have a version field');
    assert.match(packageJson.version, /^\d+\.\d+\.\d+/, 'Version should be semver format');
  });
});

describe('upload-sourcemaps: CLI command construction', () => {
  it('should use pnpm exec posthog-cli (not npx)', () => {
    const scriptContent = fs.readFileSync(path.join(__dirname, 'upload-sourcemaps.js'), 'utf8');

    assert.ok(
      scriptContent.includes("pnpm exec posthog-cli"),
      'Should use pnpm exec posthog-cli instead of npx @posthog/cli',
    );
    assert.ok(
      !scriptContent.includes("npx @posthog/cli"),
      'Should NOT use npx @posthog/cli (causes musl fallback on Vercel)',
    );
  });

  it('should include --release-name and --release-version flags in upload command', () => {
    const scriptContent = fs.readFileSync(path.join(__dirname, 'upload-sourcemaps.js'), 'utf8');

    assert.ok(
      scriptContent.includes('--release-name pulpe-webapp'),
      'Upload command should include --release-name pulpe-webapp',
    );
    assert.ok(
      scriptContent.includes('--release-version'),
      'Upload command should include --release-version',
    );
  });

  it('should set POSTHOG_CLI_TOKEN env var for CLI auth (not pass key in command)', () => {
    const scriptContent = fs.readFileSync(path.join(__dirname, 'upload-sourcemaps.js'), 'utf8');

    assert.ok(
      scriptContent.includes('POSTHOG_CLI_TOKEN: apiKey'),
      'Should pass API key via POSTHOG_CLI_TOKEN env var',
    );
    // Verify the key is NOT interpolated into the command string
    const uploadCmdLine = scriptContent.split('\n').find(l => l.includes('uploadCmd'));
    assert.ok(
      !uploadCmdLine.includes('apiKey'),
      'API key should NOT be interpolated in the command string',
    );
  });
});

describe('upload-sourcemaps: environment validation', () => {
  it('should default PostHog host to EU instance', () => {
    const scriptContent = fs.readFileSync(path.join(__dirname, 'upload-sourcemaps.js'), 'utf8');

    assert.ok(
      scriptContent.includes("'https://eu.i.posthog.com'"),
      'Default host should be https://eu.i.posthog.com',
    );
  });

  it('should log SET/MISSING for env vars in CI (never the actual value)', () => {
    const scriptContent = fs.readFileSync(path.join(__dirname, 'upload-sourcemaps.js'), 'utf8');

    // Find the debug logging lines
    const debugLines = scriptContent.split('\n').filter(l =>
      l.includes('POSTHOG_PERSONAL_API_KEY') && l.includes('SET')
    );

    assert.ok(debugLines.length > 0, 'Should have debug logging for API key');
    assert.ok(
      debugLines.every(l => l.includes("? 'SET' : 'MISSING'")),
      'Should only log SET or MISSING, never the actual key value',
    );
  });

  it('should exit with 0 (not 1) when credentials missing in local dev', () => {
    const scriptContent = fs.readFileSync(path.join(__dirname, 'upload-sourcemaps.js'), 'utf8');

    assert.ok(
      scriptContent.includes('process.exit(isCI ? 1 : 0)'),
      'Should exit 0 in local, 1 in CI — non-blocking locally',
    );
  });
});

describe('upload-sourcemaps: PostHog CLI version', () => {
  it('should have @posthog/cli >= 0.6.0 in devDependencies', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
    );

    const cliVersion = packageJson.devDependencies?.['@posthog/cli'];
    assert.ok(cliVersion, '@posthog/cli should be in devDependencies');

    // Extract the minimum version number
    const versionMatch = cliVersion.match(/(\d+)\.(\d+)\.(\d+)/);
    assert.ok(versionMatch, `Version should be parseable: ${cliVersion}`);

    const [, major, minor] = versionMatch.map(Number);
    assert.ok(
      major > 0 || minor >= 6,
      `@posthog/cli should be >= 0.6.0 (has --release-name flag), got ${cliVersion}`,
    );
  });
});
