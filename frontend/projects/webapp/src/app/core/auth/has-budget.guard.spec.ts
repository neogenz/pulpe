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

describe('hasBudgetGuard', () => {
  let mockBudgetApi: {
    checkBudgetExists$: ReturnType<typeof vi.fn>;
    getCachedBudgetExists: ReturnType<typeof vi.fn>;
  };
  let mockRouter: { createUrlTree: ReturnType<typeof vi.fn> };
  let mockLogger: { error: ReturnType<typeof vi.fn> };
  let expectedUrlTree: UrlTree;

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  beforeEach(() => {
    expectedUrlTree = { toString: () => '/complete-profile' } as UrlTree;

    mockBudgetApi = {
      checkBudgetExists$: vi.fn(),
      getCachedBudgetExists: vi.fn().mockReturnValue(null),
    };

    mockRouter = {
      createUrlTree: vi.fn().mockReturnValue(expectedUrlTree),
    };

    mockLogger = {
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: Router, useValue: mockRouter },
        { provide: Logger, useValue: mockLogger },
      ],
    });
  });

  it('should allow navigation when user has budgets', async () => {
    mockBudgetApi.checkBudgetExists$.mockReturnValue(of(true));

    const result = await TestBed.runInInjectionContext(() =>
      hasBudgetGuard(mockRoute, mockState),
    );

    expect(result).toBe(true);
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect to complete-profile when user has no budgets', async () => {
    mockBudgetApi.checkBudgetExists$.mockReturnValue(of(false));

    const result = await TestBed.runInInjectionContext(() =>
      hasBudgetGuard(mockRoute, mockState),
    );

    expect(result).toBe(expectedUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
      '/',
      ROUTES.COMPLETE_PROFILE,
    ]);
  });

  it('should redirect to complete-profile on API error (fail-closed)', async () => {
    mockBudgetApi.checkBudgetExists$.mockReturnValue(
      throwError(() => new Error('API Error')),
    );

    const result = await TestBed.runInInjectionContext(() =>
      hasBudgetGuard(mockRoute, mockState),
    );

    expect(result).toBe(expectedUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
      '/',
      ROUTES.COMPLETE_PROFILE,
    ]);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'hasBudgetGuard: API error, redirecting to complete-profile (fail-closed)',
      expect.any(Error),
    );
  });

  describe('cache behavior', () => {
    it('should return true immediately when fresh cache indicates user has budget', async () => {
      mockBudgetApi.getCachedBudgetExists.mockReturnValue({
        data: true,
        fresh: true,
      });

      const result = await TestBed.runInInjectionContext(() =>
        hasBudgetGuard(mockRoute, mockState),
      );

      expect(result).toBe(true);
      expect(mockBudgetApi.checkBudgetExists$).not.toHaveBeenCalled();
    });

    it('should redirect immediately when fresh cache indicates no budget', async () => {
      mockBudgetApi.getCachedBudgetExists.mockReturnValue({
        data: false,
        fresh: true,
      });

      const result = await TestBed.runInInjectionContext(() =>
        hasBudgetGuard(mockRoute, mockState),
      );

      expect(result).toBe(expectedUrlTree);
      expect(mockBudgetApi.checkBudgetExists$).not.toHaveBeenCalled();
    });

    it('should trust stale cache when data is true (budget does not disappear)', async () => {
      mockBudgetApi.getCachedBudgetExists.mockReturnValue({
        data: true,
        fresh: false,
      });

      const result = await TestBed.runInInjectionContext(() =>
        hasBudgetGuard(mockRoute, mockState),
      );

      expect(result).toBe(true);
      expect(mockBudgetApi.checkBudgetExists$).not.toHaveBeenCalled();
    });

    it('should revalidate via API when stale cache says no budget', async () => {
      mockBudgetApi.getCachedBudgetExists.mockReturnValue({
        data: false,
        fresh: false,
      });
      mockBudgetApi.checkBudgetExists$.mockReturnValue(of(true));

      const result = await TestBed.runInInjectionContext(() =>
        hasBudgetGuard(mockRoute, mockState),
      );

      expect(result).toBe(true);
      expect(mockBudgetApi.checkBudgetExists$).toHaveBeenCalled();
    });

    it('should fetch from API when cache is empty', async () => {
      mockBudgetApi.checkBudgetExists$.mockReturnValue(of(true));

      await TestBed.runInInjectionContext(() =>
        hasBudgetGuard(mockRoute, mockState),
      );

      expect(mockBudgetApi.checkBudgetExists$).toHaveBeenCalled();
    });
  });
});
