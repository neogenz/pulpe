import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import type { SupportedCurrency } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { UserRepositoryPort } from '@modules/user/domain/ports/user-repository.port';
import type { AssetRepositoryPort } from '../domain/ports/asset-repository.port';
import type { ExchangeRatePort } from '../domain/ports/exchange-rate.port';
import type { AssetWithValue, CheckedLinkedLine } from '../domain/asset.entity';
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
  latestValue: number,
): AssetWithValue {
  return {
    id,
    categoryId: category.id,
    name: id,
    currency,
    direction: 'own',
    inPulpe: false,
    archivedAt: null,
    latestValue,
    latestRecordedAt: '2026-11-03T10:00:00.000Z',
    suggestionDismissedAt: null,
  };
}

describe('GetNetWorthUseCase', () => {
  let assets: AssetWithValue[];
  let checkedLines: CheckedLinkedLine[];
  let findCheckedLinkedLines: ReturnType<typeof jest.fn>;
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
    checkedLines = [];
    findCheckedLinkedLines = jest.fn(async () => checkedLines);
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
      findCheckedLinkedLines,
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

  describe('suggestions', () => {
    it('proposes the value moved by the checked lines the repository returns', async () => {
      assets = [asset('livret', 'CHF', 3000)];
      checkedLines = [{ assetId: 'livret', kind: 'saving', amount: 500 }];

      const result = await useCase.execute(user);

      expect(result.assets[0]?.suggestion).toEqual({
        delta: 500,
        proposedValue: 3500,
      });
    });

    it('lowers a debt by a checked instalment', async () => {
      assets = [{ ...asset('leasing', 'CHF', 8000), direction: 'owe' }];
      checkedLines = [{ assetId: 'leasing', kind: 'expense', amount: 400 }];

      const result = await useCase.execute(user);

      expect(result.assets[0]?.suggestion).toEqual({
        delta: -400,
        proposedValue: 7600,
      });
    });

    it('converts a CHF prévision into a EUR asset at the rate of the day', async () => {
      assets = [asset('eur', 'EUR', 1000)];
      checkedLines = [{ assetId: 'eur', kind: 'saving', amount: 93 }];
      getRate.mockResolvedValue(0.93);

      const result = await useCase.execute(user);

      expect(result.assets[0]?.suggestion).toEqual({
        delta: 100,
        proposedValue: 1100,
      });
    });

    it('proposes nothing without a rate, whatever was checked', async () => {
      assets = [asset('eur', 'EUR', 1000)];
      checkedLines = [{ assetId: 'eur', kind: 'saving', amount: 93 }];
      getRate.mockRejectedValue(new Error('Currency API unavailable'));

      const result = await useCase.execute(user);

      expect(result.assets[0]?.suggestion).toBeNull();
    });

    it('asks for the lines checked after the later of the snapshot and the dismissal', async () => {
      assets = [
        asset('fresh-snapshot', 'CHF', 1),
        {
          ...asset('dismissed', 'CHF', 1),
          suggestionDismissedAt: '2026-11-04T08:00:00.000Z',
        },
        {
          ...asset('stale-dismissal', 'CHF', 1),
          suggestionDismissedAt: '2026-11-01T08:00:00.000Z',
        },
      ];

      await useCase.execute(user);

      expect(findCheckedLinkedLines).toHaveBeenCalledWith([
        { assetId: 'fresh-snapshot', since: '2026-11-03T10:00:00.000Z' },
        { assetId: 'dismissed', since: '2026-11-04T08:00:00.000Z' },
        { assetId: 'stale-dismissal', since: '2026-11-03T10:00:00.000Z' },
      ]);
    });

    it('does not read the lines of an archived asset', async () => {
      assets = [
        asset('active', 'CHF', 1),
        { ...asset('old', 'CHF', 1), archivedAt: '2026-10-01T00:00:00.000Z' },
      ];

      await useCase.execute(user);

      expect(findCheckedLinkedLines).toHaveBeenCalledWith([
        { assetId: 'active', since: '2026-11-03T10:00:00.000Z' },
      ]);
    });
  });
});
