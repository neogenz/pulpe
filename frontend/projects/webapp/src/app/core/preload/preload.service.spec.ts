import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PreloadService } from './preload.service';
import { AuthStateService } from '../auth/auth-state.service';
import { BudgetApi } from '../budget/budget-api';
import { ClientKeyService } from '../encryption/client-key.service';
import { DemoModeService } from '../demo/demo-mode.service';
import { UserSettingsApi } from '../user-settings/user-settings-api';
import { Logger } from '../logging/logger';

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function setup({
  authenticated = true,
  hasClientKey = true,
  isDemoMode = false,
}: {
  authenticated?: boolean;
  hasClientKey?: boolean;
  isDemoMode?: boolean;
} = {}) {
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
      {
        provide: ClientKeyService,
        useValue: { hasClientKey: signal(hasClientKey) },
      },
      {
        provide: DemoModeService,
        useValue: { isDemoMode: () => isDemoMode },
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

  it('should preload budgets and user settings when authenticated with client key', async () => {
    const { mockBudgetApi, mockUserSettingsApi } = setup();

    await TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(mockBudgetApi.checkBudgetExists$).toHaveBeenCalled();
      expect(mockBudgetApi.getAllBudgets$).toHaveBeenCalled();
      expect(mockUserSettingsApi.initialize).toHaveBeenCalled();
    });
  });

  it('should preload in demo mode even without client key', async () => {
    const { mockBudgetApi, mockUserSettingsApi } = setup({
      hasClientKey: false,
      isDemoMode: true,
    });

    await TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(mockBudgetApi.checkBudgetExists$).toHaveBeenCalled();
      expect(mockUserSettingsApi.initialize).toHaveBeenCalled();
    });
  });

  it('should not preload when not authenticated', async () => {
    const { mockBudgetApi, mockUserSettingsApi } = setup({
      authenticated: false,
    });

    await TestBed.flushEffects();

    expect(mockBudgetApi.checkBudgetExists$).not.toHaveBeenCalled();
    expect(mockBudgetApi.getAllBudgets$).not.toHaveBeenCalled();
    expect(mockUserSettingsApi.initialize).not.toHaveBeenCalled();
  });

  it('should not preload when authenticated but no client key (vault code not entered)', async () => {
    const { mockBudgetApi, mockUserSettingsApi } = setup({
      hasClientKey: false,
    });

    await TestBed.flushEffects();

    expect(mockBudgetApi.checkBudgetExists$).not.toHaveBeenCalled();
    expect(mockBudgetApi.getAllBudgets$).not.toHaveBeenCalled();
    expect(mockUserSettingsApi.initialize).not.toHaveBeenCalled();
  });

  it('should handle individual preload failures without blocking others (allSettled)', async () => {
    const { mockBudgetApi, mockUserSettingsApi } = setup();
    mockBudgetApi.checkBudgetExists$.mockReturnValue(
      throwError(() => new Error('Network error')),
    );
    mockBudgetApi.getAllBudgets$.mockReturnValue(of([]));
    mockUserSettingsApi.initialize.mockResolvedValue(undefined);

    await TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('checkBudgetExists'),
        expect.anything(),
      );
      expect(mockBudgetApi.getAllBudgets$).toHaveBeenCalled();
      expect(mockUserSettingsApi.initialize).toHaveBeenCalled();
    });
  });

  it('should log warnings with operation name for each failed preload item', async () => {
    const { mockBudgetApi, mockUserSettingsApi } = setup();
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
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('checkBudgetExists'),
        expect.anything(),
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('getAllBudgets'),
        expect.anything(),
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('userSettings'),
        expect.anything(),
      );
    });
  });
});
