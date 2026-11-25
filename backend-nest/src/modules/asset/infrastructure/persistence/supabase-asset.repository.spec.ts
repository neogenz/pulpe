import { describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { POSTGREST_PAGE_SIZE } from '@common/utils/postgrest-pagination';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { InfoLogger } from '@common/logger';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { EncryptionPort } from '@modules/encryption/domain/ports/encryption.port';
import type { AssetRow } from '../../domain/asset.entity';
import { SupabaseAssetRepository } from './supabase-asset.repository';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

type Result = { data: unknown; error: unknown };
type Call = [method: string, args: unknown[]];

/**
 * A PostgREST query builder stand-in: every method returns the builder and
 * records its call; awaiting it resolves `respond` with the calls so far.
 */
function query(
  respond: (calls: Call[]) => Result = () => ({
    data: [],
    error: null,
  }),
) {
  const calls: Call[] = [];
  const builder: unknown = new Proxy(
    {},
    {
      get: (_target, method: string) =>
        method === 'then'
          ? (resolve: (value: Result) => void) => resolve(respond(calls))
          : (...args: unknown[]) => {
              calls.push([method, args]);
              return builder;
            },
    },
  );
  const argsOf = (method: string) =>
    calls.filter(([name]) => name === method).map(([, args]) => args);
  return { builder, calls, argsOf };
}

function createRepository(
  tables: Record<string, ReturnType<typeof query>[]>,
  encryption: Partial<EncryptionPort> = {},
) {
  const queues = Object.fromEntries(
    Object.entries(tables).map(([table, list]) => [table, [...list]]),
  );
  // An RPC is queued under `rpc:<name>`; its arguments are recorded as a call.
  const client = {
    from: (table: string) => queues[table]?.shift()?.builder,
    rpc: (name: string, args: unknown) => {
      const rpc = queues[`rpc:${name}`]?.shift();
      rpc?.calls.push(['rpc', [args]]);
      return rpc?.builder;
    },
  } as unknown as AuthenticatedSupabaseClient;
  const provider = {
    client,
    user: mockUser,
  } as unknown as AuthenticatedSupabaseProvider;
  const port = {
    getDekFor: jest.fn().mockResolvedValue(Buffer.alloc(32)),
    encryptAmount: jest.fn((amount: number) => `enc:${amount}`),
    decryptAmount: jest.fn((ciphertext: string) => Number(ciphertext.slice(4))),
    ...encryption,
  } as unknown as EncryptionPort;
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    trace: jest.fn(),
  } as unknown as InfoLogger;
  return {
    repo: new SupabaseAssetRepository(provider, port, logger),
    encryption: port,
    logger,
  };
}

