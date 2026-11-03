import { describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { POSTGREST_PAGE_SIZE } from '@common/utils/postgrest-pagination';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
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
  const client = {
    from: (table: string) => queues[table]?.shift()?.builder,
  } as unknown as AuthenticatedSupabaseClient;
  const provider = {
    client,
    user: mockUser,
  } as unknown as AuthenticatedSupabaseProvider;
  const port = {
    getDekFor: jest.fn().mockResolvedValue(Buffer.alloc(32)),
    encryptAmount: jest.fn((amount: number) => `enc:${amount}`),
    decryptAmount: jest.fn((ciphertext: string) => Number(ciphertext.slice(4))),
    tryDecryptAmount: jest.fn((ciphertext: string) =>
      Number(ciphertext.slice(4)),
    ),
    ...encryption,
  } as unknown as EncryptionPort;
  return {
    repo: new SupabaseAssetRepository(provider, port),
    encryption: port,
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
    it('decrypts the latest snapshot of each asset, paging past 1000 rows', async () => {
      const firstPage = query((calls) => {
        const [from, to] = calls.find(([m]) => m === 'range')?.[1] as number[];
        expect([from, to]).toEqual([0, POSTGREST_PAGE_SIZE - 1]);
        return {
          data: [
            snapshotRow('a', 300, '2026-11-03T10:00:00Z'),
            ...Array.from({ length: POSTGREST_PAGE_SIZE - 1 }, (_, i) =>
              snapshotRow('a', i, '2026-10-01T10:00:00Z'),
            ),
          ],
          error: null,
        };
      });
      const secondPage = query((calls) => {
        const [from, to] = calls.find(([m]) => m === 'range')?.[1] as number[];
        expect([from, to]).toEqual([
          POSTGREST_PAGE_SIZE,
          2 * POSTGREST_PAGE_SIZE - 1,
        ]);
        return {
          data: [snapshotRow('b', 50, '2026-09-01T10:00:00Z')],
          error: null,
        };
      });
      const { repo, encryption } = createRepository({
        asset: [
          query(() => ({ data: [assetRow('a'), assetRow('b')], error: null })),
        ],
        asset_snapshot: [firstPage, secondPage],
      });

      const assets = await repo.findAllWithLatestValue();

      expect(
        assets.map((a) => [a.id, a.latestValue, a.latestRecordedAt]),
      ).toEqual([
        ['a', 300, '2026-11-03T10:00:00Z'],
        ['b', 50, '2026-09-01T10:00:00Z'],
      ]);
      expect(encryption.decryptAmount).toHaveBeenCalledTimes(2);
      expect(firstPage.argsOf('order')).toEqual([
        ['recorded_at', { ascending: false }],
        ['id', { ascending: true }],
      ]);
    });

    it('carries the dismissal instant of each asset', async () => {
      const { repo } = createRepository({
        asset: [
          query(() => ({
            data: [
              assetRow('a', {
                suggestion_dismissed_at: '2026-11-02T08:00:00Z',
              }),
              assetRow('b'),
            ],
            error: null,
          })),
        ],
        asset_snapshot: [
          query(() => ({
            data: [
              snapshotRow('a', 1, '2026-11-01T10:00:00Z'),
              snapshotRow('b', 2, '2026-11-01T10:00:00Z'),
            ],
            error: null,
          })),
        ],
      });

      const assets = await repo.findAllWithLatestValue();

      expect(assets.map((a) => a.suggestionDismissedAt)).toEqual([
        '2026-11-02T08:00:00Z',
        null,
      ]);
    });

    it('does not swallow a decryption failure', async () => {
      const failure = new Error(
        'Unsupported state or unable to authenticate data',
      );
      const { repo } = createRepository(
        {
          asset: [query(() => ({ data: [assetRow('a')], error: null }))],
          asset_snapshot: [
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

    it('fails with ASSET_FETCH_FAILED on an asset without any snapshot', async () => {
      const { repo } = createRepository({
        asset: [query(() => ({ data: [assetRow('a')], error: null }))],
        asset_snapshot: [query(() => ({ data: [], error: null }))],
      });

      await expect(repo.findAllWithLatestValue()).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ASSET_FETCH_FAILED.code,
      });
    });
  });

  describe('findCheckedLinkedLines', () => {
    function lineRow(id: number, amount: number | null, kind = 'saving') {
      return { id: `line-${id}`, kind, amount: amount && `enc:${amount}` };
    }

    it('reads each asset after its own cutoff and decrypts the amounts', async () => {
      const livret = query(() => ({
        data: [lineRow(1, 500), lineRow(2, 200.5)],
        error: null,
      }));
      const leasing = query(() => ({
        data: [lineRow(3, 400, 'expense')],
        error: null,
      }));
      const { repo, encryption } = createRepository({
        budget_line: [livret, leasing],
      });

      const lines = await repo.findCheckedLinkedLines([
        { assetId: 'livret', since: '2026-11-03T10:00:00+00:00' },
        { assetId: 'leasing', since: '2026-11-04T08:00:00+00:00' },
      ]);

      expect(lines).toEqual([
        { assetId: 'livret', kind: 'saving', amount: 500 },
        { assetId: 'livret', kind: 'saving', amount: 200.5 },
        { assetId: 'leasing', kind: 'expense', amount: 400 },
      ]);
      expect(livret.argsOf('eq')).toEqual([['asset_id', 'livret']]);
      expect(livret.argsOf('gt')).toEqual([
        ['checked_at', '2026-11-03T10:00:00+00:00'],
      ]);
      expect(leasing.argsOf('eq')).toEqual([['asset_id', 'leasing']]);
      expect(leasing.argsOf('gt')).toEqual([
        ['checked_at', '2026-11-04T08:00:00+00:00'],
      ]);
      expect(encryption.tryDecryptAmount).toHaveBeenCalledTimes(3);
    });

    it('counts every line of an asset past the 1000-row PostgREST page', async () => {
      const firstPage = query((calls) => {
        const [from, to] = calls.find(([m]) => m === 'range')?.[1] as number[];
        expect([from, to]).toEqual([0, POSTGREST_PAGE_SIZE - 1]);
        return {
          data: Array.from({ length: POSTGREST_PAGE_SIZE }, (_, i) =>
            lineRow(i, 1),
          ),
          error: null,
        };
      });
      const secondPage = query((calls) => {
        const [from, to] = calls.find(([m]) => m === 'range')?.[1] as number[];
        expect([from, to]).toEqual([
          POSTGREST_PAGE_SIZE,
          2 * POSTGREST_PAGE_SIZE - 1,
        ]);
        return {
          data: Array.from({ length: 5 }, (_, i) => lineRow(10_000 + i, 2)),
          error: null,
        };
      });
      const { repo } = createRepository({
        budget_line: [firstPage, secondPage],
      });

      const lines = await repo.findCheckedLinkedLines([
        { assetId: 'livret', since: '2026-11-03T10:00:00+00:00' },
      ]);

      expect(lines).toHaveLength(POSTGREST_PAGE_SIZE + 5);
      expect(lines.reduce((sum, line) => sum + line.amount, 0)).toBe(
        POSTGREST_PAGE_SIZE + 10,
      );
      expect(firstPage.argsOf('order')).toEqual([['id', { ascending: true }]]);
    });

    it('does not query anything without an active asset', async () => {
      const { repo } = createRepository({ budget_line: [] });

      await expect(repo.findCheckedLinkedLines([])).resolves.toEqual([]);
    });

    it('reads a line without a stored amount as zero', async () => {
      const { repo, encryption } = createRepository({
        budget_line: [query(() => ({ data: [lineRow(1, null)], error: null }))],
      });

      const lines = await repo.findCheckedLinkedLines([
        { assetId: 'livret', since: '2026-11-03T10:00:00+00:00' },
      ]);

      expect(lines).toEqual([{ assetId: 'livret', kind: 'saving', amount: 0 }]);
      expect(encryption.tryDecryptAmount).not.toHaveBeenCalled();
    });

    it('fails with ASSET_FETCH_FAILED when a read fails', async () => {
      const { repo } = createRepository({
        budget_line: [
          query(() => ({
            data: null,
            error: { code: '08006', message: 'down' },
          })),
        ],
      });

      await expect(
        repo.findCheckedLinkedLines([
          { assetId: 'livret', since: '2026-11-03T10:00:00+00:00' },
        ]),
      ).rejects.toMatchObject({
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

    it('writes the asset then its encrypted first snapshot', async () => {
      const assetInsert = query(() => ({
        data: assetRow('new', { currency: 'EUR' }),
        error: null,
      }));
      const snapshotInsert = query(() => ({
        data: [{ recorded_at: '2026-11-03T10:00:00Z' }],
        error: null,
      }));
      const { repo } = createRepository({
        asset: [assetInsert],
        asset_snapshot: [snapshotInsert],
      });

      const asset = await repo.insertAsset(input);

      expect(asset).toMatchObject({
        id: 'new',
        currency: 'EUR',
        direction: 'own',
      });
      expect(assetInsert.argsOf('insert')[0]?.[0]).toMatchObject({
        user_id: 'user-1',
        category_id: 'cat-1',
        in_pulpe: false,
      });
      expect(snapshotInsert.argsOf('insert')[0]?.[0]).toEqual([
        { user_id: 'user-1', asset_id: 'new', value: 'enc:1000' },
      ]);
    });

    it('deletes the asset again when the first snapshot cannot be written', async () => {
      const compensation = query();
      const { repo } = createRepository({
        asset: [
          query(() => ({ data: assetRow('new'), error: null })),
          compensation,
        ],
        asset_snapshot: [
          query(() => ({
            data: null,
            error: { code: '08006', message: 'down' },
          })),
        ],
      });

      await expect(repo.insertAsset(input)).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ASSET_CREATE_FAILED.code,
      });
      expect(compensation.argsOf('delete')).toHaveLength(1);
      expect(compensation.argsOf('eq')[0]).toEqual(['id', 'new']);
    });

    it('maps a composite foreign key violation to ASSET_CATEGORY_NOT_FOUND', async () => {
      const { repo } = createRepository({
        asset: [
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
  });

  describe('update', () => {
    it('writes the dismissal instant and leaves the other columns out', async () => {
      const update = query(() => ({ data: assetRow('a'), error: null }));
      const { repo } = createRepository({ asset: [update] });

      await repo.update('a', { suggestionDismissedAt: '2026-11-03T10:00:00Z' });

      expect(
        JSON.parse(JSON.stringify(update.argsOf('update')[0]?.[0])),
      ).toEqual({ suggestion_dismissed_at: '2026-11-03T10:00:00Z' });
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
