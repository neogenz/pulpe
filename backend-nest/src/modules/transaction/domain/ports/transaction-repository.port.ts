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
  delete(id: string): Promise<void>;
  toggleCheck(id: string): Promise<Transaction>;
  fetchBudgetIdForTransaction(id: string): Promise<string>;
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
