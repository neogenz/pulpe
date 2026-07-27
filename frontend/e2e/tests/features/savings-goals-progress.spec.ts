import { test, expect } from '../../fixtures/test-fixtures';
import type { Locator, Page } from '@playwright/test';
import type {
  SavingsGoal,
  SavingsGoalContribution,
  SavingsGoalProgress,
} from 'pulpe-shared';

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
  startDate: null,
  targetAmount: 3000,
  targetDate: '2027-08-01',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const progress = {
  goalId: GOAL_ID,
  status: 'ACTIVE',
  startDate: null,
  targetAmount: 3000,
  targetDate: '2027-08-01',
  initialAmount: 0,
  plannedCumulative: 1200,
  plannedProjection: 1200,
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
  cumulativeGap: 300,
  estimatedCompletion: { month: 6, year: 2027 },
  months: [],
  originalTargetAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
} satisfies SavingsGoalProgress;

const contributions = [
  {
    lineId: '00000000-0000-4000-a000-000000000401',
    name: 'Épargne juillet',
    amount: 400,
    checkedAt: '2026-07-01T00:00:00.000Z',
    budgetMonth: 7,
    budgetYear: 2026,
    transactions: [],
  },
  {
    lineId: '00000000-0000-4000-a000-000000000402',
    name: 'Épargne août',
    amount: 400,
    checkedAt: null,
    budgetMonth: 8,
    budgetYear: 2026,
    transactions: [],
  },
] satisfies SavingsGoalContribution[];

async function pickFutureDate(
  page: Page,
  dialog: Locator,
  inputTestId: string,
  monthsAhead: number,
) {
  await dialog
    .getByTestId(inputTestId)
    .locator('xpath=ancestor::mat-form-field//mat-datepicker-toggle//button')
    .click();
  const navigationLabel = monthsAhead < 0 ? 'Previous month' : 'Next month';
  for (let month = 0; month < Math.abs(monthsAhead); month += 1) {
    await page.getByLabel(navigationLabel).click();
  }
  await page
    .locator(
      '.mat-calendar-body-cell:not(.mat-calendar-body-disabled) .mat-calendar-body-cell-content',
    )
    .filter({ hasText: /^\s*15\s*$/ })
    .click();
  await expect(page.locator('mat-datepicker-content')).toHaveCount(0);
}

function progressFor(goalState: SavingsGoal): SavingsGoalProgress {
  const hasTarget = goalState.targetAmount !== null;
  const hasDeadline = goalState.targetDate !== null;
  return {
    goalId: goalState.id,
    status: goalState.status,
    startDate: goalState.startDate,
    targetAmount: goalState.targetAmount,
    targetDate: goalState.targetDate,
    initialAmount: goalState.initialAmount ?? 0,
    plannedCumulative: 300,
    plannedProjection: 600,
    confirmed: 300,
    achievementPercent: hasTarget ? 10 : null,
    monthsElapsed: 1,
    monthsRemaining: hasDeadline ? 2 : null,
    isOverdue: false,
    pace: 300,
    confirmedPace: 300,
    required: hasTarget && hasDeadline ? 1350 : null,
    projected: hasTarget ? 3600 : null,
    paceStatus: hasTarget ? 'on_track' : null,
    suggestCompletion: false,
    linkedLineCount: 0,
    cumulativeGap: 0,
    estimatedCompletion:
      hasTarget && !hasDeadline ? { month: 5, year: 2027 } : null,
    months: [],
    originalTargetAmount: null,
    originalCurrency: null,
    targetCurrency: null,
    exchangeRate: null,
  };
}

