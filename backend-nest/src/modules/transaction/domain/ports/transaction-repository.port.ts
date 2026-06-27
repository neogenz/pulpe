import type {
  Transaction,
  TransactionCreateInput,
  TransactionUpdatePatch,
  BudgetLineForAllocation,
  TransactionSearchTransactionRow,
  TransactionSearchBudgetLineRow,
} from '../transaction.entity';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export interface TransactionRepositoryPort {
  findAll(): Promise<Transaction[]>;
  findById(id: string): Promise<Transaction>;
  findByBudgetId(budgetId: string): Promise<Transaction[]>;
  findByBudgetLineId(budgetLineId: string): Promise<Transaction[]>;
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
  fetchBudgetIdForTransaction(id: string): Promise<string | null>;
  fetchBudgetLineForAllocation(
    budgetLineId: string,
  ): Promise<BudgetLineForAllocation | null>;
  assertBudgetLineExists(budgetLineId: string): Promise<void>;
  fetchBudgetIdsByYears(userId: string, years: number[]): Promise<string[]>;
  fetchTransactionsByPattern(
    searchPattern: string,
    budgetIds: string[] | null,
  ): Promise<TransactionSearchTransactionRow[]>;
  fetchBudgetLinesByPattern(
    searchPattern: string,
    budgetIds: string[] | null,
  ): Promise<TransactionSearchBudgetLineRow[]>;
}
