import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Validates the E2E test structure and configuration
 */
export async function validateTestStructure(): Promise<void> {
  console.log('🔍 Validating E2E test structure...\n');

  try {
    // Check Playwright configuration
    const { stdout: listOutput } = await execAsync(
      'npx playwright test --list',
    );

    const setupTests = (listOutput.match(/\[setup\]/g) || []).length;
    const criticalTests = (
      listOutput.match(/\[Chromium - Critical Path\]/g) || []
    ).length;
    const featureTests = (
      listOutput.match(/\[Chromium - Features \(Mocked\)\]/g) || []
    ).length;

    console.log('📊 Test Distribution:');
    console.log(`   Setup: ${setupTests} test(s)`);
    console.log(`   Critical Path: ${criticalTests} test(s)`);
    console.log(`   Features (Mocked): ${featureTests} test(s)`);
    console.log(
      `   Total: ${setupTests + criticalTests + featureTests} test(s)\n`,
    );

    // Validate expected numbers
    if (setupTests !== 1) {
      throw new Error(`Expected 1 setup test, found ${setupTests}`);
    }

    if (criticalTests < 4) {
      console.warn(
        `⚠️  Only ${criticalTests} critical path tests. Consider adding more.`,
      );
    }

    if (featureTests < 20) {
      console.warn(
        `⚠️  Only ${featureTests} feature tests. This might be low.`,
      );
    }

    console.log('✅ Test structure validation passed!');
  } catch (error) {
    console.error('❌ Test structure validation failed:', error);
    throw error;
  }
}

/**
 * Quick health check for the E2E setup
 */
export async function quickHealthCheck(): Promise<void> {
  console.log('🏥 Running E2E health check...\n');

  try {
    // Check TypeScript compilation
    await execAsync('npx tsc --noEmit --project e2e/tsconfig.json');
    console.log('✅ TypeScript compilation successful');

    // Validate test structure
    await validateTestStructure();

    console.log('\n🎉 All checks passed! E2E setup is healthy.');
  } catch (error) {
    console.error('\n💀 Health check failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  quickHealthCheck();
}
