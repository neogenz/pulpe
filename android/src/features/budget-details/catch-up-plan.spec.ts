import type { BudgetLine, Transaction } from "pulpe-shared";

import {
  catchUpImpact,
  catchUpPlan,
  defaultChoice,
  updatesFor,
} from "./catch-up-plan";

function expense(
  id: string,
  amount: number,
  overrides: Partial<BudgetLine> = {},
): BudgetLine {
  return {
    id,
    budgetId: "b",
    templateLineId: null,
    savingsGoalId: null,
    assetId: null,
    name: id,
    amount,
    kind: "expense",
    recurrence: "one_off",
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function spent(budgetLineId: string, amount: number): Transaction {
  return {
    id: `${budgetLineId}-${amount}`,
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

const salary: BudgetLine = { ...expense("salaire", 3000), kind: "income" };

function ledger(lines: BudgetLine[], transactions: Transaction[]) {
  return { lines: [salary, ...lines], transactions, rollover: 0 };
}

describe("catchUpPlan", () => {
  const month = ledger(
    [expense("courses", 300), expense("loisirs", 150), expense("vacances", 60)],
    [spent("courses", 364.2), spent("loisirs", 50), spent("vacances", 10)],
  );

  it("totals the overruns and offers the lines with margin, most margin first", () => {
    const plan = catchUpPlan(month, null, "CHF");

    expect(plan.total).toBe(64.2);
    expect(plan.overruns.map((overrun) => overrun.line.id)).toEqual([
      "courses",
    ]);
    expect(plan.choices.map((choice) => choice.line.id)).toEqual([
      "loisirs",
      "vacances",
    ]);
    expect(defaultChoice(plan)?.line.id).toBe("loisirs");
  });

  it("lowers the chosen line and raises the overrun by the same share", () => {
    const plan = catchUpPlan(month, null, "CHF");
    const choice = defaultChoice(plan)!;

    expect(updatesFor(plan, choice).map(({ id }) => id)).toEqual([
      "loisirs",
      "courses",
    ]);
    expect(updatesFor(plan, choice)[0]?.amount).toBe(85.8);
    expect(updatesFor(plan, choice)[1]?.amount).toBe(364.2);
    // The overrun is absorbed, the envelope shrinks by what it gave.
    expect(catchUpImpact(plan, choice, month).tone).toBe("ok");
  });

  it("keeps every amount to the centime", () => {
    const plan = catchUpPlan(
      ledger(
        [expense("courses", 300), expense("loisirs", 250.3)],
        [spent("courses", 364.2)],
      ),
      null,
      "CHF",
    );
    const [lowered, raised] = updatesFor(plan, defaultChoice(plan)!);

    expect(lowered?.amount).toBe(186.1);
    expect(raised?.amount).toBe(364.2);
  });

  it("never offers to empty an untouched prévision", () => {
    const plan = catchUpPlan(
      ledger(
        [expense("courses", 100), expense("vide", 40)],
        [spent("courses", 140)],
      ),
      null,
      "CHF",
    );

    expect(plan.overruns).toHaveLength(1);
    expect(plan.choices).toEqual([]);
  });

  it("leaves out a pointed prévision and one typed in another currency", () => {
    const plan = catchUpPlan(
      ledger(
        [
          expense("courses", 100),
          expense("pointee", 500, { checkedAt: "2026-11-06T00:00:00.000Z" }),
          expense("euro", 500, { originalCurrency: "EUR" }),
        ],
        [spent("courses", 120)],
      ),
      null,
      "CHF",
    );

    expect(plan.choices).toEqual([]);
  });

  it("takes back only the focused prévision's overrun", () => {
    const plan = catchUpPlan(
      ledger(
        [expense("a", 100), expense("b", 100), expense("marge", 900)],
        [spent("a", 130), spent("b", 150)],
      ),
      "a",
      "CHF",
    );

    expect(plan.total).toBe(30);
    expect(plan.overruns.map((overrun) => overrun.line.id)).toEqual(["a"]);
  });

  it("reports nothing to take back when nothing overruns", () => {
    expect(
      catchUpPlan(ledger([expense("a", 100)], []), null, "CHF").overruns,
    ).toEqual([]);
  });
});
