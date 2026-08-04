import { test, expect } from '../../fixtures/test-fixtures';
import type { Locator, Page } from '@playwright/test';
import {
  API_ERROR_CODES,
  type SavingsGoal,
  type SavingsGoalContribution,
  type SavingsGoalDeletionImpact,
  type SavingsGoalPlanMonth,
  type SavingsGoalProgress,
} from 'pulpe-shared';

/**
 * PUL-8 (CA10-CA12): track a savings goal progression.
 * Drives list to detail with a mocked GET savings-goals/:id/progress route.
 * No live backend: the local DB may be reset by another agent at any time.
 */

const GOAL_ID = '00000000-0000-4000-a000-000000000301';
const USER_ID = '00000000-0000-4000-a000-000000000201';
const GOAL_NAME = 'Vacances été 2027';

function buildPlanMonths(): SavingsGoalPlanMonth[] {
  const plannedAmounts = [
    600,
    600,
    ...Array.from({ length: 12 }, () => 250),
    300,
  ];
  let plannedCumulative = 0;

  return plannedAmounts.map((plannedAmount, index) => {
    plannedCumulative += plannedAmount;
    const monthIndex = 5 + index;
    const confirmedAmount = index === 0 ? 600 : index === 1 ? 300 : 0;

    return {
      month: (monthIndex % 12) + 1,
      year: 2026 + Math.floor(monthIndex / 12),
      state: index === 0 ? 'past' : index === 1 ? 'current' : 'future',
      isLocked: index === 0,
      plannedAmount,
      confirmedAmount,
      plannedCumulative,
      confirmedCumulative: index === 0 ? 600 : 900,
      lines: [],
    };
  });
}

