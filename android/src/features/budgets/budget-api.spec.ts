import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

import {
  BUDGET_PAGE_SIZE,
  fetchBudgetDeletionImpact,
  fetchBudgetListPage,
  fetchBudgetPeriods,
  generateBudgets,
} from "./budget-api";

jest.mock("@/core/api/api", () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

const mockedGet = jest.mocked(api.get);
const mockedPost = jest.mocked(api.post);

describe("budget list API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue({ success: true, data: [] });
    mockedPost.mockResolvedValue({
      success: true,
      data: { budgets: [], skippedMonths: [{ month: 10, year: 2026 }] },
    });
  });

  it("requests a bounded history page", async () => {
    await fetchBudgetListPage(36);

    expect(mockedGet).toHaveBeenCalledWith(
      ENDPOINTS.budgets,
      expect.anything(),
      expect.objectContaining({ limit: BUDGET_PAGE_SIZE, offset: 36 }),
    );
  });

  it("loads only periods for the active year", async () => {
    await fetchBudgetPeriods(2025);

    expect(mockedGet).toHaveBeenCalledWith(
      ENDPOINTS.budgets,
      expect.anything(),
      { fields: "month,year", year: 2025 },
    );
  });

  it("posts and validates the shared budget generation contract", async () => {
    const payload = {
      templateId: "11111111-2222-3333-4444-555555555555",
      startMonth: 9,
      startYear: 2026,
      count: 12,
    };

    const response = await generateBudgets(payload);

    expect(mockedPost).toHaveBeenCalledWith(
      ENDPOINTS.budgetsGenerate,
      payload,
      expect.objectContaining({ parse: expect.any(Function) }),
      expect.objectContaining({ parse: expect.any(Function) }),
    );
    expect(response.data.skippedMonths).toEqual([{ month: 10, year: 2026 }]);

    const responseSchema = mockedPost.mock.calls[0]?.[2];
    expect(() => responseSchema?.parse({ success: true, data: {} })).toThrow();
  });

  it("reads the deletion impact of one budget and unwraps its payload", async () => {
    const impact = {
      forecastCount: 4,
      movementCount: 2,
      links: {
        spreadForecasts: 1,
        savingsGoalForecasts: 0,
        savingsWithdrawalForecasts: 0,
        savingsWithdrawalMovements: 0,
      },
    };
    mockedGet.mockResolvedValue({ success: true, data: impact });

    await expect(fetchBudgetDeletionImpact("budget-1")).resolves.toEqual(
      impact,
    );

    expect(mockedGet).toHaveBeenCalledWith(
      ENDPOINTS.budgetDeletionImpact("budget-1"),
      expect.objectContaining({ parse: expect.any(Function) }),
    );
    expect(ENDPOINTS.budgetDeletionImpact("budget-1")).toBe(
      "/budgets/budget-1/deletion-impact",
    );
    const responseSchema = mockedGet.mock.calls[0]?.[1];
    expect(() => responseSchema?.parse({ success: true, data: {} })).toThrow();
  });
});
