import { describe, it, expect, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { SupabaseTagRepository } from './supabase-tag.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { TagRow } from '../../domain/tag.entity';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { EncryptionPort } from '@modules/encryption/domain/ports/encryption.port';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

const mockRow: TagRow = {
  id: 'tag-1',
  user_id: 'user-1',
  name: 'Voyage',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
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

const encryption = {
  getDekFor: jest.fn().mockResolvedValue(Buffer.alloc(32)),
  decryptAmount: jest.fn((ciphertext: string) => Number(ciphertext.slice(4))),
} as unknown as EncryptionPort;

describe('SupabaseTagRepository', () => {
  it('findAll returns mapped camelCase entities ordered by name', async () => {
    const provider = createMockProvider(() => ({
      select: () => ({
        order: jest.fn().mockResolvedValue({ data: [mockRow], error: null }),
      }),
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    const result = await repo.findAll();

    expect(result).toEqual([
      {
        id: 'tag-1',
        userId: 'user-1',
        name: 'Voyage',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ]);
  });

  it('findById throws TAG_NOT_FOUND when RLS hides the row', async () => {
    const provider = createMockProvider(() => ({
      select: () => ({
        eq: () => ({
          single: jest
            .fn()
            .mockResolvedValue({ data: null, error: { message: 'no rows' } }),
        }),
      }),
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    await expect(repo.findById('missing')).rejects.toThrow(BusinessException);
    await expect(repo.findById('missing')).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TAG_NOT_FOUND.code,
    });
  });

  it('insert stamps the authenticated user_id', async () => {
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
    const repo = new SupabaseTagRepository(provider, encryption);

    const result = await repo.insert({ name: 'Voyage' });

    expect(captured?.user_id).toBe('user-1');
    expect(captured?.name).toBe('Voyage');
    expect(result.name).toBe('Voyage');
  });

  it('insert maps unique violation (23505) to TAG_ALREADY_EXISTS conflict', async () => {
    const provider = createMockProvider(() => ({
      insert: () => ({
        select: () => ({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate key value' },
          }),
        }),
      }),
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    await expect(repo.insert({ name: 'Voyage' })).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TAG_ALREADY_EXISTS.code,
    });
  });

  it('update maps unique violation (23505) to TAG_ALREADY_EXISTS conflict', async () => {
    const provider = createMockProvider(() => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'duplicate key value' },
            }),
          }),
        }),
      }),
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    await expect(
      repo.update('tag-1', { name: 'Voyage' }),
    ).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TAG_ALREADY_EXISTS.code,
    });
  });

  it('update maps PGRST116 to TAG_NOT_FOUND when the row is absent or hidden by RLS', async () => {
    const provider = createMockProvider(() => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'JSON object requested' },
            }),
          }),
        }),
      }),
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    await expect(
      repo.update('missing', { name: 'Voyage' }),
    ).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TAG_NOT_FOUND.code,
    });
  });

  it('update maps database errors to TAG_UPDATE_FAILED', async () => {
    const provider = createMockProvider(() => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '08006', message: 'connection lost' },
            }),
          }),
        }),
      }),
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    await expect(
      repo.update('tag-1', { name: 'Voyage' }),
    ).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TAG_UPDATE_FAILED.code,
    });
  });

  it('update renames and returns the mapped entity', async () => {
    let captured: Record<string, unknown> | undefined;
    const provider = createMockProvider(() => ({
      update: (row: Record<string, unknown>) => {
        captured = row;
        return {
          eq: () => ({
            select: () => ({
              single: jest.fn().mockResolvedValue({
                data: { ...mockRow, name: 'Santé' },
                error: null,
              }),
            }),
          }),
        };
      },
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    const result = await repo.update('tag-1', { name: 'Santé' });

    expect(captured).toEqual({ name: 'Santé' });
    expect(result.name).toBe('Santé');
  });

  it('delete propagates database errors as TAG_DELETE_FAILED', async () => {
    const provider = createMockProvider(() => ({
      delete: () => ({
        eq: jest
          .fn()
          .mockResolvedValue({ error: { message: 'connection lost' } }),
      }),
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    await expect(repo.delete('tag-1')).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TAG_DELETE_FAILED.code,
    });
  });

  it('delete succeeds idempotently when no visible row exists', async () => {
    const provider = createMockProvider(() => ({
      delete: () => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    await expect(repo.delete('missing')).resolves.toBeUndefined();
  });

  it('findHistoryContributions decrypts direct expense links in the requested periods', async () => {
    const historyResult = (data: unknown[]) => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            eq: jest.fn().mockResolvedValue({ data, error: null }),
          }),
        }),
      }),
    });
    const provider = createMockProvider((table) => {
      if (table === 'monthly_budget') {
        return {
          select: () => ({
            gte: () => ({
              lte: jest.fn().mockResolvedValue({
                data: [
                  { id: 'budget-1', month: 12, year: 2026 },
                  { id: 'budget-2', month: 1, year: 2027 },
                  { id: 'outside', month: 2, year: 2027 },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'budget_line_tag') {
        return historyResult([
          {
            budget_line: {
              amount: 'enc:100',
              budget_id: 'budget-1',
              kind: 'expense',
            },
          },
          {
            budget_line: {
              amount: 'enc:999',
              budget_id: 'budget-1',
              kind: 'income',
            },
          },
        ]);
      }
      return historyResult([
        {
          transaction: {
            amount: 'enc:75',
            budget_id: 'budget-2',
            kind: 'expense',
          },
        },
      ]);
    });
    const repo = new SupabaseTagRepository(provider, encryption);

    const result = await repo.findHistoryContributions(
      'tag-1',
      { month: 12, year: 2026 },
      { month: 1, year: 2027 },
    );

    expect(result).toEqual({
      planned: [{ month: 12, year: 2026, amount: 100 }],
      actual: [{ month: 1, year: 2027, amount: 75 }],
    });
    expect(encryption.decryptAmount).toHaveBeenCalledTimes(2);
  });
});
