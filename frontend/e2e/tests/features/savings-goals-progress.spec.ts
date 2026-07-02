import { test, expect } from '../../fixtures/test-fixtures';

/**
 * PUL-8 (CA10-CA12): track a savings goal progression.
 * Drives list to detail with a mocked GET savings-goals/:id/progress route.
 * No live backend: the local DB may be reset by another agent at any time.
 */

const GOAL_ID = '00000000-0000-4000-a000-000000000301';
const USER_ID = '00000000-0000-4000-a000-000000000201';
const GOAL_NAME = 'Vacances été 2027';

const goal = {
  id: GOAL_ID,
  userId: USER_ID,
  name: GOAL_NAME,
  targetAmount: 3000,
  targetDate: '2027-08-01',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const progress = {
  goalId: GOAL_ID,
  status: 'ACTIVE',
  targetAmount: 3000,
  targetDate: '2027-08-01',
  plannedCumulative: 1200,
  confirmed: 900,
  achievementPercent: 30,
  monthsElapsed: 3,
  monthsRemaining: 12,
  isOverdue: false,
  pace: 400,
  confirmedPace: 300,
  required: 175,
  projected: 4500,
  paceStatus: 'on_track',
  // D2 — surface the "mark completed" suggestion.
  suggestCompletion: true,
  linkedLineCount: 2,
  originalTargetAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
};

test.describe('Savings goal progression (PUL-8)', () => {
  test('navigates list → detail and shows the progress bar, Pointé label and D2 CTA', async ({
    authenticatedPage: page,
  }) => {
    // Registered after the global fixture mocks → matched first (LIFO).
    await page.route('**/api/v1/savings-goals/*/progress', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: progress }),
      }),
    );
    await page.route('**/api/v1/savings-goals', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [goal] }),
      }),
    );

    await page.goto('/savings-goals');
    await page.waitForLoadState('domcontentloaded');

    const card = page.getByTestId(`savings-goal-${GOAL_NAME}`);
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(new RegExp(`/savings-goals/${GOAL_ID}$`));
    await expect(page.getByTestId('savings-goal-detail-page')).toBeVisible();

    // Two-layer progress bar with the confirmed (Pointé) layer.
    await expect(page.getByTestId('savings-goal-progress-bar')).toBeVisible();
    await expect(page.getByTestId('progress-confirmed-layer')).toBeVisible();
    await expect(page.getByTestId('progress-planned-layer')).toBeVisible();
    await expect(page.getByTestId('savings-goal-detail-page')).toContainText(
      'Pointé',
    );

    // D2 — completion suggestion CTA is visible.
    await expect(
      page.getByTestId('savings-goal-mark-completed-button'),
    ).toBeVisible();
  });
});
