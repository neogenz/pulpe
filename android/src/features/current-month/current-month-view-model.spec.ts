import type { Budget, BudgetLine, Transaction } from "pulpe-shared";

import {
  buildCurrentMonthViewModel,
  selectBudgetIdForPeriod,
  withRolloverLine,
} from "./current-month-view-model";

const BUDGET_ID = "budget-august";
const AUGUST_11 = new Date(2026, 7, 11);

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: BUDGET_ID,
    month: 8,
    year: 2026,
    description: "Août 2026",
    templateId: "template-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function line(overrides: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: "line-1",
    budgetId: BUDGET_ID,
    templateLineId: null,
    savingsGoalId: null,
    name: "Loyer",
    amount: 1200,
    kind: "expense",
    recurrence: "fixed",
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    budgetId: BUDGET_ID,
    budgetLineId: null,
    name: "Courses",
    amount: 60,
    kind: "expense",
    transactionDate: "2026-08-10T00:00:00.000Z",
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    checkedAt: null,
    ...overrides,
  };
}

function viewModelOf(
  budgetLines: BudgetLine[],
  transactions: Transaction[] = [],
  overrides: Partial<Budget> = {},
  payDayOfMonth: number | null = null,
) {
  return buildCurrentMonthViewModel(
    { budget: budget(overrides), budgetLines, transactions },
    { now: AUGUST_11, payDayOfMonth },
  );
}

describe("selectBudgetIdForPeriod", () => {
  it("finds the budget covering the period", () => {
    const budgets = [
      { id: "september", month: 9, year: 2026 },
      { id: "august", month: 8, year: 2026 },
      { id: "august-last-year", month: 8, year: 2025 },
    ];

    expect(selectBudgetIdForPeriod(budgets, { month: 8, year: 2026 })).toBe(
      "august",
    );
  });

  it("reports no budget rather than falling back on a neighbour", () => {
    expect(
      selectBudgetIdForPeriod([{ id: "august", month: 8, year: 2026 }], {
        month: 9,
        year: 2026,
      }),
    ).toBeNull();
  });
});

describe("withRolloverLine", () => {
  it("shows a negative carry-over as an expense envelope", () => {
    const lines = withRolloverLine(budget({ rollover: -80 }), []);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: "expense", amount: 80 });
  });

  it("adds nothing when there is no carry-over", () => {
    const base = [line()];

    expect(withRolloverLine(budget({ rollover: 0 }), base)).toBe(base);
  });
});

describe("metrics", () => {
  it("adds the carry-over to what is available and leaves it out of the lines", () => {
    const model = viewModelOf(
      [
        line({ id: "salary", kind: "income", amount: 5000 }),
        line({ id: "rent", amount: 1200 }),
      ],
      [transaction({ amount: 300 })],
      { rollover: 200 },
    );

    expect(model.metrics.available).toBe(5200);
    expect(model.metrics.totalExpenses).toBe(1500);
    expect(model.metrics.remaining).toBe(3700);
    expect(model.emotion).toBe("comfortable");
  });

  it("calls the month a deficit once the plan goes past what came in", () => {
    const model = viewModelOf([
      line({ id: "salary", kind: "income", amount: 1000 }),
      line({ id: "rent", amount: 1400 }),
    ]);

    expect(model.emotion).toBe("deficit");
  });
});

describe("period", () => {
  it("counts today as a day left", () => {
    const model = viewModelOf([
      line({ id: "salary", kind: "income", amount: 2100 }),
    ]);

    expect(model.daysRemaining).toBe(21);
    expect(model.periodProgress).toEqual({ day: 11, totalDays: 31 });
    expect(model.dailyBudget).toBe(100);
  });

  it("follows the pay day instead of the calendar month", () => {
    const model = viewModelOf(
      [line({ id: "salary", kind: "income", amount: 1000 })],
      [],
      {},
      27,
    );

    expect(model.daysRemaining).toBe(16);
    expect(model.periodProgress).toEqual({ day: 16, totalDays: 31 });
  });

  it("offers nothing to spend per day when the month is already in deficit", () => {
    const model = viewModelOf([line({ id: "rent", amount: 1200 })]);

    expect(model.dailyBudget).toBe(0);
  });
});

describe("drift", () => {
  it("lists the envelopes spent past their plan, worst first", () => {
    const model = viewModelOf(
      [
        line({ id: "groceries", name: "Courses", amount: 400 }),
        line({ id: "leisure", name: "Loisirs", amount: 100 }),
        line({ id: "rent", name: "Loyer", amount: 1200 }),
      ],
      [
        transaction({ id: "t1", budgetLineId: "groceries", amount: 450 }),
        transaction({ id: "t2", budgetLineId: "leisure", amount: 300 }),
        transaction({ id: "t3", budgetLineId: "rent", amount: 1200 }),
      ],
    );

    expect(model.driftLines.map((drift) => drift.line.id)).toEqual([
      "leisure",
      "groceries",
    ]);
    expect(model.driftTotal).toBe(250);
  });

  // Dividing by a plan of zero reports 0 %, so the percentage cannot be the test.
  it("counts an envelope with no plan that was spent on anyway", () => {
    const model = viewModelOf(
      [line({ id: "extras", amount: 0 })],
      [transaction({ budgetLineId: "extras", amount: 90 })],
    );

    expect(model.driftLines).toHaveLength(1);
    expect(model.driftTotal).toBe(90);
  });

  it("leaves the carry-over line out of the drift", () => {
    const model = viewModelOf([
      line({ id: "rollover-x", amount: 0, isRollover: true }),
    ]);

    expect(model.driftLines).toHaveLength(0);
  });
});

