#!/usr/bin/env node

/**
 * PostHog Release Creation for Landing Page
 *
 * Creates a release in PostHog to track deployments.
 * The landing page uses static export (no sourcemaps needed),
 * but releases enable version-based error filtering.
 *
 * Environment Variables:
 * - POSTHOG_PERSONAL_API_KEY: Personal API key for PostHog
 * - POSTHOG_CLI_ENV_ID: PostHog project ID (same project as webapp: 87621)
 * - POSTHOG_HOST: PostHog instance URL (optional, defaults to EU)
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const isCI = !!(process.env.CI || process.env.VERCEL || process.env.GITHUB_ACTIONS);
const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
const envId = process.env.POSTHOG_CLI_ENV_ID;
const host = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com';

async function main() {
  if (!apiKey || !envId) {
    console.log('⚠️  PostHog credentials not configured for landing releases. Skipping.');
    return;
  }

  let version;
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    version = pkg.version;
  } catch (error) {
    console.error('❌ Failed to read version from package.json:', error.message);
    process.exit(isCI ? 1 : 0);
  }

  let commitHash;
  try {
    commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    commitHash = 'unknown';
  }

  console.log(`📦 Creating PostHog release for landing v${version} (${commitHash.substring(0, 7)})`);

  try {
    const response = await fetch(`${host}/api/projects/${envId}/error_tracking/releases/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        version: `landing-${version}`,
        hash_id: commitHash,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${response.status} - ${errorText}`);
    }

    console.log(`✅ PostHog release landing-${version} created`);
  } catch (error) {
    console.warn(`⚠️  Release creation failed (non-blocking): ${error.message}`);
  }
}

main().catch((error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(isCI ? 1 : 0);
});
