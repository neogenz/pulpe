import type { BudgetLine, Transaction } from 'pulpe-shared';
import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

/**
 * Budget Line — Currency Conversion Display (regression guards)
 *
 * Context: conversion used to hide in a crashed inline pill on the detail
 * panel — unreachable on free transactions. The secondary caption now sits
 * directly under every primary amount, on both cards and detail surfaces.
 *
 * Acceptance criteria covered end-to-end:
 *  - AC1: converted line on desktop card shows `100 CHF`
 *  - AC3: free transaction (Hors prévisions) shows the caption too
 *  - AC6: line without conversion metadata renders NO caption (no noise)
 *  - AC7: same-currency line renders NO caption (no false positives)
 *  - AC10: every caption carries `ph-no-capture` for amount-blurring privacy
 */

const BUDGET_ID = TEST_UUIDS.BUDGET_1;
const CAPTION = '[data-testid="original-amount-line"]';

async function mockUserCurrency(page: Page, currency: 'CHF' | 'EUR') {
  await page.route('**/api/v1/users/settings', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { payDayOfMonth: 25, currency, showCurrencySelector: true },
      }),
    });
  });
}

async function mockBudget(
  page: Page,
  data: { budgetLines?: BudgetLine[]; transactions?: Transaction[] },
) {
  await page.route('**/api/v1/budgets/*/details', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createBudgetDetailsMock(BUDGET_ID, data)),
    }),
  );
}

test.describe('Budget Line — Currency Conversion Display', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await mockUserCurrency(authenticatedPage, 'EUR');
  });

  test('shows the original-amount caption on a converted budget line card (AC1)', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await mockBudget(authenticatedPage, {
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, BUDGET_ID, {
          name: 'Loyer',
          amount: 109,
          recurrence: 'fixed',
          originalAmount: 100,
          originalCurrency: 'CHF',
          targetCurrency: 'EUR',
          exchangeRate: 1.0899,
        }),
      ],
    });

    await budgetDetailsPage.goto(BUDGET_ID);

    const caption = authenticatedPage.locator(CAPTION).first();
    await expect(caption).toBeVisible();
    await expect(caption).toContainText('CHF');
    await expect(caption).toContainText('100');
    await expect(caption).toHaveClass(/ph-no-capture/);
  });

  test('shows the caption on free transactions in the Hors prévisions section (AC3)', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await mockBudget(authenticatedPage, {
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, BUDGET_ID, {
          name: 'Loyer',
          amount: 1200,
          recurrence: 'fixed',
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, BUDGET_ID, {
          name: 'Achat Amazon',
          amount: 45,
          budgetLineId: null,
          originalAmount: 42,
          originalCurrency: 'CHF',
          targetCurrency: 'EUR',
          exchangeRate: 1.0714,
          transactionDate: '2026-04-22T00:00:00+02:00',
        }),
      ],
    });

    await budgetDetailsPage.goto(BUDGET_ID);

    const caption = authenticatedPage
      .locator(`[data-testid="transaction-card-${TEST_UUIDS.TRANSACTION_1}"]`)
      .locator(CAPTION);
    await expect(caption).toBeVisible();
    await expect(caption).toContainText('CHF');
    await expect(caption).toContainText('42');
    await expect(caption).toHaveClass(/ph-no-capture/);
  });

  test('renders NO caption when the budget line has no conversion metadata (AC6 — regression)', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await mockBudget(authenticatedPage, {
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, BUDGET_ID, {
          name: 'Loyer local',
          amount: 1200,
          recurrence: 'fixed',
        }),
      ],
    });

    await budgetDetailsPage.goto(BUDGET_ID);

    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_1}`),
    ).toBeVisible();
    await expect(authenticatedPage.locator(CAPTION)).toHaveCount(0);
  });

  test('renders NO caption when originalCurrency matches the display currency (AC7)', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await mockBudget(authenticatedPage, {
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, BUDGET_ID, {
          name: 'Courses',
          amount: 100,
          recurrence: 'fixed',
          originalAmount: 100,
          originalCurrency: 'EUR',
          targetCurrency: 'EUR',
        }),
      ],
    });

    await budgetDetailsPage.goto(BUDGET_ID);

    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_1}`),
    ).toBeVisible();
    await expect(authenticatedPage.locator(CAPTION)).toHaveCount(0);
  });
});
