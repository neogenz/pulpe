import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { UserRepositoryPort } from '@modules/user/domain/ports/user-repository.port';
import type { AssetRepositoryPort } from '../domain/ports/asset-repository.port';
import type { ExchangeRatePort } from '../domain/ports/exchange-rate.port';
import type {
  AssetHistoryEntry,
  AssetMovements,
  AssetSnapshot,
  AssetWithValue,
  MovementLine,
} from '../domain/asset.entity';
import { GetAssetHistoryUseCase } from './get-asset-history.use-case';
import { GetNetWorthUseCase } from './get-net-worth.use-case';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

const COURANT_ID = '00000000-0000-4000-8000-0000000000c0';
const LIVRET_ID = '00000000-0000-4000-8000-0000000000c1';
const OCT_1 = '2026-10-01T08:00:00.000Z';
const NOV_1 = '2026-11-01T08:00:00.000Z';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function asset(overrides: Partial<AssetWithValue>): AssetWithValue {
  return {
    id: COURANT_ID,
    categoryId: 'cat-1',
    name: 'Compte courant',
    currency: 'CHF',
    direction: 'own',
    inPulpe: true,
    archivedAt: null,
    recordedValue: 5_000,
    latestRecordedAt: NOV_1,
    ...overrides,
  };
}

function line(
  n: number,
  name: string,
  kind: MovementLine['kind'],
  amount: number,
  checkedAt: string,
): MovementLine {
  return {
    id: uuid(n),
    name,
    kind,
    amount,
    checkedAt,
    accountId: COURANT_ID,
    assetId: null,
    checkedReals: [],
  };
}

// PUL-379 jeu d'essai: entries of 4 800 on 1 October and 5 000 on 1 November.
const SNAPSHOTS: AssetSnapshot[] = [
  { id: uuid(1), value: 4_800, recordedAt: OCT_1 },
  { id: uuid(2), value: 5_000, recordedAt: NOV_1 },
];

function contractMovements(): AssetMovements {
  return {
    lines: [
      line(10, 'Assurance', 'expense', 300, '2026-10-28T10:00:00.000Z'),
      line(11, 'Loyer', 'expense', 1_500, '2026-11-03T10:00:00.000Z'),
      line(12, 'Salaire', 'income', 6_000, '2026-11-10T10:00:00.000Z'),
    ],
    freeMovements: [
      {
        id: uuid(13),
        name: 'Restaurant',
        accountId: COURANT_ID,
        kind: 'expense',
        amount: 80,
        checkedAt: '2026-11-05T10:00:00.000Z',
      },
    ],
  };
}

function label(entry: AssetHistoryEntry) {
  return entry.type === 'snapshot' ? `saisie ${entry.value}` : entry.name;
}

