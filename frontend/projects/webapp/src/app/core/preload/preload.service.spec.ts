import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PreloadService } from './preload.service';
import { AuthStateService } from '../auth/auth-state.service';
import { BudgetApi } from '../budget/budget-api';
import { Logger } from '../logging/logger';

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function setup(authenticated: boolean) {
  const mockBudgetApi = {
    checkBudgetExists$: vi.fn().mockReturnValue(of(true)),
    getAllBudgets$: vi.fn().mockReturnValue(of([])),
  };

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      PreloadService,
      {
        provide: AuthStateService,
        useValue: { isAuthenticated: signal(authenticated) },
      },
      { provide: BudgetApi, useValue: mockBudgetApi },
      { provide: Logger, useValue: mockLogger },
    ],
  });

  TestBed.inject(PreloadService);

  return { mockBudgetApi };
}

describe('PreloadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should preload data when authenticated', async () => {
    const { mockBudgetApi } = setup(true);

    await TestBed.flushEffects();

    expect(mockBudgetApi.checkBudgetExists$).toHaveBeenCalled();
    expect(mockBudgetApi.getAllBudgets$).toHaveBeenCalled();
  });

  it('should not preload when not authenticated', async () => {
    const { mockBudgetApi } = setup(false);

    await TestBed.flushEffects();

    expect(mockBudgetApi.checkBudgetExists$).not.toHaveBeenCalled();
    expect(mockBudgetApi.getAllBudgets$).not.toHaveBeenCalled();
  });

  it('should handle preload errors gracefully', async () => {
    const { mockBudgetApi } = setup(true);
    const networkError = () => throwError(() => new Error('Network error'));
    mockBudgetApi.checkBudgetExists$.mockReturnValue(networkError());
    mockBudgetApi.getAllBudgets$.mockReturnValue(networkError());

    await TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });
  });
});
