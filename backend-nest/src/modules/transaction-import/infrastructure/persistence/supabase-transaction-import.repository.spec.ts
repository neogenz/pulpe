import { describe, expect, it, mock } from 'bun:test';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { EncryptionPort } from '@modules/encryption/encryption.tokens';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { ImportCandidate } from '../../domain/transaction-import.entity';
import { SupabaseTransactionImportRepository } from './supabase-transaction-import.repository';

const BUDGET_ID = '11111111-1111-4111-8111-111111111111';
const user = { id: 'user-1', clientKey: Buffer.alloc(32, 7) };

const candidate = (
  overrides: Partial<ImportCandidate> = {},
): ImportCandidate => ({
  position: 1,
  date: '2026-03-10',
  name: 'Boulangerie',
  amount: 12.5,
  kind: 'expense',
  fingerprint: 'a'.repeat(64),
  ...overrides,
});

function setup(insertError: { code: string } | null = null) {
  const insert = mock(async (_rows: unknown[]) => ({ error: insertError }));
  const client = { from: mock(() => ({ insert })) };
  const encryption = {
    prepareAmountsData: mock(async (amounts: number[]) =>
      amounts.map((amount) => ({ amount: `enc(${amount})` })),
    ),
    fingerprints: mock(() => []),
  };
  const repo = new SupabaseTransactionImportRepository(
    { client, user } as unknown as AuthenticatedSupabaseProvider,
    encryption as unknown as EncryptionPort,
  );
  return { repo, insert, encryption };
}

describe('SupabaseTransactionImportRepository.insertAll', () => {
  it('encrypts every amount and sends all rows in a single insert', async () => {
    const { repo, insert, encryption } = setup();

    await repo.insertAll(BUDGET_ID, [
      candidate(),
      candidate({
        position: 2,
        amount: 5200,
        kind: 'income',
        fingerprint: 'b'.repeat(64),
      }),
    ]);

    expect(encryption.prepareAmountsData).toHaveBeenCalledWith(
      [12.5, 5200],
      'user-1',
      user.clientKey,
    );
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toEqual([
      {
        budget_id: BUDGET_ID,
        budget_line_id: null,
        name: 'Boulangerie',
        amount: 'enc(12.5)',
        kind: 'expense',
        transaction_date: '2026-03-10T12:00:00.000Z',
        checked_at: null,
        import_fingerprint: 'a'.repeat(64),
      },
      {
        budget_id: BUDGET_ID,
        budget_line_id: null,
        name: 'Boulangerie',
        amount: 'enc(5200)',
        kind: 'income',
        transaction_date: '2026-03-10T12:00:00.000Z',
        checked_at: null,
        import_fingerprint: 'b'.repeat(64),
      },
    ]);
  });

  it('turns a fingerprint collision into an import conflict', async () => {
    const { repo } = setup({ code: '23505' });

    const promise = repo.insertAll(BUDGET_ID, [candidate()]);

    await expect(promise).rejects.toBeInstanceOf(BusinessException);
    await expect(promise).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TRANSACTION_IMPORT_CONFLICT.code,
    });
  });

  it('turns any other database error into a failed import', async () => {
    const { repo } = setup({ code: '42501' });

    await expect(
      repo.insertAll(BUDGET_ID, [candidate()]),
    ).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TRANSACTION_IMPORT_FAILED.code,
    });
  });

  it('does not reach the database for an empty batch', async () => {
    const { repo, insert } = setup();

    await repo.insertAll(BUDGET_ID, []);

    expect(insert).not.toHaveBeenCalled();
  });
});
