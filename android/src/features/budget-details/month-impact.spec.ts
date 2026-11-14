import type { BudgetLine, Transaction } from "pulpe-shared";

import { impactBetween, impactOfRemoving } from "./month-impact";

function line(
  id: string,
  kind: BudgetLine["kind"],
  amount: number,
): BudgetLine {
  return {
    id,
    budgetId: "b",
    templateLineId: null,
    savingsGoalId: null,
    assetId: null,
    name: id,
    amount,
    kind,
    recurrence: "one_off",
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

function transaction(budgetLineId: string | null, amount: number): Transaction {
  return {
    id: `t-${amount}`,
    budgetId: "b",
    budgetLineId,
    name: "t",
    amount,
    kind: "expense",
    transactionDate: "2026-11-05T10:00:00.000Z",
    checkedAt: null,
    createdAt: "2026-11-05T10:00:00.000Z",
    updatedAt: "2026-11-05T10:00:00.000Z",
  };
}

const income = line("salaire", "income", 3000);

describe("impactOfRemoving", () => {
  it("raises the disponible by an untouched prévision", () => {
    const ledger = {
      lines: [income, line("cadeau", "expense", 80)],
      transactions: [],
      rollover: 0,
    };

    expect(impactOfRemoving(ledger, "cadeau")).toEqual({
      before: 2920,
      after: 3000,
      delta: 80,
      tone: "ok",
    });
  });

  it("keeps the movements, Hors prévision", () => {
    const ledger = {
      lines: [income, line("courses", "expense", 500)],
      transactions: [transaction("courses", 300)],
      rollover: 0,
    };

    // The planned 500 goes, the 300 spent stays against the month.
    expect(impactOfRemoving(ledger, "courses")).toMatchObject({
      before: 2500,
      after: 2700,
      tone: "ok",
    });
  });

  it("says nothing moves when the prévision was already fully spent", () => {
    const ledger = {
      lines: [income, line("courses", "expense", 300)],
      transactions: [transaction("courses", 300)],
      rollover: 0,
    };

    expect(impactOfRemoving(ledger, "courses").tone).toBe("neutral");
  });
});

describe("impactBetween", () => {
  it("is over when the disponible drops", () => {
    const before = { lines: [income], transactions: [], rollover: 0 };
    const after = {
      ...before,
      lines: [income, line("x", "expense", 40)],
    };

    expect(impactBetween(before, after)).toMatchObject({
      delta: -40,
      tone: "over",
    });
  });
});
