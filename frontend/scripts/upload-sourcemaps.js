#!/usr/bin/env node

/**
 * PostHog Source Maps Upload Script
 *
 * This script injects source map metadata and uploads them to PostHog
 * for better error tracking and debugging in production.
 *
 * Environment Variables (required for CI/CD):
 * - POSTHOG_PERSONAL_API_KEY: Personal API key for PostHog
 * - POSTHOG_CLI_ENV_ID: PostHog project ID (number)
 * - POSTHOG_HOST: PostHog instance URL (optional, defaults to EU)
 *
 * Usage: npm run upload:sourcemaps
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const DIST_DIR = './dist/webapp/browser';
const POSTHOG_CLI = 'npx @posthog/cli';

// Environment detection
const isCI = !!(process.env.CI || process.env.VERCEL || process.env.GITHUB_ACTIONS);
const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
const envId = process.env.POSTHOG_CLI_ENV_ID;
const host = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com';

function getVersionInfo() {
  let version, commitHash;

  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    if (!packageJson.version) {
      throw new Error('package.json is missing "version" field');
    }

    version = packageJson.version;
  } catch (error) {
    console.error('❌ Failed to read version from package.json:', error.message);
    process.exit(1);
  }

  try {
    commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    console.warn('⚠️  Could not get git commit hash');
    commitHash = 'unknown';
  }

  return { version, commitHash };
}

async function createPostHogRelease(version, commitHash) {
  const url = `${host}/api/projects/${envId}/error_tracking/releases/`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      version: version,
      hash_id: commitHash
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create release: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function main() {
  console.log('🚀 PostHog Source Maps Upload & Release');
  console.log('========================================');
  console.log(`Environment: ${isCI ? 'CI/CD' : 'Local'}`);
  console.log(`Host: ${host}`);

  // Environment validation
  if (isCI && !apiKey) {
    console.error('❌ POSTHOG_PERSONAL_API_KEY environment variable is required in CI/CD');
    console.error('Please configure this variable in your Vercel project settings.');
    process.exit(1);
  }

  if (isCI && !envId) {
    console.error('❌ POSTHOG_CLI_ENV_ID environment variable is required in CI/CD');
    console.error('Get your Project ID from PostHog Dashboard → Settings → Project variables');
    console.error('Please configure this variable in your Vercel project settings.');
    process.exit(1);
  }

  if (!isCI && (!apiKey || !envId)) {
    console.log('⚠️  PostHog credentials not fully configured');
    console.log('Skipping sourcemap upload in local development.');
    console.log('To test locally, set these environment variables:');
    console.log('- POSTHOG_PERSONAL_API_KEY=phc_your_key_here');
    console.log('- POSTHOG_CLI_ENV_ID=your_project_id_here');
    return;
  }

  // Check if dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ Distribution directory not found: ${DIST_DIR}`);
    console.error('Please run "npm run build" first to generate build artifacts.');
    process.exit(1);
  }

  // Check if source maps exist
  const files = fs.readdirSync(DIST_DIR);
  const sourceMapFiles = files.filter(file => file.endsWith('.js.map'));
  const jsFiles = files.filter(file => file.endsWith('.js') && !file.endsWith('.js.map'));

  if (sourceMapFiles.length === 0) {
    console.error('❌ No source map files found in dist directory.');
    console.error('Make sure source maps are enabled in your build configuration.');
    console.error('Check angular.json production configuration for sourceMap settings.');
    process.exit(1);
  }

  console.log(`📊 Found ${sourceMapFiles.length} source map files and ${jsFiles.length} JS bundles`);

  // Set environment variables for PostHog CLI (official variables)
  const env = {
    ...process.env,
    POSTHOG_CLI_TOKEN: apiKey,
    POSTHOG_CLI_HOST: host,
    POSTHOG_CLI_ENV_ID: envId
  };

  // Debug: log env vars visibility in CI
  if (isCI) {
    console.log(`🔍 POSTHOG_PERSONAL_API_KEY: ${apiKey ? 'SET' : 'MISSING'}`);
    console.log(`🔍 POSTHOG_CLI_ENV_ID: ${envId ? 'SET' : 'MISSING'}`);
    console.log(`🔍 POSTHOG_HOST: ${host}`);
  }

  try {
    // Step 1: Inject source map metadata
    console.log('\n📝 Step 1: Injecting source map metadata...');
    const injectCmd = `${POSTHOG_CLI} sourcemap inject --directory ${DIST_DIR}`;
    execSync(injectCmd, {
      stdio: isCI ? 'pipe' : 'inherit',
      env
    });
    console.log('✅ Source map metadata injected successfully');

    // Verify injection by checking for chunkId comments
    const sampleJsFile = jsFiles[0];
    if (sampleJsFile) {
      const jsContent = fs.readFileSync(`${DIST_DIR}/${sampleJsFile}`, 'utf8');
      const hasChunkId = jsContent.includes('//# chunkId=');
      if (hasChunkId) {
        console.log('✅ ChunkId metadata verified in bundle');
      } else {
        console.warn('⚠️  ChunkId metadata not found - injection may have failed');
      }
    }

    // Step 2: Upload source maps to PostHog
    console.log('\n☁️  Step 2: Uploading source maps to PostHog...');
    const uploadCmd = `${POSTHOG_CLI} sourcemap upload --directory ${DIST_DIR}`;
    execSync(uploadCmd, {
      stdio: isCI ? 'pipe' : 'inherit',
      env
    });
    console.log('✅ Source maps uploaded successfully');

    // Step 3: Create PostHog release for version tracking
    console.log('\n📦 Step 3: Creating PostHog release...');
    const { version, commitHash } = getVersionInfo();
    console.log(`   Version: ${version}`);
    console.log(`   Commit: ${commitHash.substring(0, 7)}`);

    try {
      await createPostHogRelease(version, commitHash);
      console.log('✅ PostHog release created successfully');
    } catch (releaseError) {
      console.warn(`⚠️  Release creation failed (non-blocking): ${releaseError.message}`);
    }

    console.log('\n🎉 PostHog source maps processing completed!');
    console.log('Your error tracking will now show readable stack traces.');
    console.log('Errors will be grouped by release version.');

  } catch (error) {
    console.error('\n❌ Error during source maps processing:', error.message);

    if (isCI) {
      console.error('\nCI/CD Environment - Please check:');
      console.error('1. POSTHOG_PERSONAL_API_KEY is set in Vercel environment variables');
      console.error('2. POSTHOG_CLI_ENV_ID is set in Vercel environment variables');
      console.error('3. POSTHOG_HOST is correct for your instance');
      console.error('4. API key has sourcemap upload permissions');
      console.error('5. Project ID corresponds to your PostHog project');
    } else {
      console.error('\nLocal Development - Please check:');
      console.error('1. Set POSTHOG_PERSONAL_API_KEY environment variable');
      console.error('2. Set POSTHOG_CLI_ENV_ID environment variable');
      console.error('3. Ensure API key has sourcemap upload permissions');
      console.error('4. Verify network connectivity to PostHog');
    }

    // In CI, fail the build. In local, just warn.
    process.exit(isCI ? 1 : 0);
  }
}

main().catch((error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});