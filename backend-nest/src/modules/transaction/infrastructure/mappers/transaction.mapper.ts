import { Injectable } from '@nestjs/common';
import { type Transaction as TransactionApi } from 'pulpe-shared';
import {
  mapTransactionToApi,
  mapTransactionsToApi,
} from '@common/utils/transaction-api.mapper';
import type { Transaction } from '../../domain/transaction.entity';

@Injectable()
export class TransactionMapper {
  toApi(entity: Transaction): TransactionApi {
    return mapTransactionToApi(entity);
  }

  toApiList(entities: Transaction[]): TransactionApi[] {
    return mapTransactionsToApi(entities);
  }
}
