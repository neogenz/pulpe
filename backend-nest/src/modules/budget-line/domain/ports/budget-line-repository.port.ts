import type { Transaction } from '../../../transaction/domain/transaction.entity';
import type {
  BudgetLine,
  BudgetLineCreateInput,
  BudgetLineUpdatePatch,
  SpreadOccurrence,
  TemplateLine,
} from '../budget-line.entity';

export const BUDGET_LINE_REPOSITORY = Symbol('BUDGET_LINE_REPOSITORY');

export interface BudgetLineRepositoryPort {
  findAll(): Promise<BudgetLine[]>;
  findById(id: string): Promise<BudgetLine>;
  validateAccess(id: string, userId: string): Promise<void>;
  findByBudgetId(budgetId: string): Promise<BudgetLine[]>;
  fetchBudgetIdForLine(id: string): Promise<string | null>;
  insert(input: BudgetLineCreateInput): Promise<BudgetLine>;
  /**
   * PUL-17: set-based atomic fan-out — inserts N `one_off` lines (one per
   * `input`) sharing `spreadGroupId`, via the `create_budget_lines_spread` RPC.
   */
  createSpread(
    spreadGroupId: string,
    inputs: BudgetLineCreateInput[],
  ): Promise<BudgetLine[]>;
  /**
   * PUL-17 Lot C: all occurrences of a spread group across their months.
   * Cross-budget read; RLS scopes to the caller. Empty when not found/owned.
   */
  findBySpreadGroupId(spreadGroupId: string): Promise<SpreadOccurrence[]>;
  update(id: string, patch: BudgetLineUpdatePatch): Promise<BudgetLine>;
  delete(id: string): Promise<void>;
  fetchTemplateLineById(templateLineId: string): Promise<TemplateLine>;
  toggleCheckRpc(id: string): Promise<BudgetLine>;
  checkUncheckedTransactionsRpc(id: string): Promise<Transaction[]>;
}
