import type {
  Transaction,
  TransactionCreateInput,
  TransactionMutationContext,
  TransactionUpdatePatch,
  BudgetLineForAllocation,
  SpreadSourceTransaction,
  TransactionSearchTransactionRow,
  TransactionSearchBudgetLineRow,
} from '../transaction.entity';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export interface TransactionSearchCriteria {
  userId: string;
  searchPattern: string | null;
  budgetIds: string[] | null;
  tagIds: string[];
}

export interface TransactionRepositoryPort {
  findById(id: string): Promise<Transaction>;
  findByBudgetId(budgetId: string): Promise<Transaction[]>;
  findByBudgetLineId(budgetLineId: string): Promise<Transaction[]>;
  /**
   * PUL-17 v1.1: decrypted spread SOURCE (a transaction + its budget's
   * month/year M0). RLS scopes to the caller — throws NOT_FOUND for another
   * user's transaction (IDOR guard before any fan-out).
   */
  findSpreadSource(id: string): Promise<SpreadSourceTransaction>;
  insert(input: TransactionCreateInput): Promise<Transaction>;
  update(id: string, patch: TransactionUpdatePatch): Promise<Transaction>;
  /**
   * Atomic, race-guarded move of an unchecked free transaction to another
   * budget (PUL-22). The guard (`budget_id = :source AND budget_line_id IS NULL
   * AND checked_at IS NULL`) wins exactly once. Shifts `transaction_date` to the
   * pre-computed `shiftedDate`. Never round-trips `amount` (ciphertext kept).
   */
  postpone(
    id: string,
    sourceBudgetId: string,
    targetBudgetId: string,
    shiftedDate: string,
  ): Promise<Transaction>;
  delete(id: string): Promise<void>;
  toggleCheck(id: string): Promise<Transaction>;
  /**
   * Insère un revenu dont l'argent SORT d'un objectif (PUL-329), via la RPC
   * atomique : le prélèvement, la pose du lien et le figeage du nom courant se
   * font sous le même verrou que la vérification de `expectedRevision`. Une
   * insertion ordinaire ne conviendrait pas — elle laisserait le solde et la
   * transaction diverger le temps d'un aller-retour.
   */
  insertWithdrawal(
    input: TransactionCreateInput & { sourceSavingsGoalId: string },
    expectedRevision: number,
  ): Promise<Transaction>;
  /**
   * Édite un retrait ACTIF. Le patch ne peut pas porter le lien : la RPC le
   * relit elle-même et refuse un changement de source, de type ou une
   * allocation.
   */
  updateWithdrawal(
    id: string,
    patch: TransactionUpdatePatch,
    expectedRevision: number,
  ): Promise<Transaction>;
  /** Supprime un retrait ACTIF ; le stock remonte du montant exact. */
  deleteWithdrawal(id: string, expectedRevision: number): Promise<void>;
  /**
   * Ce que les mutations doivent savoir AVANT d'écrire : le budget à
   * recalculer, le montant courant (le disponible d'une édition vaut
   * `confirmé + ancien montant`) et l'origine d'épargne, qui décide si
   * l'écriture emprunte la RPC atomique ou le chemin ordinaire. `null` quand
   * la transaction n'existe pas ou appartient à un autre compte.
   */
  findMutationContext(id: string): Promise<TransactionMutationContext | null>;
  fetchBudgetLineForAllocation(
    budgetLineId: string,
  ): Promise<BudgetLineForAllocation | null>;
  assertBudgetLineExists(budgetLineId: string): Promise<void>;
  fetchBudgetIdsByYears(userId: string, years: number[]): Promise<string[]>;
  fetchTransactionsByPattern(
    criteria: TransactionSearchCriteria,
  ): Promise<TransactionSearchTransactionRow[]>;
  fetchBudgetLinesByPattern(
    criteria: TransactionSearchCriteria,
  ): Promise<TransactionSearchBudgetLineRow[]>;
}
