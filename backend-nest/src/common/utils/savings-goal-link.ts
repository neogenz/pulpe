import type { TransactionKind } from 'pulpe-shared';

/**
 * A savings-goal link only ever lives on a `saving` line (SAVINGS.md §3.4).
 *
 * Create path — `kind` is always present. A link on a non-saving line is forced
 * to null.
 */
export function savingsGoalIdForKind(
  kind: TransactionKind,
  savingsGoalId: string | null | undefined,
): string | null {
  return kind === 'saving' ? (savingsGoalId ?? null) : null;
}

/**
 * Update path — `kind` may be absent (preserve). When `kind` is explicitly moved
 * off `saving`, the link is cleared. `undefined` return = leave the link
 * untouched; the read side double-guards on `kind = 'saving'`.
 */
export function savingsGoalIdPatchForKind(
  kind: TransactionKind | undefined,
  savingsGoalId: string | null | undefined,
): string | null | undefined {
  if (kind !== undefined && kind !== 'saving') return null;
  return savingsGoalId;
}

/**
 * Exact message RAISEd (P0001) by the `enforce_savings_goal_line_link` trigger
 * (migration 20260701083300) when a tagged `savingsGoalId` doesn't reference a
 * goal owned by the line's owner — deleted goal (stale picker) or foreign goal.
 * Business rejection, not a server fault: callers map it to
 * SAVINGS_GOAL_NOT_FOUND (4xx, RLS-hiding idiom) instead of a generic
 * *_FAILED 500.
 */
const SAVINGS_GOAL_LINK_DENIED_MESSAGE = 'Savings goal access denied';

export function isSavingsGoalLinkDenied(error: unknown): boolean {
  const { code, message } = (error ?? {}) as {
    code?: string;
    message?: string;
  };
  return (
    code === 'P0001' &&
    Boolean(message?.includes(SAVINGS_GOAL_LINK_DENIED_MESSAGE))
  );
}
