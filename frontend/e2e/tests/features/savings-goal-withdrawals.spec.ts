import type { Page, Request } from '@playwright/test';
import type {
  BudgetLine,
  SavingsGoalPlanApply,
  SavingsGoalWithdrawal,
  Transaction,
} from 'pulpe-shared';
import { API_ERROR_CODES, remainingPlannedWithdrawal } from 'pulpe-shared';
import { test, expect } from '../../fixtures/test-fixtures';
import { TEST_CONFIG } from '../../config/test-config';
import {
  TEST_UUIDS,
  createBudgetDetailsMock,
  createBudgetLineMock,
  createSavingsGoalDeletionImpactMock,
  createSavingsGoalMock,
  createSavingsGoalProgressMock,
  createSavingsGoalWithdrawalMock,
  createSavingsGoalWithdrawalOptionMock,
  createTransactionMock,
} from '../../helpers/api-mocks';

/**
 * PUL-329 — utiliser un objectif d'épargne comme source d'un revenu.
 *
 * One franc is followed end to end: it leaves a goal, lands in a budget as an
 * income, and every screen that mentions it must agree on where it came from.
 * The fake backend below keeps a single balance and derives every read from it,
 * so the equation `solde = 10'000 − Σ retraits` is what the assertions actually
 * exercise — no screen is allowed to compute it on its own.
 */

const GOAL_ID = TEST_UUIDS.GOAL_1;
const GOAL_NAME = 'Vacances';
const INCOME_NAME = 'Apport cuisine';
const INCOME_ID = TEST_UUIDS.TRANSACTION_1;
const INITIAL_BALANCE = 10000;
const WITHDRAWAL_AMOUNT = 4500;
const CURRENT_BUDGET = TEST_CONFIG.BUDGETS.CURRENT_MONTH;

interface GoalWorld {
  balance: number;
  withdrawals: SavingsGoalWithdrawal[];
  transactions: Transaction[];
  isGoalDeleted: boolean;
}

function createIncome(amount: number, isLinked: boolean): Transaction {
  return createTransactionMock(INCOME_ID, CURRENT_BUDGET.id, {
    name: INCOME_NAME,
    amount,
    kind: 'income',
    // The edit form only accepts a date inside the budget's month, and that
    // month is the real one: the transaction has to be dated accordingly.
    transactionDate: new Date().toISOString(),
    sourceSavingsGoalId: isLinked ? GOAL_ID : null,
    sourceSavingsGoalName: GOAL_NAME,
  });
}

/** The state a scenario starts from once the income already exists. */
function withdrawnWorld(amount = WITHDRAWAL_AMOUNT): Partial<GoalWorld> {
  return {
    balance: INITIAL_BALANCE - amount,
    withdrawals: [
      createSavingsGoalWithdrawalMock(INCOME_ID, CURRENT_BUDGET.id, {
        name: INCOME_NAME,
        amount,
      }),
    ],
    transactions: [createIncome(amount, true)],
  };
}

/**
 * A write only moves the balance once the browser has actually sent it; leaving
 * the page first would cancel it and let the next screen read a stale goal.
 */
function waitForTransactionWrite(page: Page, method: string): Promise<Request> {
  return page.waitForRequest(
    (request) =>
      request.method() === method &&
      /\/transactions\/[^/]+$/.test(request.url()),
  );
}

/**
 * Registered after the fixture's catch-all, so it wins on the routes it knows
 * and falls back for everything else. Every read is derived from the mutable
 * world: a screen can never be right by luck.
 */
