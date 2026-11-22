/** What the person keeps between comparisons; null while nothing is stored. */
export interface StoredReconciliationState {
  lastCompletedAt: string | null;
}

/** Only the fields present are written. */
export interface ReconciliationStatePatch {
  lastCompletedAt?: string;
}
