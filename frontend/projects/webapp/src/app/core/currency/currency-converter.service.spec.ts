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
});