async function installGoalWorld(
  page: Page,
  seed: Partial<GoalWorld> = {},
): Promise<GoalWorld> {
  const world: GoalWorld = {
    balance: INITIAL_BALANCE,
    withdrawals: [],
    transactions: [],
    isGoalDeleted: false,
    ...seed,
  };

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (path.endsWith('/users/settings') && method === 'GET') {
      return json({
        success: true,
        data: {
          currency: 'CHF',
          payDayOfMonth: 1,
          showCurrencySelector: false,
        },
      });
    }
    if (path.endsWith('/savings-goals/withdrawal-options')) {
      const isOffered = !world.isGoalDeleted && world.balance > 0;
      return json({
        success: true,
        data: isOffered
          ? [
              createSavingsGoalWithdrawalOptionMock(GOAL_ID, {
                name: GOAL_NAME,
                availableAmount: world.balance,
              }),
            ]
          : [],
      });
    }
    if (path.endsWith('/withdrawals')) {
      return json({ success: true, data: world.withdrawals });
    }
    if (path.endsWith('/progress')) {
      return json({
        success: true,
        data: createSavingsGoalProgressMock(GOAL_ID, {
          confirmed: world.balance,
          achievementPercent: Math.round((world.balance / 12000) * 100),
        }),
      });
    }
    if (path.endsWith('/contributions')) {
      return json({ success: true, data: [] });
    }
    if (path.endsWith('/deletion-impact')) {
      return json({
        success: true,
        data: createSavingsGoalDeletionImpactMock(GOAL_ID, world.withdrawals),
      });
    }
    if (path.endsWith('/deletion') && method === 'POST') {
      world.isGoalDeleted = true;
      // The income survives every mode; only its link dies.
      world.transactions = world.transactions.map((transaction) => ({
        ...transaction,
        sourceSavingsGoalId: null,
      }));
      return json({ success: true, message: 'deleted' });
    }
    if (path.endsWith('/savings-goals') && method === 'GET') {
      return json({
        success: true,
        data: world.isGoalDeleted
          ? []
          : [createSavingsGoalMock(GOAL_ID, { name: GOAL_NAME })],
      });
    }
    if (path.includes('/budgets/') && path.endsWith('/details')) {
      return json(
        createBudgetDetailsMock(CURRENT_BUDGET.id, {
          budget: {
            month: CURRENT_BUDGET.month,
            year: CURRENT_BUDGET.year,
            rollover: 0,
          },
          budgetLines: [
            createBudgetLineMock(TEST_UUIDS.LINE_1, CURRENT_BUDGET.id, {
              name: 'Salaire',
              amount: 5000,
              kind: 'income',
            }),
          ],
          transactions: world.transactions,
        }),
      );
    }
    if (path.endsWith('/transactions') && method === 'POST') {
      const payload = request.postDataJSON() as {
        amount: number;
        sourceSavingsGoalId?: string | null;
      };
      const income = createIncome(
        payload.amount,
        !!payload.sourceSavingsGoalId,
      );
      if (payload.sourceSavingsGoalId) {
        world.balance -= payload.amount;
        world.withdrawals = [
          createSavingsGoalWithdrawalMock(INCOME_ID, CURRENT_BUDGET.id, {
            name: INCOME_NAME,
            amount: payload.amount,
          }),
          ...world.withdrawals,
        ];
      }
      world.transactions = [...world.transactions, income];
      return json({ success: true, data: income });
    }
    if (/\/transactions\/[^/]+$/.test(path) && method === 'PATCH') {
      const payload = request.postDataJSON() as { amount?: number };
      const previous = world.withdrawals[0]?.amount ?? 0;
      const amount = payload.amount ?? previous;
      world.balance += previous - amount;
      world.withdrawals = [
        createSavingsGoalWithdrawalMock(INCOME_ID, CURRENT_BUDGET.id, {
          name: INCOME_NAME,
          amount,
        }),
      ];
      const income = createIncome(amount, true);
      world.transactions = [income];
      return json({ success: true, data: income });
    }
    if (/\/transactions\/[^/]+$/.test(path) && method === 'DELETE') {
      world.balance += world.withdrawals[0]?.amount ?? 0;
      world.withdrawals = [];
      world.transactions = [];
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fallback();
  });

  return world;
}

