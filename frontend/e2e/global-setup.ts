import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  process.env['E2E_TESTING'] = 'true';
}

export default globalSetup;
