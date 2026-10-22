import { Injectable } from '@nestjs/common';
import type { TransactionUpdate } from 'pulpe-shared';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { TransactionWritePort } from '../domain/ports/transaction-write.port';
import type { Transaction } from '../domain/transaction.entity';
import { FindTransactionUseCase } from './find-transaction.use-case';
import { UpdateTransactionUseCase } from './update-transaction.use-case';
import { RemoveTransactionUseCase } from './remove-transaction.use-case';
import { ToggleTransactionCheckUseCase } from './toggle-transaction-check.use-case';

/** Movement writes, for in-process consumers that have no HTTP request. */
@Injectable()
export class WriteTransactionsInProcessUseCase implements TransactionWritePort {
  constructor(
    private readonly findTransaction: FindTransactionUseCase,
    private readonly updateTransaction: UpdateTransactionUseCase,
    private readonly removeTransaction: RemoveTransactionUseCase,
    private readonly toggleTransactionCheck: ToggleTransactionCheckUseCase,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  find(id: string): Promise<Transaction> {
    return this.findTransaction.execute(id, this.session.user);
  }

  update(id: string, patch: TransactionUpdate): Promise<Transaction> {
    return this.updateTransaction.execute(id, patch, this.session.user);
  }

  remove(id: string): Promise<void> {
    return this.removeTransaction.execute(id, this.session.user, {
      mustExist: true,
    });
  }

  toggleCheck(id: string): Promise<Transaction> {
    return this.toggleTransactionCheck.execute(id, this.session.user);
  }
}
