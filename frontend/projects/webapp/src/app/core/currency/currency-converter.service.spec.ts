import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClient } from '@core/api/api-client';
import { CurrencyConverterService } from './currency-converter.service';

describe('CurrencyConverterService', () => {
  let service: CurrencyConverterService;
  let mockApi: { get$: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockApi = {
      get$: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        CurrencyConverterService,
        { provide: ApiClient, useValue: mockApi },
      ],
    });

    service = TestBed.inject(CurrencyConverterService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('fetchRate', () => {
    it('should call the API with the correct URL and resolve with the rate', async () => {
      mockApi.get$.mockReturnValue(
        of({
          success: true,
          data: {
            base: 'CHF',
            target: 'EUR',
            rate: 0.95,
            date: '2026-04-13',
          },
        }),
      );

      const rate = await service.fetchRate('CHF', 'EUR');

      expect(rate).toBe(0.95);
      expect(mockApi.get$).toHaveBeenCalledWith(
        '/currency/rate?base=CHF&target=EUR',
        expect.anything(),
      );
    });

    it('should short-circuit to 1 when base equals target without hitting the API', async () => {
      const rate = await service.fetchRate('CHF', 'CHF');

      expect(rate).toBe(1);
      expect(mockApi.get$).not.toHaveBeenCalled();
    });

    it('should propagate API errors to the caller', async () => {
      mockApi.get$.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(service.fetchRate('CHF', 'EUR')).rejects.toThrow(
        'Network error',
      );
    });

    it('should return the cached rate on a second call within the fresh window', async () => {
      mockApi.get$.mockReturnValue(
        of({
          success: true,
          data: {
            base: 'CHF',
            target: 'EUR',
            rate: 0.95,
            date: '2026-04-13',
          },
        }),
      );

      const first = await service.fetchRate('CHF', 'EUR');
      const second = await service.fetchRate('CHF', 'EUR');

      expect(first).toBe(0.95);
      expect(second).toBe(0.95);
      expect(mockApi.get$).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent in-flight requests for the same pair', async () => {
      const response$ = new Subject<{
        success: true;
        data: { base: string; target: string; rate: number; date: string };
      }>();
      mockApi.get$.mockReturnValue(response$.asObservable());

      const first = service.fetchRate('CHF', 'EUR');
      const second = service.fetchRate('CHF', 'EUR');

      expect(mockApi.get$).toHaveBeenCalledTimes(1);

      response$.next({
        success: true,
        data: {
          base: 'CHF',
          target: 'EUR',
          rate: 0.95,
          date: '2026-04-13',
        },
      });
      response$.complete();

      await expect(first).resolves.toBe(0.95);
      await expect(second).resolves.toBe(0.95);
      expect(mockApi.get$).toHaveBeenCalledTimes(1);
    });
  });

  describe('convert', () => {
    it('should multiply the amount by the rate', () => {
      expect(service.convert(100, 0.95)).toBe(95);
    });

    it('should handle a zero amount', () => {
      expect(service.convert(0, 0.95)).toBe(0);
    });

    it('should handle a rate of 1', () => {
      expect(service.convert(250, 1)).toBe(250);
    });
  });

  describe('convertIfNeeded', () => {
    it('should return the original amount when currencies are the same', async () => {
      const result = await service.convertIfNeeded(100, 'CHF', 'CHF');

      expect(result).toBe(100);
      expect(mockApi.get$).not.toHaveBeenCalled();
    });

    it('should convert and round to 2 decimals when currencies differ', async () => {
      mockApi.get$.mockReturnValue(
        of({
          success: true,
          data: {
            base: 'EUR',
            target: 'CHF',
            rate: 1.0567,
            date: '2026-04-13',
          },
        }),
      );

      const result = await service.convertIfNeeded(100, 'EUR', 'CHF');

      expect(result).toBe(105.67);
    });

    it('should round correctly for long decimals', async () => {
      mockApi.get$.mockReturnValue(
        of({
          success: true,
          data: {
            base: 'CHF',
            target: 'EUR',
            rate: 0.9333,
            date: '2026-04-13',
          },
        }),
      );

      const result = await service.convertIfNeeded(33.33, 'CHF', 'EUR');

      expect(result).toBe(31.11);
    });
  });

  describe('convertWithMetadata', () => {
    it('should return null metadata when currencies are the same', async () => {
      const result = await service.convertWithMetadata(100, 'CHF', 'CHF');

      expect(result).toEqual({
        convertedAmount: 100,
        metadata: null,
      });
      expect(mockApi.get$).not.toHaveBeenCalled();
    });

    it('should return converted amount with metadata when currencies differ', async () => {
      mockApi.get$.mockReturnValue(
        of({
          success: true,
          data: {
            base: 'EUR',
            target: 'CHF',
            rate: 1.05,
            date: '2026-04-13',
          },
        }),
      );

      const result = await service.convertWithMetadata(200, 'EUR', 'CHF');

      expect(result).toEqual({
        convertedAmount: 210,
        metadata: {
          originalAmount: 200,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 1.05,
        },
      });
    });

    it('should round convertedAmount to 2 decimals', async () => {
      mockApi.get$.mockReturnValue(
        of({
          success: true,
          data: {
            base: 'CHF',
            target: 'EUR',
            rate: 0.9333,
            date: '2026-04-13',
          },
        }),
      );

      const result = await service.convertWithMetadata(33.33, 'CHF', 'EUR');

      expect(result.convertedAmount).toBe(31.11);
      expect(result.metadata).not.toBeNull();
      expect(result.metadata!.originalAmount).toBe(33.33);
      expect(result.metadata!.exchangeRate).toBe(0.9333);
    });
  });
});
