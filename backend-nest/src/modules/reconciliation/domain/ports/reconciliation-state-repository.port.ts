import type {
  ReconciliationStatePatch,
  StoredReconciliationState,
} from '../reconciliation-state.entity';

export const RECONCILIATION_STATE_REPOSITORY = Symbol(
  'RECONCILIATION_STATE_REPOSITORY',
);

/** Persistence port for the person's comparison state. */
export interface ReconciliationStateRepositoryPort {
  get(): Promise<StoredReconciliationState>;
  /** Upserts the row, touching only the fields present in the patch. */
  upsert(patch: ReconciliationStatePatch): Promise<StoredReconciliationState>;
}