const goal = {
  id: GOAL_ID,
  userId: USER_ID,
  name: GOAL_NAME,
  startDate: null,
  targetAmount: 3000,
  targetDate: '2027-08-01',
  status: 'ACTIVE',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
} satisfies SavingsGoal;

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
  monthsElapsed: 2,
  monthsRemaining: 14,
  isOverdue: false,
  pace: 600,
  confirmedPace: 450,
  required: 150,
  projected: 4500,
  paceStatus: 'ahead',
  suggestCompletion: false,
  linkedLineCount: 2,
  cumulativeGap: 300,
  estimatedCompletion: { month: 12, year: 2026 },
  months: buildPlanMonths(),
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
    projected: hasTarget && hasDeadline ? 3600 : null,
    paceStatus: hasTarget && hasDeadline ? 'on_track' : null,
    suggestCompletion: hasTarget ? false : null,
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
  test('navigates list → detail and shows a coherent responsive trajectory', async ({
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

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/savings-goals');
    await page.waitForLoadState('domcontentloaded');

    const card = page.getByTestId(`savings-goal-${GOAL_ID}`);
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(new RegExp(`/savings-goals/${GOAL_ID}$`));
    await expect(page.getByTestId('savings-goal-detail-page')).toBeVisible();

    // Two-layer progress bar: confirmed balance in front, planned projection behind.
    await expect(page.getByTestId('savings-goal-progress-bar')).toBeVisible();
    await expect(page.getByTestId('progress-confirmed-layer')).toBeVisible();
    await expect(page.getByTestId('progress-projected-layer')).toBeVisible();
    await expect(page.getByTestId('savings-goal-detail-page')).toContainText(
      'Épargné',
    );
    const projectionPanel = page.getByTestId('goal-projection-panel');
    const projectionCanvas = projectionPanel.locator('canvas');
    const projectionSummary = page.getByTestId('goal-projection-summary');
    await expect(projectionPanel).toBeVisible();
    await expect(
      page.getByTestId('goal-projection-summary-target'),
    ).toContainText(/3[\s’']?000/);
    await expect(
      page.getByTestId('goal-projection-summary-confirmed'),
    ).toContainText('900');
    await expect(
      page.getByTestId('goal-projection-summary-projection'),
    ).toContainText(/4[\s’']?500/);
    await expect(page.getByTestId('stat-projected')).toContainText(
      /4[\s’']?500/,
    );

    const [desktopCanvas, desktopSummary] = await Promise.all([
      projectionCanvas.boundingBox(),
      projectionSummary.boundingBox(),
    ]);
    expect(desktopCanvas).not.toBeNull();
    expect(desktopSummary).not.toBeNull();
    if (!desktopCanvas || !desktopSummary) {
      throw new Error('Desktop projection geometry is unavailable');
    }
    expect(desktopSummary.x).toBeGreaterThan(
      desktopCanvas.x + desktopCanvas.width,
    );

    for (const viewport of [
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          projectionPanel.evaluate(
            (element) => element.scrollWidth - element.clientWidth,
          ),
        )
        .toBeLessThanOrEqual(0);
      // Le canvas se remesure en asynchrone après le resize (ResizeObserver +
      // rAF) : lire la géométrie une seule fois l'échantillonne parfois en
      // plein relayout, le résumé encore de quelques pixels trop haut.
      await expect
        .poll(async () => {
          const [canvas, summary] = await Promise.all([
            projectionCanvas.boundingBox(),
            projectionSummary.boundingBox(),
          ]);
          return canvas && summary
            ? summary.y - (canvas.y + canvas.height)
            : null;
        })
        .toBeGreaterThan(0);
    }
  });

  test('explains the projection and starts the monthly plan at the goal start', async ({
    authenticatedPage: page,
  }) => {
    const futureGoal = {
      ...goal,
      name: 'Canapé',
      startDate: '2026-09-01',
      targetAmount: 3700,
      targetDate: '2026-10-12',
      initialAmount: 930,
    } satisfies SavingsGoal;
    const futureProgress = {
      ...progress,
      startDate: futureGoal.startDate,
      targetAmount: futureGoal.targetAmount,
      targetDate: futureGoal.targetDate,
      initialAmount: 930,
      plannedCumulative: 0,
      plannedProjection: 2315,
      confirmed: 930,
      achievementPercent: 25,
      monthsElapsed: 1,
      monthsRemaining: 2,
      required: 1385,
      projected: 2315,
      paceStatus: 'behind',
      months: [
        {
          month: 7,
          year: 2026,
          state: 'current',
          isLocked: false,
          isContributionEligible: false,
          plannedAmount: 0,
          confirmedAmount: 0,
          plannedCumulative: 0,
          confirmedCumulative: 0,
          lines: [],
        },
        {
          month: 8,
          year: 2026,
          state: 'gap',
          isLocked: false,
          isContributionEligible: false,
          plannedAmount: 0,
          confirmedAmount: 0,
          plannedCumulative: 0,
          confirmedCumulative: 0,
          lines: [],
        },
        {
          month: 9,
          year: 2026,
          state: 'future',
          isLocked: false,
          isContributionEligible: true,
          plannedAmount: 1385,
          confirmedAmount: 0,
          plannedCumulative: 1385,
          confirmedCumulative: 0,
          lines: [],
        },
        {
          month: 10,
          year: 2026,
          state: 'gap',
          isLocked: false,
          isContributionEligible: true,
          plannedAmount: 0,
          confirmedAmount: 0,
          plannedCumulative: 1385,
          confirmedCumulative: 0,
          lines: [],
        },
      ],
    } satisfies SavingsGoalProgress;

    await page.route('**/api/v1/savings-goals/*/progress', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: futureProgress }),
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
        body: JSON.stringify({ success: true, data: [futureGoal] }),
      }),
    );

    await page.goto('/savings-goals');
    await page.getByTestId(`savings-goal-${GOAL_ID}`).click();
    await expect(page.getByTestId('savings-goal-detail-page')).toBeVisible();

    const projectedLayer = page.getByTestId('progress-projected-layer');
    const projectedStat = page.getByTestId('stat-projected');
    const [layerColor, legendColor] = await Promise.all([
      projectedLayer.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
      projectedStat
        .locator('span[aria-hidden="true"]')
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ]);
    expect(legendColor).toBe(layerColor);
    await expect(
      page.getByTestId('stat-planned-projection-legend'),
    ).toHaveCount(0);

    const targetLegend = page.getByTestId('goal-projection-target-legend');
    const [targetColor, savingsColor, projectionColor, targetTokenColor] =
      await Promise.all([
        targetLegend.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
        page
          .getByTestId('stat-confirmed')
          .locator('span[aria-hidden="true"]')
          .evaluate((element) => getComputedStyle(element).backgroundColor),
        projectedStat
          .locator('span[aria-hidden="true"]')
          .evaluate((element) => getComputedStyle(element).backgroundColor),
        targetLegend.evaluate((element) => {
          const probe = document.createElement('span');
          probe.style.backgroundColor = 'var(--pulpe-financial-expense)';
          element.parentElement?.appendChild(probe);
          const color = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return color;
        }),
      ]);
    expect(targetColor).toBe(targetTokenColor);
    expect(targetColor).not.toBe(savingsColor);
    expect(targetColor).not.toBe(projectionColor);

    const timeline = page.getByTestId('goal-plan-timeline');
    await expect(
      timeline.locator('[data-testid^="goal-plan-row-"]'),
    ).toHaveCount(2);
    await expect(
      page.getByTestId(`goal-plan-row-${2026 * 12 + 7}`),
    ).toHaveCount(0);
    await expect(
      page.getByTestId(`goal-plan-row-${2026 * 12 + 8}`),
    ).toHaveCount(0);
    await expect(
      page.getByTestId(`goal-plan-row-${2026 * 12 + 9}`),
    ).toContainText(/1\D?385/);
    // The chip answers "has this month a budget?", not "is this month
    // labelled gap" — neither visible row (month 9, month 10) sets
    // hasBudget, so both legitimately show "Pas de budget".
    await expect(page.getByTestId('goal-plan-gap-chip')).toHaveCount(2);
    await expect(page.getByTestId('goal-plan-gap-hint')).toBeVisible();
  });
});

