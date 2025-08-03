import { Result } from '@shared/domain/enhanced-result';
import { Transaction } from '../entities/transaction.entity';

export const TRANSACTION_REPOSITORY_TOKEN = 'TransactionRepository';

export interface TransactionFilters {
  budgetId?: string;
  category?: string;
  isOutOfBudget?: boolean;
  kind?: 'expense' | 'income';
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  searchTerm?: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'date' | 'amount' | 'name';
  orderDirection?: 'asc' | 'desc';
}

export interface TransactionListResult {
  transactions: Transaction[];
  total: number;
}

export interface BulkImportResult {
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export interface TransactionRepository {
  /**
   * Find a transaction by its ID
   */
  findById(id: string, userId: string): Promise<Result<Transaction | null>>;

  /**
   * Find all transactions for a user with optional filters
   */
  findByUserId(
    userId: string,
    filters?: TransactionFilters,
    pagination?: PaginationOptions,
  ): Promise<Result<TransactionListResult>>;

  /**
   * Find all transactions for a specific budget
   */
  findByBudgetId(
    budgetId: string,
    userId: string,
    pagination?: PaginationOptions,
  ): Promise<Result<Transaction[]>>;

  /**
   * Find transactions by category
   */
  findByCategory(
    category: string,
    userId: string,
    pagination?: PaginationOptions,
  ): Promise<Result<Transaction[]>>;

  /**
   * Save a transaction (create or update)
   */
  save(transaction: Transaction): Promise<Result<void>>;

  /**
   * Delete a transaction
   */
  delete(id: string, userId: string): Promise<Result<void>>;

  /**
   * Bulk import transactions
   */
  bulkImport(
    transactions: Transaction[],
    userId: string,
  ): Promise<Result<BulkImportResult>>;

  /**
   * Get transaction statistics for a budget
   */
  getStatsByBudget(
    budgetId: string,
    userId: string,
  ): Promise<
    Result<{
      totalIncome: number;
      totalExpense: number;
      categoryBreakdown: Record<string, number>;
    }>
  >;

  /**
   * Check if user owns the budget (for transaction creation)
   */
  userOwnsBudget(budgetId: string, userId: string): Promise<Result<boolean>>;
}