function assetRow(id: string, overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id,
    user_id: 'user-1',
    category_id: 'cat-1',
    name: id,
    currency: 'CHF',
    direction: 'own',
    in_pulpe: false,
    archived_at: null,
    suggestion_dismissed_at: null,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

function snapshotRow(assetId: string, value: number, recordedAt: string) {
  return { asset_id: assetId, value: `enc:${value}`, recorded_at: recordedAt };
}

describe('SupabaseAssetRepository', () => {
  describe('insertSnapshots', () => {
    it('writes ciphertext in one insert and returns the shared recorded_at', async () => {
      const insert = query(() => ({
        data: [
          { recorded_at: '2026-11-03T10:00:00Z' },
          { recorded_at: '2026-11-03T10:00:00Z' },
        ],
        error: null,
      }));
      const { repo, encryption } = createRepository({
        asset_snapshot: [insert],
      });

      const recordedAt = await repo.insertSnapshots([
        { assetId: 'a', value: 1500.5 },
        { assetId: 'b', value: -200 },
      ]);

      expect(recordedAt).toBe('2026-11-03T10:00:00Z');
      expect(insert.argsOf('insert')).toEqual([
        [
          [
            { user_id: 'user-1', asset_id: 'a', value: 'enc:1500.5' },
            { user_id: 'user-1', asset_id: 'b', value: 'enc:-200' },
          ],
        ],
      ]);
      expect(encryption.encryptAmount).toHaveBeenCalledTimes(2);
    });

    it('maps a foreign key violation to ASSET_NOT_FOUND', async () => {
      const { repo } = createRepository({
        asset_snapshot: [
          query(() => ({
            data: null,
            error: { code: '23503', message: 'fk' },
          })),
        ],
      });

      await expect(
        repo.insertSnapshots([{ assetId: 'gone', value: 1 }]),
      ).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ASSET_NOT_FOUND.code,
      });
    });
  });

  describe('findAllWithLatestValue', () => {
    it('decrypts the current value of each asset from the latest-snapshot view', async () => {
      const latest = query(() => ({
        data: [
          snapshotRow('a', 300, '2026-11-03T10:00:00Z'),
          snapshotRow('b', 50, '2026-09-01T10:00:00Z'),
        ],
        error: null,
      }));
      const { repo, encryption } = createRepository({
        asset: [
          query(() => ({ data: [assetRow('a'), assetRow('b')], error: null })),
        ],
        asset_latest_snapshot: [latest],
      });

      const assets = await repo.findAllWithLatestValue();

      expect(
        assets.map((a) => [a.id, a.recordedValue, a.latestRecordedAt]),
      ).toEqual([
        ['a', 300, '2026-11-03T10:00:00Z'],
        ['b', 50, '2026-09-01T10:00:00Z'],
      ]);
      expect(encryption.decryptAmount).toHaveBeenCalledTimes(2);
      expect(latest.argsOf('eq')).toEqual([['user_id', 'user-1']]);
    });

    it('does not swallow a decryption failure', async () => {
      const failure = new Error(
        'Unsupported state or unable to authenticate data',
      );
      const { repo } = createRepository(
        {
          asset: [query(() => ({ data: [assetRow('a')], error: null }))],
          asset_latest_snapshot: [
            query(() => ({
              data: [snapshotRow('a', 1, '2026-11-03T10:00:00Z')],
              error: null,
            })),
          ],
        },
        {
          decryptAmount: jest.fn(() => {
            throw failure;
          }),
        },
      );

      await expect(repo.findAllWithLatestValue()).rejects.toBe(failure);
    });

    it('leaves out an asset without any snapshot and keeps the others', async () => {
      const { repo, logger } = createRepository({
        asset: [
          query(() => ({
            data: [assetRow('orphan'), assetRow('a')],
            error: null,
          })),
        ],
        asset_latest_snapshot: [
          query(() => ({
            data: [snapshotRow('a', 5, '2026-11-03T10:00:00Z')],
            error: null,
          })),
        ],
      });

      const assets = await repo.findAllWithLatestValue();

      expect(assets.map((asset) => asset.id)).toEqual(['a']);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('findMovementsSince', () => {
    const SINCE = '2026-11-03T10:00:00+00:00';
    const CHECKED = '2026-11-05T09:00:00+00:00';

    function movementRow(
      movement: 'line' | 'real' | 'free',
      id: string,
      amount: number | null,
      overrides: Record<string, unknown> = {},
    ) {
      return {
        movement,
        id,
        budget_line_id: null,
        kind: 'expense',
        amount: amount === null ? null : `enc:${amount}`,
        checked_at: CHECKED,
        account_id: null,
        asset_id: null,
        ...overrides,
      };
    }

    it('reads every movement in one call and hangs the checked movements on their prévision', async () => {
      // « Courses » 400 on the Compte courant, unchecked, with 120 checked
      // (CA17), and the imprévu « Restaurant » 80 (CA5).
      const rpc = query(() => ({
        data: [
          movementRow('line', 'courses', 400, {
            checked_at: null,
            account_id: 'compte-courant',
          }),
          movementRow('real', 'real-1', 120, { budget_line_id: 'courses' }),
          movementRow('free', 'restaurant', 80, {
            account_id: 'compte-courant',
          }),
        ],
        error: null,
      }));
      const { repo } = createRepository({
        'rpc:list_asset_movements': [rpc],
      });

      const result = await repo.findMovementsSince(SINCE);

      expect(result).toEqual({
        lines: [
          {
            id: 'courses',
            kind: 'expense',
            amount: 400,
            checkedAt: null,
            accountId: 'compte-courant',
            assetId: null,
            checkedReals: [{ amount: 120, checkedAt: CHECKED }],
          },
        ],
        freeMovements: [
          {
            accountId: 'compte-courant',
            kind: 'expense',
            amount: 80,
            checkedAt: CHECKED,
          },
        ],
      });
      expect(rpc.argsOf('rpc')).toEqual([[{ p_since: SINCE }]]);
    });

    it('counts every movement past the 1000-row PostgREST page', async () => {
      const page = (from: number, length: number) =>
        query((calls) => {
          const [start] = calls.find(([m]) => m === 'range')?.[1] as number[];
          expect(start).toBe(from);
          return {
            data: Array.from({ length }, (_, i) =>
              movementRow('free', `free-${from + i}`, 1, {
                account_id: 'compte-courant',
              }),
            ),
            error: null,
          };
        });
      const firstPage = page(0, POSTGREST_PAGE_SIZE);
      const { repo } = createRepository({
        'rpc:list_asset_movements': [firstPage, page(POSTGREST_PAGE_SIZE, 5)],
      });

      const { freeMovements } = await repo.findMovementsSince(SINCE);

      expect(freeMovements).toHaveLength(POSTGREST_PAGE_SIZE + 5);
      expect(firstPage.argsOf('order')).toEqual([['id', { ascending: true }]]);
    });

    it('skips a movement without a stored amount, which moves no value', async () => {
      const { repo, encryption } = createRepository({
        'rpc:list_asset_movements': [
          query(() => ({
            data: [
              movementRow('line', 'line-1', null, { account_id: 'a' }),
              movementRow('real', 'real-1', null, { budget_line_id: 'x' }),
              movementRow('free', 'free-1', null, { account_id: 'a' }),
            ],
            error: null,
          })),
        ],
      });

      await expect(repo.findMovementsSince(SINCE)).resolves.toEqual({
        lines: [],
        freeMovements: [],
      });
      expect(encryption.decryptAmount).not.toHaveBeenCalled();
    });

    it('does not read an undecryptable amount as zero', async () => {
      const failure = new Error(
        'Unsupported state or unable to authenticate data',
      );
      const { repo } = createRepository(
        {
          'rpc:list_asset_movements': [
            query(() => ({
              data: [movementRow('free', 'free-1', 80, { account_id: 'a' })],
              error: null,
            })),
          ],
        },
        {
          decryptAmount: jest.fn(() => {
            throw failure;
          }),
        },
      );

      await expect(repo.findMovementsSince(SINCE)).rejects.toBe(failure);
    });

    it('fails with ASSET_FETCH_FAILED when the read fails', async () => {
      const { repo } = createRepository({
        'rpc:list_asset_movements': [
          query(() => ({
            data: null,
            error: { code: '08006', message: 'down' },
          })),
        ],
      });

      await expect(repo.findMovementsSince(SINCE)).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ASSET_FETCH_FAILED.code,
      });
    });
  });

  describe('insertAsset', () => {
    const input = {
      name: 'Livret',
      categoryId: 'cat-1',
      currency: 'EUR' as const,
      direction: 'own' as const,
      inPulpe: false,
      value: 1000,
    };

    it('writes the asset and its encrypted first value in one call', async () => {
      const create = query(() => ({
        data: assetRow('new', { currency: 'EUR' }),
        error: null,
      }));
      const { repo } = createRepository({
        'rpc:create_asset_with_first_snapshot': [create],
      });

      const asset = await repo.insertAsset(input);

      expect(asset).toMatchObject({
        id: 'new',
        currency: 'EUR',
        direction: 'own',
      });
      expect(create.argsOf('rpc')).toEqual([
        [
          {
            p_category_id: 'cat-1',
            p_name: 'Livret',
            p_currency: 'EUR',
            p_direction: 'own',
            p_in_pulpe: false,
            p_value: 'enc:1000',
          },
        ],
      ]);
    });

    it('maps a composite foreign key violation to ASSET_CATEGORY_NOT_FOUND', async () => {
      const { repo } = createRepository({
        'rpc:create_asset_with_first_snapshot': [
          query(() => ({
            data: null,
            error: { code: '23503', message: 'fk' },
          })),
        ],
      });

      await expect(repo.insertAsset(input)).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ASSET_CATEGORY_NOT_FOUND.code,
      });
    });

    it('fails with ASSET_CREATE_FAILED when the write fails', async () => {
      const { repo } = createRepository({
        'rpc:create_asset_with_first_snapshot': [
          query(() => ({
            data: null,
            error: { code: '08006', message: 'down' },
          })),
        ],
      });

      await expect(repo.insertAsset(input)).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ASSET_CREATE_FAILED.code,
      });
    });
  });

  describe('update', () => {
    it('writes only the fields of the patch', async () => {
      const update = query(() => ({ data: assetRow('a'), error: null }));
      const { repo } = createRepository({ asset: [update] });

      await repo.update('a', { name: 'Livret B' });

      expect(
        JSON.parse(JSON.stringify(update.argsOf('update')[0]?.[0])),
      ).toEqual({ name: 'Livret B' });
    });
  });

  describe('not found and conflicts', () => {
    it('update throws ASSET_NOT_FOUND when RLS hides the row', async () => {
      const { repo } = createRepository({
        asset: [
          query(() => ({
            data: null,
            error: { code: 'PGRST116', message: 'no rows' },
          })),
        ],
      });

      await expect(
        repo.update('other', { inPulpe: true }),
      ).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ASSET_NOT_FOUND.code,
      });
    });

    it('delete throws ASSET_NOT_FOUND when no row was deleted', async () => {
      const { repo } = createRepository({
        asset: [query(() => ({ data: [], error: null }))],
      });

      const result = repo.delete('other');

      await expect(result).rejects.toBeInstanceOf(BusinessException);
      await expect(result).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ASSET_NOT_FOUND.code,
      });
    });

    it('insertCategory maps a unique violation to ASSET_CATEGORY_DUPLICATE', async () => {
      const { repo } = createRepository({
        asset_category: [
          query(() => ({
            data: null,
            error: { code: '23505', message: 'dup' },
          })),
        ],
      });

      await expect(repo.insertCategory('Comptes')).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ASSET_CATEGORY_DUPLICATE.code,
      });
    });

    it('deleteCategory maps the RESTRICT violation to ASSET_CATEGORY_NOT_EMPTY', async () => {
      const { repo } = createRepository({
        asset_category: [
          query(() => ({
            data: null,
            error: { code: '23503', message: 'fk' },
          })),
        ],
      });

      await expect(repo.deleteCategory('cat-1')).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ASSET_CATEGORY_NOT_EMPTY.code,
      });
    });

    it('deleteCategory throws ASSET_CATEGORY_NOT_FOUND when no row was deleted', async () => {
      const { repo } = createRepository({
        asset_category: [query(() => ({ data: [], error: null }))],
      });

      await expect(repo.deleteCategory('other')).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ASSET_CATEGORY_NOT_FOUND.code,
      });
    });
  });
});
