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
  findByBudgetId(budgetId: string): Promise<BudgetLine[]>;
  fetchBudgetIdForLine(id: string): Promise<string | null>;
  insert(input: BudgetLineCreateInput): Promise<BudgetLine>;
  update(id: string, patch: BudgetLineUpdatePatch): Promise<BudgetLine>;
  delete(id: string): Promise<void>;
  fetchTemplateLineById(templateLineId: string): Promise<TemplateLine>;
  toggleCheckRpc(id: string): Promise<BudgetLine>;
  checkUncheckedTransactionsRpc(id: string): Promise<Transaction[]>;
}
