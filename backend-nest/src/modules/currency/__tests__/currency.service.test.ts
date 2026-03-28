import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { Test } from '@nestjs/testing';
import { CurrencyService } from '../currency.service';
import { INFO_LOGGER_TOKEN } from '@common/logger';
import { createMockPinoLogger } from '../../../test/test-mocks';

const FRANKFURTER_RESPONSE = {
  base: 'CHF',
  date: '2026-03-05',
  rates: { EUR: 0.94 },
};

function mockFetchSuccess(body: unknown = FRANKFURTER_RESPONSE) {
  return spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200 }),
  );
}

function mockFetchFailure() {
  return spyOn(globalThis, 'fetch').mockRejectedValue(
    new Error('Network error'),
  );
}

function mockFetchHttpError(status: number) {
  return spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('error', { status }),
  );
}

describe('CurrencyService', () => {
  let service: CurrencyService;
  let fetchSpy: ReturnType<typeof spyOn>;
  let mockLogger: ReturnType<typeof createMockPinoLogger>;

  beforeEach(async () => {
    mockLogger = createMockPinoLogger();
    const module = await Test.createTestingModule({
      providers: [
        CurrencyService,
        {
          provide: `${INFO_LOGGER_TOKEN}:${CurrencyService.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get(CurrencyService);
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('should return rate 1 when base equals target', async () => {
    fetchSpy = mockFetchSuccess();

    const result = await service.getRate('CHF', 'CHF');

    expect(result.rate).toBe(1);
    expect(result.base).toBe('CHF');
    expect(result.target).toBe('CHF');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should fetch and return correct rate structure', async () => {
    fetchSpy = mockFetchSuccess();

    const result = await service.getRate('CHF', 'EUR');

    expect(result).toEqual({
      base: 'CHF',
      target: 'EUR',
      rate: 0.94,
      date: '2026-03-05',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('should return cached rate on second call', async () => {
    fetchSpy = mockFetchSuccess();

    await service.getRate('CHF', 'EUR');
    const result = await service.getRate('CHF', 'EUR');

    expect(result.rate).toBe(0.94);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('should return stale cached rate when fetch fails after TTL expiry', async () => {
    fetchSpy = mockFetchSuccess();
    await service.getRate('CHF', 'EUR');
    fetchSpy.mockRestore();

    const dateNowSpy = spyOn(Date, 'now').mockReturnValue(
      Date.now() + 25 * 60 * 60 * 1000,
    );
    const warnSpy = spyOn(mockLogger, 'warn');
    fetchSpy = mockFetchFailure();

    const result = await service.getRate('CHF', 'EUR');

    expect(result).toEqual({
      base: 'CHF',
      target: 'EUR',
      rate: 0.94,
      date: '2026-03-05',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    dateNowSpy.mockRestore();
  });

  it('should return identity rate when fetch fails and no cache exists', async () => {
    const warnSpy = spyOn(mockLogger, 'warn');
    fetchSpy = mockFetchFailure();
    const expectedDate = new Date().toISOString().slice(0, 10);

    const result = await service.getRate('CHF', 'EUR');

    expect(result).toEqual({
      base: 'CHF',
      target: 'EUR',
      rate: 1,
      date: expectedDate,
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('should return identity rate on HTTP error when no cache exists', async () => {
    const warnSpy = spyOn(mockLogger, 'warn');
    fetchSpy = mockFetchHttpError(500);
    const expectedDate = new Date().toISOString().slice(0, 10);

    const result = await service.getRate('CHF', 'EUR');

    expect(result.rate).toBe(1);
    expect(result.date).toBe(expectedDate);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('should return identity rate when rate is missing in response and no cache exists', async () => {
    const warnSpy = spyOn(mockLogger, 'warn');
    fetchSpy = mockFetchSuccess({
      base: 'CHF',
      date: '2026-03-05',
      rates: {},
    });
    const expectedDate = new Date().toISOString().slice(0, 10);

    const result = await service.getRate('CHF', 'EUR');

    expect(result.rate).toBe(1);
    expect(result.date).toBe(expectedDate);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  describe('overrideExchangeRate', () => {
    it('should skip API call when currencies match', async () => {
      fetchSpy = mockFetchSuccess();

      const dto = {
        originalCurrency: 'CHF',
        targetCurrency: 'CHF',
        exchangeRate: null,
      };
      const result = await service.overrideExchangeRate(dto);

      expect(result).toEqual(dto);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should skip API call when originalCurrency is missing', async () => {
      fetchSpy = mockFetchSuccess();

      const dto = { targetCurrency: 'EUR', exchangeRate: null };
      const result = await service.overrideExchangeRate(dto);

      expect(result).toEqual(dto);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should skip API call when targetCurrency is missing', async () => {
      fetchSpy = mockFetchSuccess();

      const dto = { originalCurrency: 'CHF', exchangeRate: null };
      const result = await service.overrideExchangeRate(dto);

      expect(result).toEqual(dto);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should override exchangeRate with server-side rate', async () => {
      fetchSpy = mockFetchSuccess();

      const dto = {
        originalCurrency: 'CHF',
        targetCurrency: 'EUR',
        exchangeRate: 0.5,
      };
      const result = await service.overrideExchangeRate(dto);

      expect(result.exchangeRate).toBe(0.94);
      expect(result.originalCurrency).toBe('CHF');
      expect(result.targetCurrency).toBe('EUR');
    });

    it('should preserve other dto properties', async () => {
      fetchSpy = mockFetchSuccess();

      const dto = {
        originalCurrency: 'CHF',
        targetCurrency: 'EUR',
        exchangeRate: null as number | null,
        originalAmount: 100,
        amount: 94,
      };
      const result = await service.overrideExchangeRate(dto);

      expect(result.exchangeRate).toBe(0.94);
      expect(result.originalAmount).toBe(100);
      expect(result.amount).toBe(94);
    });
  });
});
