import { createMMKV } from "react-native-mmkv";

import type { BudgetPeriod } from "pulpe-shared";
import { compareBudgetPeriods, getBudgetPeriodForDate } from "pulpe-shared";

const DISMISSED_KEY = "pulpe-savings-withdrawal-dismissed";

const storage = createMMKV({ id: "pulpe-budget-details" });

/**
 * Whether the "mois un peu juste" card belongs on screen.
 *
 * A withdrawal already in place does not hide it: a month can dip back into
 * deficit after a first one, and hiding the offer then would leave the user
 * with a red month and no visible way out.
 */
export function shouldOfferWithdrawal(input: {
  available: number;
  viewedPeriod: BudgetPeriod;
  payDayOfMonth: number | null;
  isDismissed: boolean;
}): boolean {
  const isCurrentOrFuture =
    compareBudgetPeriods(
      input.viewedPeriod,
      getBudgetPeriodForDate(new Date(), input.payDayOfMonth),
    ) >= 0;

  return input.available < 0 && isCurrentOrFuture && !input.isDismissed;
}

/**
 * "Plus tard" silences the card for one month only — keyed by budget, because
 * the answer is about this month's shortfall and not about the feature.
 */
export function isWithdrawalDismissed(budgetId: string): boolean {
  return dismissedIds().includes(budgetId);
}

export function dismissWithdrawal(budgetId: string): void {
  if (isWithdrawalDismissed(budgetId)) return;
  storage.set(DISMISSED_KEY, [...dismissedIds(), budgetId].join(","));
}

function dismissedIds(): string[] {
  const raw = storage.getString(DISMISSED_KEY) ?? "";
  return raw === "" ? [] : raw.split(",");
}

/** The month that repays a withdrawal taken on `period` — always the next one. */
export function repaymentPeriod(period: BudgetPeriod): BudgetPeriod {
  return period.month === 12
    ? { year: period.year + 1, month: 1 }
    : { year: period.year, month: period.month + 1 };
}
