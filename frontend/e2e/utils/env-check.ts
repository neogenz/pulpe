/**
 * Utility to check required environment variables for E2E tests
 */
export function checkRequiredEnvVars(): void {
  const requiredVars = ['TEST_EMAIL', 'TEST_PASSWORD'];
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    return;
  }
}

export function getTestCredentials() {
  checkRequiredEnvVars();

  const email = process.env['TEST_EMAIL'] || 'test@example.com';
  const password = process.env['TEST_PASSWORD'] || 'password123';

  return {
    email,
    password,
  };
}