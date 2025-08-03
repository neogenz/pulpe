import type {
  TransactionFilters,
  PaginationOptions,
} from '../../domain/repositories';

export class ListTransactionsQuery {
  constructor(
    public readonly userId: string,
    public readonly filters?: TransactionFilters,
    public readonly pagination?: PaginationOptions,
  ) {}
}
