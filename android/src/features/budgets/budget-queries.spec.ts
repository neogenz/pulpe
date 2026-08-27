import { QueryClient } from "@tanstack/react-query";

import { queryClient } from "@/core/query/query-client";

import { BUDGET_PAGE_SIZE } from "./budget-api";
import {
  budgetKeys,
  invalidateBudget,
  nextBudgetPageOffset,
  refetchStaleBudgetList,
} from "./budget-queries";

jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: jest.fn() }));
jest.mock("./budget-api", () => ({
  BUDGET_PAGE_SIZE: 36,
  fetchBudgetDetails: jest.fn(),
  fetchBudgetListPage: jest.fn(),
  fetchBudgetPeriods: jest.fn(),
}));

describe("nextBudgetPageOffset", () => {
  it("continues after a full page", () => {
    expect(nextBudgetPageOffset(BUDGET_PAGE_SIZE, 36)).toBe(72);
  });

  it("stops after a short page", () => {
    expect(nextBudgetPageOffset(BUDGET_PAGE_SIZE - 1, 36)).toBeUndefined();
  });
});

describe("invalidateBudget", () => {
  it("refetches the detail now and only marks the list stale", async () => {
    const client = new QueryClient();
    const invalidate = jest
      .spyOn(client, "invalidateQueries")
      .mockResolvedValue(undefined);

    await invalidateBudget(client, "budget-1");

    expect(invalidate.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: budgetKeys.detail("budget-1") },
      { queryKey: budgetKeys.list(), refetchType: "none" },
    ]);
    expect(invalidate).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: budgetKeys.all }),
    );
  });
});

describe("refetchStaleBudgetList", () => {
  it("asks only for a list that went stale", async () => {
    const refetch = jest
      .spyOn(queryClient, "refetchQueries")
      .mockResolvedValue(undefined);

    await refetchStaleBudgetList();

    expect(refetch).toHaveBeenCalledWith({
      queryKey: budgetKeys.list(),
      stale: true,
      type: "active",
    });
    refetch.mockRestore();
  });
});
