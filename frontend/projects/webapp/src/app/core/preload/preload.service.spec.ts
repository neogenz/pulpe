import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PreloadService } from './preload.service';
import { AuthStateService } from '../auth/auth-state.service';
import { BudgetApi } from '../budget/budget-api';
import { UserSettingsApi } from '../user-settings/user-settings-api';
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

  const mockUserSettingsApi = {
    initialize: vi.fn().mockResolvedValue(undefined),
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
      { provide: UserSettingsApi, useValue: mockUserSettingsApi },
      { provide: Logger, useValue: mockLogger },
    ],
  });

  TestBed.inject(PreloadService);

  return { mockBudgetApi, mockUserSettingsApi };
}

describe('PreloadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should preload budgets and user settings when authenticated', async () => {
    const { mockBudgetApi, mockUserSettingsApi } = setup(true);

    await TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(mockBudgetApi.checkBudgetExists$).toHaveBeenCalled();
      expect(mockBudgetApi.getAllBudgets$).toHaveBeenCalled();
      expect(mockUserSettingsApi.initialize).toHaveBeenCalled();
    });
  });

  it('should not preload when not authenticated', async () => {
    const { mockBudgetApi, mockUserSettingsApi } = setup(false);

    await TestBed.flushEffects();

    expect(mockBudgetApi.checkBudgetExists$).not.toHaveBeenCalled();
    expect(mockBudgetApi.getAllBudgets$).not.toHaveBeenCalled();
    expect(mockUserSettingsApi.initialize).not.toHaveBeenCalled();
  });

  it('should handle individual preload failures without blocking others (allSettled)', async () => {
    const { mockBudgetApi, mockUserSettingsApi } = setup(true);
    mockBudgetApi.checkBudgetExists$.mockReturnValue(
      throwError(() => new Error('Network error')),
    );
    mockBudgetApi.getAllBudgets$.mockReturnValue(of([]));
    mockUserSettingsApi.initialize.mockResolvedValue(undefined);

    await TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockBudgetApi.getAllBudgets$).toHaveBeenCalled();
      expect(mockUserSettingsApi.initialize).toHaveBeenCalled();
    });
  });

  it('should log warnings for each failed preload item', async () => {
    const { mockBudgetApi, mockUserSettingsApi } = setup(true);
    mockBudgetApi.checkBudgetExists$.mockReturnValue(
      throwError(() => new Error('Budget check failed')),
    );
    mockBudgetApi.getAllBudgets$.mockReturnValue(
      throwError(() => new Error('Budget list failed')),
    );
    mockUserSettingsApi.initialize.mockRejectedValue(
      new Error('Settings failed'),
    );

    await TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(mockLogger.warn).toHaveBeenCalledTimes(3);
    });
  });
});
