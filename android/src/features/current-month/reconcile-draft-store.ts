import type { AccountRow } from "./reconcile-account-links";

/**
 * What the comparison keeps when its sheet goes away unfinished. Checking a
 * balance means leaving for the bank app, and the auto-lock then drops the
 * whole signed-in screen tree: without this, the rows and amounts typed so far
 * die with the sheet. In memory only, so a cold start opens on an empty sheet.
 * Read back only when the person opens the sheet again, never reopened for them.
 */
interface ReconcileDraft {
  rows: AccountRow[];
  /** A comparison was completed before the lock: the real close still saves the balances. */
  hasCompleted: boolean;
}

let draft: (ReconcileDraft & { budgetId: string }) | null = null;

export function keepReconcileDraft(
  budgetId: string,
  rows: AccountRow[],
  hasCompleted = false,
): void {
  draft = { budgetId, rows, hasCompleted };
}

export function readReconcileDraft(budgetId: string): ReconcileDraft | null {
  return draft?.budgetId === budgetId ? draft : null;
}

/** Closing by hand, finishing and signing out all leave nothing to come back to. */
export function clearReconcileDraft(): void {
  draft = null;
}
