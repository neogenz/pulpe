import type { BudgetLine, Transaction, TransactionKind } from "pulpe-shared";

import {
  DEFAULT_FILTERS,
  detailsSections,
  freeTransactions,
  kindCounts,
  type DetailsFilters,
} from "./budget-details-selectors";

const filters = (overrides: Partial<DetailsFilters> = {}): DetailsFilters => ({
  ...DEFAULT_FILTERS,
  checked: "all",
  ...overrides,
});

function line(
  id: string,
  kind: TransactionKind,
  amount: number,
  overrides: Partial<BudgetLine> = {},
): BudgetLine {
  return {
    id,
    budgetId: "budget-1",
    templateLineId: null,
    savingsGoalId: null,
    name: id,
    amount,
    kind,
    recurrence: "fixed",
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function transaction(
  id: string,
  amount: number,
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    budgetId: "budget-1",
    budgetLineId: null,
    name: id,
    amount,
    kind: "expense",
    transactionDate: "2026-08-05T10:00:00.000Z",
    checkedAt: null,
    createdAt: "2026-08-05T10:00:00.000Z",
    updatedAt: "2026-08-05T10:00:00.000Z",
    ...overrides,
  };
}

function firstItem(lines: BudgetLine[], transactions: Transaction[]) {
  const [section] = detailsSections(lines, transactions, filters());
  return section?.items[0];
}

describe("detailsSections", () => {
  it("orders the sections income, saving, expense", () => {
    const sections = detailsSections(
      [
        line("a", "expense", 100),
        line("b", "income", 200),
        line("c", "saving", 50),
      ],
      [],
      filters(),
    );

    expect(sections.map((section) => section.kind)).toEqual([
      "income",
      "saving",
      "expense",
    ]);
  });

  it("drops a kind the filter excludes", () => {
    const sections = detailsSections(
      [line("a", "expense", 100), line("b", "income", 200)],
      [],
      filters({ kind: "income" }),
    );

    expect(sections).toHaveLength(1);
    expect(sections[0]?.kind).toBe("income");
  });

  it("keeps only what is left to point", () => {
    const sections = detailsSections(
      [
        line("done", "expense", 100, { checkedAt: "2026-08-06T00:00:00.000Z" }),
        line("todo", "expense", 50),
      ],
      [],
      filters({ checked: "unchecked" }),
    );

    expect(sections[0]?.items.map((item) => item.line.id)).toEqual(["todo"]);
  });

  it("finds a line through a transaction booked against it", () => {
    const lines = [
      line("courses", "expense", 600),
      line("loyer", "expense", 1650),
    ];
    const transactions = [
      transaction("t1", 42, { budgetLineId: "courses", name: "Migros" }),
    ];

    const sections = detailsSections(
      lines,
      transactions,
      filters({ search: "migros" }),
    );

    expect(sections[0]?.items.map((item) => item.line.id)).toEqual(["courses"]);
  });

  // The user types what they see, grouping separator included.
  it("matches an amount whatever the separators", () => {
    const lines = [line("loyer", "expense", 1650)];

    for (const search of ["1650", "1’650", "1 650", "1650,00"]) {
      const sections = detailsSections(lines, [], filters({ search }));
      expect(sections[0]?.items).toHaveLength(1);
    }
  });

  it("matches nothing on a search with no digit and no name", () => {
    const sections = detailsSections(
      [line("loyer", "expense", 1650)],
      [],
      filters({ search: "  " }),
    );

    expect(sections).toEqual([]);
  });
});

describe("line amounts", () => {
  it("shows an untouched expense as planned", () => {
    const item = firstItem([line("loyer", "expense", 1650)], []);

    expect(item?.displayAmount).toBe(1650);
    expect(item?.amountSuffix).toEqual({ kind: "planned" });
  });

  it("shows a partly spent expense as what is left", () => {
    const item = firstItem(
      [line("courses", "expense", 600)],
      [transaction("t1", 412, { budgetLineId: "courses" })],
    );

    expect(item?.displayAmount).toBe(188);
    expect(item?.amountSuffix).toEqual({ kind: "remaining", amount: 600 });
    expect(item?.accent).toBe("warning");
  });

  it("shows an overrun expense as the overshoot", () => {
    const item = firstItem(
      [line("courses", "expense", 600)],
      [transaction("t1", 700, { budgetLineId: "courses" })],
    );

    expect(item?.displayAmount).toBe(100);
    expect(item?.amountSuffix).toEqual({ kind: "overrun" });
    expect(item?.statusLabel).toEqual({ kind: "overBudget" });
    expect(item?.accent).toBe("overBudget");
  });

  it("shows a partial income as what has landed, against the plan", () => {
    const item = firstItem(
      [line("salaire", "income", 4500)],
      [transaction("t1", 3000, { budgetLineId: "salaire", kind: "income" })],
    );

    expect(item?.displayAmount).toBe(3000);
    expect(item?.amountSuffix).toEqual({ kind: "plannedTotal", amount: 4500 });
    expect(item?.statusLabel).toEqual({ kind: "toReceive", amount: 1500 });
  });

  it("says nothing under a pointed line", () => {
    const item = firstItem(
      [
        line("salaire", "income", 4500, {
          checkedAt: "2026-08-06T00:00:00.000Z",
        }),
      ],
      [],
    );

    expect(item?.statusLabel).toBeNull();
  });

  // Over-received income is good news, not the red an overrun expense earns.
  it("keeps the income ink past plan", () => {
    const item = firstItem(
      [line("salaire", "income", 4500)],
      [transaction("t1", 5000, { budgetLineId: "salaire", kind: "income" })],
    );

    expect(item?.accent).toBe("income");
    expect(item?.statusLabel).toEqual({ kind: "received" });
  });
});

describe("freeTransactions", () => {
  it("keeps only the ones attached to no envelope, newest first", () => {
    const transactions = [
      transaction("older", 10, { transactionDate: "2026-08-01T00:00:00.000Z" }),
      transaction("allocated", 20, { budgetLineId: "courses" }),
      transaction("newer", 30, { transactionDate: "2026-08-09T00:00:00.000Z" }),
    ];

    expect(
      freeTransactions(transactions, filters()).map((row) => row.id),
    ).toEqual(["newer", "older"]);
  });
});

describe("kindCounts", () => {
  it("counts what the checked filter leaves visible", () => {
    const lines = [
      line("a", "expense", 100),
      line("b", "expense", 100, { checkedAt: "2026-08-06T00:00:00.000Z" }),
      line("c", "income", 200),
    ];

    expect(kindCounts(lines, "unchecked")).toEqual({
      all: 2,
      income: 1,
      saving: 0,
      expense: 1,
    });
    expect(kindCounts(lines, "all").all).toBe(3);
  });
});
