import type {
  Budget,
  BudgetForRollover,
  BudgetRow,
  BudgetUpdatePatch,
  BudgetWithRelations,
  BudgetAggregates,
} from '../budget.entity';

export const BUDGET_REPOSITORY = Symbol('BUDGET_REPOSITORY');

export interface BudgetRepositoryPort {
  hasAnyBudget(): Promise<boolean>;
  fetchAllBudgets(): Promise<Budget[]>;
  fetchBudgetsWithFilters(filters: {
    limit?: number;
    year?: number;
  }): Promise<Budget[]>;
  fetchAllBudgetsForExport(): Promise<Budget[]>;

  fetchBudgetById(id: string, userId: string): Promise<Budget>;
  validateBudgetExists(id: string): Promise<Budget>;
  fetchBudgetUserId(id: string): Promise<string>;

  updateBudget(id: string, patch: BudgetUpdatePatch): Promise<Budget>;
  deleteBudget(id: string): Promise<void>;
  deleteBudgetsByIds(ids: string[]): Promise<boolean>;

  getExistingPeriods(
    userId: string,
    targetMonths: { month: number; year: number }[],
  ): Promise<Set<string>>;

  fetchBudgetData(budgetId: string): Promise<BudgetWithRelations>;

  fetchBudgetAggregates(
    budgetIds: string[],
  ): Promise<Map<string, BudgetAggregates>>;

  /**
   * Calls `create_budget_from_template` RPC. Returns the raw RPC payload.
   * The created budget's `ending_balance` is always NULL at this stage.
   */
  createBudgetFromTemplateRpc(payload: {
    p_user_id: string;
    p_template_id: string;
    p_month: number;
    p_year: number;
    p_description: string;
  }): Promise<{
    budget: BudgetRow;
    budget_lines_created: number;
    template_name: string;
  }>;

  /**
   * Persist the recomputed ending balance. Accepts a plain number; repo encrypts
   * with the user's DEK before writing.
   */
  persistEndingBalance(budgetId: string, endingBalance: number): Promise<void>;

  /**
   * Lightweight per-user listing for rollover computation. Repo decrypts
   * `ending_balance` before returning.
   */
  fetchAllBudgetsForRollover(userId: string): Promise<BudgetForRollover[]>;

  /**
   * Resolves the authenticated user's `payDayOfMonth` from auth metadata,
   * clamped to `[PAY_DAY_MIN, PAY_DAY_MAX]`. Defaults to PAY_DAY_MIN when missing.
   */
  fetchUserPayDayOfMonth(): Promise<number>;

  /**
   * Existence check for duplicate-period validation. Returns the colliding
   * budget id, or `null` if no duplicate exists. RLS scopes the query to the
   * authenticated user.
   */
  fetchBudgetIdByPeriod(month: number, year: number): Promise<string | null>;
  fetchBudgetIdByPeriodExcluding(
    month: number,
    year: number,
    excludeId: string,
  ): Promise<string | null>;
}
