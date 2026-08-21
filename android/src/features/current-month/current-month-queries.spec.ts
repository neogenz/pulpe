import { queryClient } from "@/core/query/query-client";

import {
  currentBudgetPeriod,
  refreshCurrentMonth,
  resolveStatus,
} from "./current-month-queries";

/**
 * The two query hooks reach the vault store and the HTTP layer, and with them
 * the native crypto binding and the build-time environment — neither of which a
 * test environment has. What is under test is the cache plumbing around them.
 */
jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: () => false }));
jest.mock("@/core/user-settings/user-settings-api", () => ({}));
jest.mock("@/features/budgets/budget-api", () => ({}));

const BUDGET_ID = "budget-august";

function statusInput(
  overrides: {
    settings?: { isError: boolean; isPending: boolean };
    periods?: { isError: boolean; data?: unknown };
    details?: { isError: boolean; data?: unknown };
    budgetId?: string | null;
  } = {},
) {
  return {
    settings: { isError: false, isPending: false },
    periods: { isError: false, data: [] },
    details: { isError: false, data: {} },
    budgetId: BUDGET_ID,
    ...overrides,
  };
}

describe("refreshCurrentMonth", () => {
  it("invalidates the settings query as well as the budgets", async () => {
    const invalidate = jest
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);

    await refreshCurrentMonth();

    expect(invalidate.mock.calls.map(([options]) => options?.queryKey)).toEqual(
      expect.arrayContaining([["budgets"], ["user-settings"]]),
    );

    invalidate.mockRestore();
  });
});

describe("resolveStatus", () => {
  it("fails on a settings error even when the budgets loaded", () => {
    expect(
      resolveStatus(
        statusInput({ settings: { isError: true, isPending: false } }),
      ),
    ).toBe("failed");
  });

  it("returns to ready once the settings query stops erroring", () => {
    expect(resolveStatus(statusInput())).toBe("ready");
  });

  it("reads no budget for the period as empty, not as a failure", () => {
    expect(resolveStatus(statusInput({ budgetId: null }))).toBe("empty");
  });
});

describe("currentBudgetPeriod", () => {
  it("selects the previous year before a January pay day", () => {
    expect(currentBudgetPeriod(3, new Date("2026-01-02T12:00:00Z"))).toEqual({
      month: 12,
      year: 2025,
    });
  });
});
