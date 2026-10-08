import type { TemplateLine } from "pulpe-shared";

import {
  canCreateTemplate,
  MAX_TEMPLATES,
  propagationBudgetCount,
  type TemplateUsage,
  templateLineSections,
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
      null,
      now,
    );

    expect(count).toBe(2);
  });

  it("counts the current month", () => {
    expect(
      propagationBudgetCount(usage([{ month: 8, year: 2026 }]), null, now),
    ).toBe(1);
  });

  it("crosses the year boundary", () => {
    expect(
      propagationBudgetCount(usage([{ month: 1, year: 2027 }]), null, now),
    ).toBe(1);
  });

  describe("with a payday", () => {
    const july = { month: 7, year: 2026 };
    const august = { month: 8, year: 2026 };
    const september = { month: 9, year: 2026 };

    it("still counts the previous month's budget before a first-quinzaine payday", () => {
      const beforePayday = new Date(2026, 7, 3);

      expect(
        propagationBudgetCount(usage([july, august]), 5, beforePayday),
      ).toBe(2);
      expect(propagationBudgetCount(usage([july]), 5, beforePayday)).toBe(1);
    });

    it("moves to the next period on a first-quinzaine payday", () => {
      const onPayday = new Date(2026, 7, 5);

      expect(propagationBudgetCount(usage([july, august]), 5, onPayday)).toBe(
        1,
      );
    });

    it("keeps the current budget until a second-quinzaine payday", () => {
      const dayBefore = new Date(2026, 7, 26);

      expect(
        propagationBudgetCount(usage([august, september]), 27, dayBefore),
      ).toBe(2);
    });

    it("drops the month once a second-quinzaine payday has passed", () => {
      const onPayday = new Date(2026, 7, 27);

      expect(
        propagationBudgetCount(usage([august, september]), 27, onPayday),
      ).toBe(1);
    });

    it("rolls a late-December payday over into January", () => {
      const afterPayday = new Date(2026, 11, 28);

      expect(
        propagationBudgetCount(
          usage([
            { month: 12, year: 2026 },
            { month: 1, year: 2027 },
          ]),
          27,
          afterPayday,
        ),
      ).toBe(1);
    });

    it("falls back to the calendar month without a payday", () => {
      const beforePayday = new Date(2026, 7, 3);

      expect(propagationBudgetCount(usage([july]), null, beforePayday)).toBe(0);
      expect(
        propagationBudgetCount(usage([july]), undefined, beforePayday),
      ).toBe(0);
    });
  });
});

describe("canCreateTemplate", () => {
  it("closes at the ceiling", () => {
    expect(canCreateTemplate(MAX_TEMPLATES - 1)).toBe(true);
    expect(canCreateTemplate(MAX_TEMPLATES)).toBe(false);
  });
});
