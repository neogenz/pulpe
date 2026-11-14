import type { BudgetLine, Transaction } from "pulpe-shared";

import { computeMovementImpact, impactNote } from "./movement-impact";

const rent = {
  id: "rent",
  name: "Loyer",
  kind: "expense",
  amount: 100,
  checkedAt: null,
} as BudgetLine;
const salary = {
  id: "salary",
  name: "Salaire",
  kind: "income",
  amount: 1000,
  checkedAt: null,
} as BudgetLine;
const lines = [rent, salary];

describe("computeMovementImpact", () => {
  it("lowers the disponible by an uncovered expense", () => {
    const impact = computeMovementImpact({
      lines,
      transactions: [],
      rollover: 0,
      draft: { kind: "expense", amount: 80, lineId: null },
    });

    expect(impact).toMatchObject({
      before: 900,
      after: 820,
      delta: -80,
      tone: "over",
      lineBefore: null,
    });
    expect(impactNote(impact, undefined)).toEqual({ kind: "uncovered" });
  });

  it("leaves the disponible alone when the prévision has room", () => {
    const impact = computeMovementImpact({
      lines,
      transactions: [],
      rollover: 0,
      draft: { kind: "expense", amount: 40, lineId: "rent" },
    });

    expect(impact).toMatchObject({ delta: 0, tone: "neutral", lineAfter: 60 });
    expect(impactNote(impact, rent)).toEqual({
      kind: "covered",
      lineName: "Loyer",
      before: 100,
      after: 60,
    });
  });

  it("lowers it by the surplus once the prévision is exceeded", () => {
    const impact = computeMovementImpact({
      lines,
      transactions: [],
      rollover: 0,
      draft: { kind: "expense", amount: 130, lineId: "rent" },
    });

    expect(impact.delta).toBe(-30);
    expect(impactNote(impact, rent)).toEqual({
      kind: "overLine",
      lineName: "Loyer",
    });
  });

  it("raises it by an income and swaps out the movement being edited", () => {
    const edited = {
      id: "tx",
      kind: "expense",
      amount: 50,
      budgetLineId: null,
    } as Transaction;

    const raise = computeMovementImpact({
      lines,
      transactions: [],
      rollover: 0,
      draft: { kind: "income", amount: 25, lineId: null },
    });
    const swap = computeMovementImpact({
      lines,
      transactions: [edited],
      rollover: 0,
      replacingId: "tx",
      draft: { kind: "expense", amount: 70, lineId: null },
    });

    expect(raise).toMatchObject({ delta: 25, tone: "ok" });
    expect(impactNote(raise, undefined)).toBeNull();
    expect(swap).toMatchObject({ before: 850, after: 830, delta: -20 });
  });
});
