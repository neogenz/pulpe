import type {
  AttachableLine,
  ImportTargetBudget,
  PlannedImport,
} from '../transaction-import.entity';

export const TRANSACTION_IMPORT_REPOSITORY = Symbol(
  'TRANSACTION_IMPORT_REPOSITORY',
);

export interface TransactionImportRepositoryPort {
  /** The caller's budget; throws BUDGET_NOT_FOUND for a missing or foreign one. */
  findTargetBudget(budgetId: string): Promise<ImportTargetBudget>;
  /** The budget's Prévisions an import may attach to, amounts decrypted. */
  findAttachableLines(budgetId: string): Promise<AttachableLine[]>;
  /** Keyed fingerprints for the caller, one per material, same order. */
  fingerprint(materials: readonly string[]): string[];
  /** The subset of `fingerprints` already carried by one of the caller's Réels. */
  findImportedFingerprints(
    fingerprints: readonly string[],
  ): Promise<ReadonlySet<string>>;
  /**
   * Creates every planned Réel in ONE statement: all rows or none. Throws
   * TRANSACTION_IMPORT_CONFLICT when one of them was imported in the meantime.
   */
  insertAll(budgetId: string, planned: readonly PlannedImport[]): Promise<void>;
}
