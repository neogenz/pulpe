import type {
  TransactionSearchQuery,
  TransactionSearchResult,
} from 'pulpe-shared';

export const TRANSACTION_SEARCH_PORT = Symbol('TRANSACTION_SEARCH_PORT');

/**
 * Search the user's movements and prévisions, for in-process consumers (the
 * MCP agent connector). Requires the caller to have put `user` and `supabase`
 * in CLS, exactly like an HTTP request does.
 */
export interface TransactionSearchPort {
  search(query: TransactionSearchQuery): Promise<TransactionSearchResult[]>;
}
