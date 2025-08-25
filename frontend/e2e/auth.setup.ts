import { test as setup } from '@playwright/test';
import type { E2EWindow } from './types/e2e.types';
import { TEST_CONFIG } from './config/test-config';
import { MOCK_API_RESPONSES } from './mocks/api-responses';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Security check: Only inject auth bypass in non-production environments
  await page.addInitScript((config) => {
    // Runtime environment check - multiple production indicators
    const hostname = window.location.hostname;
    const isProduction = 
      hostname.includes('.vercel.app') ||  // Vercel production deployments
      hostname.includes('pulpe.com') ||    // Any pulpe.com domain
      !hostname.includes('localhost') && !hostname.includes('127.0.0.1'); // Not local dev
    
    if (isProduction) {
      throw new Error('E2E auth bypass cannot be used in production environment');
    }
    
    const e2eWindow = window as unknown as E2EWindow;
    e2eWindow.__E2E_AUTH_BYPASS__ = true;
    e2eWindow.__E2E_MOCK_AUTH_STATE__ = {
      user: { 
        id: config.USER.ID, 
        email: config.USER.EMAIL 
      },
      session: { 
        access_token: config.TOKENS.ACCESS,
        user: { 
          id: config.USER.ID, 
          email: config.USER.EMAIL 
        }
      },
      isLoading: false,
      isAuthenticated: true
    };
  }, TEST_CONFIG);

  // Type-safe API mocking
  await page.route('**/api/**', (route) => {
    const url = route.request().url();
    
    // Route to appropriate mock response based on URL
    if (url.includes('auth')) {
      return route.fulfill({ 
        status: 200, 
        body: JSON.stringify(MOCK_API_RESPONSES.auth)
      });
    }
    
    if (url.includes('budgets')) {
      return route.fulfill({ 
        status: 200, 
        body: JSON.stringify(MOCK_API_RESPONSES.budgets)
      });
    }
    
    if (url.includes('templates')) {
      return route.fulfill({ 
        status: 200, 
        body: JSON.stringify(MOCK_API_RESPONSES.templates)
      });
    }
    
    // Default response
    return route.fulfill({ 
      status: 200, 
      body: JSON.stringify({ data: [] })
    });
  });
  
  // Navigate and save auth state
  await page.goto('/app/current-month');
  await page.context().storageState({ path: authFile });
});