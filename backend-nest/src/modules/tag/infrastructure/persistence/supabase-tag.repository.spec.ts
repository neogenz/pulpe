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
    const eq = jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue({ data: [mockRow], error: null }),
    });
    const provider = createMockProvider(() => ({
      select: () => ({
        eq,
      }),
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    const result = await repo.findAll();

    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
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
    const hiddenError = {
      code: 'PGRST116',
      message: 'JSON object requested, multiple (or no) rows returned',
    };
    const eq = jest.fn();
    const query = {
      eq,
      single: jest.fn().mockResolvedValue({ data: null, error: hiddenError }),
    };
    eq.mockReturnValue(query);
    const provider = createMockProvider(() => ({
      select: () => query,
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    await expect(repo.findById('missing')).rejects.toThrow(BusinessException);
    await expect(repo.findById('missing')).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TAG_NOT_FOUND.code,
      cause: hiddenError,
    });
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('findById preserves technical Supabase errors as TAG_FETCH_FAILED causes', async () => {
    const dbError = { code: '08006', message: 'connection lost' };
    const eq = jest.fn();
    const query = {
      eq,
      single: jest.fn().mockResolvedValue({ data: null, error: dbError }),
    };
    eq.mockReturnValue(query);
    const provider = createMockProvider(() => ({
      select: () => query,
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    const result = repo.findById('tag-1');

    await expect(result).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TAG_FETCH_FAILED.code,
      cause: dbError,
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
    const eq = jest.fn();
    const query = {
      eq,
      select: () => ({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key value' },
        }),
      }),
    };
    eq.mockReturnValue(query);
    const provider = createMockProvider(() => ({
      update: () => query,
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    await expect(
      repo.update('tag-1', { name: 'Voyage' }),
    ).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TAG_ALREADY_EXISTS.code,
    });
  });

  it('update maps PGRST116 to TAG_NOT_FOUND when the row is absent or hidden by RLS', async () => {
    const eq = jest.fn();
    const query = {
      eq,
      select: () => ({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'JSON object requested' },
        }),
      }),
    };
    eq.mockReturnValue(query);
    const provider = createMockProvider(() => ({
      update: () => query,
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    await expect(
      repo.update('missing', { name: 'Voyage' }),
    ).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TAG_NOT_FOUND.code,
    });
  });

  it('update maps database errors to TAG_UPDATE_FAILED', async () => {
    const eq = jest.fn();
    const query = {
      eq,
      select: () => ({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '08006', message: 'connection lost' },
        }),
      }),
    };
    eq.mockReturnValue(query);
    const provider = createMockProvider(() => ({
      update: () => query,
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
    const eq = jest.fn();
    const query = {
      eq,
      select: () => ({
        single: jest.fn().mockResolvedValue({
          data: { ...mockRow, name: 'Santé' },
          error: null,
        }),
      }),
    };
    eq.mockReturnValue(query);
    const provider = createMockProvider(() => ({
      update: (row: Record<string, unknown>) => {
        captured = row;
        return query;
      },
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    const result = await repo.update('tag-1', { name: 'Santé' });

    expect(captured).toEqual({ name: 'Santé' });
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result.name).toBe('Santé');
  });

  it('delete propagates database errors as TAG_DELETE_FAILED', async () => {
    const cleanupError = { message: 'connection lost' };
    const eq = jest.fn();
    const query = { eq };
    eq.mockImplementation(() =>
      eq.mock.calls.length === 2
        ? Promise.resolve({ error: cleanupError })
        : query,
    );
    const provider = createMockProvider(() => ({
      delete: () => query,
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    await expect(repo.delete('tag-1')).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TAG_DELETE_FAILED.code,
    });
  });

  it('delete succeeds idempotently when no visible row exists', async () => {
    const eq = jest.fn();
    const query = { eq };
    eq.mockImplementation(() =>
      eq.mock.calls.length === 2 ? Promise.resolve({ error: null }) : query,
    );
    const provider = createMockProvider(() => ({
      delete: () => query,
    }));
    const repo = new SupabaseTagRepository(provider, encryption);

    await expect(repo.delete('missing')).resolves.toBeUndefined();
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('findHistoryContributions decrypts direct expense links in the requested periods', async () => {
    let capturedBudgetUserFilter:
      | { column: string; value: unknown }
      | undefined;
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
            eq: (column: string, value: unknown) => {
              capturedBudgetUserFilter = { column, value };
              return {
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
              };
            },
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
    expect(capturedBudgetUserFilter).toEqual({
      column: 'user_id',
      value: 'user-1',
    });
    expect(encryption.decryptAmount).toHaveBeenCalledTimes(2);
  });

  it('findHistoryContributions includes the user id when history loading fails', async () => {
    const dbError = { code: '08006', message: 'connection lost' };
    const provider = createMockProvider((table) => {
      if (table !== 'monthly_budget') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: jest.fn().mockResolvedValue({ data: null, error: dbError }),
            }),
          }),
        }),
      };
    });
    const repo = new SupabaseTagRepository(provider, encryption);

    await expect(
      repo.findHistoryContributions(
        'tag-1',
        { month: 1, year: 2026 },
        { month: 3, year: 2026 },
      ),
    ).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TAG_FETCH_FAILED.code,
      cause: dbError,
      loggingContext: {
        operation: 'getTagHistory',
        entityId: 'tag-1',
        entityType: 'tag',
        userId: 'user-1',
      },
    });
  });
});
