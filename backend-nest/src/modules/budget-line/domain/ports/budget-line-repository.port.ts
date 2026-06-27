import type { Transaction } from '../../../transaction/domain/transaction.entity';
import type {
  BudgetLine,
  BudgetLineCreateInput,
  BudgetLineUpdatePatch,
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
  update(id: string, patch: BudgetLineUpdatePatch): Promise<BudgetLine>;
  /**
   * Atomic, race-guarded move of an unchecked line to another budget (PUL-22).
   * The guard (`budget_id = :source AND checked_at IS NULL`) lets a concurrent
   * check/move win exactly once. Never round-trips `amount` (ciphertext kept).
   */
  postpone(
    id: string,
    sourceBudgetId: string,
    targetBudgetId: string,
  ): Promise<BudgetLine>;
  hasAllocatedTransactions(budgetLineId: string): Promise<boolean>;
  delete(id: string): Promise<void>;
  fetchTemplateLineById(templateLineId: string): Promise<TemplateLine>;
  toggleCheckRpc(id: string): Promise<BudgetLine>;
  checkUncheckedTransactionsRpc(id: string): Promise<Transaction[]>;
}
