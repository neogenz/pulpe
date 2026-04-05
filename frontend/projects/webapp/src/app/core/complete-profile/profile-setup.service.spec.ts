import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { ProfileSetupService } from './profile-setup.service';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { ApiClient } from '@core/api/api-client';
import { BudgetApi } from '@core/budget';
import { PostHogService } from '@core/analytics/posthog';
import { Logger } from '@core/logging/logger';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

describe('ProfileSetupService', () => {
  let service: ProfileSetupService;
  let mockApiClient: { post$: ReturnType<typeof vi.fn> };
  let mockBudgetApi: {
    generateBudgets$: ReturnType<typeof vi.fn>;
    getAllBudgets$: ReturnType<typeof vi.fn>;
    cache: unknown;
  };
  let mockPostHogService: { enableTracking: ReturnType<typeof vi.fn> };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockApiClient = {
      post$: vi.fn().mockReturnValue(
        of({
          data: { template: { id: 'template-123' } },
        }),
      ),
    };

    mockBudgetApi = {
      generateBudgets$: vi.fn().mockReturnValue(
        of({
          success: true,
          data: { budgets: [{ id: 'budget-123' }], skippedMonths: [] },
        }),
      ),
      getAllBudgets$: vi
        .fn()
        .mockReturnValue(of([{ id: 'budget-123', remaining: 500 }])),
      cache: {
        invalidate: vi.fn(),
        prefetch: vi
          .fn()
          .mockImplementation(
            async (_key: string[], fn: () => Promise<unknown>) => {
              await fn();
            },
          ),
        clear: vi.fn(),
      },
    };

    mockPostHogService = {
      enableTracking: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ...provideTranslocoForTest(),
        ProfileSetupService,
        {
          provide: ApplicationConfiguration,
          useValue: { backendApiUrl: () => 'http://localhost:3000/api/v1' },
        },
        { provide: ApiClient, useValue: mockApiClient },
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: PostHogService, useValue: mockPostHogService },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(ProfileSetupService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createInitialBudget', () => {
    it('should return error when firstName is missing', async () => {
      const result = await service.createInitialBudget({
        firstName: '',
        monthlyIncome: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('prénom et ton revenu mensuel');
    });

    it('should return error when monthlyIncome is missing', async () => {
      const result = await service.createInitialBudget({
        firstName: 'John',
        monthlyIncome: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('prénom et ton revenu mensuel');
    });

    it('should return error when monthlyIncome is negative', async () => {
      const result = await service.createInitialBudget({
        firstName: 'John',
        monthlyIncome: -100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('prénom et ton revenu mensuel');
    });
  });

  describe('budget period computation', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should pass payDayOfMonth to getBudgetPeriodForDate and use result', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-02'));

      const result = await service.createInitialBudget({
        firstName: 'Test',
        monthlyIncome: 3000,
        payDayOfMonth: 4,
      });

      expect(result.success).toBe(true);
      expect(mockBudgetApi.generateBudgets$).toHaveBeenCalledWith(
        expect.objectContaining({
          startMonth: 1,
          startYear: 2026,
          count: 12,
        }),
      );
    });

    it('should use calendar month when payDayOfMonth is undefined', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-15'));

      const result = await service.createInitialBudget({
        firstName: 'Test',
        monthlyIncome: 3000,
      });

      expect(result.success).toBe(true);
      expect(mockBudgetApi.generateBudgets$).toHaveBeenCalledWith(
        expect.objectContaining({
          startMonth: 2,
          startYear: 2026,
          count: 12,
        }),
      );
    });

    it('should prefetch full budget list after create to align list amounts', async () => {
      const result = await service.createInitialBudget({
        firstName: 'Test',
        monthlyIncome: 3000,
      });

      expect(result.success).toBe(true);
      expect(
        (mockBudgetApi.cache as { invalidate: ReturnType<typeof vi.fn> })
          .invalidate,
      ).toHaveBeenCalledWith(['budget']);
      expect(mockBudgetApi.getAllBudgets$).toHaveBeenCalled();
      expect(
        (mockBudgetApi.cache as { prefetch: ReturnType<typeof vi.fn> })
          .prefetch,
      ).toHaveBeenCalledWith(['budget', 'list'], expect.any(Function));
    });

    it('should handle year boundary correctly', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-02'));

      const result = await service.createInitialBudget({
        firstName: 'Test',
        monthlyIncome: 3000,
        payDayOfMonth: 4,
      });

      expect(result.success).toBe(true);
      expect(mockBudgetApi.generateBudgets$).toHaveBeenCalledWith(
        expect.objectContaining({
          startMonth: 12,
          startYear: 2025,
          count: 12,
        }),
      );
    });

    it('should pass templateId from template creation response', async () => {
      const result = await service.createInitialBudget({
        firstName: 'Test',
        monthlyIncome: 3000,
      });

      expect(result.success).toBe(true);
      expect(mockBudgetApi.generateBudgets$).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: 'template-123' }),
      );
    });

    it('should return budget error when generate fails', async () => {
      mockBudgetApi.generateBudgets$.mockReturnValue(
        throwError(() => new Error('budget generation failed')),
      );

      const result = await service.createInitialBudget({
        firstName: 'Test',
        monthlyIncome: 3000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
