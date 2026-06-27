import type { Transaction } from '../../../transaction/domain/transaction.entity';
import type {
  BudgetLine,
  BudgetLineCreateInput,
  BudgetLineUpdatePatch,
  SpreadDeleteSource,
  SpreadOccurrence,
  SpreadSourceLine,
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
   *
   * `source` (PUL-17 v1.1 Defect 2) lets the total-preserving spread-from flows
   * fold the source deletion INTO the same all-or-nothing RPC transaction, so a
   * fan-out failure leaves the source intact and nothing created (no double-count,
   * no money loss, no duplicate-on-retry). The additive create flow omits it.
   */
  createSpread(
    spreadGroupId: string,
    inputs: BudgetLineCreateInput[],
    source?: SpreadDeleteSource,
  ): Promise<BudgetLine[]>;
  /**
   * PUL-17 Lot C: all occurrences of a spread group across their months.
   * Cross-budget read; RLS scopes to the caller. Empty when not found/owned.
   */
  findBySpreadGroupId(spreadGroupId: string): Promise<SpreadOccurrence[]>;
  /**
   * PUL-17 idempotency: the raw `BudgetLine[]` of a spread group, in the SAME
   * shape `createSpread` returns. Distinct from `findBySpreadGroupId` (which
   * returns the heavier `SpreadOccurrence` read model with the transaction-sum
   * join): the replay path only needs the lines to return them verbatim and to
   * derive the touched budgets for the healing recalculation. RLS scopes to the
   * caller; empty when not found/owned.
   */
  findBudgetLinesBySpreadGroupId(spreadGroupId: string): Promise<BudgetLine[]>;
  /**
   * PUL-17 v1.1: decrypted spread SOURCE (a budget_line + its budget's
   * month/year M0). RLS scopes to the caller — throws NOT_FOUND for another
   * user's line (IDOR guard before any fan-out).
   */
  findSpreadSource(id: string): Promise<SpreadSourceLine>;
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