test.describe('Savings goal progression (PUL-8)', () => {
  test('navigates list → detail and shows the progress bar, Épargné label and D2 CTA', async ({
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
    await page.route('**/api/v1/savings-goals/*/contributions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: contributions }),
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

    const card = page.getByTestId(`savings-goal-${GOAL_ID}`);
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(new RegExp(`/savings-goals/${GOAL_ID}$`));
    await expect(page.getByTestId('savings-goal-detail-page')).toBeVisible();

    // Two-layer progress bar with the confirmed (Épargné) layer.
    await expect(page.getByTestId('savings-goal-progress-bar')).toBeVisible();
    await expect(page.getByTestId('progress-confirmed-layer')).toBeVisible();
    await expect(page.getByTestId('progress-planned-layer')).toBeVisible();
    await expect(page.getByTestId('savings-goal-detail-page')).toContainText(
      'Épargné',
    );

    // D2 — completion suggestion CTA is visible.
    await expect(
      page.getByTestId('savings-goal-mark-completed-button'),
    ).toBeVisible();
  });

  test('creates a name-only objective and shows its free metrics without a target bar', async ({
    authenticatedPage: page,
  }) => {
    const openGoalId = '00000000-0000-4000-a000-000000000302';
    const openGoal = {
      id: openGoalId,
      userId: USER_ID,
      name: 'Matelas',
      startDate: null,
      targetAmount: null,
      targetDate: null,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const openProgress = {
      goalId: openGoalId,
      status: 'ACTIVE',
      startDate: null,
      targetAmount: null,
      targetDate: null,
      initialAmount: 0,
      plannedCumulative: 0,
      plannedProjection: 0,
      confirmed: 0,
      achievementPercent: null,
      monthsElapsed: 1,
      monthsRemaining: null,
      isOverdue: false,
      pace: 0,
      confirmedPace: 0,
      required: null,
      projected: null,
      paceStatus: null,
      suggestCompletion: null,
      linkedLineCount: 0,
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
        body: JSON.stringify({ success: true, data: openProgress }),
      }),
    );
    await page.route('**/api/v1/savings-goals/*/contributions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      }),
    );
    await page.route('**/api/v1/savings-goals', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: openGoal }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto('/savings-goals');
    await page.getByTestId('create-savings-goal-button').click();
    await page.getByTestId('savings-goal-name').fill('Matelas');
    const createRequest = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().endsWith('/api/v1/savings-goals'),
    );
    await page.getByTestId('savings-goal-save').click();

    expect((await createRequest).postDataJSON()).toEqual({
      name: 'Matelas',
      status: 'ACTIVE',
    });

    const createdCard = page.getByTestId(`savings-goal-${openGoalId}`);
    await expect(createdCard).toBeVisible();
    await createdCard.click();

    await expect(page).toHaveURL(new RegExp(`/savings-goals/${openGoalId}$`));
    await expect(page.getByTestId('stat-confirmed')).toBeVisible();
    await expect(page.getByTestId('stat-planned')).toBeVisible();
    await expect(page.getByTestId('stat-planned-projection')).toBeVisible();
    await expect(page.getByTestId('savings-goal-progress-bar')).toHaveCount(0);
  });
});

test.describe('Savings goal optional interval (PUL-314)', () => {
  const matrix = [
    {
      label: 'target only',
      id: '00000000-0000-4000-a000-000000000311',
      target: true,
      deadline: false,
      start: false,
    },
    {
      label: 'deadline only',
      id: '00000000-0000-4000-a000-000000000312',
      target: false,
      deadline: true,
      start: false,
    },
    {
      label: 'target, future start and deadline',
      id: '00000000-0000-4000-a000-000000000313',
      target: true,
      deadline: true,
      start: true,
    },
  ] as const;

  for (const scenario of matrix) {
    test(`creates and displays ${scenario.label}`, async ({
      authenticatedPage: page,
    }) => {
      let currentGoal: SavingsGoal | null = null;

      await page.route('**/api/v1/savings-goals/*/progress', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: progressFor(currentGoal!),
          }),
        }),
      );
      await page.route('**/api/v1/savings-goals/*/contributions', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        }),
      );
      await page.route(/\/api\/v1\/savings-goals(?:\?.*)?$/, (route) => {
        if (route.request().method() === 'POST') {
          const payload = route.request().postDataJSON();
          currentGoal = {
            id: scenario.id,
            userId: USER_ID,
            name: String(payload['name']),
            startDate: (payload['startDate'] as string | undefined) ?? null,
            targetAmount:
              (payload['targetAmount'] as number | undefined) ?? null,
            targetDate: (payload['targetDate'] as string | undefined) ?? null,
            status: 'ACTIVE',
            initialAmount:
              (payload['initialAmount'] as number | undefined) ?? 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          };
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: currentGoal }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: currentGoal ? [currentGoal] : [],
          }),
        });
      });

      await page.goto('/savings-goals');
      await page.getByTestId('create-savings-goal-button').click();
      const dialog = page.getByTestId('savings-goal-form-dialog');
      await dialog
        .getByTestId('savings-goal-name')
        .fill(`Objectif ${scenario.label}`);
      if (scenario.target) {
        await dialog.getByTestId('savings-goal-target-amount').fill('3000');
      }
      if (scenario.deadline) {
        await pickFutureDate(page, dialog, 'savings-goal-target-date', 2);
      }
      if (scenario.start) {
        await pickFutureDate(page, dialog, 'savings-goal-start-date', 1);
      }

      const createRequest = page.waitForRequest(
        (request) =>
          request.method() === 'POST' &&
          request.url().endsWith('/api/v1/savings-goals'),
      );
      await dialog.getByTestId('savings-goal-save').click();
      const createPayload = (await createRequest).postDataJSON();

      expect(createPayload['targetAmount'] !== undefined).toBe(scenario.target);
      expect(createPayload['targetDate'] !== undefined).toBe(scenario.deadline);
      expect(createPayload['startDate'] !== undefined).toBe(scenario.start);
      if (scenario.start) {
        expect(
          String(createPayload['startDate']) <=
            String(createPayload['targetDate']),
        ).toBe(true);
      }

      await page.getByTestId(`savings-goal-${scenario.id}`).click();
      await expect(page.getByTestId('savings-goal-detail-page')).toBeVisible();
      await expect(page.getByTestId('savings-goal-progress-bar')).toHaveCount(
        scenario.target ? 1 : 0,
      );
      await expect(page.getByTestId('savings-goal-target-date')).toHaveCount(
        scenario.deadline ? 1 : 0,
      );
      await expect(page.getByTestId('stat-required')).toHaveCount(
        scenario.target && scenario.deadline ? 1 : 0,
      );
      await expect(page.getByTestId('stat-estimated-completion')).toHaveCount(
        scenario.target && !scenario.deadline ? 1 : 0,
      );
    });
  }
});

