import type { Transaction } from "pulpe-shared";

import { groupByDay, latestMovements } from "./activity-window";

function transaction(id: string, transactionDate: string): Transaction {
  return {
    id,
    budgetId: "budget-august",
    budgetLineId: null,
    name: id,
    amount: 60,
    kind: "expense",
    transactionDate,
    createdAt: transactionDate,
    updatedAt: transactionDate,
    checkedAt: null,
  };
}

describe("latestMovements", () => {
  it("keeps the five newest, whatever order they come in", () => {
    const all = Array.from({ length: 7 }, (_, index) =>
      transaction(`tx-${index}`, `2026-08-0${index + 1}T09:00:00.000Z`),
    );

    expect(latestMovements(all).map((item) => item.id)).toEqual([
      "tx-6",
      "tx-5",
      "tx-4",
      "tx-3",
      "tx-2",
    ]);
  });
});

describe("groupByDay", () => {
  it("buckets by day, newest day first", () => {
    const days = groupByDay([
      transaction("older", "2026-08-07T09:00:00.000Z"),
      transaction("today-a", "2026-08-11T09:00:00.000Z"),
      transaction("yesterday", "2026-08-10T09:00:00.000Z"),
      transaction("today-b", "2026-08-11T08:00:00.000Z"),
    ]);

    expect(days.map((day) => day.date.getDate())).toEqual([11, 10, 7]);
    expect(days[0].transactions.map((item) => item.id)).toEqual([
      "today-a",
      "today-b",
    ]);
  });
});
