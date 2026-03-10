import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { Test } from '@nestjs/testing';
import { CurrencyService } from '../currency.service';
import { INFO_LOGGER_TOKEN } from '@common/logger';
import { createMockPinoLogger } from '../../../test/test-mocks';
import { BusinessException } from '@common/exceptions/business.exception';

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

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CurrencyService,
        {
          provide: `${INFO_LOGGER_TOKEN}:${CurrencyService.name}`,
          useValue: createMockPinoLogger(),
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

  it('should throw BusinessException when fetch fails', async () => {
    fetchSpy = mockFetchFailure();

    try {
      await service.getRate('CHF', 'EUR');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).code).toBe(
        'ERR_CURRENCY_RATE_FETCH_FAILED',
      );
    }
  });

  it('should throw BusinessException on HTTP error', async () => {
    fetchSpy = mockFetchHttpError(500);

    try {
      await service.getRate('CHF', 'EUR');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).code).toBe(
        'ERR_CURRENCY_RATE_FETCH_FAILED',
      );
    }
  });

  it('should throw BusinessException when rate is missing in response', async () => {
    fetchSpy = mockFetchSuccess({ base: 'CHF', date: '2026-03-05', rates: {} });

    try {
      await service.getRate('CHF', 'EUR');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
    }
  });
});