test.describe('Savings goal deadline reconciliation (PUL-313)', () => {
  test('previews affected lines and sends one atomic deadline PATCH', async ({
    authenticatedPage: page,
  }) => {
    const futureLine = {
      budgetLineId: '00000000-0000-4000-a000-000000000451',
      amount: 400,
      month: 8,
      year: 2027,
    };
    let patchCount = 0;
    let generationStopCount = 0;
    let patchPayload: Record<string, unknown> | undefined;
    const browserErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

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
        body: JSON.stringify({ success: true, data: contributions }),
      }),
    );
    await page.route(/\/api\/v1\/savings-goals(?:\?.*)?$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [goal] }),
      }),
    );
    await page.route(
      new RegExp(`/api/v1/savings-goals/${GOAL_ID}/future-lines(?:\\?.*)?$`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [futureLine] }),
        }),
    );
    await page.route(
      new RegExp(`/api/v1/savings-goals/${GOAL_ID}/generation-stop$`),
      (route) => {
        generationStopCount += 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { affectedCount: 1 },
          }),
        });
      },
    );
    await page.route(
      new RegExp(`/api/v1/savings-goals/${GOAL_ID}$`),
      (route) => {
        if (route.request().method() !== 'PATCH') return route.fallback();
        patchCount += 1;
        const requestPayload = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        patchPayload = requestPayload;
        const { reconciliation: _wireOnly, ...persistedUpdates } =
          requestPayload;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...goal, ...persistedUpdates },
          }),
        });
      },
    );

    await page.goto('/savings-goals');
    await page.getByTestId(`savings-goal-${GOAL_ID}`).click();
    await page.getByTestId('edit-savings-goal-button').click();
    const editDialog = page.getByTestId('savings-goal-form-dialog');
    await editDialog.getByTestId('savings-goal-name').fill('Vacances avancées');
    await pickFutureDate(page, editDialog, 'savings-goal-target-date', -1);
    await editDialog.getByTestId('savings-goal-save').click();

    await expect(page.getByTestId('goal-generation-stop-lines')).toBeVisible();
    await page.getByTestId('goal-generation-stop-freeze').click();

    await expect
      .poll(() => ({ patchCount, browserErrors }))
      .toEqual({ patchCount: 1, browserErrors: [] });
    expect(generationStopCount).toBe(0);
    expect(patchPayload).toMatchObject({
      name: 'Vacances avancées',
      reconciliation: {
        mode: 'freeze',
        budgetLineIds: [futureLine.budgetLineId],
      },
    });
    expect(patchPayload?.['targetDate']).toMatch(/^2027-07-15$/);
  });
});
