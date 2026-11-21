import type {
  BudgetLine,
  ReconciliationContext,
  ReconciliationPriorItem,
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
  const pharmacie: ReconciliationPriorItem = {
    id: "t-pharmacie",
    source: "transaction",
    budgetId: "budget-0",
    name: "Pharmacie",
    amount: 40,
    kind: "expense",
    monthsAgo: 1,
    effect: -40,
  };
  const context: ReconciliationContext = {
    startingAmount: 0,
    hasCompletedComparison: true,
    priorCorrection: 0,
    priorItems: [pharmacie],
  };
  const base = {
    onAccountsCents: 95_000,
    realizedBalance: 1050,
    available: 900,
    budgetLines: [assurance, withdrawal],
    transactions: [essence],
    context,
    comparedBefore: null,
    isDismissed: false,
    payDayOfMonth: null,
    today: new Date(2026, 10, 18),
  };

  it("ranks the happy path's items from every source, the exact one highlighted", () => {
    const comparison = buildComparison(base);

    expect(comparison.gap).toBe(-100);
    expect(comparison.screen).toBe("suggestions");
    expect(
      comparison.suggestions.map(({ name, source, monthsAgo, settles }) => ({
        name,
        source,
        monthsAgo,
        settles,
      })),
    ).toEqual([
      {
        name: "Assurance",
        source: "budgetLine",
        monthsAgo: 0,
        settles: true,
      },
      {
        name: "Essence",
        source: "transaction",
        monthsAgo: 0,
        settles: false,
      },
      {
        name: "Pharmacie",
        source: "transaction",
        monthsAgo: 1,
        settles: false,
      },
    ]);
    expect(comparison.suggestions[1].date).toBe(STAMP);
    // Assurance and Essence are shown; the withdrawal is not on « À pointer ».
    expect(comparison.othersCount).toBe(0);
    expect(comparison.note).toEqual({ before: 900, after: 800 });
  });

  it("counts what the checks found, then matches once the previous month moves", () => {
    const afterEssence = buildComparison({
      ...base,
      realizedBalance: 990,
      transactions: [{ ...essence, checkedAt: STAMP }],
      comparedBefore: 1050,
    });
    expect(afterEssence).toMatchObject({
      gap: -40,
      compared: 990,
      comparedBefore: 1050,
      found: 60,
    });
    expect(afterEssence.suggestions.map((row) => row.name)).toEqual([
      "Pharmacie",
    ]);
    expect(afterEssence.suggestions[0].settles).toBe(true);

    const afterPharmacie = buildComparison({
      ...base,
      realizedBalance: 990,
      transactions: [{ ...essence, checkedAt: STAMP }],
      context: { ...context, priorCorrection: -40, priorItems: [] },
      comparedBefore: 1050,
    });
    expect(afterPharmacie).toMatchObject({
      gap: 0,
      screen: "matched",
      found: 100,
      matched: { stillPlanned: -50, beforePulpe: 0, remaining: 900 },
    });
  });

  it("strikes nothing through when the checks left the figure where it was", () => {
    expect(
      buildComparison({ ...base, comparedBefore: 1050 }).comparedBefore,
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
      context: { ...context, priorItems: [] },
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
