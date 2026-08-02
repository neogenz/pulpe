import { describe, expect, it, jest } from 'bun:test';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  fetchTagIds,
  replaceTagLinks,
  updateTaggedEntity,
} from './tag-links.util';

const replaceParams = {
  rpcName: 'replace_transaction_tags' as const,
  entityId: 'transaction-1',
  tagIds: ['tag-1'],
  operation: 'updateTransaction',
  entityType: 'transaction_tag',
  userId: 'user-1',
  fallbackErrorDef: ERROR_DEFINITIONS.TRANSACTION_UPDATE_FAILED,
};

describe('replaceTagLinks', () => {
  for (const [rpcName, idParam] of [
    ['replace_transaction_tags', 'p_transaction_id'],
    ['replace_budget_line_tags', 'p_budget_line_id'],
    ['replace_template_line_tags', 'p_template_line_id'],
  ] as const) {
    it(`should call ${rpcName} with its typed id parameter`, async () => {
      const rpc = jest.fn().mockResolvedValue({ error: null });
      const supabase = {
        rpc,
      } as unknown as AuthenticatedSupabaseClient;

      await replaceTagLinks(supabase, {
        ...replaceParams,
        rpcName,
      });

      expect(rpc).toHaveBeenCalledWith(rpcName, {
        [idParam]: 'transaction-1',
        p_tag_ids: ['tag-1'],
      });
    });
  }

  for (const code of ['23503', '42501']) {
    it(`should map ${code} to TAG_NOT_FOUND`, async () => {
      const error = { code, message: 'tag rejected' };
      const supabase = {
        rpc: jest.fn().mockResolvedValue({ error }),
      } as unknown as AuthenticatedSupabaseClient;

      await expect(
        replaceTagLinks(supabase, replaceParams),
      ).rejects.toMatchObject({
        code: 'ERR_TAG_NOT_FOUND',
        cause: error,
        loggingContext: {
          operation: 'updateTransaction',
          entityId: 'transaction-1',
          entityType: 'transaction_tag',
          userId: 'user-1',
        },
      });
    });
  }

  it('should map other errors to the caller fallback definition', async () => {
    const error = { code: '08006', message: 'connection lost' };
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ error }),
    } as unknown as AuthenticatedSupabaseClient;

    await expect(
      replaceTagLinks(supabase, replaceParams),
    ).rejects.toMatchObject({
      code: 'ERR_TRANSACTION_UPDATE_FAILED',
      cause: error,
    });
  });
});

describe('updateTaggedEntity', () => {
  const params = {
    rpcName: 'update_budget_line_with_tags' as const,
    entityId: 'line-1',
    patch: { name: 'Updated' },
    tagIds: ['tag-1'],
    operation: 'updateBudgetLine',
    entityType: 'budget_line',
    parentNotFoundMessage: 'Budget line not found',
    notFoundErrorDef: ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
    fallbackErrorDef: ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
    duplicateErrorDef: ERROR_DEFINITIONS.BUDGET_LINE_ALREADY_EXISTS,
  };

  it('should return the row from the atomic RPC', async () => {
    const row = { id: 'line-1', name: 'Updated' };
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: row, error: null }),
    } as unknown as AuthenticatedSupabaseClient;

    await expect(updateTaggedEntity(supabase, params)).resolves.toEqual(row);
  });

  it('should map the stable parent error to the entity 404', async () => {
    const error = { code: 'P0001', message: 'Budget line not found' };
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: null, error }),
    } as unknown as AuthenticatedSupabaseClient;

    await expect(updateTaggedEntity(supabase, params)).rejects.toMatchObject({
      code: 'ERR_BUDGET_LINE_NOT_FOUND',
      cause: error,
    });
  });

  for (const code of ['23503', '42501']) {
    it(`should map ${code} to TAG_NOT_FOUND`, async () => {
      const error = { code, message: 'tag rejected' };
      const supabase = {
        rpc: jest.fn().mockResolvedValue({ data: null, error }),
      } as unknown as AuthenticatedSupabaseClient;

      await expect(updateTaggedEntity(supabase, params)).rejects.toMatchObject({
        code: 'ERR_TAG_NOT_FOUND',
        cause: error,
      });
    });
  }

  it('should preserve duplicate conflicts', async () => {
    const error = { code: '23505', message: 'duplicate' };
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: null, error }),
    } as unknown as AuthenticatedSupabaseClient;

    await expect(updateTaggedEntity(supabase, params)).rejects.toMatchObject({
      code: 'ERR_BUDGET_LINE_ALREADY_EXISTS',
      cause: error,
    });
  });

  it('should preserve savings-goal access errors', async () => {
    const error = { code: 'P0001', message: 'Savings goal access denied' };
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: null, error }),
    } as unknown as AuthenticatedSupabaseClient;

    await expect(updateTaggedEntity(supabase, params)).rejects.toMatchObject({
      code: 'ERR_SAVINGS_GOAL_NOT_FOUND',
      cause: error,
    });
  });

  it('should map an arbitrated deadlock to a conflict the client replays', async () => {
    const error = { code: '40P01', message: 'deadlock detected' };
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: null, error }),
    } as unknown as AuthenticatedSupabaseClient;

    await expect(updateTaggedEntity(supabase, params)).rejects.toMatchObject({
      code: 'ERR_CONCURRENT_MODIFICATION',
      cause: error,
    });
  });

  it('should map unexpected errors to the repository fallback', async () => {
    const error = { code: '08006', message: 'connection lost' };
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: null, error }),
    } as unknown as AuthenticatedSupabaseClient;

    await expect(updateTaggedEntity(supabase, params)).rejects.toMatchObject({
      code: 'ERR_BUDGET_LINE_UPDATE_FAILED',
      cause: error,
    });
  });
});

describe('fetchTagIds', () => {
  it('should return tag ids from the junction rows', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: () => ({
          eq: jest.fn().mockResolvedValue({
            data: [{ tag_id: 'tag-1' }, { tag_id: 'tag-2' }],
            error: null,
          }),
        }),
      }),
    } as unknown as AuthenticatedSupabaseClient;

    const result = await fetchTagIds(
      supabase,
      {
        junctionTable: 'transaction_tag',
        fkColumn: 'transaction_id',
      },
      'transaction-1',
      'toggleCheck',
      ERROR_DEFINITIONS.TRANSACTION_UPDATE_FAILED,
    );

    expect(result).toEqual(['tag-1', 'tag-2']);
  });

  it('should wrap a refetch error with the caller fallback definition', async () => {
    const error = { code: '08006', message: 'connection lost' };
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: () => ({
          eq: jest.fn().mockResolvedValue({ data: null, error }),
        }),
      }),
    } as unknown as AuthenticatedSupabaseClient;

    await expect(
      fetchTagIds(
        supabase,
        {
          junctionTable: 'budget_line_tag',
          fkColumn: 'budget_line_id',
        },
        'line-1',
        'toggleCheck',
        ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
      ),
    ).rejects.toMatchObject({
      code: 'ERR_BUDGET_LINE_UPDATE_FAILED',
      cause: error,
      loggingContext: { entityType: 'budget_line_tag' },
    });
  });
});
