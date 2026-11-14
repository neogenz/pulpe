import type { Transaction } from "pulpe-shared";

import { isMovementPostponeEligible } from "./movement-postpone-gate";

const free = { budgetLineId: null, checkedAt: null } as Transaction;

describe("isMovementPostponeEligible", () => {
  it("should accept a free, unpointed movement", () => {
    expect(isMovementPostponeEligible(free)).toBe(true);
  });

  it("should refuse a movement attached to a forecast", () => {
    expect(isMovementPostponeEligible({ ...free, budgetLineId: "l" })).toBe(
      false,
    );
  });

  it("should refuse a pointed movement", () => {
    expect(
      isMovementPostponeEligible({
        ...free,
        checkedAt: "2026-11-02T09:00:00Z",
      }),
    ).toBe(false);
  });
});
