import { test, expect } from '../../fixtures/test-fixtures';
import type { SavingsGoal, SavingsGoalProgress } from 'pulpe-shared';

/**
 * PUL-293: "Montant de départ" (initial amount) on a savings goal.
 * Drives the create dialog and the detail page with mocked routes — no live
 * backend: the local DB may be reset by another agent at any time.
 */

const CREATE_GOAL_ID = '00000000-0000-4000-a000-000000000501';
const DETAIL_GOAL_ID = '00000000-0000-4000-a000-000000000502';
const USER_ID = '00000000-0000-4000-a000-000000000201';

test.describe('Savings goal initial amount (PUL-293)', () => {
  test('keeps the empty initial amount label clear of its suffix on mobile', async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/savings-goals');
    await page.getByTestId('create-savings-goal-button').click();

    const field = page
      .getByTestId('savings-goal-initial-amount')
      .locator('xpath=ancestor::mat-form-field');
    const [labelBox, suffixBox] = await Promise.all([
      field.locator('.mat-mdc-floating-label').boundingBox(),
      field.locator('.mat-mdc-form-field-text-suffix').boundingBox(),
    ]);

    expect(labelBox).not.toBeNull();
    expect(suffixBox).not.toBeNull();
    if (!labelBox || !suffixBox) return;

    const overlaps =
      labelBox.x < suffixBox.x + suffixBox.width &&
      labelBox.x + labelBox.width > suffixBox.x &&
      labelBox.y < suffixBox.y + suffixBox.height &&
      labelBox.y + labelBox.height > suffixBox.y;
    expect(overlaps).toBe(false);
  });

  test('creates a goal with an initial amount and sends it in the POST payload', async ({
    authenticatedPage: page,
  }) => {
    let createPayload: Record<string, unknown> | null = null;

    // Registered after the global fixture mocks → matched first (LIFO).
    await page.route('**/api/v1/savings-goals', (route) => {
      if (route.request().method() !== 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      }
      createPayload = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: CREATE_GOAL_ID,
            userId: USER_ID,
            name: createPayload?.['name'],
            startDate: createPayload?.['startDate'] ?? null,
            targetAmount: createPayload?.['targetAmount'] ?? null,
            targetDate: createPayload?.['targetDate'] ?? null,
            status: 'ACTIVE',
            initialAmount: createPayload?.['initialAmount'] ?? 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        }),
      });
    });

    await page.goto('/savings-goals');
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('create-savings-goal-button').click();
    const dialog = page.getByTestId('savings-goal-form-dialog');
    await expect(dialog).toBeVisible();

    await page.getByTestId('savings-goal-name').fill('Vacances été 2027');
    await page.getByTestId('savings-goal-target-amount').fill('10000');
    await page.getByTestId('savings-goal-initial-amount').fill('5000');

    await page.getByTestId('savings-goal-save').click();

    // Round trip completed once the created card renders in the list.
    await expect(
      page.getByTestId(`savings-goal-${CREATE_GOAL_ID}`),
    ).toBeVisible();

    expect(createPayload).not.toBeNull();
    expect(createPayload?.['initialAmount']).toBe(5000);
  });

  test('shows the "Montant de départ" stat and a consistent percent on the detail page', async ({
    authenticatedPage: page,
  }) => {
    const goal = {
      id: DETAIL_GOAL_ID,
      userId: USER_ID,
      name: 'Vacances été 2027',
      startDate: null,
      targetAmount: 10000,
      targetDate: '2027-08-01',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      initialAmount: 5000,
    } satisfies SavingsGoal;

    const progress = {
      goalId: DETAIL_GOAL_ID,
      status: 'ACTIVE',
      startDate: null,
      targetAmount: 10000,
      targetDate: '2027-08-01',
      plannedCumulative: 5200,
      plannedProjection: 5200,
      confirmed: 5200,
      initialAmount: 5000,
      achievementPercent: 52,
      monthsElapsed: 3,
      monthsRemaining: 12,
      isOverdue: false,
      pace: 400,
      confirmedPace: 300,
      required: 400,
      projected: 5200,
      paceStatus: 'on_track',
      suggestCompletion: false,
      linkedLineCount: 1,
      cumulativeGap: 0,
      estimatedCompletion: null,
      months: [],
      originalTargetAmount: null,
      originalCurrency: null,
      targetCurrency: null,
      exchangeRate: null,
    } satisfies SavingsGoalProgress;

    await page.route('**/api/v1/savings-goals/*/progress', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: progress }),
      }),
    );
    await page.route('**/api/v1/savings-goals/*/contributions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
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

    await page.getByTestId(`savings-goal-${DETAIL_GOAL_ID}`).click();
    await expect(page).toHaveURL(
      new RegExp(`/savings-goals/${DETAIL_GOAL_ID}$`),
    );
    await expect(page.getByTestId('savings-goal-detail-page')).toBeVisible();

    // 5'000 (initial) + 200 (pointé ce mois) = 5'200 / 10'000 = 52 %.
    await expect(page.getByTestId('savings-goal-achievement')).toContainText(
      '52',
    );
    const initialAmountStat = page.getByTestId('stat-initial-amount');
    await expect(initialAmountStat).toBeVisible();
    await expect(initialAmountStat).toContainText(/5\D?000/);
  });
});
