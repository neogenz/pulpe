import type { BudgetLine, BudgetSparse, Transaction } from "pulpe-shared";

import {
  monthRecap,
  recapFindings,
  recapOutcome,
  recapSpending,
  recapSubtitle,
} from "./month-recap";

const t = (key: string, options?: Record<string, unknown>) =>
  options === undefined ? key : `${key}:${JSON.stringify(options)}`;
const amount = (value: number) => `${value}`;

const budgets: BudgetSparse[] = [
  {
    id: "oct",
    month: 10,
    year: 2026,
    totalIncome: 6200,
    totalExpenses: 6225.5,
    totalSavings: 1088,
    rollover: 365.5,
  },
];

describe("monthRecap", () => {
  it("closes the previous period, across the new year too", () => {
    const recap = monthRecap({ month: 11, year: 2026 }, budgets, 340);
    expect(recap).toMatchObject({
      budgetId: "oct",
      openedMonth: 11,
      endingBalance: -25.5,
      carriedOver: 340,
      key: "2026-10",
    });
    expect(recap && recapSpending(recap)).toBeCloseTo(5137.5);
    expect(
      monthRecap(
        { month: 1, year: 2027 },
        [{ id: "dec", month: 12, year: 2026 }],
        0,
      )?.key,
    ).toBe("2026-12");
  });

  it("is absent without a previous budget", () => {
    expect(monthRecap({ month: 12, year: 2026 }, budgets, 0)).toBeNull();
  });
});

describe("recap outcome and subtitle", () => {
  const base = monthRecap({ month: 11, year: 2026 }, budgets, 0)!;

  it("keeps half a unit as balanced", () => {
    expect(recapOutcome({ ...base, endingBalance: 0.5 })).toBe("saved");
    expect(recapOutcome({ ...base, endingBalance: -0.4 })).toBe("balanced");
    expect(recapOutcome({ ...base, endingBalance: -0.5 })).toBe("overspent");
  });

  it("prefers the carry-over, else the verdict", () => {
    expect(
      recapSubtitle(t, { ...base, carriedOver: 10 }, "novembre", amount),
    ).toContain("subtitleCarried");
    expect(recapSubtitle(t, base, "novembre", amount)).toContain(
      "subtitleOverspent",
    );
  });
});

describe("recapFindings", () => {
  const line = (over: Partial<BudgetLine>): BudgetLine =>
    ({
      id: "l",
      name: "L",
      amount: 100,
      kind: "expense",
      checkedAt: null,
      ...over,
    }) as BudgetLine;
  const tx = (over: Partial<Transaction>): Transaction =>
    ({
      amount: 10,
      budgetLineId: "l",
      checkedAt: null,
      ...over,
    }) as Transaction;

  it("names an unpaid saving, an overrun and what waits", () => {
    const findings = recapFindings(
      t,
      [
        line({ id: "s", name: "Vacances", kind: "saving" }),
        line({ id: "e", name: "Courses" }),
      ],
      [tx({ budgetLineId: "e", amount: 130, checkedAt: "2026-10-02" })],
      "octobre",
      amount,
    );
    expect(findings.map((finding) => finding.title)).toEqual([
      "home.recap.findings.savingsPartial",
      'home.recap.findings.overruns:{"count":1}',
      'home.recap.findings.waiting:{"count":2}',
    ]);
    expect(findings[1]?.overrun).toBe(30);
  });

  it("says everything is pointed, savings paid in full", () => {
    const findings = recapFindings(
      t,
      [line({ id: "s", kind: "saving", checkedAt: "2026-10-01" })],
      [tx({ budgetLineId: "s", checkedAt: "2026-10-01" })],
      "octobre",
      amount,
    );
    expect(findings.map((finding) => finding.title)).toEqual([
      "home.recap.findings.savingsFull",
      "home.recap.findings.allPointed",
    ]);
  });
});