test.describe('Savings goal optional interval (PUL-314)', () => {
  const matrix = [
    {
      label: 'name only',
      id: '00000000-0000-4000-a000-000000000310',
      target: false,
      deadline: false,
      start: false,
    },
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
    test(`creates, edits and removes ${scenario.label}`, async ({
      authenticatedPage: page,
    }) => {
      let currentGoal: SavingsGoal | null = null;
      const patches: Record<string, unknown>[] = [];
      const deletionImpact = {
        goalId: scenario.id,
        summary: {
          templateLineCount: 0,
          templateLineTotal: 0,
          budgetCount: 0,
          budgetLineCount: 0,
          budgetLineTotal: 0,
          transactionCount: 0,
          transactionTotal: 0,
          withdrawalCount: 0,
          withdrawalTotal: 0,
        },
        templateLines: [],
        budgets: [],
        withdrawals: [],
        revision: {
          templateLines: [],
          budgetLines: [],
          transactions: [],
        },
      } satisfies SavingsGoalDeletionImpact;

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
      await page.route(
        `**/api/v1/savings-goals/${scenario.id}/deletion-impact`,
        (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: deletionImpact }),
          }),
      );
      await page.route(
        `**/api/v1/savings-goals/${scenario.id}/deletion`,
        (route) => {
          currentGoal = null;
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, message: 'deleted' }),
          });
        },
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
      await page.route(
        new RegExp(`/api/v1/savings-goals/${scenario.id}$`),
        (route) => {
          if (route.request().method() === 'PATCH') {
            const updates = route.request().postDataJSON() as Record<
              string,
              unknown
            >;
            patches.push(updates);
            currentGoal = {
              ...currentGoal!,
              name:
                typeof updates['name'] === 'string'
                  ? updates['name']
                  : currentGoal!.name,
              startDate:
                'startDate' in updates
                  ? (updates['startDate'] as string | null)
                  : currentGoal!.startDate,
              targetAmount:
                'targetAmount' in updates
                  ? (updates['targetAmount'] as number | null)
                  : currentGoal!.targetAmount,
              targetDate:
                'targetDate' in updates
                  ? (updates['targetDate'] as string | null)
                  : currentGoal!.targetDate,
              updatedAt: '2026-01-02T00:00:00.000Z',
            };
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: currentGoal }),
            });
          }
          if (route.request().method() === 'DELETE') {
            currentGoal = null;
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, message: 'deleted' }),
            });
          }
          return route.fallback();
        },
      );

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
      await expect(page.getByTestId('stat-projected')).toHaveCount(
        scenario.target && scenario.deadline ? 1 : 0,
      );
      await expect(page.getByTestId('savings-goal-pace-chip')).toHaveCount(
        scenario.target && scenario.deadline ? 1 : 0,
      );
      await expect(
        page.getByTestId('savings-goal-suggest-completion'),
      ).toHaveCount(0);
      await expect(page.getByTestId('savings-goal-trajectory')).toHaveCount(0);

      await page.getByTestId('edit-savings-goal-button').click();
      const editDialog = page.getByTestId('savings-goal-form-dialog');
      const updatedName = `Objectif ${scenario.label} modifié`;
      await editDialog.getByTestId('savings-goal-name').fill(updatedName);
      if (scenario.label === 'name only') {
        await editDialog.getByTestId('savings-goal-target-amount').fill('3500');
        await pickFutureDate(page, editDialog, 'savings-goal-target-date', 3);
      } else if (scenario.label === 'target only') {
        await editDialog.getByTestId('savings-goal-target-amount').clear();
        await pickFutureDate(page, editDialog, 'savings-goal-target-date', 3);
      } else if (scenario.label === 'deadline only') {
        await editDialog.getByTestId('savings-goal-target-amount').fill('3500');
        await editDialog.getByTestId('savings-goal-clear-target-date').click();
      } else {
        await editDialog.getByTestId('savings-goal-clear-start-date').click();
      }

      const patchRequest = page.waitForRequest(
        (request) =>
          request.method() === 'PATCH' &&
          request.url().endsWith(`/api/v1/savings-goals/${scenario.id}`),
      );
      await editDialog.getByTestId('savings-goal-save').click();
      const patchPayload = (await patchRequest).postDataJSON() as Record<
        string,
        unknown
      >;
      await expect.poll(() => patches).toEqual([patchPayload]);
      expect(patchPayload).toMatchObject({ name: updatedName });
      if (scenario.label === 'name only') {
        expect(patchPayload).toMatchObject({ targetAmount: 3500 });
        expect(patchPayload['targetDate']).toMatch(/^\d{4}-\d{2}-15$/);
      } else if (scenario.label === 'target only') {
        expect(patchPayload).toMatchObject({ targetAmount: null });
        expect(patchPayload['targetDate']).toMatch(/^\d{4}-\d{2}-15$/);
      } else if (scenario.label === 'deadline only') {
        expect(patchPayload).toMatchObject({
          targetAmount: 3500,
          targetDate: null,
        });
      } else {
        expect(patchPayload).toMatchObject({ startDate: null });
        expect(patchPayload).not.toHaveProperty('targetAmount');
        expect(patchPayload).not.toHaveProperty('targetDate');
      }
      await expect(page.getByTestId('page-title')).toContainText(updatedName);

      const deletionRequest = page.waitForRequest(
        (request) =>
          request.method() === 'POST' &&
          request
            .url()
            .endsWith(`/api/v1/savings-goals/${scenario.id}/deletion`),
      );
      await page.getByTestId('delete-savings-goal-button').click();
      await expect(page.getByTestId('goal-deletion-summary')).toBeVisible();
      await page.getByTestId('goal-deletion-confirm').click();
      expect((await deletionRequest).postDataJSON()).toEqual({
        mode: 'goal_only',
        revision: deletionImpact.revision,
      });
      await expect(page).toHaveURL(/\/savings-goals$/);
      await expect(page.getByTestId(`savings-goal-${scenario.id}`)).toHaveCount(
        0,
      );
    });
  }

  test('blocks an invalid interval without writing, then saves after correction', async ({
    authenticatedPage: page,
  }) => {
    let writeCount = 0;
    const validGoalId = '00000000-0000-4000-a000-000000000314';
    await page.route(/\/api\/v1\/savings-goals(?:\?.*)?$/, (route) => {
      if (route.request().method() !== 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      }
      writeCount += 1;
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: validGoalId,
            userId: USER_ID,
            name: payload['name'],
            startDate: payload['startDate'] ?? null,
            targetAmount: null,
            targetDate: payload['targetDate'] ?? null,
            status: 'ACTIVE',
            initialAmount: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        }),
      });
    });

    await page.goto('/savings-goals');
    await page.getByTestId('create-savings-goal-button').click();
    const dialog = page.getByTestId('savings-goal-form-dialog');
    await dialog.getByTestId('savings-goal-name').fill('Intervalle');
    await pickFutureDate(page, dialog, 'savings-goal-start-date', 2);
    await pickFutureDate(page, dialog, 'savings-goal-target-date', 1);

    await expect(dialog.getByTestId('savings-goal-save')).toBeDisabled();
    expect(writeCount).toBe(0);

    await dialog.getByTestId('savings-goal-clear-target-date').click();
    await pickFutureDate(page, dialog, 'savings-goal-target-date', 3);
    await expect(dialog.getByTestId('savings-goal-save')).toBeEnabled();
    await dialog.getByTestId('savings-goal-save').click();
    await expect.poll(() => writeCount).toBe(1);
  });
});

