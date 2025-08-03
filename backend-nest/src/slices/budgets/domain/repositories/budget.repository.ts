import { Result } from '@shared/domain/enhanced-result';
import { Budget } from '../entities/budget.entity';
import { BudgetPeriod } from '../value-objects/budget-period.value-object';

export const BUDGET_REPOSITORY_TOKEN = 'BudgetRepository';

export interface BudgetRepository {
  /**
   * Find a budget by its ID
   */
  findById(id: string, userId: string): Promise<Result<Budget | null>>;

  /**
   * Find a budget by period for a specific user
   */
  findByPeriod(
    period: BudgetPeriod,
    userId: string,
  ): Promise<Result<Budget | null>>;

  /**
   * Find all budgets for a user
   */
  findByUserId(userId: string): Promise<Result<Budget[]>>;

  /**
   * Check if a budget exists for a specific period
   */
  existsForPeriod(
    period: BudgetPeriod,
    userId: string,
    excludeId?: string,
  ): Promise<Result<boolean>>;

  /**
   * Save a budget (create or update)
   */
  save(budget: Budget): Promise<Result<void>>;

  /**
   * Delete a budget
   */
  delete(id: string, userId: string): Promise<Result<void>>;

  /**
   * Create a budget from template with atomic transaction
   * This includes creating all budget lines from the template
   */
  createFromTemplate(
    budget: Budget,
    templateId: string,
  ): Promise<Result<{ budgetLinesCreated: number }>>;
}
