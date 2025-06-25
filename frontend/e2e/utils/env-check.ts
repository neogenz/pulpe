/**
 * Utility to check required environment variables for E2E tests
 */
export function checkRequiredEnvVars(): void {
  const requiredVars = ['TEST_EMAIL', 'TEST_PASSWORD'];
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.warn('⚠️  Missing environment variables for real authentication:');
    missingVars.forEach((varName) => {
      console.warn(`   - ${varName}`);
    });
    console.log('📝 Using default test credentials for mocked authentication');
    console.log('💡 For real E2E tests, set environment variables:');
    console.log('   export TEST_EMAIL="your-test-email@example.com"');
    console.log('   export TEST_PASSWORD="your-test-password"');
    return; // Continue with default values instead of throwing
  }

  console.log('✅ All required environment variables are set');
}

export function getTestCredentials() {
  checkRequiredEnvVars();

  // Use environment variables if available, otherwise use default test credentials
  const email = process.env['TEST_EMAIL'] || 'test@example.com';
  const password = process.env['TEST_PASSWORD'] || 'password123';

  return {
    email,
    password,
  };
}