test.describe('Savings goal deadline reconciliation (PUL-313)', () => {
  const futureLine = {
    budgetLineId: '00000000-0000-4000-a000-000000000451',
    amount: 400,
    month: 8,
    year: 2027,
  };

  async function setupReconciliation(
    page: Page,
    options: {
      initialGoal?: SavingsGoal;
      futureLineBatches?: (typeof futureLine)[][];
      conflictOnce?: boolean;
    } = {},
  ) {
    const state = {
      goal: options.initialGoal ?? (goal satisfies SavingsGoal),
      patchPayloads: [] as Record<string, unknown>[],
      generationStopPayloads: [] as Record<string, unknown>[],
      requestOrder: [] as string[],
      previewCount: 0,
      generationStopCount: 0,
    };
    const futureLineBatches = options.futureLineBatches ?? [[futureLine]];

    await page.route('**/api/v1/savings-goals/*/progress', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: progressFor(state.goal),
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
    await page.route(/\/api\/v1\/savings-goals(?:\?.*)?$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [state.goal] }),
      }),
    );
    await page.route(
      new RegExp(`/api/v1/savings-goals/${GOAL_ID}/future-lines(?:\\?.*)?$`),
      (route) => {
        const targetDate = new URL(route.request().url()).searchParams.get(
          'targetDate',
        );
        const previewKind = targetDate ? 'deadline-preview' : 'status-preview';
        if (!state.requestOrder.includes(previewKind)) {
          state.requestOrder.push(previewKind);
        }
        const lines =
          futureLineBatches[
            Math.min(state.previewCount, futureLineBatches.length - 1)
          ];
        state.previewCount += 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: lines }),
        });
      },
    );
    await page.route(
      new RegExp(`/api/v1/savings-goals/${GOAL_ID}/generation-stop$`),
      (route) => {
        state.requestOrder.push('generation-stop');
        state.generationStopPayloads.push(
          route.request().postDataJSON() as Record<string, unknown>,
        );
        state.generationStopCount += 1;
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
        const requestPayload = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        state.requestOrder.push('patch');
        state.patchPayloads.push(requestPayload);
        if (options.conflictOnce && state.patchPayloads.length === 1) {
          return route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              statusCode: 409,
              error: 'Conflict',
              code: API_ERROR_CODES.SAVINGS_GOAL_RECONCILIATION_CONFLICT,
              message: 'Candidates drifted',
            }),
          });
        }
        const { reconciliation: _wireOnly, ...persistedUpdates } =
          requestPayload;
        state.goal = { ...state.goal, ...persistedUpdates };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: state.goal }),
        });
      },
    );
    return state;
  }

  async function openEarlierDeadline(
    page: Page,
    status?: 'PAUSED' | 'COMPLETED',
  ) {
    await page.goto('/savings-goals');
    await page.getByTestId(`savings-goal-${GOAL_ID}`).click();
    await page.getByTestId('edit-savings-goal-button').click();
    const editDialog = page.getByTestId('savings-goal-form-dialog');
    await editDialog.getByTestId('savings-goal-name').fill('Vacances avancées');
    await pickFutureDate(page, editDialog, 'savings-goal-target-date', -1);
    if (status) {
      await editDialog.getByTestId('savings-goal-status').click();
      await page
        .getByRole('option', {
          name: status === 'PAUSED' ? 'En pause' : 'Atteint',
          exact: true,
        })
        .click();
    }
    await editDialog.getByTestId('savings-goal-save').click();
  }

  for (const decision of ['freeze', 'remove'] as const) {
    test(`sends one atomic ${decision} PATCH and no generation-stop POST`, async ({
      authenticatedPage: page,
    }) => {
      const state = await setupReconciliation(page);

      await openEarlierDeadline(page);
      await expect(
        page.getByTestId('goal-generation-stop-lines'),
      ).toBeVisible();
      await page.getByTestId(`goal-generation-stop-${decision}`).click();

      await expect.poll(() => state.patchPayloads.length).toBe(1);
      expect(state.previewCount).toBe(1);
      expect(state.generationStopCount).toBe(0);
      expect(state.patchPayloads[0]).toMatchObject({
        name: 'Vacances avancées',
        reconciliation: {
          mode: decision,
          budgetLineIds: [futureLine.budgetLineId],
        },
      });
      expect(state.patchPayloads[0]?.['targetDate']).toMatch(/^2027-07-15$/);
    });
  }

  test('separates deadline and status decisions in strict request order', async ({
    authenticatedPage: page,
  }) => {
    const remainingLine = {
      ...futureLine,
      budgetLineId: '00000000-0000-4000-a000-000000000453',
      amount: 275,
    };
    const state = await setupReconciliation(page, {
      futureLineBatches: [[futureLine], [remainingLine]],
    });

    await openEarlierDeadline(page, 'PAUSED');
    await expect(page.getByTestId('goal-generation-stop-lines')).toContainText(
      '400',
    );
    await page.getByTestId('goal-generation-stop-remove').click();
    await expect(page.getByTestId('goal-generation-stop-lines')).toContainText(
      '275',
    );
    await page.getByTestId('goal-generation-stop-freeze').click();

    await expect.poll(() => state.generationStopCount).toBe(1);
    expect(state.requestOrder).toEqual([
      'deadline-preview',
      'patch',
      'status-preview',
      'generation-stop',
    ]);
    expect(state.patchPayloads).toHaveLength(1);
    expect(state.patchPayloads[0]).toMatchObject({
      status: 'PAUSED',
      reconciliation: {
        mode: 'remove',
        budgetLineIds: [futureLine.budgetLineId],
      },
    });
    expect(state.generationStopPayloads).toEqual([
      {
        mode: 'freeze',
        budgetLineIds: [remainingLine.budgetLineId],
      },
    ]);
  });

  test('cancels reconciliation without writing', async ({
    authenticatedPage: page,
  }) => {
    const state = await setupReconciliation(page);

    await openEarlierDeadline(page);
    await expect(page.getByTestId('goal-generation-stop-lines')).toBeVisible();
    await page.getByTestId('goal-generation-stop-dismiss').click();

    expect(state.previewCount).toBe(1);
    expect(state.patchPayloads).toEqual([]);
    expect(state.generationStopCount).toBe(0);
  });

  test('reloads candidates after conflict without partial success', async ({
    authenticatedPage: page,
  }) => {
    const refreshedLine = {
      ...futureLine,
      budgetLineId: '00000000-0000-4000-a000-000000000452',
      amount: 550,
    };
    const state = await setupReconciliation(page, {
      futureLineBatches: [[futureLine], [refreshedLine]],
      conflictOnce: true,
    });

    await openEarlierDeadline(page);
    await page.getByTestId('goal-generation-stop-freeze').click();

    await expect.poll(() => state.previewCount).toBe(2);
    await expect(page.getByTestId('goal-generation-stop-lines')).toContainText(
      '550',
    );
    await expect(page.locator('simple-snack-bar')).toContainText(
      'Les prévisions ont changé entre-temps',
    );
    await expect(page.getByTestId('page-title')).toContainText(GOAL_NAME);
    expect(state.patchPayloads).toHaveLength(1);
    expect(state.goal.name).toBe(GOAL_NAME);
    expect(state.generationStopCount).toBe(0);
    await page.getByTestId('goal-generation-stop-dismiss').click();
  });

  test('updates an earlier deadline directly when preview is empty', async ({
    authenticatedPage: page,
  }) => {
    const state = await setupReconciliation(page, {
      futureLineBatches: [[]],
    });

    await openEarlierDeadline(page);

    await expect.poll(() => state.patchPayloads.length).toBe(1);
    await expect(page.getByTestId('goal-generation-stop-lines')).toHaveCount(0);
    expect(state.previewCount).toBe(1);
  });

  for (const transition of ['later', 'remove', 'add'] as const) {
    test(`${transition} deadline skips reconciliation preview`, async ({
      authenticatedPage: page,
    }) => {
      const initialGoal =
        transition === 'add'
          ? ({ ...goal, targetDate: null } satisfies SavingsGoal)
          : (goal satisfies SavingsGoal);
      const state = await setupReconciliation(page, { initialGoal });

      await page.goto('/savings-goals');
      await page.getByTestId(`savings-goal-${GOAL_ID}`).click();
      await page.getByTestId('edit-savings-goal-button').click();
      const editDialog = page.getByTestId('savings-goal-form-dialog');
      if (transition === 'remove') {
        await editDialog.getByTestId('savings-goal-clear-target-date').click();
      } else {
        await pickFutureDate(page, editDialog, 'savings-goal-target-date', 1);
      }
      await editDialog.getByTestId('savings-goal-save').click();

      await expect.poll(() => state.patchPayloads.length).toBe(1);
      expect(state.previewCount).toBe(0);
      await expect(page.getByTestId('goal-generation-stop-lines')).toHaveCount(
        0,
      );
    });
  }
});