describe("unchecked", () => {
  it("keeps subtitle data semantic until presentation", () => {
    const model = viewModelOf([line()], [transaction()]);

    expect(model.uncheckedItems.map((item) => item.subtitle)).toEqual([
      { kind: "date", value: "2026-08-10T00:00:00.000Z" },
      { kind: "recurrence", value: "fixed" },
    ]);
  });

  it("puts what was spent ahead of what was planned", () => {
    const model = viewModelOf(
      [line({ id: "rent", name: "Loyer" })],
      [
        transaction({
          id: "allocated",
          name: "Loyer août",
          budgetLineId: "rent",
        }),
        transaction({ id: "free", name: "Café" }),
      ],
    );

    expect(model.uncheckedItems.map((item) => item.name)).toEqual([
      "Café",
      "Loyer août",
      "Loyer",
    ]);
  });

  it("keeps counting past the five it shows", () => {
    const lines = Array.from({ length: 8 }, (_, index) =>
      line({ id: `line-${index}`, name: `Prévision ${index}` }),
    );

    const model = viewModelOf(lines);

    expect(model.uncheckedItems).toHaveLength(5);
    expect(model.uncheckedCount).toBe(8);
  });

  it("never asks the user to point the carry-over", () => {
    const model = viewModelOf([
      line({ id: "rollover-x", isRollover: true, amount: 200 }),
    ]);

    expect(model.uncheckedCount).toBe(0);
    expect(model.uncheckedItems).toHaveLength(0);
  });

  it("never asks the user to point a planned savings withdrawal", () => {
    const model = viewModelOf([
      line({
        id: "withdrawal",
        kind: "income",
        recurrence: "one_off",
        sourceSavingsGoalId: "goal-1",
      }),
    ]);

    expect(model.uncheckedCount).toBe(0);
    expect(model.uncheckedItems).toHaveLength(0);
  });

  it("carries the envelope state on an allocated transaction", () => {
    const model = viewModelOf(
      [line({ id: "groceries", amount: 400 })],
      [transaction({ budgetLineId: "groceries", amount: 250 })],
    );

    expect(model.uncheckedItems[0]?.consumption).toEqual({
      allocated: 250,
      available: 150,
      percentage: 62.5,
    });
  });
});

describe("trajectory", () => {
  // The full arithmetic is asserted in `shared/src/calculators/`; what matters
  // here is that the chart and the hero read the same number.
  it("lands on the figure the hero prints", () => {
    const model = viewModelOf(
      [
        line({ id: "salary", kind: "income", amount: 5000 }),
        line({ id: "food", amount: 500 }),
      ],
      [
        transaction({
          budgetLineId: "food",
          amount: 800,
          transactionDate: "2026-08-05T12:00:00.000Z",
        }),
      ],
    );

    expect(model.trajectory?.estimatedBalance).toBe(model.metrics.remaining);
  });
});

describe("savings", () => {
  it("reports the month complete once every planned transfer is pointed", () => {
    const model = viewModelOf([
      line({
        id: "savings",
        kind: "saving",
        amount: 500,
        checkedAt: "2026-08-05T00:00:00.000Z",
      }),
    ]);

    expect(model.savings).toMatchObject({
      totalPlanned: 500,
      totalRealized: 500,
      checkedCount: 1,
      totalCount: 1,
      isComplete: true,
    });
  });

  it("stays incomplete while a transfer is still to be pointed", () => {
    const model = viewModelOf([
      line({
        id: "savings-a",
        kind: "saving",
        amount: 300,
        checkedAt: "2026-08-05T00:00:00.000Z",
      }),
      line({ id: "savings-b", kind: "saving", amount: 200 }),
    ]);

    expect(model.savings.isComplete).toBe(false);
    expect(model.savings.progressPercentage).toBe(60);
  });

  it("says there is nothing to save rather than reporting a complete month", () => {
    const model = viewModelOf([line({ id: "rent", amount: 1200 })]);

    expect(model.savings.hasSavings).toBe(false);
    expect(model.savings.isComplete).toBe(false);
  });
});

describe("realized", () => {
  it("carries the report in the balance, never in what was pointed", () => {
    const model = viewModelOf(
      [
        line({
          id: "salary",
          kind: "income",
          amount: 5000,
          checkedAt: "2026-08-01T00:00:00.000Z",
        }),
      ],
      [],
      { rollover: 500 },
    );

    // Same balance as iOS, and "Pointé" shows the salary alone: the carry-over
    // is not income that landed this month.
    expect(model.realized.realizedIncome).toBe(5000);
    expect(model.realized.realizedBalance).toBe(5500);
  });

  it("keeps savings transfers out of what was spent", () => {
    const model = viewModelOf([
      line({
        id: "rent",
        amount: 1200,
        checkedAt: "2026-08-05T00:00:00.000Z",
      }),
      line({
        id: "savings",
        kind: "saving",
        amount: 300,
        checkedAt: "2026-08-05T00:00:00.000Z",
      }),
    ]);

    expect(model.realized.realizedExpenses).toBe(1500);
    expect(model.realized.realizedSpending).toBe(1200);
    expect(model.realized.realizedSavings).toBe(300);
  });

  it("tallies the pointing over everything the lists show", () => {
    const model = viewModelOf(
      [line({ id: "rent", checkedAt: "2026-08-05T00:00:00.000Z" })],
      [transaction()],
      { rollover: 500 },
    );

    // Rent, the free transaction, and the always-checked carry-over row.
    expect(model.realized.totalItemsCount).toBe(3);
    expect(model.realized.checkedItemsCount).toBe(2);
  });
});
