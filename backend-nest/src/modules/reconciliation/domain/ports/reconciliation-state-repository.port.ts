import type {
  ReconciliationState,
  ReconciliationStatePatch,
} from '../reconciliation-state.entity';

/**
 * Persistence port for the person's comparison state. The repository owns the
 * encryption boundary: the starting amount is a plain number on both sides.
 */
export interface ReconciliationStateRepositoryPort {
  /** True when the budget exists and belongs to the person. */
  budgetExists(budgetId: string): Promise<boolean>;
  get(): Promise<ReconciliationState>;
  /** Upserts the row, touching only the fields present in the patch. */
  upsert(patch: ReconciliationStatePatch): Promise<ReconciliationState>;
}
