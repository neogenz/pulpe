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

describe('hasBudgetGuard', () => {
  let mockBudgetApi: { getAllBudgets$: ReturnType<typeof vi.fn> };
  let mockRouter: { createUrlTree: ReturnType<typeof vi.fn> };

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  beforeEach(() => {
    mockBudgetApi = {
      getAllBudgets$: vi.fn(),
    };

    mockRouter = {
      createUrlTree: vi.fn().mockReturnValue({} as UrlTree),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: Router, useValue: mockRouter },
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

  it('should redirect to complete-profile on API error', async () => {
    mockBudgetApi.getAllBudgets$.mockReturnValue(
      throwError(() => new Error('API Error')),
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
});
