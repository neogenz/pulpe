import type { TransactionCreate } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { Transaction } from '../transaction.entity';

export const TRANSACTION_CREATE_PORT = Symbol('TRANSACTION_CREATE_PORT');

/** Create one movement, same contract as `POST /transactions`, for in-process consumers. */
export interface TransactionCreatePort {
  execute(
    dto: TransactionCreate,
    user: AuthenticatedUser,
  ): Promise<Transaction>;
}
