import type {
  BudgetLine,
  ReconciliationContext,
  Transaction,
} from "pulpe-shared";

import { buildAdjustmentPayload, buildComparison } from "./reconciliation";

// Parsing, total and verdict are shared with the web: their cases live in
// `shared/src/calculators/account-reconciliation.spec.ts`.

describe("buildAdjustmentPayload", () => {
  it("writes one checked, free entry on the active budget", () => {
    const now = new Date("2026-10-02T09:30:00.000Z");

    expect(
      buildAdjustmentPayload({
        budgetId: "budget-1",
        name: "  Ajustement ",
        adjustment: { kind: "expense", amount: 170.3 },
        now,
      }),
    ).toEqual({
      budgetId: "budget-1",
      name: "Ajustement",
      amount: 170.3,
      kind: "expense",
      transactionDate: "2026-10-02T09:30:00.000Z",
      checkedAt: "2026-10-02T09:30:00.000Z",
    });
  });
});

describe("buildComparison", () => {
  const STAMP = "2026-11-18T10:00:00.000Z";
  const assurance = {
    id: "l-assurance",
    budgetId: "budget-1",
    templateLineId: null,
    savingsGoalId: null,
    assetId: null,
    name: "Assurance",
    amount: 100,
    kind: "expense",
    recurrence: "fixed",
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
  } satisfies BudgetLine;
  // Realized by its real income: the API refuses to check it, « À pointer » never lists it.
  const withdrawal: BudgetLine = {
    ...assurance,
    id: "l-withdrawal",
    name: "Retrait épargne",
    kind: "income",
    sourceSavingsGoalId: "goal-1",
  };
  const essence: Transaction = {
    id: "t-essence",
    budgetId: "budget-1",
    budgetLineId: null,
    name: "Essence",
    amount: 60,
    kind: "expense",
    transactionDate: STAMP,
    checkedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  const context: ReconciliationContext = {
    startingAmount: 0,
    hasCompletedComparison: true,
    priorCorrection: 0,
    priorItems: [],
  };
  const base = {
    onAccountsCents: 95_000,
    realizedBalance: 1050,
    available: 900,
    budgetLines: [assurance, withdrawal],
    transactions: [essence],
    context,
    comparedBefore: null,
    realizedBefore: null,
    isDismissed: false,
    payDayOfMonth: null,
    today: new Date(2026, 10, 18),
  };

  it("ranks this month's items from both sources, the exact one highlighted", () => {
    const comparison = buildComparison(base);

    expect(comparison.gap).toBe(-100);
    expect(comparison.screen).toBe("suggestions");
    expect(
      comparison.suggestions.map(({ name, source, settles }) => ({
        name,
        source,
        settles,
      })),
    ).toEqual([
      { name: "Assurance", source: "budgetLine", settles: true },
      { name: "Essence", source: "transaction", settles: false },
    ]);
    expect(comparison.suggestions[1].date).toBe(STAMP);
    // Assurance and Essence are shown; the withdrawal is not on « À pointer ».
    expect(comparison.othersCount).toBe(0);
    expect(comparison.note).toEqual({ before: 900, after: 800 });
  });

  it("counts in « Voir les autres » what « À pointer » lists: a movement under a checked prévision included", () => {
    // Android's own list: the web leaves this movement out, its prévision being checked.
    const courses: BudgetLine = {
      ...assurance,
      id: "l-courses",
      name: "Courses",
      amount: 400,
      checkedAt: STAMP,
    };
    const migros: Transaction = {
      ...essence,
      id: "t-migros",
      name: "Migros",
      amount: 250,
      budgetLineId: courses.id,
    };
    const comparison = buildComparison({
      ...base,
      budgetLines: [...base.budgetLines, courses],
      transactions: [...base.transactions, migros],
    });

    expect(comparison.suggestions.map((row) => row.name)).not.toContain(
      "Migros",
    );
    // « À pointer » lists Assurance, Essence and Migros; the first two are suggested.
    expect(comparison.othersCount).toBe(1);
  });

  it("counts what the checks found, then matches", () => {
    const afterEssence = buildComparison({
      ...base,
      realizedBalance: 990,
      transactions: [{ ...essence, checkedAt: STAMP }],
      comparedBefore: 1050,
      realizedBefore: 1050,
    });
    expect(afterEssence).toMatchObject({
      gap: -40,
      compared: 990,
      comparedBefore: 1050,
      realized: 990,
      realizedBefore: 1050,
      found: 60,
    });
    // Assurance would leave 60, further from zero than the 40 left.
    expect(afterEssence.suggestions).toEqual([]);

    const matched = buildComparison({
      ...base,
      onAccountsCents: 99_000,
      realizedBalance: 990,
      transactions: [{ ...essence, checkedAt: STAMP }],
      comparedBefore: 1050,
    });
    expect(matched).toMatchObject({
      gap: 0,
      screen: "matched",
      found: 60,
      matched: { stillPlanned: -90, beforePulpe: 0, remaining: 900 },
    });
  });

  it("strikes nothing through when the checks left the figure where it was", () => {
    expect(
      buildComparison({ ...base, comparedBefore: 1050, realizedBefore: 1050 }),
    ).toMatchObject({ comparedBefore: null, realizedBefore: null });
  });

  it("compares the struck figure to the cent, not as floats", () => {
    expect(
      buildComparison({
        ...base,
        realizedBalance: 0.3,
        comparedBefore: 0.3,
        realizedBefore: 0.1 + 0.2,
      }).realizedBefore,
    ).toBeNull();
  });

  it("falls back on the gap screens once the suggestions are dismissed", () => {
    expect(buildComparison({ ...base, isDismissed: true }).screen).toBe(
      "largeGap",
    );
    expect(
      buildComparison({
        ...base,
        onAccountsCents: 104_760,
        isDismissed: true,
      }).screen,
    ).toBe("smallGap");
    expect(
      buildComparison({
        ...base,
        onAccountsCents: 120_000,
        context: { ...context, hasCompletedComparison: false },
      }).screen,
    ).toBe("firstComparison");
  });

  describe("salary early", () => {
    // 6 000 more on the accounts, nothing to check that could explain it.
    const more = {
      ...base,
      onAccountsCents: 705_000,
      budgetLines: [],
      transactions: [],
    };

    it("asks within five days of pay day, and names the day", () => {
      expect(
        buildComparison({
          ...more,
          payDayOfMonth: 25,
          today: new Date(2026, 10, 23),
        }),
      ).toMatchObject({ screen: "salaryEarly", nextPayDay: 25 });
      expect(
        buildComparison({
          ...more,
          payDayOfMonth: 25,
          today: new Date(2026, 10, 10),
        }).screen,
      ).toBe("moreOnAccounts");
      expect(
        buildComparison({ ...more, today: new Date(2026, 10, 23) }).screen,
      ).toBe("moreOnAccounts");
    });

    it("takes the next period's own start, and on pay day itself the one after", () => {
      // Pay day 31: March's period starts on February 28th.
      expect(
        buildComparison({
          ...more,
          payDayOfMonth: 31,
          today: new Date(2027, 1, 26),
        }),
      ).toMatchObject({ screen: "salaryEarly", nextPayDay: 28 });
      expect(
        buildComparison({
          ...more,
          payDayOfMonth: 31,
          today: new Date(2027, 1, 28),
        }).screen,
      ).toBe("moreOnAccounts");
    });

    it("finds the next pay day across the new year", () => {
      expect(
        buildComparison({
          ...more,
          payDayOfMonth: 25,
          today: new Date(2026, 11, 23),
        }),
      ).toMatchObject({ screen: "salaryEarly", nextPayDay: 25 });
    });

    it("leaves the first comparison its own question", () => {
      expect(
        buildComparison({
          ...more,
          context: { ...more.context, hasCompletedComparison: false },
          payDayOfMonth: 25,
          today: new Date(2026, 10, 23),
        }).screen,
      ).toBe("firstComparison");
    });
  });
});
