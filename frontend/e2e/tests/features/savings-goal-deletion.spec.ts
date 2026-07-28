import { test, expect } from '../../fixtures/test-fixtures';
import type {
  SavingsGoal,
  SavingsGoalDeletionImpact,
  SavingsGoalProgress,
} from 'pulpe-shared';

const GOAL_ID = '00000000-0000-4000-8000-000000000501';
const USER_ID = '00000000-0000-4000-8000-000000000502';
const TEMPLATE_ID = '00000000-0000-4000-8000-000000000503';
const TEMPLATE_LINE_ID = '00000000-0000-4000-8000-000000000504';
const BUDGET_ID = '00000000-0000-4000-8000-000000000505';
const BUDGET_LINE_ID = '00000000-0000-4000-8000-000000000506';
const TRANSACTION_ID = '00000000-0000-4000-8000-000000000507';
const UPDATED_AT = '2026-07-27T10:00:00.000Z';

test('deletes a savings goal from its impact preview', async ({
  authenticatedPage: page,
}) => {
  const goal = {
    id: GOAL_ID,
    userId: USER_ID,
    name: 'Canapé',
    startDate: null,
    targetAmount: 3700,
    targetDate: '2027-12-01',
    status: 'ACTIVE',
    initialAmount: 930,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: UPDATED_AT,
  } satisfies SavingsGoal;
  const progress = {
    goalId: GOAL_ID,
    status: 'ACTIVE',
    startDate: null,
    targetAmount: 3700,
    targetDate: '2027-12-01',
    plannedCumulative: 930,
    plannedProjection: 930,
    confirmed: 930,
    initialAmount: 930,
    achievementPercent: 25,
    monthsElapsed: 7,
    monthsRemaining: 18,
    isOverdue: false,
    pace: 0,
    confirmedPace: 0,
    required: 154,
    projected: 930,
    paceStatus: 'behind',
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
  const impact = {
    goalId: GOAL_ID,
    summary: {
      templateLineCount: 1,
      templateLineTotal: 200,
      budgetCount: 1,
      budgetLineCount: 1,
      budgetLineTotal: 200,
      transactionCount: 1,
      transactionTotal: 180,
    },
    templateLines: [
      {
        lineId: TEMPLATE_LINE_ID,
        templateId: TEMPLATE_ID,
        templateName: 'Mois Type principal',
        name: 'Épargne canapé',
        amount: 200,
        recurrence: 'fixed',
        updatedAt: UPDATED_AT,
      },
    ],
    budgets: [
      {
        budgetId: BUDGET_ID,
        month: 7,
        year: 2026,
        lines: [
          {
            lineId: BUDGET_LINE_ID,
            name: 'Épargne canapé',
            amount: 200,
            recurrence: 'fixed',
            checkedAt: UPDATED_AT,
            updatedAt: UPDATED_AT,
            transactions: [
              {
                id: TRANSACTION_ID,
                budgetId: BUDGET_ID,
                budgetLineId: BUDGET_LINE_ID,
                name: 'Virement épargne',
                amount: 180,
                kind: 'saving',
                transactionDate: UPDATED_AT,
                createdAt: UPDATED_AT,
                updatedAt: UPDATED_AT,
                checkedAt: UPDATED_AT,
              },
            ],
          },
        ],
      },
    ],
    revision: {
      templateLines: [{ id: TEMPLATE_LINE_ID, updatedAt: UPDATED_AT }],
      budgetLines: [{ id: BUDGET_LINE_ID, updatedAt: UPDATED_AT }],
      transactions: [{ id: TRANSACTION_ID, updatedAt: UPDATED_AT }],
    },
  } satisfies SavingsGoalDeletionImpact;

  const angularErrors: string[] = [];
  let goalDeleted = false;
  let deletionPayload: unknown;
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('NG0201')) {
      angularErrors.push(message.text());
    }
  });

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
  await page.route('**/api/v1/savings-goals/*/deletion-impact', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: impact }),
    }),
  );
  await page.route('**/api/v1/savings-goals/*/deletion', async (route) => {
    deletionPayload = route.request().postDataJSON();
    goalDeleted = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'Deleted' }),
    });
  });
  await page.route('**/api/v1/savings-goals', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: goalDeleted ? [] : [goal],
      }),
    }),
  );

  await page.goto('/savings-goals');
  await page.getByTestId(`savings-goal-${GOAL_ID}`).click();
  await expect(page.getByTestId('savings-goal-detail-page')).toBeVisible();

  await page.getByTestId('delete-savings-goal-button').click();
  await expect(page.getByTestId('goal-deletion-summary')).toBeVisible();
  expect(angularErrors).toEqual([]);

  await page.getByTestId('goal-deletion-forecasts').click();
  await page.getByTestId('goal-deletion-transactions').click();
  await page.getByTestId('goal-deletion-confirm').click();

  await expect
    .poll(() => deletionPayload)
    .toEqual({
      mode: 'goal_forecasts_and_transactions',
      revision: impact.revision,
    });
  await expect(page).toHaveURL(/\/savings-goals$/);
  await expect(page.getByTestId(`savings-goal-${GOAL_ID}`)).toHaveCount(0);
});
