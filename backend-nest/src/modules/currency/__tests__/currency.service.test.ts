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

  it('should throw when fetch fails and no cache exists', async () => {
    const warnSpy = spyOn(mockLogger, 'warn');
    fetchSpy = mockFetchFailure();

    await expect(service.getRate('CHF', 'EUR')).rejects.toThrow(
      'Failed to fetch exchange rate for CHF/EUR',
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('should throw on HTTP error when no cache exists', async () => {
    const warnSpy = spyOn(mockLogger, 'warn');
    fetchSpy = mockFetchHttpError(500);

    await expect(service.getRate('CHF', 'EUR')).rejects.toThrow(
      'Failed to fetch exchange rate for CHF/EUR',
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('should throw when rate is missing in response and no cache exists', async () => {
    const warnSpy = spyOn(mockLogger, 'warn');
    fetchSpy = mockFetchSuccess({
      base: 'CHF',
      date: '2026-03-05',
      rates: {},
    });

    await expect(service.getRate('CHF', 'EUR')).rejects.toThrow(
      'Failed to fetch exchange rate for CHF/EUR',
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  describe('overrideExchangeRate', () => {
    type FxDto = {
      originalCurrency?: string | null;
      targetCurrency?: string;
      exchangeRate?: number | null;
      originalAmount?: number | null;
      amount?: number;
      name?: string;
    };

    it('should force-null the 3 source FX fields and preserve targetCurrency when currencies match (S3-F1)', async () => {
      fetchSpy = mockFetchSuccess();

      const dto: FxDto = {
        originalCurrency: 'CHF',
        targetCurrency: 'CHF',
        exchangeRate: 99999,
        originalAmount: 99999,
      };
      const result = await service.overrideExchangeRate(dto);

      expect(result).toEqual({
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
        targetCurrency: 'CHF',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should force-null the 3 source FX fields when any FX source key is sent without a full currency pair', async () => {
      fetchSpy = mockFetchSuccess();

      const dto: FxDto = {
        amount: 50,
        exchangeRate: 99999,
        originalAmount: 99999,
      };
      const result = await service.overrideExchangeRate(dto);

      expect(result).toEqual({
        amount: 50,
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should skip API call and force-null source FX fields when originalCurrency is missing', async () => {
      fetchSpy = mockFetchSuccess();

      const dto: FxDto = {
        targetCurrency: 'EUR',
        exchangeRate: 99999,
        originalAmount: 99999,
      };
      const result = await service.overrideExchangeRate(dto);

      expect(result).toEqual({
        targetCurrency: 'EUR',
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should skip API call and force-null source FX fields when targetCurrency is missing (C1 regression)', async () => {
      fetchSpy = mockFetchSuccess();

      const dto: FxDto = {
        originalCurrency: 'CHF',
        exchangeRate: 99999,
        originalAmount: 99999,
      };
      const result = await service.overrideExchangeRate(dto);

      expect(result).toEqual({
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should force-null source FX fields even when client omits amount+rate on same-currency PATCH (S3-F1)', async () => {
      fetchSpy = mockFetchSuccess();

      const dto: FxDto = { originalCurrency: 'CHF', targetCurrency: 'CHF' };
      const result = await service.overrideExchangeRate(dto);

      expect(result).toEqual({
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
        targetCurrency: 'CHF',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should reject same-currency PATCH with unsupported currency instead of clearing FX metadata (PUL-115 defense-in-depth)', async () => {
      // If an internal caller bypasses DTO validation and passes equal but
      // unsupported currencies (e.g. "ZZZ"/"ZZZ"), the same-currency branch
      // must throw rather than silently wipe persisted FX columns.
      fetchSpy = mockFetchSuccess();

      const dto = {
        originalCurrency: 'ZZZ',
        targetCurrency: 'ZZZ',
        amount: 50,
      } as unknown as {
        originalCurrency: string;
        targetCurrency: string;
        amount: number;
      };

      await expect(service.overrideExchangeRate(dto)).rejects.toThrow(
        /Unsupported currency: ZZZ/,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should return DTO unchanged when no FX fields are present at all', async () => {
      fetchSpy = mockFetchSuccess();

      const dto: FxDto = { amount: 100, name: 'Rent' };
      const result = await service.overrideExchangeRate(dto);

      expect(result).toEqual({ amount: 100, name: 'Rent' });
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

    it('should reject forged exchangeRate with wrong type (defence-in-depth)', async () => {
      fetchSpy = mockFetchSuccess();

      const forged = {
        originalCurrency: 'CHF',
        targetCurrency: 'EUR',
        exchangeRate: '99999' as unknown as number,
      };

      await expect(service.overrideExchangeRate(forged)).rejects.toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should reject forged originalAmount with wrong type', async () => {
      fetchSpy = mockFetchSuccess();

      const forged = {
        originalCurrency: 'CHF',
        targetCurrency: 'EUR',
        originalAmount: '100' as unknown as number,
      };

      await expect(service.overrideExchangeRate(forged)).rejects.toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should pass through non-FX extra keys untouched (attacker cannot smuggle FX bypass via extras)', async () => {
      fetchSpy = mockFetchSuccess();

      const dto = {
        originalCurrency: 'CHF',
        targetCurrency: 'EUR',
        exchangeRate: null as number | null,
        userId: 'attacker',
        isDefault: true,
      } as {
        originalCurrency: string;
        targetCurrency: string;
        exchangeRate: number | null;
      };

      const result = (await service.overrideExchangeRate(dto)) as Record<
        string,
        unknown
      >;

      expect(result.exchangeRate).toBe(0.94);
      expect(result.userId).toBe('attacker');
      expect(result.isDefault).toBe(true);
    });
  });
});
