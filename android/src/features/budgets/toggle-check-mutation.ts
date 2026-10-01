import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { BudgetDetails } from "./budget-api";
import { budgetKeys, invalidateBudget } from "./budget-queries";
import { type CheckTarget, toggleCheck } from "./toggle-check-api";

/**
 * Pointing is a one-tap habit, so the row has to answer at tap speed rather
 * than at network speed: the cached budget is edited in place, then reconciled
 * against the server on settle. A failure puts that row back — the caller is
 * expected to say so, since the row simply reappearing is not an explanation.
 *
 * Only that row: rows stay tappable while another one is in flight, and a
 * whole-cache snapshot taken before this tap would also undo every tap made
 * after it — a second row pointed in the meantime, and about to succeed, came
 * back unpointed with the first one's failure.
 */
export function useToggleCheck(budgetId: string | null) {
  const queryClient = useQueryClient();
  const detailKey = budgetKeys.detail(budgetId ?? "");

  return useMutation({
    mutationFn: toggleCheck,
    onMutate: async (target: CheckTarget) => {
      // In flight refetches would land after the edit and undo it.
      await queryClient.cancelQueries({ queryKey: detailKey });
      const details = queryClient.getQueryData<BudgetDetails>(detailKey);
      const row = details === undefined ? undefined : findRow(details, target);
      if (row === undefined) return undefined;

      const flip: RowFlip = {
        from: row.checkedAt,
        to: row.checkedAt === null ? nowIso() : null,
      };
      queryClient.setQueryData<BudgetDetails>(detailKey, (current) =>
        current === undefined
          ? current
          : withCheckedAt(current, target, () => flip.to),
      );

      return flip;
    },
    onError: (_error, target, flip) => {
      if (flip === undefined) return;
      // Put back only what this tap wrote. A row that no longer holds it was
      // since replaced by a refetch, which already speaks for the server.
      queryClient.setQueryData<BudgetDetails>(detailKey, (current) =>
        current === undefined
          ? current
          : withCheckedAt(current, target, (checkedAt) =>
              checkedAt === flip.to ? flip.from : checkedAt,
            ),
      );
    },
    // Whether it succeeded or failed, the aggregates the toggle moved are only
    // right again once the server has been asked.
    onSettled: () =>
      budgetId === null
        ? queryClient.invalidateQueries({ queryKey: budgetKeys.all })
        : invalidateBudget(queryClient, budgetId),
  });
}

/** What one tap did to one row, so a failure can undo exactly that. */
interface RowFlip {
  from: string | null;
  to: string | null;
}

interface CheckableRow {
  id: string;
  checkedAt: string | null;
}

function findRow(
  details: BudgetDetails,
  target: CheckTarget,
): CheckableRow | undefined {
  const rows: CheckableRow[] =
    target.source === "budgetLine" ? details.budgetLines : details.transactions;
  return rows.find((row) => row.id === target.sourceId);
}

function withCheckedAt(
  details: BudgetDetails,
  target: CheckTarget,
  next: (checkedAt: string | null) => string | null,
): BudgetDetails {
  const update = <T extends CheckableRow>(rows: T[]) =>
    rows.map((row) =>
      row.id === target.sourceId
        ? { ...row, checkedAt: next(row.checkedAt) }
        : row,
    );

  return target.source === "budgetLine"
    ? { ...details, budgetLines: update(details.budgetLines) }
    : { ...details, transactions: update(details.transactions) };
}

/**
 * The server stamps its own time; this one only has to be non-null so the row
 * reads as pointed until the refetch replaces it.
 */
function nowIso(): string {
  return new Date().toISOString();
}
