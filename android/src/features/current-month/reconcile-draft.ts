import type { AccountRow } from "./reconcile-account-links";

/**
 * What « Comparer avec mes comptes » keeps when the vault locks under it.
 * Checking a balance means leaving for the bank app, and past the auto-lock
 * delay the lock closes every screen: without this, the balances typed so far
 * die with the sheet. In memory only, so a cold start still opens on an empty
 * sheet. Port of `ReconcileDraftStore`.
 */
export interface ReconcileDraft {
  budgetId: string;
  rows: AccountRow[];
}

let kept: ReconcileDraft | null = null;
let isResumePending = false;

/** A draft taken by the lock, reopened once unlocked; `null` and the next opening starts empty. */
export function keepReconcileDraft(draft: ReconcileDraft | null): void {
  kept = draft;
  isResumePending = draft !== null;
}

export function reconcileDraft(budgetId: string): ReconcileDraft | null {
  return kept?.budgetId === budgetId ? kept : null;
}

/**
 * The month whose sheet the lock took away, until the sheet is left again:
 * the Accueil reopens it when it loads that month.
 */
export function pendingReconcileResume(): string | null {
  return isResumePending ? (kept?.budgetId ?? null) : null;
}
