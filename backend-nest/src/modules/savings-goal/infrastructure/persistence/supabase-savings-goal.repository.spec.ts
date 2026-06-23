import { describe, it, expect, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { SupabaseSavingsGoalRepository } from './supabase-savings-goal.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import type { SavingsGoalRow } from '../../domain/savings-goal.entity';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { EncryptionPort } from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

const mockRow: SavingsGoalRow = {
  id: 'goal-1',
  user_id: 'user-1',
  name: 'Maison',
  target_amount: 'enc:5000',
  target_date: '2099-01-01',
  priority: null,
  status: 'ACTIVE',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  original_target_amount: null,
  original_currency: null,
  target_currency: null,
  exchange_rate: null,
};

function createMockProvider(
  fromFn: (table: string) => unknown,
): AuthenticatedSupabaseProvider {
  const client = { from: fromFn } as unknown as AuthenticatedSupabaseClient;
  return {
    get client() {
      return client;
    },
    get user() {
      return mockUser;
    },
  } as unknown as AuthenticatedSupabaseProvider;
}

function createMockEncryption(): EncryptionPort {
  return {
    getUserDEK: jest.fn().mockResolvedValue(Buffer.from('dek')),
    ensureUserDEK: jest.fn().mockResolvedValue(Buffer.from('dek')),
    getDekFor: jest.fn().mockResolvedValue(Buffer.from('dek')),
    decryptAmount: jest.fn(),
    tryDecryptAmount: jest
      .fn()
      .mockImplementation((cipher: string | null, _dek: Buffer, fb: unknown) =>
        typeof cipher === 'string' && cipher.startsWith('enc:')
          ? Number(cipher.slice(4))
          : fb,
      ),
    encryptAmount: jest
      .fn()
      .mockImplementation((amount: number) => `enc:${amount}`),
    decryptRowAmountFields: jest.fn(),
    prepareAmountData: jest.fn(),
    prepareAmountsData: jest.fn(),
    encryptOptionalAmount: jest
      .fn()
      .mockImplementation((amount: number | null | undefined) =>
        Promise.resolve(amount == null ? null : `enc:${amount}`),
      ),
  } as unknown as EncryptionPort;
}

describe('SupabaseSavingsGoalRepository', () => {
  it('findById decrypts target_amount (dedicated field, not generic)', async () => {
    const provider = createMockProvider(() => ({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
        }),
      }),
    }));
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    const result = await repo.findById('goal-1');

    expect(result.targetAmount).toBe(5000); // decrypted from 'enc:5000'
    expect(result.originalTargetAmount).toBeNull();
    expect(result.status).toBe('ACTIVE');
  });

  it('findById throws BusinessException when not found (RLS-hidden)', async () => {
    const provider = createMockProvider(() => ({
      select: () => ({
        eq: () => ({
          single: jest
            .fn()
            .mockResolvedValue({ data: null, error: { message: 'no rows' } }),
        }),
      }),
    }));
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    await expect(repo.findById('missing')).rejects.toThrow(BusinessException);
  });

  it('insert encrypts target_amount and stamps the authenticated user_id', async () => {
    let captured: Record<string, unknown> | undefined;
    const provider = createMockProvider(() => ({
      insert: (row: Record<string, unknown>) => {
        captured = row;
        return {
          select: () => ({
            single: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
          }),
        };
      },
    }));
    const repo = new SupabaseSavingsGoalRepository(
      provider,
      createMockEncryption(),
    );

    await repo.insert({
      name: 'Maison',
      targetAmount: 5000,
      targetDate: '2099-01-01',
      status: 'ACTIVE',
    });

    expect(captured?.target_amount).toBe('enc:5000'); // ciphertext, never plaintext
    expect(captured?.target_amount).not.toBe(5000);
    expect(captured?.user_id).toBe('user-1');
    expect(captured?.status).toBe('ACTIVE');
    expect('priority' in (captured ?? {})).toBe(false); // dropped from product
  });
});
