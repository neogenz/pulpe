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
