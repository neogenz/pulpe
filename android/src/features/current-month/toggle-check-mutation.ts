import { useMutation, useQueryClient } from "@tanstack/react-query";

import { budgetKeys } from "@/features/budgets/budget-queries";
import type { BudgetDetails } from "@/features/budgets/budget-api";

import type { CheckableItem } from "./current-month-view-model";
import { toggleCheck } from "./toggle-check-api";

/**
 * Pointing is a one-tap habit, so the row has to answer at tap speed rather
 * than at network speed: the cached budget is edited in place, then reconciled
 * against the server on settle. A failure puts the old cache back — the caller
 * is expected to say so, since the row simply reappearing is not an
 * explanation.
 */
export function useToggleCheck(budgetId: string | null) {
  const queryClient = useQueryClient();
  const detailKey = budgetKeys.detail(budgetId ?? "");

  return useMutation({
    mutationFn: toggleCheck,
    onMutate: async (item: CheckableItem) => {
      // In flight refetches would land after the edit and undo it.
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<BudgetDetails>(detailKey);

      queryClient.setQueryData<BudgetDetails>(detailKey, (details) =>
        details === undefined ? details : withToggled(details, item),
      );

      return { previous };
    },
    onError: (_error, _item, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(detailKey, context.previous);
      }
    },
    // Whether it succeeded or failed, the aggregates the toggle moved are only
    // right again once the server has been asked.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
  });
}

function withToggled(
  details: BudgetDetails,
  item: CheckableItem,
): BudgetDetails {
  const flip = <T extends { id: string; checkedAt: string | null }>(
    rows: T[],
  ) =>
    rows.map((row) =>
      row.id === item.sourceId
        ? { ...row, checkedAt: row.checkedAt === null ? nowIso() : null }
        : row,
    );

  return item.source === "budgetLine"
    ? { ...details, budgetLines: flip(details.budgetLines) }
    : { ...details, transactions: flip(details.transactions) };
}

/**
 * The server stamps its own time; this one only has to be non-null so the row
 * reads as pointed until the refetch replaces it.
 */
function nowIso(): string {
  return new Date().toISOString();
}
