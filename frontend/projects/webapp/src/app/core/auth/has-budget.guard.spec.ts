import { TestBed } from '@angular/core/testing';
import {
  Router,
  type UrlTree,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { hasBudgetGuard } from './has-budget.guard';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';
import { HasBudgetCache } from './has-budget-cache';

describe('hasBudgetGuard', () => {
  let mockBudgetApi: {
    checkBudgetExists$: ReturnType<typeof vi.fn>;
  };
  let mockRouter: { createUrlTree: ReturnType<typeof vi.fn> };
  let mockLogger: { error: ReturnType<typeof vi.fn> };
  let mockHasBudgetCache: {
    hasBudget: ReturnType<typeof vi.fn>;
    setHasBudget: ReturnType<typeof vi.fn>;
  };

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  beforeEach(() => {
    mockBudgetApi = {
      checkBudgetExists$: vi.fn(),
    };

    mockRouter = {
      createUrlTree: vi.fn().mockReturnValue({} as UrlTree),
    };

    mockLogger = {
      error: vi.fn(),
    };

    mockHasBudgetCache = {
      hasBudget: vi.fn().mockReturnValue(null),
      setHasBudget: vi.fn(),
    };

    mockHasBudgetCache = {
      hasBudget: vi.fn().mockReturnValue(null),
      setHasBudget: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: Router, useValue: mockRouter },
        { provide: Logger, useValue: mockLogger },
        { provide: HasBudgetCache, useValue: mockHasBudgetCache },
      ],
    });
  });

  it('should allow navigation when user has budgets', async () => {
    mockHasBudgetCache.hasBudget.mockReturnValue(null);
    mockBudgetApi.checkBudgetExists$.mockReturnValue(of(true));

    const result = await TestBed.runInInjectionContext(() =>
      hasBudgetGuard(mockRoute, mockState),
    );

    expect(result).toBe(true);
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect to complete-profile when user has no budgets', async () => {
    mockHasBudgetCache.hasBudget.mockReturnValue(null);
    mockBudgetApi.checkBudgetExists$.mockReturnValue(of(false));

    const result = await TestBed.runInInjectionContext(() =>
      hasBudgetGuard(mockRoute, mockState),
    );

    expect(result).toEqual({});
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
      '/',
      ROUTES.COMPLETE_PROFILE,
    ]);
  });

  it('should redirect to complete-profile on API error (fail-closed)', async () => {
    mockHasBudgetCache.hasBudget.mockReturnValue(null);
    mockBudgetApi.checkBudgetExists$.mockReturnValue(
      throwError(() => new Error('API Error')),
    );

    const result = await TestBed.runInInjectionContext(() =>
      hasBudgetGuard(mockRoute, mockState),
    );

    expect(result).toEqual({});
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
      '/',
      ROUTES.COMPLETE_PROFILE,
    ]);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'hasBudgetGuard: API error during cache miss, redirecting to complete-profile (fail-closed)',
      expect.any(Error),
    );
  });

  describe('cache behavior', () => {
    it('should return true immediately when cache indicates user has budget (fast path)', async () => {
      mockHasBudgetCache.hasBudget.mockReturnValue(true);

      const result = await TestBed.runInInjectionContext(() =>
        hasBudgetGuard(mockRoute, mockState),
      );

      expect(result).toBe(true);
      expect(mockBudgetApi.checkBudgetExists$).not.toHaveBeenCalled();
    });

    it('should redirect immediately when cache indicates no budget (fast path)', async () => {
      mockHasBudgetCache.hasBudget.mockReturnValue(false);

      const result = await TestBed.runInInjectionContext(() =>
        hasBudgetGuard(mockRoute, mockState),
      );

      expect(result).toEqual({});
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        ROUTES.COMPLETE_PROFILE,
      ]);
      expect(mockBudgetApi.checkBudgetExists$).not.toHaveBeenCalled();
    });

    it('should fetch from API when cache is empty (slow path)', async () => {
      mockHasBudgetCache.hasBudget.mockReturnValue(null);
      mockBudgetApi.checkBudgetExists$.mockReturnValue(of(true));

      await TestBed.runInInjectionContext(() =>
        hasBudgetGuard(mockRoute, mockState),
      );

      expect(mockBudgetApi.checkBudgetExists$).toHaveBeenCalled();
    });
  });
});
