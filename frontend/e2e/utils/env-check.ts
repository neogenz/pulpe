/**
 * Utility to check required environment variables for E2E tests
 */
export function checkRequiredEnvVars(): void {
  const requiredVars = ['TEST_EMAIL', 'TEST_PASSWORD'];
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error('\n💡 Please set them before running Critical Path tests:');
    console.error('   export TEST_EMAIL="your-test-email@example.com"');
    console.error('   export TEST_PASSWORD="your-test-password"');

    throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
  }

  console.log('✅ All required environment variables are set');
}

export function getTestCredentials() {
  checkRequiredEnvVars();

  return {
    email: process.env['TEST_EMAIL']!,
    password: process.env['TEST_PASSWORD']!,
  };
}
