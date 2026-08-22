import type { Transaction } from "pulpe-shared";

import { summarizeActivity } from "./activity-window";

const NOW = new Date(2026, 7, 11, 12);

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    budgetId: "budget-august",
    budgetLineId: null,
    name: "Courses",
    amount: 60,
    kind: "expense",
    transactionDate: "2026-08-11T09:00:00.000Z",
    createdAt: "2026-08-11T09:00:00.000Z",
    updatedAt: "2026-08-11T09:00:00.000Z",
    checkedAt: null,
    ...overrides,
  };
}

function dated(id: string, isoDate: string, rest: Partial<Transaction> = {}) {
  return transaction({ id, transactionDate: isoDate, ...rest });
}

describe("summarizeActivity", () => {
  it("keeps day groups semantic for localized presentation", () => {
    const { days } = summarizeActivity(
      [
        dated("today", "2026-08-11T09:00:00.000Z"),
        dated("yesterday", "2026-08-10T09:00:00.000Z"),
        dated("older", "2026-08-07T09:00:00.000Z"),
      ],
      "week",
      NOW,
    );

    expect(days.map((day) => day.date.getDate())).toEqual([11, 10, 7]);
  });

  it("puts the same day's operations under one heading", () => {
    const { days } = summarizeActivity(
      [
        dated("morning", "2026-08-11T08:00:00.000Z"),
        dated("evening", "2026-08-11T19:00:00.000Z"),
      ],
      "week",
      NOW,
    );

    expect(days).toHaveLength(1);
    expect(days[0]?.transactions.map((item) => item.id)).toEqual([
      "evening",
      "morning",
    ]);
  });

  it("leaves out what falls before the seven days", () => {
    const { days } = summarizeActivity(
      [
        dated("inside", "2026-08-06T09:00:00.000Z"),
        dated("outside", "2026-08-01T09:00:00.000Z"),
      ],
      "week",
      NOW,
    );

    expect(
      days.flatMap((day) => day.transactions).map((item) => item.id),
    ).toEqual(["inside"]);
  });

  it("shows more rows over the month than over the week", () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      dated(
        `tx-${index}`,
        `2026-08-${String(11 - index).padStart(2, "0")}T09:00:00.000Z`,
      ),
    );

    const week = summarizeActivity(many, "week", NOW);
    const month = summarizeActivity(many, "month", NOW);

    expect(week.days.flatMap((day) => day.transactions)).toHaveLength(5);
    expect(month.days.flatMap((day) => day.transactions)).toHaveLength(8);
  });

  // A total that stopped at the cap would contradict the rows it heads.
  it("totals the whole window, not only the rows it shows", () => {
    const sixInsideTheWeek = Array.from({ length: 6 }, (_, index) =>
      dated(
        `tx-${index}`,
        `2026-08-${String(11 - index).padStart(2, "0")}T09:00:00.000Z`,
        { amount: 10 },
      ),
    );

    const { days, net } = summarizeActivity(sixInsideTheWeek, "week", NOW);

    expect(days.flatMap((day) => day.transactions)).toHaveLength(5);
    expect(net).toBe(-60);
  });

  it("counts income up and everything else down", () => {
    const { net } = summarizeActivity(
      [
        dated("salary", "2026-08-11T09:00:00.000Z", {
          kind: "income",
          amount: 5000,
        }),
        dated("rent", "2026-08-11T09:00:00.000Z", { amount: 2000 }),
        dated("transfer", "2026-08-11T09:00:00.000Z", {
          kind: "saving",
          amount: 500,
        }),
      ],
      "week",
      NOW,
    );

    expect(net).toBe(2500);
  });
});
