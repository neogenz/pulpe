import type { BudgetDetails } from "@/features/budgets/budget-api";
import { i18n } from "@/core/i18n/i18n";

import {
  makeWeeklyRecap,
  nextRecapDate,
  weeklyRecapBody,
} from "./weekly-recap";

jest.mock("@/core/ui/amount-format", () => ({
  formatCompactCurrency: (value: number, currency: string) =>
    `${value} ${currency}`,
}));

const day = (month: number, date: number, hour = 12) =>
  new Date(2026, month - 1, date, hour);
const iso = (date: Date) => date.toISOString();

function line(
  id: string,
  name: string,
  kind: "income" | "expense",
  amount: number,
  extra: Record<string, unknown> = {},
) {
  return { id, name, kind, amount, checkedAt: null, ...extra };
}

function movement(
  date: Date,
  kind: string,
  amount: number,
  budgetLineId: string | null,
) {
  return { transactionDate: iso(date), kind, amount, budgetLineId };
}

const MONDAY = day(11, 16, 8);
const details = {
  budget: { month: 11, year: 2026, rollover: 0 },
  budgetLines: [
    line("income", "Salaire", "income", 3000),
    line("rent", "Loyer", "expense", 1000),
    line("checked", "Abo", "expense", 10, {
      checkedAt: "2026-11-02T10:00:00Z",
    }),
    line("carry", "Report", "expense", 5, { isRollover: true }),
  ],
  checkingDays: { rent: 17, checked: 17, carry: 17 },
  transactions: [
    movement(day(10, 20), "income", 10, null),
    movement(day(11, 5), "expense", 400, null),
    movement(day(11, 10), "expense", 30, "rent"),
    movement(day(11, 12), "expense", 20, null),
  ],
} as unknown as BudgetDetails;

describe("nextRecapDate", () => {
  it("is the next Monday at 8:30, today included while 8:30 has not passed", () => {
    expect(nextRecapDate(day(11, 14))).toEqual(new Date(2026, 10, 16, 8, 30));
    expect(nextRecapDate(day(11, 16, 7))).toEqual(
      new Date(2026, 10, 16, 8, 30),
    );
    expect(nextRecapDate(day(11, 16, 9))).toEqual(
      new Date(2026, 10, 23, 8, 30),
    );
  });
});

describe("makeWeeklyRecap", () => {
  it("counts the week before, splits what is left per remaining day, and names the forecasts usually pointed", () => {
    const recap = makeWeeklyRecap(MONDAY, details, null);

    expect(recap.movementCount).toBe(2);
    // 2000 planned minus the 420 of free movements, over the 15 days left, for 7 days.
    expect(recap.weekAllowance).toBeCloseTo((1580 / 15) * 7);
    // Free expenses of the 4 weeks before, averaged per week (400 + 20) / 4.
    expect(recap.usualWeekSpending).toBe(105);
    // Not the pointed one, not the carry-over line.
    expect(recap.expectedLineNames).toEqual(["Loyer"]);
  });

  it("has no usual spending before there is history", () => {
    const young = {
      ...details,
      transactions: details.transactions.slice(1),
    } as BudgetDetails;

    expect(makeWeeklyRecap(MONDAY, young, null).usualWeekSpending).toBeNull();
  });

  it("leaves the allowance and forecasts out when the week falls past the loaded period", () => {
    const recap = makeWeeklyRecap(day(12, 7, 8), details, null);

    expect(recap.weekAllowance).toBeNull();
    expect(recap.expectedLineNames).toEqual([]);
  });
});

describe("weeklyRecapBody", () => {
  beforeAll(() => {
    i18n.locale = "fr";
  });

  const recap = {
    movementCount: 2,
    weekAllowance: 933.4,
    usualWeekSpending: 105,
    expectedLineNames: ["Loyer"],
  };

  it("leads with the week ahead and ends with last week", () => {
    expect(weeklyRecapBody(recap, "CHF", true)).toBe(
      "Cette semaine : environ 933 CHF à dépenser (d'habitude, tu en dépenses 105 CHF). Prévu cette semaine : Loyer. Semaine passée : 2 mouvements notés.",
    );
  });

  it("keeps amounts and forecast names off the lock screen when asked", () => {
    expect(weeklyRecapBody(recap, "CHF", false)).toBe(
      "Semaine passée : 2 mouvements notés.",
    );
  });

  it("leads with the nudge when nothing was noted, and says an exhausted allowance plainly", () => {
    expect(
      weeklyRecapBody(
        {
          ...recap,
          movementCount: 0,
          weekAllowance: 0.25,
          expectedLineNames: [],
        },
        "CHF",
        true,
      ),
    ).toBe(
      "Nouvelle semaine : une minute pour noter tes derniers mouvements ? Ton disponible est épuisé : un coup d'œil pour ajuster ta semaine ?",
    );
  });
});
