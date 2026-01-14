import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
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
import { HasBudgetState } from './has-budget-state';

describe('hasBudgetGuard', () => {
  let mockBudgetApi: { getAllBudgets$: ReturnType<typeof vi.fn> };
  let mockRouter: { createUrlTree: ReturnType<typeof vi.fn> };
  let mockLogger: { warn: ReturnType<typeof vi.fn> };
  let mockHasBudgetState: {
    get: ReturnType<typeof vi.fn>;
    setHasBudget: ReturnType<typeof vi.fn>;
    setNoBudget: ReturnType<typeof vi.fn>;
  };

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  beforeEach(() => {
    mockBudgetApi = {
      getAllBudgets$: vi.fn(),
    };

    mockRouter = {
      createUrlTree: vi.fn().mockReturnValue({} as UrlTree),
    };

    mockLogger = {
      warn: vi.fn(),
    };

    mockHasBudgetState = {
      get: vi.fn().mockReturnValue(null),
      setHasBudget: vi.fn(),
      setNoBudget: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: Router, useValue: mockRouter },
        { provide: Logger, useValue: mockLogger },
        { provide: HasBudgetState, useValue: mockHasBudgetState },
      ],
    });
  });

  it('should allow navigation when user has budgets', async () => {
    mockBudgetApi.getAllBudgets$.mockReturnValue(
      of([{ id: 'budget-1', name: 'Test Budget' }]),
    );

    const result = await TestBed.runInInjectionContext(() =>
      hasBudgetGuard(mockRoute, mockState),
    );

    expect(result).toBe(true);
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect to complete-profile when user has no budgets', async () => {
    mockBudgetApi.getAllBudgets$.mockReturnValue(of([]));

    const result = await TestBed.runInInjectionContext(() =>
      hasBudgetGuard(mockRoute, mockState),
    );

    expect(result).toEqual({});
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
      '/',
      'app',
      'complete-profile',
    ]);
  });

  it('should redirect to complete-profile on validation error', async () => {
    mockBudgetApi.getAllBudgets$.mockReturnValue(
      throwError(() => new Error('Validation Error')),
    );

    const result = await TestBed.runInInjectionContext(() =>
      hasBudgetGuard(mockRoute, mockState),
    );

    expect(result).toEqual({});
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
      '/',
      'app',
      'complete-profile',
    ]);
  });

  it('should allow navigation on network error (status 0)', async () => {
    const networkError = new HttpErrorResponse({
      status: 0,
      statusText: 'Unknown Error',
    });
    mockBudgetApi.getAllBudgets$.mockReturnValue(
      throwError(() => networkError),
    );

    const result = await TestBed.runInInjectionContext(() =>
      hasBudgetGuard(mockRoute, mockState),
    );

    expect(result).toBe(true);
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'hasBudgetGuard: Network or server error, allowing navigation',
      { status: 0 },
    );
  });

  it('should allow navigation on server error (status 500+)', async () => {
    const serverError = new HttpErrorResponse({
      status: 503,
      statusText: 'Service Unavailable',
    });
    mockBudgetApi.getAllBudgets$.mockReturnValue(throwError(() => serverError));

    const result = await TestBed.runInInjectionContext(() =>
      hasBudgetGuard(mockRoute, mockState),
    );

    expect(result).toBe(true);
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'hasBudgetGuard: Network or server error, allowing navigation',
      { status: 503 },
    );
  });

  it('should redirect to complete-profile on client error (4xx)', async () => {
    const clientError = new HttpErrorResponse({
      status: 403,
      statusText: 'Forbidden',
    });
    mockBudgetApi.getAllBudgets$.mockReturnValue(throwError(() => clientError));

    const result = await TestBed.runInInjectionContext(() =>
      hasBudgetGuard(mockRoute, mockState),
    );

    expect(result).toEqual({});
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
      '/',
      'app',
      'complete-profile',
    ]);
  });

  describe('cache behavior', () => {
    it('should return true immediately when cache indicates user has budget', async () => {
      mockHasBudgetState.get.mockReturnValue(true);

      const result = await TestBed.runInInjectionContext(() =>
        hasBudgetGuard(mockRoute, mockState),
      );

      expect(result).toBe(true);
      expect(mockBudgetApi.getAllBudgets$).not.toHaveBeenCalled();
    });

    it('should redirect immediately when cache indicates no budget', async () => {
      mockHasBudgetState.get.mockReturnValue(false);

      const result = await TestBed.runInInjectionContext(() =>
        hasBudgetGuard(mockRoute, mockState),
      );

      expect(result).toEqual({});
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/',
        'app',
        'complete-profile',
      ]);
      expect(mockBudgetApi.getAllBudgets$).not.toHaveBeenCalled();
    });

    it('should update cache after successful API call with budgets', async () => {
      mockHasBudgetState.get.mockReturnValue(null);
      mockBudgetApi.getAllBudgets$.mockReturnValue(
        of([{ id: 'budget-1', name: 'Test Budget' }]),
      );

      await TestBed.runInInjectionContext(() =>
        hasBudgetGuard(mockRoute, mockState),
      );

      expect(mockHasBudgetState.setHasBudget).toHaveBeenCalled();
      expect(mockHasBudgetState.setNoBudget).not.toHaveBeenCalled();
    });

    it('should update cache after successful API call with no budgets', async () => {
      mockHasBudgetState.get.mockReturnValue(null);
      mockBudgetApi.getAllBudgets$.mockReturnValue(of([]));

      await TestBed.runInInjectionContext(() =>
        hasBudgetGuard(mockRoute, mockState),
      );

      expect(mockHasBudgetState.setNoBudget).toHaveBeenCalled();
      expect(mockHasBudgetState.setHasBudget).not.toHaveBeenCalled();
    });
  });
});
