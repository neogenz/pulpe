import type {
  TransactionRow,
  TransactionInsert,
  TransactionUpdate,
} from '../transaction.entity';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export interface TransactionRepositoryPort {
  findAll(): Promise<TransactionRow[]>;
  findById(id: string): Promise<TransactionRow>;
  findByBudgetId(budgetId: string): Promise<TransactionRow[]>;
  findByBudgetLineId(budgetLineId: string): Promise<TransactionRow[]>;
  insert(data: TransactionInsert): Promise<TransactionRow>;
  update(id: string, data: Partial<TransactionUpdate>): Promise<TransactionRow>;
  delete(id: string): Promise<void>;
  fetchBudgetIdForTransaction(id: string): Promise<string>;
  fetchBudgetLineForAllocation(
    budgetLineId: string,
  ): Promise<{ id: string; budget_id: string; kind: string } | null>;
  assertBudgetLineExists(budgetLineId: string): Promise<void>;
  fetchBudgetIdsByYears(userId: string, years: number[]): Promise<string[]>;
  fetchTransactionsByPattern(
    searchPattern: string,
    budgetIds: string[] | null,
  ): Promise<
    {
      id: string;
      name: string;
      amount: string | null;
      kind: string;
      transaction_date: string;
      category: string | null;
      budget_id: string;
      budget: unknown;
    }[]
  >;
  fetchBudgetLinesByPattern(
    searchPattern: string,
    budgetIds: string[] | null,
  ): Promise<
    {
      id: string;
      name: string;
      amount: string | null;
      kind: string;
      recurrence: 'fixed' | 'one_off';
      budget_id: string;
      budget: unknown;
    }[]
  >;
}
