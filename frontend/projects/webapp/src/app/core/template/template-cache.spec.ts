import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError, delay } from 'rxjs';
import { type BudgetTemplate } from 'pulpe-shared';
import { TemplateCache } from './template-cache';
import { TemplateApi } from './template-api';
import { Logger } from '../logging/logger';

describe('TemplateCache', () => {
  let service: TemplateCache;
  let mockTemplateApi: { getAll$: ReturnType<typeof vi.fn> };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };

  const mockTemplates: BudgetTemplate[] = [
    {
      id: '1',
      name: 'Template 1',
      description: 'Test template',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    } as BudgetTemplate,
    {
      id: '2',
      name: 'Template 2',
      description: 'Another template',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    } as BudgetTemplate,
  ];

  beforeEach(() => {
    mockTemplateApi = {
      getAll$: vi.fn(),
    };

    mockLogger = {
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TemplateCache,
        { provide: TemplateApi, useValue: mockTemplateApi },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(TemplateCache);
  });

  describe('initial state', () => {
    it('should have templates() as null', () => {
      expect(service.templates()).toBeNull();
    });

    it('should have isLoading() as false', () => {
      expect(service.isLoading()).toBe(false);
    });

    it('should have hasTemplates() as false', () => {
      expect(service.hasTemplates()).toBe(false);
    });
  });

  describe('preloadAll', () => {
    it('should call API and store templates in signal', async () => {
      mockTemplateApi.getAll$.mockReturnValue(of(mockTemplates));

      const result = await service.preloadAll();

      expect(mockTemplateApi.getAll$).toHaveBeenCalledOnce();
      expect(result).toEqual(mockTemplates);
      expect(service.templates()).toEqual(mockTemplates);
    });

    it('should return cached data on second call without API request', async () => {
      mockTemplateApi.getAll$.mockReturnValue(of(mockTemplates));

      await service.preloadAll();
      mockTemplateApi.getAll$.mockClear();

      const result = await service.preloadAll();

      expect(mockTemplateApi.getAll$).not.toHaveBeenCalled();
      expect(result).toEqual(mockTemplates);
    });

    it('should set isLoading to true while loading', async () => {
      let isLoadingDuringCall = false;
      mockTemplateApi.getAll$.mockReturnValue(
        of(mockTemplates)
          .pipe
          // Capture loading state during the observable
          (),
      );

      const promise = service.preloadAll();
      isLoadingDuringCall = service.isLoading();

      await promise;

      expect(isLoadingDuringCall).toBe(true);
      expect(service.isLoading()).toBe(false);
    });

    it('should set hasTemplates to true after successful load', async () => {
      mockTemplateApi.getAll$.mockReturnValue(of(mockTemplates));

      expect(service.hasTemplates()).toBe(false);

      await service.preloadAll();

      expect(service.hasTemplates()).toBe(true);
    });

    it('should return empty array on error and log error', async () => {
      const error = new Error('API Error');
      mockTemplateApi.getAll$.mockReturnValue(throwError(() => error));

      const result = await service.preloadAll();

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[TemplateCache] Failed to preload templates',
        error,
      );
    });

    it('should not store templates on error', async () => {
      mockTemplateApi.getAll$.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      await service.preloadAll();

      expect(service.templates()).toBeNull();
      expect(service.hasTemplates()).toBe(false);
    });

    it('should set isLoading to false after error', async () => {
      mockTemplateApi.getAll$.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      await service.preloadAll();

      expect(service.isLoading()).toBe(false);
    });

    it('should deduplicate concurrent preload calls', async () => {
      mockTemplateApi.getAll$.mockReturnValue(
        of(mockTemplates).pipe(delay(50)),
      );

      const [result1, result2] = await Promise.all([
        service.preloadAll(),
        service.preloadAll(),
      ]);

      expect(result1).toEqual(mockTemplates);
      expect(result2).toEqual(mockTemplates);
      expect(mockTemplateApi.getAll$).toHaveBeenCalledOnce();
    });
  });

  describe('invalidate', () => {
    it('should set templates back to null', async () => {
      mockTemplateApi.getAll$.mockReturnValue(of(mockTemplates));
      await service.preloadAll();

      expect(service.templates()).not.toBeNull();

      service.invalidate();

      expect(service.templates()).toBeNull();
    });

    it('should set hasTemplates to false after invalidate', async () => {
      mockTemplateApi.getAll$.mockReturnValue(of(mockTemplates));
      await service.preloadAll();

      expect(service.hasTemplates()).toBe(true);

      service.invalidate();

      expect(service.hasTemplates()).toBe(false);
    });

    it('should not affect isLoading state', async () => {
      mockTemplateApi.getAll$.mockReturnValue(of(mockTemplates));
      await service.preloadAll();

      expect(service.isLoading()).toBe(false);

      service.invalidate();

      expect(service.isLoading()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should set templates back to null', async () => {
      mockTemplateApi.getAll$.mockReturnValue(of(mockTemplates));
      await service.preloadAll();

      expect(service.templates()).not.toBeNull();

      service.clear();

      expect(service.templates()).toBeNull();
    });

    it('should set isLoading to false', async () => {
      mockTemplateApi.getAll$.mockReturnValue(of(mockTemplates));
      await service.preloadAll();

      expect(service.isLoading()).toBe(false);

      service.clear();

      expect(service.isLoading()).toBe(false);
    });

    it('should set hasTemplates to false', async () => {
      mockTemplateApi.getAll$.mockReturnValue(of(mockTemplates));
      await service.preloadAll();

      expect(service.hasTemplates()).toBe(true);

      service.clear();

      expect(service.hasTemplates()).toBe(false);
    });

    it('should reset state completely', async () => {
      mockTemplateApi.getAll$.mockReturnValue(of(mockTemplates));
      await service.preloadAll();

      service.clear();

      expect(service.templates()).toBeNull();
      expect(service.isLoading()).toBe(false);
      expect(service.hasTemplates()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty template array', async () => {
      const emptyTemplates: BudgetTemplate[] = [];
      mockTemplateApi.getAll$.mockReturnValue(of(emptyTemplates));

      const result = await service.preloadAll();

      expect(result).toEqual([]);
      expect(service.templates()).toEqual([]);
      expect(service.hasTemplates()).toBe(true);
    });

    it('should handle multiple invalidate calls', async () => {
      mockTemplateApi.getAll$.mockReturnValue(of(mockTemplates));
      await service.preloadAll();

      service.invalidate();
      service.invalidate();

      expect(service.templates()).toBeNull();
      expect(service.hasTemplates()).toBe(false);
    });

    it('should allow preload after invalidate', async () => {
      mockTemplateApi.getAll$.mockReturnValue(of(mockTemplates));
      await service.preloadAll();
      service.invalidate();

      mockTemplateApi.getAll$.mockClear();
      mockTemplateApi.getAll$.mockReturnValue(of(mockTemplates));

      const result = await service.preloadAll();

      expect(result).toEqual(mockTemplates);
      expect(service.templates()).toEqual(mockTemplates);
    });
  });
});