describe('GetAssetHistoryUseCase', () => {
  let assets: AssetWithValue[];
  let movements: AssetMovements;
  let findMovementsSince: ReturnType<typeof jest.fn>;
  let getRate: ReturnType<typeof jest.fn>;
  let logger: {
    info: jest.Mock;
    debug: jest.Mock;
    warn: jest.Mock;
    trace: jest.Mock;
  };
  let repo: AssetRepositoryPort;
  let userRepo: UserRepositoryPort;
  let useCase: GetAssetHistoryUseCase;

  beforeEach(() => {
    assets = [
      asset({}),
      asset({ id: LIVRET_ID, name: 'Livret', recordedValue: 10_000 }),
    ];
    movements = contractMovements();
    findMovementsSince = jest.fn(async () => movements);
    getRate = jest.fn();
    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      trace: jest.fn(),
    };
    repo = {
      findAllCategories: jest.fn(async () => []),
      findAllWithLatestValue: jest.fn(async () => assets),
      findSnapshots: jest.fn(async () => SNAPSHOTS),
      findMovementsSince,
    } as unknown as AssetRepositoryPort;
    userRepo = {
      findSettings: jest.fn(async () => ({ currency: 'CHF' })),
    } as unknown as UserRepositoryPort;
    useCase = new GetAssetHistoryUseCase(
      repo,
      userRepo,
      { getRate } as unknown as ExchangeRatePort,
      logger,
    );
  });

  const read = (cursor?: string, limit = 30) =>
    useCase.execute(COURANT_ID, { limit, cursor }, user);

  it('CA2: the header is the Compte courant at 9 420, last entry 5 000 on 1 November, as on Mon patrimoine', async () => {
    const netWorth = await new GetNetWorthUseCase(
      repo,
      userRepo,
      { getRate } as unknown as ExchangeRatePort,
      logger,
    ).execute(user);

    const { asset: header } = await read();

    expect(header).toMatchObject({
      name: 'Compte courant',
      value: 9_420,
      recordedValue: 5_000,
      latestRecordedAt: NOV_1,
    });
    expect(header).toEqual(netWorth.assets[0]!);
  });

  it('reads the movements of this asset only, since its first entry', async () => {
    await read();

    expect(findMovementsSince).toHaveBeenCalledWith(OCT_1, COURANT_ID);
  });

  it('CA3, CA5: the whole history in one page, the effects above the last entry adding up to 4 420', async () => {
    const { asset: header, entries, nextCursor } = await read();

    expect(entries.map(label)).toEqual([
      'Salaire',
      'Restaurant',
      'Loyer',
      'saisie 5000',
      'Assurance',
      'saisie 4800',
    ]);
    expect(nextCursor).toBeNull();
    const open = entries.reduce(
      (sum, entry) =>
        entry.type === 'movement' && entry.supersededAt === null
          ? sum + (entry.effect ?? 0)
          : sum,
      0,
    );
    expect(open).toBe(4_420);
    expect(open).toBe(header.value - header.recordedValue);
  });

  it('CA11: pages of 2 follow each other until nextCursor is null', async () => {
    const pages: string[][] = [];
    let cursor: string | undefined;
    do {
      const page = await read(cursor, 2);
      pages.push(page.entries.map(label));
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);

    expect(pages).toEqual([
      ['Salaire', 'Restaurant'],
      ['Loyer', 'saisie 5000'],
      ['Assurance', 'saisie 4800'],
    ]);
  });

  it('CA11: a movement checked between two pages goes on top and does not shift the next page', async () => {
    const first = await read(undefined, 2);
    movements.lines.push(
      line(14, 'Remboursement', 'income', 50, '2026-11-20T10:00:00.000Z'),
    );

    const second = await read(first.nextCursor ?? undefined, 2);

    expect(second.entries.map(label)).toEqual(['Loyer', 'saisie 5000']);
    expect((await read(undefined, 2)).entries.map(label)).toEqual([
      'Remboursement',
      'Salaire',
    ]);
  });

  it('CA11: a cursor past the last entry gives an empty last page', async () => {
    const page = await read(`0.1.${uuid(99)}`, 2);

    expect(page).toMatchObject({ entries: [], nextCursor: null });
  });

  it.each([
    ['archived', { archivedAt: '2026-11-15T00:00:00.000Z' }],
    ['unknown or another user’s', { id: uuid(42) }],
  ])('CA15: an %s asset has no detail (404)', async (_, overrides) => {
    assets = [asset(overrides)];

    await expect(read()).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.ASSET_NOT_FOUND.code,
    });
    expect(findMovementsSince).not.toHaveBeenCalled();
  });

  it("CA14: a EUR asset shows its effects in euros at today's rate", async () => {
    assets = [asset({ currency: 'EUR' })];
    getRate.mockResolvedValue(0.8);

    const { entries } = await read();

    // 80 CHF / 0.8 = 100 EUR.
    expect(entries[1]).toMatchObject({ name: 'Restaurant', effect: -100 });
  });

  it('CA14: without a rate the value is the last entry and the effects are null', async () => {
    assets = [asset({ currency: 'EUR' })];
    getRate.mockRejectedValue(new Error('Currency API unavailable'));

    const { asset: header, entries } = await read();

    expect(header).toMatchObject({ value: 5_000, convertedValue: null });
    expect(entries[0]).toMatchObject({ name: 'Salaire', effect: null });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
