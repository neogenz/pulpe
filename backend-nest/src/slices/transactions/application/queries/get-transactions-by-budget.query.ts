import type { PaginationOptions } from '../../domain/repositories';

export class GetTransactionsByBudgetQuery {
  constructor(
    public readonly budgetId: string,
    public readonly userId: string,
    public readonly pagination?: PaginationOptions,
  ) {}
}
