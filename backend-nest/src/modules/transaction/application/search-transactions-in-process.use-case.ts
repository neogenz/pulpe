import { Injectable } from '@nestjs/common';
import type {
  TransactionSearchQuery,
  TransactionSearchResult,
} from 'pulpe-shared';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { TransactionSearchPort } from '../domain/ports/transaction-search.port';
import { SearchTransactionsUseCase } from './search-transactions.use-case';

/** Search, for in-process consumers that have no HTTP request to carry the user. */
@Injectable()
export class SearchTransactionsInProcessUseCase implements TransactionSearchPort {
  constructor(
    private readonly searchTransactions: SearchTransactionsUseCase,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  search(query: TransactionSearchQuery): Promise<TransactionSearchResult[]> {
    return this.searchTransactions.execute(query, this.session.user);
  }
}
