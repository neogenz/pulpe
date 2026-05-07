import type {
  BudgetLineRow,
  BudgetLineInsert,
  BudgetLineUpdate,
  TemplateLineRow,
  TransactionRow,
} from '../budget-line.entity';

export const BUDGET_LINE_REPOSITORY = Symbol('BUDGET_LINE_REPOSITORY');

export interface BudgetLineRepositoryPort {
  findAll(): Promise<BudgetLineRow[]>;
  findById(id: string): Promise<BudgetLineRow>;
  findByBudgetId(budgetId: string): Promise<BudgetLineRow[]>;
  fetchBudgetIdForLine(id: string): Promise<string | null>;
  insert(data: BudgetLineInsert): Promise<BudgetLineRow>;
  update(id: string, data: Partial<BudgetLineUpdate>): Promise<BudgetLineRow>;
  delete(id: string): Promise<void>;
  fetchTemplateLineById(templateLineId: string): Promise<TemplateLineRow>;
  toggleCheckRpc(id: string): Promise<BudgetLineRow>;
  checkUncheckedTransactionsRpc(id: string): Promise<TransactionRow[]>;
}
