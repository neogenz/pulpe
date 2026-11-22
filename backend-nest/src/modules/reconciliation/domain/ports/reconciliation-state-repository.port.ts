import type {
  ReconciliationStatePatch,
  StoredReconciliationState,
} from '../reconciliation-state.entity';

export const RECONCILIATION_STATE_REPOSITORY = Symbol(
  'RECONCILIATION_STATE_REPOSITORY',
);

/**
 * Persistence port for the person's comparison state. The repository owns the
 * encryption boundary: the starting amount is a plain number on both sides.
 */
export interface ReconciliationStateRepositoryPort {
  get(): Promise<StoredReconciliationState>;
  /** Upserts the row, touching only the fields present in the patch. */
  upsert(patch: ReconciliationStatePatch): Promise<StoredReconciliationState>;
}
