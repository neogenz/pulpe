import {
  type QueryClient,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";

import { queryClient } from "@/core/query/query-client";
import { useVaultStore } from "@/core/vault/vault-store";

import {
  BUDGET_PAGE_SIZE,
  fetchBudgetDetails,
  fetchBudgetListPage,
  fetchBudgetPeriods,
} from "./budget-api";
import { uniqueBudgets } from "./budget-list-selectors";

export const budgetKeys = {
  all: ["budgets"] as const,
  list: () => [...budgetKeys.all, "list"] as const,
  periods: (year: number) => [...budgetKeys.all, "periods", year] as const,
  details: () => [...budgetKeys.all, "detail"] as const,
  detail: (budgetId: string) => [...budgetKeys.details(), budgetId] as const,
};

export function nextBudgetPageOffset(
  loadedCount: number,
  lastOffset: number,
): number | undefined {
  return loadedCount < BUDGET_PAGE_SIZE
    ? undefined
    : lastOffset + BUDGET_PAGE_SIZE;
}

export function useBudgetList() {
  const isVaultUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useInfiniteQuery({
    queryKey: budgetKeys.list(),
    queryFn: ({ pageParam }) => fetchBudgetListPage(pageParam),
    enabled: isVaultUnlocked,
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastOffset) =>
      nextBudgetPageOffset(lastPage.length, lastOffset),
    select: (data) => uniqueBudgets(data.pages),
  });
}

export function useBudgetPeriods(year: number | null) {
  const isVaultUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: budgetKeys.periods(year ?? 0),
    // A manual refetch can run even while `enabled` is false.
    queryFn: () =>
      year === null
        ? Promise.reject(new Error("No budget year to load"))
        : fetchBudgetPeriods(year),
    enabled: isVaultUnlocked && year !== null,
  });
}

export function useBudgetDetails(budgetId: string | null) {
  const isVaultUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: budgetKeys.detail(budgetId ?? ""),
    // Narrowed rather than asserted: `enabled` already keeps this from running
    // without an id, and a cast would go on compiling if that guard moved.
    queryFn: () =>
      budgetId === null
        ? Promise.reject(new Error("No budget to load"))
        : fetchBudgetDetails(budgetId),
    enabled: isVaultUnlocked && budgetId !== null,
  });
}

/**
 * The sweep for writes whose reach no single id names: a budget created or
 * deleted moves the list and the periods, a spread lands in months the server
 * chose, a model edit reaches every budget generated from it, and
 * pull-to-refresh means everything. A write inside an existing budget goes
 * through `invalidateAfterBudgetWrite` instead.
 */
export function invalidateBudgetData(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: budgetKeys.all });
}

/**
 * A write inside a budget. Every budget detail goes stale, not the written
 * one's alone: a month's carry-over sums the deltas of the months before it,
 * so a write in one month moves the available of every month after it. Only
 * the details on screen refetch now — the one written, and Home's when it is a
 * later month; the others when next opened. The list is only marked stale,
 * since its totals are not in front of the user — the Budgets tab asks for
 * them once on focus, rather than every pointing tap costing a list request on
 * top of the detail one.
 */
export function invalidateAfterBudgetWrite(
  queryClient: QueryClient,
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: budgetKeys.details() }),
    queryClient.invalidateQueries({
      queryKey: budgetKeys.list(),
      refetchType: "none",
    }),
  ]).then(() => undefined);
}

/** The other half of `invalidateAfterBudgetWrite`: silent when nothing went stale. */
export function refetchStaleBudgetList(): Promise<void> {
  return queryClient.refetchQueries({
    queryKey: budgetKeys.list(),
    stale: true,
    type: "active",
  });
}
