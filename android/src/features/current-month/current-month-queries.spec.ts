import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { queryClient } from "@/core/query/query-client";

import {
  currentBudgetPeriod,
  msUntilNextDay,
  refreshCurrentMonth,
  resolveStatus,
  useCurrentMonth,
} from "./current-month-queries";

/**
 * The two query hooks reach the vault store and the HTTP layer, and with them
 * the native crypto binding and the build-time environment — neither of which a
 * test environment has. What is under test is the cache plumbing around them.
 */
jest.mock("@/core/vault/vault-store", () => ({
  useVaultStore: (selector: (state: { status: string }) => unknown) =>
    selector({ status: "unlocked" }),
}));
jest.mock("@/core/user-settings/user-settings-api", () => ({
  fetchUserSettings: jest.fn(async () => ({
    payDayOfMonth: null,
    currency: "CHF",
  })),
}));
jest.mock("@/features/budgets/budget-api", () => ({
  BUDGET_PAGE_SIZE: 36,
  fetchBudgetListPage: jest.fn(async () => []),
  fetchBudgetPeriods: jest.fn(async () => [
    { id: "budget-august", month: 8, year: 2026 },
    { id: "budget-september", month: 9, year: 2026 },
  ]),
  fetchBudgetDetails: jest.fn(async (id: string) => ({ id })),
}));
jest.mock("./current-month-view-model", () => ({
  ...jest.requireActual("./current-month-view-model"),
  buildCurrentMonthViewModel: () => ({}),
}));

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

describe("msUntilNextDay", () => {
  it("waits for the local midnight, a second past it", () => {
    expect(msUntilNextDay(new Date(2026, 7, 31, 21))).toBe(
      3 * 60 * 60 * 1000 + 1000,
    );
    expect(msUntilNextDay(new Date(2026, 11, 31, 23, 59, 59))).toBe(2000);
  });
});

describe("currentBudgetPeriod", () => {
  it("uses the calendar month when no custom pay day is configured", () => {
    expect(currentBudgetPeriod(null, new Date("2026-08-22T12:00:00Z"))).toEqual(
      {
        month: 8,
        year: 2026,
      },
    );
  });

  it("selects the previous year before a January pay day", () => {
    expect(currentBudgetPeriod(3, new Date("2026-01-02T12:00:00Z"))).toEqual({
      month: 12,
      year: 2025,
    });
  });
});

/**
 * The period used to be read from a clock taken once, so after the pay day
 * Home stayed on last month's budget — through pull-to-refresh and Retry.
 */
describe("useCurrentMonth across the start of a period", () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  // Every listener, not the last one: mounting the client also subscribes
  // TanStack's focus manager to the app state.
  const appStateHandlers: ((state: AppStateStatus) => void)[] = [];
  const emitAppState = (state: AppStateStatus) => {
    for (const handler of appStateHandlers) handler(state);
  };

  beforeEach(() => {
    appStateHandlers.length = 0;
    jest.useFakeTimers({ advanceTimers: true });
    jest.setSystemTime(new Date(2026, 7, 31, 21));
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_, handler) => {
        appStateHandlers.push(handler as (state: AppStateStatus) => void);
        return { remove: jest.fn() } as never;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    queryClient.clear();
  });

  it("moves to the new budget when the user refreshes", async () => {
    const hook = await renderHook(() => useCurrentMonth(), { wrapper });
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    expect(hook.result.current.budgetId).toBe("budget-august");

    jest.setSystemTime(new Date(2026, 8, 1, 9));
    await act(() => hook.result.current.refresh());

    await waitFor(() =>
      expect(hook.result.current.budgetId).toBe("budget-september"),
    );
    await hook.unmount();
  });

  it("moves to the new budget at midnight, with the app left open", async () => {
    const hook = await renderHook(() => useCurrentMonth(), { wrapper });
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    expect(hook.result.current.budgetId).toBe("budget-august");

    // 21:00 on the 31st: three hours to the first of the month, nothing else
    // happening — no refresh, no trip to the background.
    await act(async () => {
      jest.advanceTimersByTime(3 * 60 * 60 * 1000 + 1000);
    });

    await waitFor(() =>
      expect(hook.result.current.budgetId).toBe("budget-september"),
    );
    await hook.unmount();
  });

  it("moves to the new budget when the app comes back to the foreground", async () => {
    const hook = await renderHook(() => useCurrentMonth(), { wrapper });
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));

    jest.setSystemTime(new Date(2026, 8, 1, 9));
    await act(async () => emitAppState("active"));

    await waitFor(() =>
      expect(hook.result.current.budgetId).toBe("budget-september"),
    );
    await hook.unmount();
  });
});
