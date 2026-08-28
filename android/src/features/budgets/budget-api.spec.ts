import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

import {
  BUDGET_PAGE_SIZE,
  fetchBudgetListPage,
  fetchBudgetPeriods,
} from "./budget-api";

jest.mock("@/core/api/api", () => ({ api: { get: jest.fn() } }));

const mockedGet = jest.mocked(api.get);

describe("budget list API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue({ success: true, data: [] });
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
});
