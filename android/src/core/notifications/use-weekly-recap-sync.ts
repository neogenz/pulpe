import type { SupportedCurrency } from "pulpe-shared";
import { useEffect } from "react";

import { useAmountVisibility } from "@/core/ui/amount-visibility";
import type { BudgetDetails } from "@/features/budgets/budget-api";

import { readWeeklyRecapEnabled } from "./reminder-flags";
import { scheduleWeeklyRecaps } from "./scheduler";

/**
 * Re-freezes the Monday recaps from every fresh month snapshot, which is what
 * keeps their figures true. Re-run when amounts are hidden or shown, since the
 * body carries amounts only while they are visible.
 */
export function useWeeklyRecapSync({
  details,
  payDayOfMonth,
  currency,
}: {
  details: BudgetDetails | null;
  payDayOfMonth: number | null;
  currency: SupportedCurrency;
}): void {
  const areAmountsHidden = useAmountVisibility(
    (state) => state.areAmountsHidden,
  );

  useEffect(() => {
    if (details === null || !readWeeklyRecapEnabled()) return;
    void scheduleWeeklyRecaps({ details, payDayOfMonth, currency }).catch(
      () => undefined,
    );
    // `areAmountsHidden` is read by the scheduler, not here: it is a trigger.
  }, [details, payDayOfMonth, currency, areAmountsHidden]);
}
