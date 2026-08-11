import type { TemplateLine } from "pulpe-shared";

import {
  canCreateTemplate,
  MAX_TEMPLATES,
  propagationBudgetCount,
  type TemplateUsage,
  templateLineSections,
  templateTotals,
} from "./template-vm";

function line(overrides: Partial<TemplateLine> = {}): TemplateLine {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    templateId: "22222222-2222-4222-8222-222222222222",
    savingsGoalId: null,
    name: "Loyer",
    amount: 1200,
    kind: "expense",
    recurrence: "fixed",
    description: "",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function usage(budgets: { month: number; year: number }[] = []): TemplateUsage {
  return {
    isUsed: budgets.length > 0,
    budgetCount: budgets.length,
    budgets: budgets.map((budget, index) => ({
      id: `budget-${index}`,
      month: budget.month,
      year: budget.year,
      description: "",
    })),
  };
}

describe("templateTotals", () => {
  it("counts savings as money leaving the month", () => {
    const totals = templateTotals([
      line({ kind: "income", amount: 5000 }),
      line({ kind: "expense", amount: 1200 }),
      line({ kind: "saving", amount: 800 }),
    ]);

    expect(totals).toEqual({ income: 5000, outflow: 2000, balance: 3000 });
  });

  it("is all zeroes on an empty model", () => {
    expect(templateTotals([])).toEqual({
      income: 0,
      outflow: 0,
      balance: 0,
    });
  });
});

describe("templateLineSections", () => {
  it("puts income first and drops the empty natures", () => {
    const sections = templateLineSections([
      line({ kind: "saving", amount: 300 }),
      line({ kind: "income", amount: 5000 }),
    ]);

    expect(sections.map((section) => section.kind)).toEqual([
      "income",
      "saving",
    ]);
    expect(sections.map((section) => section.total)).toEqual([5000, 300]);
  });
});

describe("propagationBudgetCount", () => {
  const now = new Date(2026, 7, 11);

  it("ignores the months already gone", () => {
    const count = propagationBudgetCount(
      usage([
        { month: 6, year: 2026 },
        { month: 8, year: 2026 },
        { month: 9, year: 2026 },
      ]),
      now,
    );

    expect(count).toBe(2);
  });

  it("counts the current month", () => {
    expect(propagationBudgetCount(usage([{ month: 8, year: 2026 }]), now)).toBe(
      1,
    );
  });

  it("crosses the year boundary", () => {
    expect(propagationBudgetCount(usage([{ month: 1, year: 2027 }]), now)).toBe(
      1,
    );
  });
});

describe("canCreateTemplate", () => {
  it("closes at the ceiling", () => {
    expect(canCreateTemplate(MAX_TEMPLATES - 1)).toBe(true);
    expect(canCreateTemplate(MAX_TEMPLATES)).toBe(false);
  });
});
