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
            targetAmount: createPayload?.['targetAmount'],
            targetDate: createPayload?.['targetDate'],
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

    // matDatepicker input is readonly — pick "today" from the calendar
    // overlay (minDate=today, so it's always selectable and always valid).
    // Date FIRST: onTargetDateChange does a read-modify-write on the shared
    // model signal, which under load can snapshot the model before a value
    // filled microseconds earlier has propagated — humans can't hit that
    // window, but Playwright can, so no field fill may follow the date pick.
    await dialog.getByRole('button', { name: 'Open calendar' }).click();
    await page.locator('.mat-calendar-body-today').click();
    // Calendar fully gone before anything else is touched: its fading backdrop
    // still swallows pointer events and would eat the save click. (The dialog
    // keeps its own backdrop, so only the calendar's disappearance is waited on.)
    await expect(page.locator('mat-datepicker-content')).toHaveCount(0);

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
