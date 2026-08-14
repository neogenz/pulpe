import { getBudgetPeriodForDate, type SupportedCurrency } from "pulpe-shared";
import { useMemo } from "react";

import {
  invalidateUserSettings,
  useUserSettings,
} from "@/core/user-settings/user-settings-queries";
import type { BudgetDetails } from "@/features/budgets/budget-api";
import {
  invalidateBudgetData,
  useBudgetDetails,
  useBudgetList,
} from "@/features/budgets/budget-queries";

import {
  buildCurrentMonthViewModel,
  type CurrentMonthViewModel,
  selectBudgetIdForPeriod,
} from "./current-month-view-model";

/**
 * `empty` is a legitimate outcome, not a failure: a user who has reached the
 * end of their generated months has no budget for the period until they create
 * one, and the screen offers exactly that.
 */
export type CurrentMonthStatus = "loading" | "empty" | "ready" | "failed";

export interface CurrentMonthQuery {
  status: CurrentMonthStatus;
  budgetId: string | null;
  details: BudgetDetails | null;
  viewModel: CurrentMonthViewModel | null;
  currency: SupportedCurrency;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

/**
 * Retry and pull-to-refresh both come here because the settings query is fatal
 * to this screen: invalidating the budgets alone leaves a settings query that
 * failed at boot errored forever, and no amount of tapping clears the screen it
 * put up.
 */
export async function refreshCurrentMonth(): Promise<void> {
  await Promise.all([invalidateBudgetData(), invalidateUserSettings()]);
}

export function useCurrentMonth(): CurrentMonthQuery {
  const settings = useUserSettings();
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;

  const periods = useBudgetList();
  const budgetId = useMemo(
    () =>
      periods.data
        ? selectBudgetIdForPeriod(
            periods.data,
            getBudgetPeriodForDate(new Date(), payDayOfMonth),
          )
        : null,
    [periods.data, payDayOfMonth],
  );

  const details = useBudgetDetails(budgetId);

  const viewModel = useMemo(
    () =>
      details.data
        ? buildCurrentMonthViewModel(details.data, {
            now: new Date(),
            payDayOfMonth,
          })
        : null,
    [details.data, payDayOfMonth],
  );

  return {
    status: resolveStatus({ settings, periods, details, budgetId }),
    budgetId,
    details: details.data ?? null,
    viewModel,
    currency: settings.data?.currency ?? FALLBACK_CURRENCY,
    isRefreshing:
      periods.isRefetching || details.isRefetching || settings.isRefetching,
    refresh: refreshCurrentMonth,
  };
}

interface StatusInput {
  settings: { isError: boolean; isPending: boolean };
  periods: { isError: boolean; data?: unknown };
  details: { isError: boolean; data?: unknown };
  budgetId: string | null;
}

/**
 * The settings failing is fatal on purpose: without the pay day the app cannot
 * tell which budget the user is living in, and guessing the calendar month
 * would show a confident number for the wrong period.
 */
export function resolveStatus({
  settings,
  periods,
  details,
  budgetId,
}: StatusInput): CurrentMonthStatus {
  if (settings.isError || periods.isError || details.isError) return "failed";
  if (settings.isPending || periods.data === undefined) return "loading";
  if (budgetId === null) return "empty";
  return details.data === undefined ? "loading" : "ready";
}
