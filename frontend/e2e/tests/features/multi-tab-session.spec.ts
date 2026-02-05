import { test, expect } from '../../fixtures/test-fixtures';
import { setupAuthBypass, setupMaintenanceMock } from '../../utils/auth-bypass';
import type { Page } from '@playwright/test';

const setRememberedClientKey = async (page: Page) => {
  await page.addInitScript(() => {
    const entry = {
      version: 1,
      data: 'aa'.repeat(32),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem('pulpe-vault-client-key-local', JSON.stringify(entry));
    sessionStorage.removeItem('pulpe-vault-client-key-session');
  });
};

const setLoggedOutState = async (page: Page) => {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __E2E_AUTH_BYPASS__?: boolean;
      __E2E_MOCK_AUTH_STATE__?: {
        user: null;
        session: null;
        isLoading: false;
        isAuthenticated: false;
      };
    };
    w.__E2E_AUTH_BYPASS__ = true;
    w.__E2E_MOCK_AUTH_STATE__ = {
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    };
  });
};

test.describe('Multi-tab session', () => {
  test.describe.configure({ mode: 'parallel' });

  test('logout in one tab signs out the other after refresh', async ({
    page,
  }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      vaultCodeConfigured: true,
    });
    await setRememberedClientKey(page);

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/(dashboard|budget)/);

    const page2 = await page.context().newPage();
    await setupMaintenanceMock(page2);
    await setupAuthBypass(page2, {
      includeApiMocks: true,
      setLocalStorage: false,
      vaultCodeConfigured: true,
    });

    await page2.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page2).toHaveURL(/\/(dashboard|budget)/);

    await expect(page.getByTestId('user-menu-trigger')).toBeVisible();
    await page.getByTestId('user-menu-trigger').click();
    await expect(page.getByTestId('logout-button')).toBeVisible();
    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/(login|welcome)/);

    await setLoggedOutState(page2);
    await page2.reload({ waitUntil: 'domcontentloaded' });
    await expect(page2).toHaveURL(/\/(login|welcome)/);

    const storage = await page2.evaluate(() => ({
      local: localStorage.getItem('pulpe-vault-client-key-local'),
      session: sessionStorage.getItem('pulpe-vault-client-key-session'),
    }));

    expect(storage.local).toBeNull();
    expect(storage.session).toBeNull();
  });
});
