import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

const TAGS = [
  {
    id: '00000000-0000-4000-a000-000000004001',
    userId: TEST_UUIDS.USER_1,
    name: 'Courses',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-a000-000000004002',
    userId: TEST_UUIDS.USER_1,
    name: 'Maison',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
] as const;

function historyResponse(tagId: string, months: number) {
  const periods = Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(2026, 7 - months + index, 1));
    return {
      month: date.getUTCMonth() + 1,
      year: date.getUTCFullYear(),
      plannedAmount: index === 0 ? 250 : 0,
      actualAmount: index === 0 ? 200 : 0,
    };
  });
  return {
    success: true,
    data: {
      tagId,
      periods,
      totalPlanned: 250,
      totalActual: 200,
      monthlyAverageActual: Number((200 / months).toFixed(2)),
      actualToPlannedPercent: 80,
    },
  };
}

test.describe('Tag history', () => {
  test('shows multi-month aggregates, reloads selections, and masks financial values', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await authenticatedPage.route('**/api/v1/tags', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: TAGS }),
      }),
    );
    await authenticatedPage.route('**/api/v1/tags/*/history**', (route) => {
      const url = new URL(route.request().url());
      const tagId = url.pathname.split('/').at(-2) ?? '';
      const months = Number(url.searchParams.get('months'));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(historyResponse(tagId, months)),
      });
    });
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          createBudgetDetailsMock(TEST_UUIDS.BUDGET_1, {
            budget: { month: 7, year: 2026 },
            budgetLines: [
              createBudgetLineMock(TEST_UUIDS.LINE_1, TEST_UUIDS.BUDGET_1, {
                name: 'Courses du mois',
                amount: 250,
                tagIds: [TAGS[0].id],
              }),
            ],
          }),
        ),
      }),
    );

    await budgetDetailsPage.goto(TEST_UUIDS.BUDGET_1);
    await authenticatedPage.getByTestId('tag-history-open').click();

    const summary = authenticatedPage.getByTestId('tag-history-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/200/);
    await expect(summary).toContainText(/250/);
    const accessibleChart = authenticatedPage.getByTestId('tag-history-aria');
    await expect(accessibleChart).toContainText('Courses');
    await expect(accessibleChart).toContainText('3');

    const periodRequest = authenticatedPage.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname.endsWith(`/tags/${TAGS[0].id}/history`) &&
        url.searchParams.get('months') === '12'
      );
    });
    await authenticatedPage.getByTestId('tag-history-period-select').click();
    await authenticatedPage.getByRole('option', { name: '12 mois' }).click();
    await periodRequest;
    await expect(accessibleChart).toContainText('12');

    const tagRequest = authenticatedPage.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname.endsWith(`/tags/${TAGS[1].id}/history`) &&
        url.searchParams.get('months') === '12'
      );
    });
    await authenticatedPage.getByTestId('tag-history-tag-select').click();
    await authenticatedPage.getByRole('option', { name: 'Maison' }).click();
    await tagRequest;
    await expect(accessibleChart).toContainText('Maison');

    await authenticatedPage.getByTestId('tag-history-close').click();
    await authenticatedPage.getByTestId('user-menu-trigger').click();
    await authenticatedPage.getByTestId('toggle-amounts-button').click();
    await authenticatedPage.getByTestId('tag-history-open').click();

    await expect(summary).toContainText('•••••');
    await expect(summary).not.toContainText(/200/);
    await expect(accessibleChart).not.toContainText(/200/);
  });
});
