import { test, expect } from '../../fixtures/test-fixtures';
import { enableFeatureFlags } from '../../utils/feature-flags';

const CHECKING_ID = '11111111-1111-4111-8111-111111111111';
const LOANS_ID = '22222222-2222-4222-8222-222222222222';

const emptyNetWorth = {
  totals: {
    baseCurrency: 'CHF',
    gross: 0,
    debts: 0,
    net: 0,
    incomplete: false,
  },
  categories: [],
  assets: [],
};

const asset = (
  id: string,
  name: string,
  categoryId: string,
  direction: 'own' | 'owe',
  value: number,
) => ({
  id,
  categoryId,
  name,
  currency: 'CHF',
  direction,
  inPulpe: false,
  archivedAt: null,
  latestValue: value,
  latestRecordedAt: new Date().toISOString(),
  convertedValue: value,
  suggestion: null,
});

const populatedNetWorth = {
  totals: {
    baseCurrency: 'CHF',
    gross: 10_000,
    debts: 3300,
    net: 6700,
    incomplete: false,
  },
  categories: [
    { id: CHECKING_ID, name: 'Comptes', total: 10_000 },
    { id: LOANS_ID, name: 'Prêts', total: 0 },
  ],
  assets: [
    asset(
      '33333333-3333-4333-8333-333333333333',
      'UBS',
      CHECKING_ID,
      'own',
      10_000,
    ),
    asset(
      '44444444-4444-4444-8444-444444444444',
      'Compte à découvert',
      CHECKING_ID,
      'own',
      -300,
    ),
    asset(
      '55555555-5555-4555-8555-555555555555',
      'Leasing',
      LOANS_ID,
      'owe',
      3000,
    ),
  ],
};

test.describe('Mon patrimoine', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await enableFeatureFlags(page, { net_worth: true });
  });

  test('invites to add a first asset when the net worth is empty', async ({
    authenticatedPage: page,
  }) => {
    await page.route('**/api/v1/assets', (route) =>
      route.fulfill({ json: { success: true, data: emptyNetWorth } }),
    );

    await page.goto('/net-worth');

    await expect(page.getByTestId('net-worth-empty')).toBeVisible();
    await expect(page.getByTestId('net-worth-hero')).toBeHidden();
    await page.getByTestId('net-worth-add-button').click();
    await expect(page.getByTestId('asset-form-dialog')).toBeVisible();
  });

  test('shows the totals from the API and draws the Sankey', async ({
    authenticatedPage: page,
  }) => {
    await page.route('**/api/v1/assets', (route) =>
      route.fulfill({ json: { success: true, data: populatedNetWorth } }),
    );

    await page.goto('/net-worth');

    await expect(page.getByTestId('net-worth-net')).toContainText('6’700');
    await expect(page.getByTestId('net-worth-gross')).toContainText('10’000');
    await expect(page.getByTestId('net-worth-debts')).toContainText('3’300');
    await expect(
      page.getByTestId('net-worth-sankey').locator('canvas'),
    ).toBeVisible();

    const rows = page.getByTestId('asset-row-name');
    await expect(rows).toHaveText(['UBS', 'Compte à découvert', 'Leasing']);
    await expect(page.getByTestId('asset-overdraft-chip')).toBeVisible();
  });
});
