import { buildAdjustmentPayload } from "./reconciliation";

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
