import {
  type QueryClient,
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";

import type { BudgetDetails } from "./budget-api";
import { goalKeys } from "@/features/savings-goals/goals-queries";

import { budgetKeys, invalidateAfterBudgetWrite } from "./budget-queries";
import { type CheckTarget, toggleCheck } from "./toggle-check-api";

const toggleCheckKeys = ["toggle-check"] as const;
const deferredReconciliations = new WeakMap<QueryClient, () => void>();

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
    mutationKey: toggleCheckKey(budgetId),
    mutationFn: toggleCheck,
    onMutate: async (target: CheckTarget): Promise<RowFlip | undefined> => {
      // In flight refetches would land after the edit and undo it.
      await queryClient.cancelQueries({ queryKey: detailKey });
      const details = queryClient.getQueryData<BudgetDetails>(detailKey);
      const row = details === undefined ? undefined : findRow(details, target);
      if (row === undefined) return undefined;

      const from = row.checkedAt;
      const to = from === null ? nowIso() : null;
      const updated = queryClient.setQueryData<BudgetDetails>(
        detailKey,
        (current) =>
          current === undefined
            ? current
            : withCheckedAt(current, target, () => to),
      );
      const rowAfter =
        updated === undefined ? undefined : findRow(updated, target);

      return rowAfter === undefined ? undefined : { from, rowAfter };
    },
    onError: (_error, target, flip) => {
      if (flip === undefined) return;
      // Match the written row, not only its timestamp: several later taps can
      // all write null. An older failure must leave their latest intent alone.
      queryClient.setQueryData<BudgetDetails>(detailKey, (current) =>
        current === undefined || findRow(current, target) !== flip.rowAfter
          ? current
          : withCheckedAt(current, target, () => flip.from),
      );
    },
    onSettled: () => {
      // The settling mutation is still pending here. Refetching before the
      // other taps finish would replace their optimistic state with an older
      // server answer. Check every budget: reconciliation sweeps all details.
      if (queryClient.isMutating({ mutationKey: toggleCheckKeys }) > 1) {
        reconcileAfterPendingChecks(queryClient, budgetId);
        return;
      }

      deferredReconciliations.get(queryClient)?.();
      deferredReconciliations.delete(queryClient);
      return reconcileChecks(queryClient, budgetId);
    },
  });
}

function toggleCheckKey(budgetId: string | null) {
  return [...toggleCheckKeys, budgetId] as const;
}

/** Two callbacks can settle together and both still see the other pending. */
function reconcileAfterPendingChecks(
  queryClient: QueryClient,
  budgetId: string | null,
): void {
  if (deferredReconciliations.has(queryClient)) return;

  const unsubscribe = queryClient.getMutationCache().subscribe(() => {
    if (queryClient.isMutating({ mutationKey: toggleCheckKeys }) !== 0) return;
    unsubscribe();
    deferredReconciliations.delete(queryClient);
    void reconcileChecks(queryClient, budgetId);
  });
  deferredReconciliations.set(queryClient, unsubscribe);
}

function reconcileChecks(queryClient: QueryClient, budgetId: string | null) {
  return Promise.all([
    budgetId === null
      ? queryClient.invalidateQueries({ queryKey: budgetKeys.all })
      : invalidateAfterBudgetWrite(queryClient),
    queryClient.invalidateQueries({ queryKey: goalKeys.all }),
  ]);
}

/**
 * Whether a row's pointing is still on its way to the server — every row in
 * flight, not only the last one tapped. `useMutation`'s own state follows the
 * latest call alone, so pointing a second row while the first was pending
 * showed the first one as settled while it was not.
 */
export function usePendingCheck(
  budgetId: string | null,
): (target: CheckTarget) => boolean {
  const pending = useMutationState({
    filters: { mutationKey: toggleCheckKey(budgetId), status: "pending" },
    select: (mutation) => mutation.state.variables,
  });

  return (target) =>
    pending.some(
      (inFlight) =>
        isCheckTarget(inFlight) &&
        inFlight.source === target.source &&
        inFlight.sourceId === target.sourceId,
    );
}

/** The mutation cache types its variables as `unknown`, whatever the key. */
function isCheckTarget(value: unknown): value is CheckTarget {
  return (
    typeof value === "object" &&
    value !== null &&
    "source" in value &&
    "sourceId" in value
  );
}

/** What one tap did to one row, so a failure can undo exactly that. */
interface RowFlip {
  from: string | null;
  rowAfter: CheckableRow;
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
