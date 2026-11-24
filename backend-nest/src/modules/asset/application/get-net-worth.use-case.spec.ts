import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import type { SupportedCurrency } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { UserRepositoryPort } from '@modules/user/domain/ports/user-repository.port';
import type { AssetRepositoryPort } from '../domain/ports/asset-repository.port';
import type { ExchangeRatePort } from '../domain/ports/exchange-rate.port';
import type {
  AssetMovements,
  AssetWithValue,
  FreeMovement,
} from '../domain/asset.entity';
import { GetNetWorthUseCase } from './get-net-worth.use-case';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

const category = { id: 'cat-1', name: 'Comptes' };

function asset(
  id: string,
  currency: SupportedCurrency,
  recordedValue: number,
): AssetWithValue {
  return {
    id,
    categoryId: category.id,
    name: id,
    currency,
    direction: 'own',
    inPulpe: false,
    archivedAt: null,
    recordedValue,
    latestRecordedAt: '2026-11-03T10:00:00.000Z',
  };
}

describe('GetNetWorthUseCase', () => {
  let assets: AssetWithValue[];
  let movements: AssetMovements;
  let findMovementsSince: ReturnType<typeof jest.fn>;
  let baseCurrency: SupportedCurrency;
  let getRate: ReturnType<typeof jest.fn>;
  let logger: {
    info: jest.Mock;
    debug: jest.Mock;
    warn: jest.Mock;
    trace: jest.Mock;
  };
  let useCase: GetNetWorthUseCase;

  beforeEach(() => {
    assets = [];
    movements = { lines: [], freeMovements: [] };
    findMovementsSince = jest.fn(async () => movements);
    baseCurrency = 'CHF';
    getRate = jest.fn();
    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      trace: jest.fn(),
    };
    const repo = {
      findAllCategories: jest.fn(async () => [category]),
      findAllWithLatestValue: jest.fn(async () => assets),
      findMovementsSince,
    } as unknown as AssetRepositoryPort;
    const userRepo = {
      findSettings: jest.fn(async () => ({ currency: baseCurrency })),
    } as unknown as UserRepositoryPort;
    useCase = new GetNetWorthUseCase(
      repo,
      userRepo,
      { getRate } as unknown as ExchangeRatePort,
      logger,
    );
  });

  it('returns zero totals in the user base currency for a user without assets', async () => {
    baseCurrency = 'EUR';

    const result = await useCase.execute(user);

    expect(result.totals).toEqual({
      baseCurrency: 'EUR',
      gross: 0,
      debts: 0,
      net: 0,
      incomplete: false,
    });
    expect(getRate).not.toHaveBeenCalled();
  });

  it('converts a foreign asset at the rate of the foreign currency into the base currency', async () => {
    assets = [asset('chf', 'CHF', 100), asset('eur', 'EUR', 1000)];
    getRate.mockResolvedValue(0.93);

    const result = await useCase.execute(user);

    expect(getRate).toHaveBeenCalledTimes(1);
    expect(getRate).toHaveBeenCalledWith('EUR', 'CHF');
    expect(result.assets.map((a) => a.convertedValue)).toEqual([100, 930]);
    expect(result.totals).toMatchObject({ gross: 1030, incomplete: false });
  });

  it('asks for the rate once per foreign currency, in a EUR base', async () => {
    baseCurrency = 'EUR';
    assets = [
      asset('a', 'CHF', 100),
      asset('b', 'CHF', 200),
      asset('c', 'EUR', 50),
    ];
    getRate.mockResolvedValue(1.07);

    const result = await useCase.execute(user);

    expect(getRate).toHaveBeenCalledTimes(1);
    expect(getRate).toHaveBeenCalledWith('CHF', 'EUR');
    expect(result.totals).toMatchObject({ baseCurrency: 'EUR', gross: 371 });
  });

  it('sets incomplete instead of failing when the rate is unavailable', async () => {
    assets = [asset('chf', 'CHF', 100), asset('eur', 'EUR', 1000)];
    getRate.mockRejectedValue(new Error('Currency API unavailable'));

    const result = await useCase.execute(user);

    expect(result.assets.map((a) => a.convertedValue)).toEqual([100, null]);
    expect(result.totals).toMatchObject({
      gross: 100,
      net: 100,
      incomplete: true,
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  describe('the value follows what is checked (PUL-377, PUL-378)', () => {
    const checkedAt = '2026-11-05T10:00:00.000Z';

    function revenu(accountId: string, amount: number): FreeMovement {
      return {
        id: `revenu-${accountId}`,
        name: 'Revenu',
        accountId,
        kind: 'income',
        amount,
        checkedAt,
      };
    }

    it('PUL-378 CA6: a checked Revenu of 6 000 on the Compte courant brings it to 11 000', async () => {
      assets = [asset('compte-courant', 'CHF', 5_000)];
      movements.freeMovements = [revenu('compte-courant', 6_000)];

      const result = await useCase.execute(user);

      expect(result.assets[0]).toMatchObject({
        value: 11_000,
        recordedValue: 5_000,
        convertedValue: 11_000,
      });
      expect(result.totals.net).toBe(11_000);
    });

    it('PUL-378 CA16: converts a CHF movement into a EUR account at the rate of the day', async () => {
      assets = [asset('eur', 'EUR', 1000)];
      movements.freeMovements = [revenu('eur', 93)];
      getRate.mockResolvedValue(0.93);

      const result = await useCase.execute(user);

      expect(result.assets[0]?.value).toBe(1100);
    });

    it('PUL-378 CA16: keeps the last entry without a rate, whatever was checked', async () => {
      assets = [asset('eur', 'EUR', 1000)];
      movements.freeMovements = [revenu('eur', 93)];
      getRate.mockRejectedValue(new Error('Currency API unavailable'));

      const result = await useCase.execute(user);

      expect(result.assets[0]?.value).toBe(1000);
      expect(result.totals.incomplete).toBe(true);
    });

    it('PUL-377 CA16: a proposal still waiting for a click at go-live is simply the value', async () => {
      // Livret entered at 10 000 on 3 Nov; « Épargne mensuelle » (500) checked
      // on 5 Nov used to wait as « Je propose 10 500 ».
      assets = [asset('livret', 'CHF', 10_000)];
      movements.lines = [
        {
          id: 'epargne',
          name: 'Épargne mensuelle',
          kind: 'saving',
          amount: 500,
          checkedAt,
          accountId: null,
          assetId: 'livret',
          checkedReals: [],
        },
      ];

      const result = await useCase.execute(user);

      expect(result.assets[0]).toMatchObject({
        value: 10_500,
        recordedValue: 10_000,
      });
      expect(result.totals.gross).toBe(10_500);
    });

    it('reads what moved since the earliest last entry of the active assets', async () => {
      assets = [
        {
          ...asset('livret', 'CHF', 1),
          latestRecordedAt: '2026-11-10T08:00:00.000Z',
        },
        asset('compte-courant', 'CHF', 1),
        {
          ...asset('old', 'CHF', 1),
          latestRecordedAt: '2026-01-01T00:00:00.000Z',
          archivedAt: '2026-10-01T00:00:00.000Z',
        },
      ];

      await useCase.execute(user);

      expect(findMovementsSince).toHaveBeenCalledWith(
        '2026-11-03T10:00:00.000Z',
      );
    });

    it('reads no movement without an active asset', async () => {
      assets = [
        { ...asset('old', 'CHF', 900), archivedAt: '2026-10-01T00:00:00.000Z' },
      ];

      const result = await useCase.execute(user);

      expect(findMovementsSince).not.toHaveBeenCalled();
      expect(result.assets[0]?.value).toBe(900);
    });
  });
});
