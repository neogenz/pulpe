import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { TransactionSpreadFromTxnCreate } from 'pulpe-shared';
import type { SpreadFanOutResult } from '../../../budget-line/domain/ports/budget-line-spread.port';

export const TRANSACTION_SPREAD_FROM_TXN_PORT = Symbol(
  'TRANSACTION_SPREAD_FROM_TXN_PORT',
);

export interface TransactionSpreadFromTxnPort {
  execute(
    id: string,
    dto: TransactionSpreadFromTxnCreate,
    user: AuthenticatedUser,
  ): Promise<SpreadFanOutResult>;
}
