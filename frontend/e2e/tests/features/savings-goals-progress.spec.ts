import { test, expect } from '../../fixtures/test-fixtures';
import type {
  SavingsGoalContribution,
  SavingsGoalPlanMonth,
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
  targetAmount: 3000,
  targetDate: '2027-08-01',
  status: 'ACTIVE',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

const progress = {
  goalId: GOAL_ID,
  status: 'ACTIVE',
  targetAmount: 3000,
  targetDate: '2027-08-01',
  initialAmount: 0,
  plannedCumulative: 1200,
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
      const [stackedCanvas, stackedSummary] = await Promise.all([
        projectionCanvas.boundingBox(),
        projectionSummary.boundingBox(),
      ]);
      expect(stackedCanvas).not.toBeNull();
      expect(stackedSummary).not.toBeNull();
      if (!stackedCanvas || !stackedSummary) {
        throw new Error('Stacked projection geometry is unavailable');
      }
      expect(stackedSummary.y).toBeGreaterThan(
        stackedCanvas.y + stackedCanvas.height,
      );
    }
  });
});
