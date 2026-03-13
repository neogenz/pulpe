import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
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

  describe('fetchRate$', () => {
    it('should call API with correct URL and extract rate', () => {
      mockApi.get$.mockReturnValue(
        of({ success: true, data: { base: 'CHF', target: 'EUR', rate: 0.95 } }),
      );

      service.fetchRate$('CHF', 'EUR').subscribe((rate) => {
        expect(rate).toBe(0.95);
      });

      expect(mockApi.get$).toHaveBeenCalledWith(
        '/currency/rate?base=CHF&target=EUR',
        expect.anything(),
      );
    });

    it('should propagate API errors', () => {
      mockApi.get$.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      service.fetchRate$('CHF', 'EUR').subscribe({
        error: (err) => {
          expect(err.message).toBe('Network error');
        },
      });
    });

    it('should return cached rate on second call within TTL', () => {
      mockApi.get$.mockReturnValue(
        of({ success: true, data: { base: 'CHF', target: 'EUR', rate: 0.95 } }),
      );

      service.fetchRate$('CHF', 'EUR').subscribe();
      service.fetchRate$('CHF', 'EUR').subscribe((rate) => {
        expect(rate).toBe(0.95);
      });

      expect(mockApi.get$).toHaveBeenCalledTimes(1);
    });

    it('should refetch after cache TTL expires', () => {
      mockApi.get$.mockReturnValue(
        of({ success: true, data: { base: 'CHF', target: 'EUR', rate: 0.95 } }),
      );

      service.fetchRate$('CHF', 'EUR').subscribe();

      // Advance time past TTL (5 minutes)
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000);

      mockApi.get$.mockReturnValue(
        of({ success: true, data: { base: 'CHF', target: 'EUR', rate: 0.96 } }),
      );

      service.fetchRate$('CHF', 'EUR').subscribe((rate) => {
        expect(rate).toBe(0.96);
      });

      expect(mockApi.get$).toHaveBeenCalledTimes(2);

      vi.restoreAllMocks();
    });
  });

  describe('convert', () => {
    it('should multiply amount by rate', () => {
      expect(service.convert(100, 0.95)).toBe(95);
    });

    it('should handle zero amount', () => {
      expect(service.convert(0, 0.95)).toBe(0);
    });

    it('should handle rate of 1', () => {
      expect(service.convert(250, 1)).toBe(250);
    });
  });

  describe('convertIfNeeded', () => {
    it('should return original amount when currencies are the same', async () => {
      const result = await service.convertIfNeeded(100, 'CHF', 'CHF');
      expect(result).toBe(100);
      expect(mockApi.get$).not.toHaveBeenCalled();
    });

    it('should convert and round to 2 decimals when currencies differ', async () => {
      mockApi.get$.mockReturnValue(
        of({
          success: true,
          data: { base: 'EUR', target: 'CHF', rate: 1.0567 },
        }),
      );

      const result = await service.convertIfNeeded(100, 'EUR', 'CHF');
      expect(result).toBe(105.67);
    });

    it('should round correctly for long decimals', async () => {
      mockApi.get$.mockReturnValue(
        of({
          success: true,
          data: { base: 'CHF', target: 'EUR', rate: 0.9333 },
        }),
      );

      const result = await service.convertIfNeeded(33.33, 'CHF', 'EUR');
      // 33.33 * 0.9333 = 31.106889 → 31.11
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
        of({ success: true, data: { base: 'EUR', target: 'CHF', rate: 1.05 } }),
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
          data: { base: 'CHF', target: 'EUR', rate: 0.9333 },
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
