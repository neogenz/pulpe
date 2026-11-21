import { describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { EncryptionPort } from '@modules/encryption/domain/ports/encryption.port';
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
          : method === 'maybeSingle' || method === 'single'
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
  const encryption = {
    getDekFor: jest.fn().mockResolvedValue(Buffer.alloc(32)),
    encryptAmount: jest.fn((amount: number) => `enc:${amount}`),
    decryptAmount: jest.fn((cipher: string) => Number(cipher.slice(4))),
  } as unknown as EncryptionPort;
  return {
    query,
    encryption,
    repo: new SupabaseReconciliationStateRepository(provider, encryption),
  };
}

describe('SupabaseReconciliationStateRepository', () => {
  it('should default to 0 and null when the person has no row', async () => {
    const { repo, encryption } = build({ data: null, error: null });

    expect(await repo.get()).toEqual({
      startingAmount: 0,
      lastCompletedAt: null,
    });
    expect(encryption.getDekFor).not.toHaveBeenCalled();
  });

  it('should decrypt the stored amount', async () => {
    const { repo } = build({
      data: {
        starting_amount: 'enc:3100',
        last_completed_at: '2026-11-01T10:00:00.000Z',
      },
      error: null,
    });

    expect(await repo.get()).toEqual({
      startingAmount: 3100,
      lastCompletedAt: '2026-11-01T10:00:00.000Z',
    });
  });

  it('should write a ciphertext, never the plain amount', async () => {
    const { repo, query } = build({
      data: { starting_amount: 'enc:3100', last_completed_at: null },
      error: null,
    });

    const state = await repo.upsert({ startingAmount: 3100 });

    expect(query.calls.find(([m]) => m === 'upsert')?.[1][0]).toEqual({
      user_id: 'user-1',
      starting_amount: 'enc:3100',
    });
    expect(state.startingAmount).toBe(3100);
  });

  it('should not touch starting_amount when the patch has no amount', async () => {
    const { repo, query, encryption } = build({
      data: { starting_amount: 'enc:3100', last_completed_at: 'x' },
      error: null,
    });

    await repo.upsert({ lastCompletedAt: '2026-11-21T10:00:00.000Z' });

    expect(query.calls.find(([m]) => m === 'upsert')?.[1][0]).toEqual({
      user_id: 'user-1',
      last_completed_at: '2026-11-21T10:00:00.000Z',
    });
    expect(encryption.encryptAmount).not.toHaveBeenCalled();
  });

  it('should tell whether the budget is the person’s', async () => {
    expect(
      await build({ data: { id: 'b' }, error: null }).repo.budgetExists('b'),
    ).toBe(true);
    expect(
      await build({ data: null, error: null }).repo.budgetExists('b'),
    ).toBe(false);
  });

  it('should wrap a database failure', async () => {
    const { repo } = build({ data: null, error: { message: 'boom' } });

    await expect(repo.upsert({ lastCompletedAt: 'x' })).rejects.toBeInstanceOf(
      BusinessException,
    );
  });
});
