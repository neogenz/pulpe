import { describe, it, expect, beforeEach, afterEach, jest } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { BusinessException } from '@common/exceptions/business.exception';
import { INFO_LOGGER_TOKEN } from '@common/logger/info-logger.provider';
import { CurrencyService } from './currency.service';

const TTL_MS = 24 * 60 * 60 * 1000;

function frankfurterResponse(target: string, rate: number, date: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ rates: { [target]: rate }, date }),
  };
}

describe('CurrencyService', () => {
  let service: CurrencyService;
  let module: TestingModule;
  const mockFetch = jest.fn();
  let dateNowSpy: ReturnType<typeof jest.spyOn> | undefined;
  let mockedTimeMs: number;

  beforeEach(async () => {
    mockedTimeMs = 1_700_000_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => mockedTimeMs);
    global.fetch = mockFetch as unknown as typeof fetch;

    module = await Test.createTestingModule({
      providers: [
        CurrencyService,
        {
          provide: `${INFO_LOGGER_TOKEN}:${CurrencyService.name}`,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            trace: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CurrencyService);
  });

  afterEach(async () => {
    dateNowSpy?.mockRestore();
    mockFetch.mockReset();
    await module?.close();
  });

  it('should return identity rate when base equals target', async () => {
    const r = await service.getRate('CHF', 'CHF');
    expect(r.rate).toBe(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return stale cache to all concurrent callers when fetch fails (in-flight reuse)', async () => {
    mockFetch.mockResolvedValueOnce(
      frankfurterResponse('CHF', 0.93, '2026-01-01'),
    );

    await service.getRate('EUR', 'CHF');

    mockedTimeMs += TTL_MS + 60_000;

    mockFetch.mockRejectedValue(new Error('network error'));

    const results = await Promise.all([
      service.getRate('EUR', 'CHF'),
      service.getRate('EUR', 'CHF'),
    ]);

    expect(results[0]).toEqual(results[1]);
    expect(results[0].rate).toBe(0.93);
    expect(results[0].date).toBe('2026-01-01');
    expect(mockFetch.mock.calls.length).toBe(2);
  });

  it('should reject when fetch fails and no stale cache exists', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));

    await expect(service.getRate('EUR', 'CHF')).rejects.toThrow(
      BusinessException,
    );
  });
});
