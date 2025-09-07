#!/usr/bin/env node

/**
 * PostHog Source Maps Upload Script
 * 
 * This script injects source map metadata and uploads them to PostHog
 * for better error tracking and debugging in production.
 * 
 * Usage: npm run upload:sourcemaps
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Configuration
const DIST_DIR = './dist/webapp/browser';
const POSTHOG_CLI = 'posthog-cli';

function main() {
  console.log('🚀 PostHog Source Maps Upload');
  console.log('===============================');

  // Check if dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ Distribution directory not found: ${DIST_DIR}`);
    console.error('Please run "npm run build" first to generate build artifacts.');
    process.exit(1);
  }

  // Check if source maps exist
  const hasSourceMaps = fs.readdirSync(DIST_DIR)
    .some(file => file.endsWith('.js.map'));

  if (!hasSourceMaps) {
    console.error('❌ No source map files found in dist directory.');
    console.error('Make sure source maps are enabled in your build configuration.');
    process.exit(1);
  }

  try {
    // Step 1: Inject source map metadata
    console.log('\n📝 Step 1: Injecting source map metadata...');
    execSync(`${POSTHOG_CLI} sourcemap inject --directory ${DIST_DIR}`, {
      stdio: 'inherit'
    });
    console.log('✅ Source map metadata injected successfully');

    // Step 2: Upload source maps to PostHog
    console.log('\n☁️  Step 2: Uploading source maps to PostHog...');
    execSync(`${POSTHOG_CLI} sourcemap upload --directory ${DIST_DIR}`, {
      stdio: 'inherit'
    });
    console.log('✅ Source maps uploaded successfully');

    console.log('\n🎉 PostHog source maps processing completed!');
    console.log('Your error tracking will now show readable stack traces.');

  } catch (error) {
    console.error('\n❌ Error during source maps processing:', error.message);
    console.error('\nMake sure you have:');
    console.error('1. PostHog CLI installed: npm install -g posthog-cli');
    console.error('2. PostHog API key configured: posthog-cli config set-key YOUR_API_KEY');
    console.error('3. Valid PostHog project configured');
    process.exit(1);
  }
}

main();