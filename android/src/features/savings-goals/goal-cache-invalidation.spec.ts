import { queryClient } from "@/core/query/query-client";
import { budgetKeys } from "@/features/budgets/budget-queries";
import { invalidateBudgetLineData } from "@/features/budget-details/budget-line-mutations";

import { goalKeys } from "./goals-queries";

jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: () => false }));
jest.mock("@/features/budgets/budget-api", () => ({}));
jest.mock("@/features/budget-details/budget-line-api", () => ({
  createBudgetLine: jest.fn(),
  deleteBudgetLine: jest.fn(),
  postponeBudgetLine: jest.fn(),
  updateBudgetLine: jest.fn(),
}));
jest.mock("./goals-api", () => ({}));

describe("goal cache invalidation", () => {
  it("refreshes budgets and goals after every budget-line write", async () => {
    const invalidate = jest
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);

    await invalidateBudgetLineData(queryClient);

    expect(invalidate.mock.calls.map(([options]) => options?.queryKey)).toEqual(
      [budgetKeys.all, goalKeys.all],
    );

    invalidate.mockRestore();
  });
});
