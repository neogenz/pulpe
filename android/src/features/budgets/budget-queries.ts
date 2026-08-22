import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

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
  detail: (budgetId: string) =>
    [...budgetKeys.all, "detail", budgetId] as const,
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
 * The single sweep every budget-data mutation and every pull-to-refresh goes
 * through. A budget line write moves its own budget's totals, a postpone moves
 * two budgets, and a spread moves a whole group — enumerating the affected keys
 * at each call site is how one of them ends up forgotten, so the prefix takes
 * them all.
 */
export function invalidateBudgetData(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: budgetKeys.all });
}
