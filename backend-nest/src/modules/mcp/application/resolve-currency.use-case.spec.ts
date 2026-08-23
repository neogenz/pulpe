import { describe, expect, it } from 'bun:test';
import { ResolveCurrencyUseCase } from './resolve-currency.use-case';
import type { CurrencyService } from '@modules/currency/currency.service';
import type { UserRepositoryPort } from '@modules/user/domain/ports/user-repository.port';

function harness(rate = 0.94) {
  const asked: string[] = [];
  const currency = {
    getRate: async (base: string, target: string) => {
      asked.push(`${base}->${target}`);
      return { base, target, rate, date: '2026-08-23' };
    },
  } as unknown as CurrencyService;
  const users = {
    findSettings: async () => ({
      payDayOfMonth: null,
      currency: 'CHF' as const,
      showCurrencySelector: false,
    }),
  } as unknown as UserRepositoryPort;
  return { useCase: new ResolveCurrencyUseCase(currency, users), asked };
}

describe('ResolveCurrencyUseCase', () => {
  it('leaves an unnamed currency alone, with no exchange metadata', async () => {
    const { useCase, asked } = harness();
    expect(await useCase.execute(42)).toEqual({ amount: 42 });
    expect(asked).toEqual([]);
  });

  it('leaves the settings currency alone, with no exchange metadata', async () => {
    const { useCase, asked } = harness();
    expect(await useCase.execute(42, 'CHF')).toEqual({ amount: 42 });
    expect(asked).toEqual([]);
  });

  it('converts another supported currency and keeps the whole quadruplet', async () => {
    const { useCase, asked } = harness(0.94);
    expect(await useCase.execute(42, 'EUR')).toEqual({
      amount: 39.48,
      originalAmount: 42,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 0.94,
    });
    expect(asked).toEqual(['EUR->CHF']);
  });
});
