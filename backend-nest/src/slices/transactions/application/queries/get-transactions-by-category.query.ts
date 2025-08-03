import type { PaginationOptions } from '../../domain/repositories';

export class GetTransactionsByCategoryQuery {
  constructor(
    public readonly category: string,
    public readonly userId: string,
    public readonly pagination?: PaginationOptions,
  ) {}
}
