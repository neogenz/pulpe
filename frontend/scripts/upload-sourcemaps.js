#!/usr/bin/env node

/**
 * PostHog Source Maps Upload Script
 *
 * This script injects source map metadata and uploads them to PostHog
 * for better error tracking and debugging in production.
 *
 * Environment Variables:
 * - POSTHOG_PERSONAL_API_KEY: Personal API key for PostHog (required in CI)
 * - POSTHOG_HOST: PostHog instance URL (defaults to EU instance)
 * - CI: Detected automatically by CI environments
 *
 * Usage: npm run upload:sourcemaps
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Configuration
const DIST_DIR = './dist/webapp/browser';
const POSTHOG_CLI = 'npx @posthog/cli';

// Environment detection
const isCI = !!(process.env.CI || process.env.VERCEL || process.env.GITHUB_ACTIONS);
const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
const host = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com';
const envId = process.env.POSTHOG_CLI_ENV_ID;

function main() {
  console.log('🚀 PostHog Source Maps Upload');
  console.log('===============================');
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

  if (!isCI && !apiKey) {
    console.log('⚠️  POSTHOG_PERSONAL_API_KEY not configured');
    console.log('Skipping sourcemap upload in local development.');
    console.log('To test locally, set POSTHOG_PERSONAL_API_KEY and POSTHOG_CLI_ENV_ID environment variables.');
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
  const hasSourceMaps = files.some(file => file.endsWith('.js.map'));
  const jsFiles = files.filter(file => file.endsWith('.js') && !file.endsWith('.js.map'));

  if (!hasSourceMaps) {
    console.error('❌ No source map files found in dist directory.');
    console.error('Make sure source maps are enabled in your build configuration.');
    console.error('Check angular.json production configuration for sourceMap settings.');
    process.exit(1);
  }

  console.log(`📊 Found ${hasSourceMaps} source map files and ${jsFiles.length} JS bundles`);

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
    console.log(`🔍 POSTHOG_HOST: ${host}`);
    console.log(`🔍 POSTHOG_CLI_ENV_ID: ${envId ? 'SET' : 'MISSING'}`);
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

    console.log('\n🎉 PostHog source maps processing completed!');
    console.log('Your error tracking will now show readable stack traces.');
    console.log('Symbol sets are retained for 90 days and will not be overwritten by future deployments.');

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

main();