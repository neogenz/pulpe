import { BUDGET_PAGE_SIZE } from "./budget-api";
import { nextBudgetPageOffset } from "./budget-queries";

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
