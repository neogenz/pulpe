import { getBudgetPeriodForDate, type SupportedCurrency } from "pulpe-shared";
import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";

import {
  invalidateUserSettings,
  useUserSettings,
} from "@/core/user-settings/user-settings-queries";
import type { BudgetDetails } from "@/features/budgets/budget-api";
import {
  invalidateBudgetData,
  useBudgetDetails,
  useBudgetPeriods,
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
  payDayOfMonth: number | null;
  refresh: () => Promise<void>;
}

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

export function currentBudgetPeriod(
  payDayOfMonth: number | null,
  now = new Date(),
) {
  return getBudgetPeriodForDate(now, payDayOfMonth);
}

/**
 * Retry and pull-to-refresh both come here because the settings query is fatal
 * to this screen: invalidating the budgets alone leaves a settings query that
 * failed at boot errored forever, and no amount of tapping clears the screen it
 * put up.
 */
export async function refreshCurrentMonth(): Promise<void> {
  await Promise.all([invalidateBudgetData(), invalidateUserSettings()]);
}

/**
 * How long until the next local midnight, plus a second so a timer that fires
 * a hair early does not land on the day it was meant to leave.
 */
export function msUntilNextDay(now: Date): number {
  const nextDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  return nextDay.getTime() - now.getTime() + 1000;
}

/**
 * The moment the current period is read from, held as state so that it can
 * move. A `new Date()` taken inside the memo was taken once: the refetched
 * settings come back structurally identical, no dependency changed, and Home
 * stayed on last month's budget after the pay day — through pull-to-refresh
 * and Retry alike. Coming back to the foreground, refreshing, and midnight
 * passing with the app open all read the clock again: a period starts at a
 * day's boundary, so a screen left open overnight would otherwise keep showing
 * the period that just ended.
 */
export function useNow(): [Date, () => void] {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(new Date());
    });
    return () => subscription.remove();
  }, []);

  // Re-armed from each new reading. JS timers stop with the app in the
  // background; the foreground listener above covers the night it slept
  // through.
  useEffect(() => {
    const timer = setTimeout(() => setNow(new Date()), msUntilNextDay(now));
    return () => clearTimeout(timer);
  }, [now]);

  return [now, () => setNow(new Date())];
}

export function useCurrentMonth(): CurrentMonthQuery {
  const settings = useUserSettings();
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;
  const [now, readClock] = useNow();

  const currentPeriod = useMemo(
    () =>
      settings.data === undefined
        ? null
        : currentBudgetPeriod(payDayOfMonth, now),
    [payDayOfMonth, settings.data, now],
  );
  const periods = useBudgetPeriods(currentPeriod?.year ?? null);
  const budgetId = useMemo(
    () =>
      periods.data && currentPeriod
        ? selectBudgetIdForPeriod(periods.data, currentPeriod)
        : null,
    [periods.data, currentPeriod],
  );

  const details = useBudgetDetails(budgetId);

  const viewModel = useMemo(
    () =>
      details.data
        ? buildCurrentMonthViewModel(details.data, { now, payDayOfMonth })
        : null,
    [details.data, payDayOfMonth, now],
  );

  return {
    status: resolveStatus({ settings, periods, details, budgetId }),
    budgetId,
    details: details.data ?? null,
    viewModel,
    currency: settings.data?.currency ?? FALLBACK_CURRENCY,
    payDayOfMonth,
    refresh: () => {
      readClock();
      return refreshCurrentMonth();
    },
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
