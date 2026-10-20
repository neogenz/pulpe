import { describe, expect, it, mock } from 'bun:test';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { FindTransactionUseCase } from './find-transaction.use-case';
import type { RemoveTransactionUseCase } from './remove-transaction.use-case';
import type { ToggleTransactionCheckUseCase } from './toggle-transaction-check.use-case';
import type { UpdateTransactionUseCase } from './update-transaction.use-case';
import { WriteTransactionsInProcessUseCase } from './write-transactions-in-process.use-case';

const ID = '11111111-1111-4111-8111-111111111111';
const user = { id: 'user-1' };

describe('WriteTransactionsInProcessUseCase.find', () => {
  it('reads the movement, with its tag ids, as the session user', async () => {
    const find = mock(async () => ({ id: ID, tagIds: [ID] }));
    const port = new WriteTransactionsInProcessUseCase(
      { execute: find } as unknown as FindTransactionUseCase,
      {} as UpdateTransactionUseCase,
      {} as RemoveTransactionUseCase,
      {} as ToggleTransactionCheckUseCase,
      { user } as unknown as AuthenticatedSupabaseProvider,
    );

    const found = await port.find(ID);
    expect(found.tagIds).toEqual([ID]);
    expect(find).toHaveBeenCalledWith(ID, user);
  });
});
