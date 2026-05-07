import type {
  BudgetRow,
  BudgetLineRow,
  TransactionRow,
} from '../budget.entity';
import type { BudgetAggregates } from '../../infrastructure/persistence/supabase-budget.repository';

export const BUDGET_REPOSITORY = Symbol('BUDGET_REPOSITORY');

export interface BudgetDataOptions {
  budgetLineFields?: string;
  transactionFields?: string;
  includeBudget?: boolean;
  orderTransactions?: boolean;
}

export interface BudgetDataResult {
  budget?: BudgetRow;
  budgetLines: BudgetLineRow[];
  transactions: TransactionRow[];
}

export interface BudgetRepositoryPort {
  fetchBudgetById(id: string, userId: string): Promise<BudgetRow>;
  fetchBudgetUserId(id: string): Promise<string>;
  updateBudget(
    id: string,
    updateData: Record<string, unknown>,
  ): Promise<BudgetRow>;
  deleteBudgetsByIds(ids: string[]): Promise<boolean>;
  getExistingPeriods(
    userId: string,
    targetMonths: { month: number; year: number }[],
  ): Promise<Set<string>>;
  fetchBudgetData(
    budgetId: string,
    options?: BudgetDataOptions,
  ): Promise<BudgetDataResult>;
  fetchBudgetAggregates(
    budgetIds: string[],
    decryptFn: (amount: string | null) => number,
  ): Promise<Map<string, BudgetAggregates>>;
  hasAnyBudget(): Promise<boolean>;
  fetchAllBudgets(): Promise<BudgetRow[]>;
  fetchBudgetsWithFilters(filters: {
    limit?: number;
    year?: number;
  }): Promise<BudgetRow[]>;
  fetchAllBudgetsForExport(): Promise<BudgetRow[]>;
  validateBudgetExists(id: string): Promise<BudgetRow>;
  deleteBudget(id: string): Promise<void>;
  createBudgetFromTemplateRpc(payload: {
    p_user_id: string;
    p_template_id: string;
    p_month: number;
    p_year: number;
    p_description: string;
  }): Promise<unknown>;
  persistEndingBalance(
    budgetId: string,
    encryptedBalance: string,
  ): Promise<void>;
  fetchAllBudgetsForRollover(
    userId: string,
  ): Promise<
    { id: string; month: number; year: number; ending_balance: string | null }[]
  >;
}
