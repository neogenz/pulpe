import type { AccountRow } from "./reconcile-account-links";

/**
 * What the comparison keeps when its sheet goes away unfinished. Checking a
 * balance means leaving for the bank app, and the auto-lock then drops the
 * whole signed-in screen tree: without this, the rows and amounts typed so far
 * die with the sheet. In memory only, so a cold start opens on an empty sheet.
 * Read back only when the person opens the sheet again, never reopened for them.
 */
let draft: { budgetId: string; rows: AccountRow[] } | null = null;

export function keepReconcileDraft(budgetId: string, rows: AccountRow[]): void {
  draft = { budgetId, rows };
}

export function readReconcileDraft(budgetId: string): AccountRow[] | null {
  return draft?.budgetId === budgetId ? draft.rows : null;
}

/** Closing by hand, finishing and signing out all leave nothing to come back to. */
export function clearReconcileDraft(): void {
  draft = null;
}
