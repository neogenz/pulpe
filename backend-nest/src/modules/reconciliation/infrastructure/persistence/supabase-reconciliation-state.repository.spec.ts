import { describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import { SupabaseReconciliationStateRepository } from './supabase-reconciliation-state.repository';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

type Result = { data: unknown; error: unknown };

/** A PostgREST builder stand-in: records every call, resolves `result`. */
function builder(result: Result) {
  const calls: [string, unknown[]][] = [];
  const proxy: unknown = new Proxy(
    {},
    {
      get: (_t, method: string) =>
        method === 'then'
          ? (resolve: (value: Result) => void) => resolve(result)
          : method === 'single'
            ? () => Promise.resolve(result)
            : (...args: unknown[]) => {
                calls.push([method, args]);
                return proxy;
              },
    },
  );
  return { proxy, calls };
}

function build(result: Result) {
  const query = builder(result);
  const provider = {
    client: { from: jest.fn(() => query.proxy) },
    user,
  } as unknown as AuthenticatedSupabaseProvider;
  return { query, repo: new SupabaseReconciliationStateRepository(provider) };
}

describe('SupabaseReconciliationStateRepository', () => {
  it('should write the completion time and never starting_amount', async () => {
    const { repo, query } = build({
      data: { last_completed_at: '2026-11-21T10:00:00.000Z' },
      error: null,
    });

    await repo.upsert({ lastCompletedAt: '2026-11-21T10:00:00.000Z' });

    expect(query.calls.find(([m]) => m === 'upsert')?.[1][0]).toEqual({
      user_id: 'user-1',
      last_completed_at: '2026-11-21T10:00:00.000Z',
    });
  });

  it('should wrap a database failure', async () => {
    const { repo } = build({ data: null, error: { message: 'boom' } });

    await expect(repo.upsert({ lastCompletedAt: 'x' })).rejects.toBeInstanceOf(
      BusinessException,
    );
  });
});
