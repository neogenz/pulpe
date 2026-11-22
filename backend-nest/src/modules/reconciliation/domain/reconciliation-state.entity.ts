/** What the person keeps between comparisons; 0 and null while nothing is stored. */
export interface StoredReconciliationState {
  startingAmount: number;
  lastCompletedAt: string | null;
}

/** Only the fields present are written. */
export interface ReconciliationStatePatch {
  startingAmount?: number;
  lastCompletedAt?: string;
}
