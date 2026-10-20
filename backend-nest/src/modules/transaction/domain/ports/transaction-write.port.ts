import type { TransactionUpdate } from 'pulpe-shared';
import type { Transaction } from '../transaction.entity';

export const TRANSACTION_WRITE_PORT = Symbol('TRANSACTION_WRITE_PORT');

/**
 * The everyday gestures on a movement, for in-process consumers (the MCP agent
 * connector). Requires the caller to have put `user` and `supabase` in CLS,
 * exactly like an HTTP request does. Creation has its own port
 * (`TRANSACTION_CREATE_PORT`), older than this one.
 */
export interface TransactionWritePort {
  update(id: string, patch: TransactionUpdate): Promise<Transaction>;
  /**
   * Rejects with `TRANSACTION_NOT_FOUND` when the id is not one of the user's
   * movements (a forecast id, an unknown or already deleted id); the REST route
   * stays idempotent.
   */
  remove(id: string): Promise<void>;
  /** Pointe ou dépointe : le même geste dans les deux sens. */
  toggleCheck(id: string): Promise<Transaction>;
}