test.describe('Savings goal as the source of an income', () => {
  test('the same money is navigable from the budget to the goal and back', async ({
    authenticatedPage,
    currentMonthPage,
    budgetDetailsPage,
    savingsGoalsPage,
  }) => {
    await installGoalWorld(authenticatedPage);

    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('10 000');
    // A goal nobody drew from says nothing rather than announcing an emptiness.
    await expect(savingsGoalsPage.withdrawalsSection()).toBeHidden();

    await currentMonthPage.goto();
    await currentMonthPage.openTransactionForm('4500', INCOME_NAME);
    await currentMonthPage.selectTransactionKind('Revenu');
    await currentMonthPage.enableSavingsGoalSource();
    await currentMonthPage.selectSavingsGoalSource(GOAL_NAME);

    const preview = currentMonthPage.withdrawalPreview();
    await expect(preview).toContainText(/10.000 CHF/);
    await expect(preview).toContainText(/5.500 CHF/);

    const createRequest = authenticatedPage.waitForRequest(
      (request) =>
        request.url().endsWith('/transactions') && request.method() === 'POST',
    );
    await currentMonthPage.submitTransactionForm();
    // One POST carries the origin: the link is never a second write.
    expect((await createRequest).postDataJSON()).toMatchObject({
      amount: 4500,
      kind: 'income',
      sourceSavingsGoalId: GOAL_ID,
    });

    await budgetDetailsPage.goto(CURRENT_BUDGET.id);
    await expect(budgetDetailsPage.transactionSource(INCOME_ID)).toContainText(
      `Pris sur · ${GOAL_NAME}`,
    );

    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('5 500');
    await savingsGoalsPage.expectWithdrawalCount(1);
    await expect(savingsGoalsPage.withdrawalRows()).toContainText(/4.500\.00/);

    // Une seule transition : le retrait ouvre son budget, jamais un éditeur
    // poussé après attente. L'URL ne porte donc plus de transaction ciblée.
    await savingsGoalsPage.openWithdrawal(INCOME_NAME);
    await budgetDetailsPage.expectPageLoaded();
    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/budget/${CURRENT_BUDGET.id}$`),
    );
    await expect(budgetDetailsPage.transactionDialogSourceLink()).toBeHidden();
    await expect(budgetDetailsPage.transactionSource(INCOME_ID)).toContainText(
      `Pris sur · ${GOAL_NAME}`,
    );

    await authenticatedPage.goBack();
    await savingsGoalsPage.expectDetailLoaded();
  });

  test('editing and deleting the income keep the balance equation', async ({
    authenticatedPage,
    budgetDetailsPage,
    savingsGoalsPage,
  }) => {
    await installGoalWorld(authenticatedPage, withdrawnWorld());

    await budgetDetailsPage.openTransactionEditor(CURRENT_BUDGET.id, INCOME_ID);
    const amountInput = authenticatedPage.getByTestId('amount-input-value');
    await amountInput.fill('3500');
    const patched = waitForTransactionWrite(authenticatedPage, 'PATCH');
    await authenticatedPage
      .getByRole('button', { name: 'Enregistrer les modifications' })
      .click();
    expect((await patched).postDataJSON()).toMatchObject({ amount: 3500 });

    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('6 500');
    await savingsGoalsPage.expectWithdrawalCount(1);

    await budgetDetailsPage.goto(CURRENT_BUDGET.id);
    await authenticatedPage.getByTestId(`tx-menu-${INCOME_ID}`).click();
    await authenticatedPage.getByTestId(`delete-tx-${INCOME_ID}`).click();
    const deleted = waitForTransactionWrite(authenticatedPage, 'DELETE');
    await budgetDetailsPage.confirmDelete();
    await deleted;

    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('10 000');
    // The history entry goes with the money: nothing left to explain.
    await expect(savingsGoalsPage.withdrawalsSection()).toBeHidden();
  });

  test('an amount over the balance is refused before it can be sent', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    await installGoalWorld(authenticatedPage);

    await currentMonthPage.goto();
    await currentMonthPage.openTransactionForm('10000.01', INCOME_NAME);
    await currentMonthPage.selectTransactionKind('Revenu');
    await currentMonthPage.enableSavingsGoalSource();
    await currentMonthPage.selectSavingsGoalSource(GOAL_NAME);

    await expect(
      currentMonthPage.withdrawalInsufficientWarning(),
    ).toBeVisible();
    await expect(currentMonthPage.submitButton()).toBeDisabled();
  });

  test('a goal emptied to the last franc is no longer offered', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    await installGoalWorld(authenticatedPage, withdrawnWorld(INITIAL_BALANCE));

    await currentMonthPage.goto();
    await currentMonthPage.openTransactionForm('50', 'Autre apport');
    await currentMonthPage.selectTransactionKind('Revenu');
    await currentMonthPage.enableSavingsGoalSource();

    await expect(
      authenticatedPage.getByTestId('savings-goal-withdrawal-empty'),
    ).toBeVisible();
    await expect(currentMonthPage.submitButton()).toBeDisabled();
  });

  test('deleting the goal keeps the income and only breaks its link', async ({
    authenticatedPage,
    budgetDetailsPage,
    savingsGoalsPage,
  }) => {
    await installGoalWorld(authenticatedPage, withdrawnWorld());

    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.openDeletionDialog();

    // Its own block, with no per-row action: an income already lived through is
    // never a candidate for deletion.
    await expect(savingsGoalsPage.deletionWithdrawalsSection()).toContainText(
      'Retraits vers tes budgets',
    );
    await expect(savingsGoalsPage.deletionWithdrawalRows()).toHaveCount(1);
    await expect(savingsGoalsPage.deletionWithdrawalRows()).toContainText(
      INCOME_NAME,
    );
    // An aggregate, so no decimals — and signed, because the block reads as what
    // the goal gave away. The rows above keep their two decimals. The symbol is
    // part of the assertion: without it the substring would still match a total
    // that grew decimals back, which is precisely what this pins down.
    await savingsGoalsPage.expectDeletionWithdrawalTotal('-4 500 CHF');

    await savingsGoalsPage.confirmDeletion();
    await expect(
      authenticatedPage.getByTestId('savings-goals-page'),
    ).toBeVisible();

    await budgetDetailsPage.goto(CURRENT_BUDGET.id);
    const source = budgetDetailsPage.transactionSource(INCOME_ID);
    // History, not an anomaly: the full name is spoken, and nothing is clickable.
    // The visible text IS the accessible name — a generic <span> cannot be named
    // by aria-label, ARIA in HTML forbids it and browsers drop it. So the name is
    // asserted on the text, and the icon is what must stay out of the reading.
    await expect(source).toContainText(`Objectif supprimé · ${GOAL_NAME}`);
    await expect(source.locator('mat-icon')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await expect(source.locator('a')).toHaveCount(0);

    await budgetDetailsPage.openTransactionEditor(CURRENT_BUDGET.id, INCOME_ID);
    await expect(
      budgetDetailsPage.transactionDialogSourceBroken(),
    ).toBeVisible();
    await expect(budgetDetailsPage.transactionDialogSourceLink()).toHaveCount(
      0,
    );
  });
});

/**
 * PUL-329 v2 — annoncer un retrait, puis le réaliser.
 *
 * Une prévision source ne sort rien du pot : elle abaisse la projection et
 * laisse le confirmé intact. Seul le revenu réel débite. Les deux stocks se
 * lisent séparément, et le reliquat planifié est ce qui les empêche de
 * retrancher deux fois la même sortie :
 *
 *     confirmé  = stock − Σ réels
 *     reliquat  = max(0, annoncé − Σ réels)      ← `remainingPlannedWithdrawal`
 *     projeté   = confirmé − reliquat
 *
 * Le faux backend ci-dessous applique cette équation avec la VRAIE fonction
 * partagée : les montants du scénario ne sont donc jamais recopiés à la main.
 */

const PLANNED_LINE_NAME = 'Apport cuisine';
const PLANNED_AMOUNT = 500;
const GOAL_STOCK = 3600;

interface PlannedGoalWorld {
  /** Ce que l'objectif détient avant toute sortie. */
  stock: number;
  /** La prévision source, tant qu'elle existe. */
  line: BudgetLine | null;
  /** Retrait piloté par le plan sans Prévision Revenu. */
  planOnlyAmount: number;
  /** Contrats effectivement envoyés au endpoint atomique du plan. */
  planSubmissions: SavingsGoalPlanApply[];
  /** Les revenus réels qui la réalisent — eux seuls débitent. */
  realized: Transaction[];
}

function realizedTotal(world: PlannedGoalWorld): number {
  return world.realized.reduce((sum, tx) => sum + tx.amount, 0);
}

function confirmedOf(world: PlannedGoalWorld): number {
  return world.stock - realizedTotal(world);
}

function remainingOf(world: PlannedGoalWorld): number {
  const line = world.line;
  if (!line) return 0;
  return remainingPlannedWithdrawal(
    {
      id: line.id,
      amount: line.amount,
      month: CURRENT_BUDGET.month,
      year: CURRENT_BUDGET.year,
    },
    world.realized.map((tx) => ({
      amount: tx.amount,
      month: CURRENT_BUDGET.month,
      year: CURRENT_BUDGET.year,
      budgetLineId: tx.budgetLineId,
    })),
  );
}

function projectedOf(world: PlannedGoalWorld): number {
  return confirmedOf(world) - remainingOf(world) - world.planOnlyAmount;
}

async function installPlannedGoalWorld(
  page: Page,
  seed: Partial<PlannedGoalWorld> = {},
): Promise<PlannedGoalWorld> {
  const world: PlannedGoalWorld = {
    stock: GOAL_STOCK,
    line: null,
    planOnlyAmount: 0,
    planSubmissions: [],
    realized: [],
    ...seed,
  };

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (path.endsWith('/users/settings') && method === 'GET') {
      return json({
        success: true,
        data: {
          currency: 'CHF',
          payDayOfMonth: 1,
          showCurrencySelector: false,
        },
      });
    }
    if (path.endsWith('/savings-goals') && method === 'GET') {
      return json({
        success: true,
        data: [createSavingsGoalMock(GOAL_ID, { name: GOAL_NAME })],
      });
    }
    if (path.endsWith('/progress')) {
      const linkedPlanAmount =
        world.line?.sourceSavingsGoalId === GOAL_ID ? world.line.amount : 0;
      const plannedWithdrawalAmount = world.planOnlyAmount + linkedPlanAmount;
      return json({
        success: true,
        data: createSavingsGoalProgressMock(GOAL_ID, {
          confirmed: confirmedOf(world),
          projected: projectedOf(world),
          plannedProjection: projectedOf(world),
          months: [
            {
              month: CURRENT_BUDGET.month,
              year: CURRENT_BUDGET.year,
              state: 'current',
              isLocked: false,
              hasBudget: true,
              plannedAmount: 200,
              confirmedAmount: 0,
              withdrawnAmount: realizedTotal(world),
              plannedWithdrawalAmount,
              remainingPlannedWithdrawalAmount:
                world.planOnlyAmount + remainingOf(world),
              planOnlyWithdrawalAmount: world.planOnlyAmount,
              planLinkedWithdrawalAmount: linkedPlanAmount,
              planWithdrawalDestination:
                world.planOnlyAmount > 0
                  ? 'goal_only'
                  : linkedPlanAmount > 0
                    ? 'linked_income'
                    : undefined,
              planWithdrawalConsumedAmount:
                linkedPlanAmount > 0 ? realizedTotal(world) : 0,
              plannedCumulative: 0,
              confirmedCumulative: confirmedOf(world),
              projectedCumulative: projectedOf(world),
              lines: [
                {
                  budgetLineId: TEST_UUIDS.LINE_1,
                  amount: 200,
                  checkedAt: null,
                  isManuallyAdjusted: false,
                },
              ],
            },
          ],
        }),
      });
    }
    if (path.endsWith('/withdrawals')) {
      const linkedLine =
        world.line?.sourceSavingsGoalId === GOAL_ID ? world.line : null;
      const realizedAmount = linkedLine ? realizedTotal(world) : 0;
      const remainingAmount = linkedLine ? remainingOf(world) : 0;
      return json({
        success: true,
        data: world.realized.map((tx) =>
          createSavingsGoalWithdrawalMock(tx.id, CURRENT_BUDGET.id, {
            name: tx.name,
            amount: tx.amount,
          }),
        ),
        planned: linkedLine
          ? [
              {
                budgetLineId: linkedLine.id,
                budgetId: CURRENT_BUDGET.id,
                name: linkedLine.name,
                month: CURRENT_BUDGET.month,
                year: CURRENT_BUDGET.year,
                plannedAmount: linkedLine.amount,
                realizedAmount,
                remainingAmount,
                status:
                  remainingAmount === 0
                    ? 'realized'
                    : realizedAmount > 0
                      ? 'partially_realized'
                      : 'planned',
              },
            ]
          : [],
        planOnly:
          world.planOnlyAmount > 0
            ? [
                {
                  planWithdrawalId: TEST_UUIDS.LINE_3,
                  name: GOAL_NAME,
                  month: CURRENT_BUDGET.month,
                  year: CURRENT_BUDGET.year,
                  plannedAmount: world.planOnlyAmount,
                  origin: 'plan_only',
                },
              ]
            : [],
      });
    }
    if (path.endsWith('/contributions')) {
      return json({ success: true, data: [] });
    }
    if (path.includes('/budgets/') && path.endsWith('/details')) {
      return json(
        createBudgetDetailsMock(CURRENT_BUDGET.id, {
          budget: {
            month: CURRENT_BUDGET.month,
            year: CURRENT_BUDGET.year,
            rollover: 0,
          },
          budgetLines: world.line ? [world.line] : [],
          transactions: world.realized,
        }),
      );
    }
    if (path.endsWith('/budget-lines') && method === 'POST') {
      const payload = request.postDataJSON() as BudgetLine & { id: string };
      world.line = createBudgetLineMock(payload.id, CURRENT_BUDGET.id, {
        name: payload.name,
        amount: payload.amount,
        kind: payload.kind,
        sourceSavingsGoalId: payload.sourceSavingsGoalId,
        sourceSavingsGoalName: payload.sourceSavingsGoalId ? GOAL_NAME : null,
      });
      return json({ success: true, data: world.line });
    }
    if (path.endsWith(`/savings-goals/${GOAL_ID}/plan`) && method === 'POST') {
      const payload = request.postDataJSON() as SavingsGoalPlanApply;
      world.planSubmissions.push(payload);
      const withdrawal = payload.planWithdrawalAdjustments?.[0];
      if (withdrawal) {
        const plannedAmount = Math.abs(withdrawal.amount);
        if (withdrawal.destination === 'linked_income' && plannedAmount > 0) {
          world.planOnlyAmount = 0;
          world.line = createBudgetLineMock(
            TEST_UUIDS.LINE_2,
            CURRENT_BUDGET.id,
            {
              name: PLANNED_LINE_NAME,
              amount: plannedAmount,
              kind: 'income',
              sourceSavingsGoalId: GOAL_ID,
              sourceSavingsGoalName: GOAL_NAME,
            },
          );
        } else {
          world.line = null;
          world.planOnlyAmount = plannedAmount;
        }
      }
      return json({
        success: true,
        data: { updatedLines: world.line ? [world.line] : [] },
      });
    }
    if (/\/budget-lines\/[^/]+$/.test(path) && method === 'DELETE') {
      // La prévision s'en va ; ce qui en est déjà sorti reste sorti.
      world.line = null;
      return route.fulfill({ status: 204, body: '' });
    }
    if (path.endsWith('/transactions') && method === 'POST') {
      const payload = request.postDataJSON() as Transaction & { id: string };
      // Le serveur reste l'autorité : au-delà du stock confirmé, rien n'est écrit.
      if (payload.amount > confirmedOf(world)) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            statusCode: 400,
            error: 'BadRequest',
            code: API_ERROR_CODES.SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE,
            message: 'Insufficient balance',
          }),
        });
      }
      const income = createTransactionMock(payload.id, CURRENT_BUDGET.id, {
        name: payload.name,
        amount: payload.amount,
        kind: 'income',
        budgetLineId: payload.budgetLineId,
        transactionDate: new Date().toISOString(),
      });
      world.realized = [...world.realized, income];
      return json({ success: true, data: income });
    }
    if (/\/transactions\/[^/]+$/.test(path) && method === 'DELETE') {
      const id = path.split('/').pop();
      world.realized = world.realized.filter((tx) => tx.id !== id);
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fallback();
  });

  return world;
}

/** La prévision telle qu'elle existe déjà quand le scénario n'a pas à la créer. */
function announcedLine(overrides: Partial<BudgetLine> = {}): BudgetLine {
  return createBudgetLineMock(TEST_UUIDS.LINE_2, CURRENT_BUDGET.id, {
    name: PLANNED_LINE_NAME,
    amount: PLANNED_AMOUNT,
    kind: 'income',
    sourceSavingsGoalId: GOAL_ID,
    sourceSavingsGoalName: GOAL_NAME,
    ...overrides,
  });
}

test.describe('Announcing a withdrawal, then realizing it', () => {
  test('the plan keeps exactly one representation while changing the withdrawal destination', async ({
    authenticatedPage,
    savingsGoalsPage,
  }) => {
    const world = await installPlannedGoalWorld(authenticatedPage);
    const periodKey = CURRENT_BUDGET.year * 12 + CURRENT_BUDGET.month;

    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await authenticatedPage.getByTestId('goal-plan-adjust-button').click();
    await authenticatedPage
      .getByTestId(`goal-plan-row-edit-${periodKey}`)
      .click();
    const amountInput = authenticatedPage.getByTestId('goal-plan-row-input');
    await amountInput.fill('-4500');
    await amountInput.press('Enter');
    await authenticatedPage.getByTestId('goal-plan-apply').click();

    const goalOnly = authenticatedPage.getByRole('radio', {
      name: /Mettre à jour l’objectif uniquement/,
    });
    await expect(goalOnly).toBeChecked();
    await authenticatedPage.getByTestId('goal-plan-apply-confirm').click();

    await expect.poll(() => world.planSubmissions.length).toBe(1);
    expect(world.planSubmissions[0]).toMatchObject({
      planWithdrawalAdjustments: [
        {
          month: CURRENT_BUDGET.month,
          year: CURRENT_BUDGET.year,
          amount: -4500,
          destination: 'goal_only',
        },
      ],
    });
    const planOnlyRows = authenticatedPage.getByTestId(
      'savings-goal-plan-only-withdrawal-row',
    );
    const linkedRows = authenticatedPage.getByTestId(
      'savings-goal-planned-withdrawal-row',
    );
    await expect(planOnlyRows).toHaveCount(1);
    await expect(planOnlyRows).toContainText('Hors budget');
    await expect(linkedRows).toHaveCount(0);
    await expect(
      authenticatedPage.getByTestId('goal-plan-adjust-button'),
    ).toBeVisible();

    await authenticatedPage.getByTestId('goal-plan-adjust-button').click();
    await authenticatedPage
      .getByTestId(`goal-plan-row-edit-${periodKey}`)
      .click();
    await authenticatedPage.getByTestId('goal-plan-row-input').fill('-3500');
    await authenticatedPage.getByTestId('goal-plan-row-input').press('Enter');
    await authenticatedPage.getByTestId('goal-plan-apply').click();

    await expect(goalOnly).toBeChecked();
    await authenticatedPage
      .getByRole('radio', { name: /Créer aussi un revenu dans le budget/ })
      .click();
    await expect(
      authenticatedPage.getByTestId('goal-plan-withdrawal-conversion'),
    ).toHaveText(
      'Une Prévision Revenu liée sera créée avec la mise à jour du plan.',
    );
    await authenticatedPage.getByTestId('goal-plan-apply-confirm').click();

    await expect.poll(() => world.planSubmissions.length).toBe(2);
    expect(world.planSubmissions[1]).toMatchObject({
      planWithdrawalAdjustments: [
        {
          month: CURRENT_BUDGET.month,
          year: CURRENT_BUDGET.year,
          amount: -3500,
          destination: 'linked_income',
        },
      ],
    });
    await expect(planOnlyRows).toHaveCount(0);
    await expect(linkedRows).toHaveCount(1);
    await expect(linkedRows).toContainText('À réaliser');
    await expect(linkedRows).toHaveRole('link');
    await expect(linkedRows).toHaveAttribute(
      'aria-label',
      /Apport cuisine.*budget/,
    );
  });

  test('the pot only empties when the real income is created, and never twice', async ({
    authenticatedPage,
    budgetDetailsPage,
    savingsGoalsPage,
  }) => {
    // Sept étapes et huit navigations : le budget par défaut suffit à peine à
    // vide, et jamais quand les autres specs tournent en parallèle.
    test.slow();

    const world = await installPlannedGoalWorld(authenticatedPage);

    // 1. Un objectif confirmé à 3'600, et une prévision source de 500.
    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('3 600');
    await savingsGoalsPage.expectProjectedAmount('3 600');

    await budgetDetailsPage.goto(CURRENT_BUDGET.id);
    await budgetDetailsPage.openPlannedWithdrawalForm(
      PLANNED_LINE_NAME,
      String(PLANNED_AMOUNT),
    );
    await budgetDetailsPage.selectPlannedWithdrawalGoal(GOAL_NAME);
    // L'aperçu se lit à la période du budget, pas sur le solde du jour.
    const preview = budgetDetailsPage.plannedWithdrawalPreview();
    await expect(preview).toContainText(/3.600/);
    await expect(preview).toContainText(/3.100/);
    await budgetDetailsPage.submitNewBudgetLine();

    await expect.poll(() => world.line?.id ?? null).not.toBeNull();
    const lineId = world.line?.id ?? '';

    // 2. Annoncer ne sort rien : le confirmé tient, la projection baisse.
    await expect(budgetDetailsPage.budgetLineSource(lineId)).toContainText(
      `Pris sur · ${GOAL_NAME}`,
    );
    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('3 600');
    await savingsGoalsPage.expectProjectedAmount('3 100');
    await expect(
      savingsGoalsPage.plannedWithdrawalRows().first(),
    ).toContainText('-500');
    // Rien n'est encore sorti, mais l'annonce reste visible et navigable sans
    // inventer un Réel dans l'historique.
    await expect(savingsGoalsPage.withdrawalRows()).toHaveCount(0);
    await expect(
      authenticatedPage.getByTestId('savings-goal-planned-withdrawal-row'),
    ).toHaveCount(1);

    // 3. Réaliser 300 : 300 sortent du stock, 200 restent annoncés.
    await budgetDetailsPage.goto(CURRENT_BUDGET.id);
    await budgetDetailsPage.realizeWithdrawal(lineId);
    await realizeAmount(authenticatedPage, '300');

    expect(world.realized).toHaveLength(1);
    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('3 300');
    await savingsGoalsPage.expectProjectedAmount('3 100');
    await savingsGoalsPage.expectWithdrawalCount(1);

    // 4. Un réel au-delà du prévu ne crée pas de reliquat négatif : 700 sortis,
    //    aucun reliquat, projeté = confirmé. Jamais 2'400.
    await budgetDetailsPage.goto(CURRENT_BUDGET.id);
    await budgetDetailsPage.realizeWithdrawal(lineId);
    await realizeAmount(authenticatedPage, '400');

    expect(world.realized).toHaveLength(2);
    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('2 900');
    await savingsGoalsPage.expectProjectedAmount('2 900');

    // 5. Supprimer un réel rend son montant au stock et rouvre le reliquat.
    const lastRealizedId = world.realized[world.realized.length - 1].id;
    await budgetDetailsPage.goto(CURRENT_BUDGET.id);
    // La prévision entièrement réalisée est effectivement pointée et donc
    // masquée par le filtre par défaut. Elle reste disponible dans « Tout voir ».
    await authenticatedPage.getByRole('option', { name: 'Tout voir' }).click();
    await budgetDetailsPage.openEnvelopePanel(PLANNED_LINE_NAME);
    // Le panneau est la surface de détail du desktop : il nomme l'objectif
    // source, jamais la prévision. L'assertion porte sur le texte rendu de bout
    // en bout, avec les vraies données du budget derrière.
    await expect(budgetDetailsPage.envelopePanelSource(lineId)).toContainText(
      `Pris sur · ${GOAL_NAME}`,
    );
    await authenticatedPage.getByTestId(`delete-tx-${lastRealizedId}`).click();
    await budgetDetailsPage.confirmDelete();
    await expect.poll(() => world.realized).toHaveLength(1);

    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('3 300');
    await savingsGoalsPage.expectProjectedAmount('3 100');

    // …et supprimer la prévision n'efface pas le retrait déjà vécu.
    await budgetDetailsPage.goto(CURRENT_BUDGET.id);
    await authenticatedPage.getByTestId(`card-menu-${lineId}`).click();
    await authenticatedPage.getByTestId(`delete-${lineId}`).click();
    await budgetDetailsPage.confirmDelete();
    await expect.poll(() => world.line).toBeNull();

    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('3 300');
    await savingsGoalsPage.expectWithdrawalCount(1);
    await expect(savingsGoalsPage.plannedWithdrawalRows()).toHaveCount(0);
  });

  test('a real income over the balance is refused with the entry left intact', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const world = await installPlannedGoalWorld(authenticatedPage, {
      line: announcedLine(),
    });

    await budgetDetailsPage.goto(CURRENT_BUDGET.id);
    await budgetDetailsPage.realizeWithdrawal(TEST_UUIDS.LINE_2);
    const amountInput = realizationAmountInput(authenticatedPage);
    await amountInput.fill('4000');
    await authenticatedPage.getByTestId('save-transaction').click();

    await expect(
      authenticatedPage.getByTestId('transaction-submit-error'),
    ).toBeVisible();
    // La saisie reste à l'écran : le refus porte justement sur ce montant.
    await expect(amountInput).toHaveValue('4000');
    expect(world.realized).toHaveLength(0);
  });

  test('an orphan source stays readable and can no longer be realized', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await installPlannedGoalWorld(authenticatedPage, {
      line: announcedLine({ sourceSavingsGoalId: null }),
    });

    await budgetDetailsPage.goto(CURRENT_BUDGET.id);

    await expect(
      budgetDetailsPage.budgetLineSource(TEST_UUIDS.LINE_2),
    ).toContainText(`Objectif supprimé · ${GOAL_NAME}`);
    // Plus rien à débiter côté serveur : la prévision redevient ordinaire et
    // reprend la bascule de pointage.
    await expect(
      authenticatedPage.getByTestId(`realize-withdrawal-${TEST_UUIDS.LINE_2}`),
    ).toHaveCount(0);
    await expect(
      authenticatedPage.getByTestId(`toggle-check-${TEST_UUIDS.LINE_2}`),
    ).toBeVisible();

    // Le panneau de détail raconte la même histoire que la carte : l'argent
    // vient d'un objectif qui n'existe plus, et cela reste lisible.
    await budgetDetailsPage.openEnvelopePanel(PLANNED_LINE_NAME);
    await expect(
      budgetDetailsPage.envelopePanelSource(TEST_UUIDS.LINE_2),
    ).toContainText(`Objectif supprimé · ${GOAL_NAME}`);
  });
});

/** Saisit et confirme le revenu réel, depuis la boîte déjà ouverte. */
async function realizeAmount(page: Page, amount: string): Promise<void> {
  await realizationAmountInput(page).fill(amount);
  await page.getByTestId('save-transaction').click();
  await expect(page.getByTestId('realize-withdrawal-context')).toBeHidden();
}

/** Scoped to the open dialog: the page behind it carries amounts of its own. */
function realizationAmountInput(page: Page) {
  return page.getByRole('dialog').getByTestId('amount-input-value');
}
