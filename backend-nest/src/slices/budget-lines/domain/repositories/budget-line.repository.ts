import { Result } from '@shared/domain/enhanced-result';
import { BudgetLine } from '../entities/budget-line.entity';

export const BUDGET_LINE_REPOSITORY_TOKEN = 'BudgetLineRepository';

export interface BudgetLineFilters {
  budgetId?: string;
  templateLineId?: string;
  savingsGoalId?: string;
  kind?: string;
  recurrence?: string;
}

export interface BudgetLineRepository {
  /**
   * Find a budget line by ID
   */
  findById(id: string, userId: string): Promise<Result<BudgetLine | null>>;

  /**
   * Find all budget lines for a user with optional filters
   */
  findAll(
    userId: string,
    filters?: BudgetLineFilters,
  ): Promise<Result<BudgetLine[]>>;

  /**
   * Find all budget lines for a specific budget
   */
  findByBudgetId(
    budgetId: string,
    userId: string,
  ): Promise<Result<BudgetLine[]>>;

  /**
   * Find budget lines by template line ID
   */
  findByTemplateLineId(
    templateLineId: string,
    userId: string,
  ): Promise<Result<BudgetLine[]>>;

  /**
   * Save a budget line (create or update)
   */
  save(budgetLine: BudgetLine, userId: string): Promise<Result<BudgetLine>>;

  /**
   * Save multiple budget lines in a transaction
   */
  saveMany(
    budgetLines: BudgetLine[],
    userId: string,
  ): Promise<Result<BudgetLine[]>>;

  /**
   * Delete a budget line
   */
  delete(id: string, userId: string): Promise<Result<void>>;

  /**
   * Delete all budget lines for a budget
   */
  deleteByBudgetId(budgetId: string, userId: string): Promise<Result<void>>;

  /**
   * Check if a budget line exists
   */
  exists(id: string, userId: string): Promise<Result<boolean>>;

  /**
   * Count budget lines for a budget
   */
  countByBudgetId(budgetId: string, userId: string): Promise<Result<number>>;

  /**
   * Calculate total amount for a budget
   */
  calculateTotalForBudget(
    budgetId: string,
    userId: string,
  ): Promise<Result<number>>;
}
