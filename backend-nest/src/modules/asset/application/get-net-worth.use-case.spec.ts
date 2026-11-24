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

  describe('the value follows what is checked (PUL-377)', () => {
    const checkedAt = '2026-11-05T10:00:00.000Z';

    it('CA1: adds the checked Épargne to the last entry of the Livret', async () => {
      assets = [asset('livret', 'CHF', 10_000)];
      checkedLines = [
        { assetId: 'livret', kind: 'saving', amount: 500, checkedAt },
      ];

      const result = await useCase.execute(user);

      expect(result.assets[0]).toMatchObject({
        value: 10_500,
        recordedValue: 10_000,
        convertedValue: 10_500,
      });
      expect(result.totals.net).toBe(10_500);
    });

    it('CA14: converts a CHF prévision into a EUR asset at the rate of the day', async () => {
      assets = [asset('eur', 'EUR', 1000)];
      checkedLines = [
        { assetId: 'eur', kind: 'saving', amount: 93, checkedAt },
      ];
      getRate.mockResolvedValue(0.93);

      const result = await useCase.execute(user);

      expect(result.assets[0]?.value).toBe(1100);
    });

    it('CA14: keeps the last entry without a rate, whatever was checked', async () => {
      assets = [asset('eur', 'EUR', 1000)];
      checkedLines = [
        { assetId: 'eur', kind: 'saving', amount: 93, checkedAt },
      ];
      getRate.mockRejectedValue(new Error('Currency API unavailable'));

      const result = await useCase.execute(user);

      expect(result.assets[0]?.value).toBe(1000);
      expect(result.totals.incomplete).toBe(true);
    });

    it('CA16: a proposal still waiting for a click at go-live is simply the value', async () => {
      // Livret entered at 10 000 on 3 Nov; « Épargne mensuelle » (500) checked
      // on 5 Nov used to wait as « Je propose 10 500 ».
      assets = [asset('livret', 'CHF', 10_000)];
      checkedLines = [
        { assetId: 'livret', kind: 'saving', amount: 500, checkedAt },
      ];

      const result = await useCase.execute(user);

      expect(result.assets[0]).toMatchObject({
        value: 10_500,
        recordedValue: 10_000,
      });
      expect(result.totals.gross).toBe(10_500);
    });

    it('CA17: after a dismissed proposal is converted, a later Épargne of 200 brings the Livret to 10 200', async () => {
      // The migration copied the 10 000 entry, dated when I dismissed.
      const dismissedAt = '2026-11-10T08:00:00.000Z';
      assets = [
        { ...asset('livret', 'CHF', 10_000), latestRecordedAt: dismissedAt },
      ];
      checkedLines = [
        {
          assetId: 'livret',
          kind: 'saving',
          amount: 200,
          checkedAt: '2026-11-12T08:00:00.000Z',
        },
      ];

      const result = await useCase.execute(user);

      // The 500 checked before the dismissal is before the cutoff: never asked for.
      expect(findCheckedLinkedLines).toHaveBeenCalledWith([
        { assetId: 'livret', since: dismissedAt },
      ]);
      expect(result.assets[0]).toMatchObject({
        value: 10_200,
        recordedValue: 10_000,
      });
    });

    it('CA5: asks for the lines checked after the last entry of each active asset only', async () => {
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
