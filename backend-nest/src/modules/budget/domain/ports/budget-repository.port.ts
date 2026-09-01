import type { TransactionKind } from 'pulpe-shared';
import type {
  Budget,
  BudgetForRollover,
  BudgetRow,
  BudgetUpdatePatch,
  BudgetWithRelations,
  BudgetAggregates,
} from '../budget.entity';
import type { HistoryMonth } from '../drift-history';

export const BUDGET_REPOSITORY = Symbol('BUDGET_REPOSITORY');

/** Slim strict-decrypt projection consumed by the recalculation formula. */
export interface BudgetDataForRecalc {
  budgetLines: { id: string; kind: TransactionKind; amount: number }[];
  transactions: {
    kind: TransactionKind;
    amount: number;
    budgetLineId: string | null;
  }[];
}

export interface GenerateBudgetsAtomicallyResult {
  createdBudgetIds: string[];
  skippedMonths: { month: number; year: number }[];
}

export interface BudgetRepositoryPort {
  hasAnyBudget(): Promise<boolean>;
  fetchAllBudgets(): Promise<Budget[]>;
  fetchBudgetsWithFilters(filters: {
    limit?: number;
    offset?: number;
    year?: number;
  }): Promise<Budget[]>;
  fetchAllBudgetsForExport(): Promise<Budget[]>;

  fetchBudgetById(id: string, userId: string): Promise<Budget>;
  validateBudgetExists(id: string): Promise<Budget>;
  fetchBudgetUserId(id: string): Promise<string>;

  updateBudget(id: string, patch: BudgetUpdatePatch): Promise<Budget>;
  deleteBudget(id: string): Promise<void>;
  deleteBudgetsByIds(ids: string[]): Promise<boolean>;

  /**
   * Returns the user's already-budgeted periods among `targetMonths` as a
   * `periodKey → budgetId` map (`"3/2026" → uuid`). Existence-only callers use
   * `.has(key)`; spread provisioning reads `.get(key)` to avoid an extra
   * per-period id lookup.
   */
  getExistingPeriods(
    userId: string,
    targetMonths: { month: number; year: number }[],
  ): Promise<Map<string, string>>;

  fetchBudgetData(budgetId: string): Promise<BudgetWithRelations>;

  /**
   * Strict-decrypt read reserved for balance recalculation: a non-null
   * ciphertext that fails AES-GCM throws `ENCRYPTION_DECRYPT_FAILED` instead
   * of silently becoming 0 — a wrong total must never be persisted. A
   * legitimately null amount still maps to 0.
   */
  fetchBudgetDataForRecalc(budgetId: string): Promise<BudgetDataForRecalc>;

  fetchBudgetAggregates(
    budgetIds: string[],
  ): Promise<Map<string, BudgetAggregates>>;

  /**
   * Lines and transactions of past budgets, decrypted, with the two dates the
   * drift history needs (`checkedAt`, `transactionDate`). Same two selects as
   * `fetchBudgetAggregates`; returns one entry per budget in `budgets` order.
   */
  fetchHistoryData(
    budgets: { id: string; month: number; year: number }[],
  ): Promise<HistoryMonth[]>;

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

  generateBudgetsFromTemplateAtomically(input: {
    userId: string;
    templateId: string;
    targetMonths: { month: number; year: number }[];
  }): Promise<GenerateBudgetsAtomicallyResult>;

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
