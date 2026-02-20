import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { User } from '@supabase/supabase-js';
import { AuthCleanupService } from './auth-cleanup.service';
import { AuthStateService } from './auth-state.service';
import { BudgetApi } from '@core/budget';
import { BudgetInvalidationService } from '../budget/budget-invalidation.service';
import { ClientKeyService } from '@core/encryption';
import { DemoModeService } from '../demo/demo-mode.service';
import { HasBudgetCache } from './has-budget-cache';
import { PreloadService } from '../preload/preload.service';
import { PostHogService } from '../analytics/posthog';
import { StorageService } from '../storage';
import { UserSettingsApi } from '../user-settings/user-settings-api';
import { Logger } from '../logging/logger';
import { type E2EWindow } from './e2e-window';

describe('AuthCleanupService', () => {
  let service: AuthCleanupService;
  let mockState: Partial<AuthStateService>;
  let mockBudgetApi: { cache: { clear: ReturnType<typeof vi.fn> } };
  let mockBudgetInvalidation: Partial<BudgetInvalidationService>;
  let mockClientKey: Partial<ClientKeyService>;
  let mockDemoMode: Partial<DemoModeService>;
  let mockHasBudgetCache: Partial<HasBudgetCache>;
  let mockPreload: Partial<PreloadService>;
  let mockPostHog: Partial<PostHogService>;
  let mockStorage: Partial<StorageService>;
  let mockUserSettings: Partial<UserSettingsApi>;
  let mockLogger: Partial<Logger>;

  const userSignal = signal<User | null>(null);

  beforeEach(() => {
    mockState = {
      user: userSignal.asReadonly(),
      setSession: vi.fn(),
      setLoading: vi.fn(),
    };

    mockBudgetApi = {
      cache: { clear: vi.fn() },
    };

    mockBudgetInvalidation = {
      reset: vi.fn(),
    };

    mockClientKey = {
      clear: vi.fn(),
      clearPreservingDeviceTrust: vi.fn(),
    };

    mockDemoMode = {
      deactivateDemoMode: vi.fn(),
    };

    mockHasBudgetCache = {
      clear: vi.fn(),
    };

    mockPreload = {
      reset: vi.fn(),
    };

    mockPostHog = {
      reset: vi.fn(),
    };

    mockStorage = {
      clearAllUserData: vi.fn(),
    };

    mockUserSettings = {
      reset: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthCleanupService,
        { provide: AuthStateService, useValue: mockState },
        { provide: BudgetApi, useValue: mockBudgetApi },
        {
          provide: BudgetInvalidationService,
          useValue: mockBudgetInvalidation,
        },
        { provide: ClientKeyService, useValue: mockClientKey },
        { provide: DemoModeService, useValue: mockDemoMode },
        { provide: HasBudgetCache, useValue: mockHasBudgetCache },
        { provide: PreloadService, useValue: mockPreload },
        { provide: PostHogService, useValue: mockPostHog },
        { provide: StorageService, useValue: mockStorage },
        { provide: UserSettingsApi, useValue: mockUserSettings },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(AuthCleanupService);
    userSignal.set(null);
  });

  afterEach(() => {
    delete (window as E2EWindow).__E2E_AUTH_BYPASS__;
    delete (window as E2EWindow).__E2E_MOCK_AUTH_STATE__;
  });

  it('should perform cleanup without calling signOut', () => {
    userSignal.set({
      id: 'user-456',
      aud: 'authenticated',
      role: 'authenticated',
    } as User);

    service.performCleanup();

    expect(mockClientKey.clearPreservingDeviceTrust).toHaveBeenCalled();
    expect(mockDemoMode.deactivateDemoMode).toHaveBeenCalled();
    expect(mockHasBudgetCache.clear).toHaveBeenCalled();
    expect(mockBudgetApi.cache.clear).toHaveBeenCalled();
    expect(mockPreload.reset).toHaveBeenCalled();
    expect(mockBudgetInvalidation.reset).toHaveBeenCalled();
    expect(mockUserSettings.reset).toHaveBeenCalled();
    expect(mockPostHog.reset).toHaveBeenCalled();
    expect(mockStorage.clearAllUserData).toHaveBeenCalled();
  });

  it('should prevent double cleanup when called rapidly', () => {
    vi.useFakeTimers();

    userSignal.set({
      id: 'user-789',
      aud: 'authenticated',
      role: 'authenticated',
    } as User);

    service.performCleanup();
    service.performCleanup();

    expect(mockDemoMode.deactivateDemoMode).toHaveBeenCalledTimes(1);
    expect(mockHasBudgetCache.clear).toHaveBeenCalledTimes(1);
    expect(mockPreload.reset).toHaveBeenCalledTimes(1);
    expect(mockBudgetInvalidation.reset).toHaveBeenCalledTimes(1);
    expect(mockUserSettings.reset).toHaveBeenCalledTimes(1);
    expect(mockPostHog.reset).toHaveBeenCalledTimes(1);
    expect(mockStorage.clearAllUserData).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Cleanup already in progress, skipping duplicate call',
    );

    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('should clear timeout on service destruction', () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    userSignal.set({
      id: 'user-123',
      aud: 'authenticated',
      role: 'authenticated',
    } as User);

    service.performCleanup();

    TestBed.resetTestingModule();

    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });

  describe('Error isolation', () => {
    beforeEach(() => {
      userSignal.set({
        id: 'user-err',
        aud: 'authenticated',
        role: 'authenticated',
      } as User);
    });

    it('should continue cleanup when clientKeyService.clearPreservingDeviceTrust() throws', () => {
      (
        mockClientKey.clearPreservingDeviceTrust as ReturnType<typeof vi.fn>
      ).mockImplementation(() => {
        throw new Error('Clear failed');
      });

      service.performCleanup();

      expect(mockDemoMode.deactivateDemoMode).toHaveBeenCalled();
      expect(mockHasBudgetCache.clear).toHaveBeenCalled();
      expect(mockPreload.reset).toHaveBeenCalled();
      expect(mockBudgetInvalidation.reset).toHaveBeenCalled();
      expect(mockUserSettings.reset).toHaveBeenCalled();
      expect(mockPostHog.reset).toHaveBeenCalled();
      expect(mockStorage.clearAllUserData).toHaveBeenCalled();
    });

    it('should continue cleanup when budgetApi.cache.clear() throws', () => {
      mockBudgetApi.cache.clear.mockImplementation(() => {
        throw new Error('Cache clear failed');
      });

      service.performCleanup();

      expect(mockClientKey.clearPreservingDeviceTrust).toHaveBeenCalled();
      expect(mockDemoMode.deactivateDemoMode).toHaveBeenCalled();
      expect(mockHasBudgetCache.clear).toHaveBeenCalled();
      expect(mockPreload.reset).toHaveBeenCalled();
      expect(mockBudgetInvalidation.reset).toHaveBeenCalled();
      expect(mockUserSettings.reset).toHaveBeenCalled();
      expect(mockPostHog.reset).toHaveBeenCalled();
      expect(mockStorage.clearAllUserData).toHaveBeenCalled();
    });

    it('should continue cleanup when storageService.clearAllUserData() throws', () => {
      (
        mockStorage.clearAllUserData as ReturnType<typeof vi.fn>
      ).mockImplementation(() => {
        throw new Error('Storage clear failed');
      });

      service.performCleanup();

      expect(mockClientKey.clearPreservingDeviceTrust).toHaveBeenCalled();
      expect(mockDemoMode.deactivateDemoMode).toHaveBeenCalled();
      expect(mockHasBudgetCache.clear).toHaveBeenCalled();
      expect(mockPreload.reset).toHaveBeenCalled();
      expect(mockBudgetInvalidation.reset).toHaveBeenCalled();
      expect(mockUserSettings.reset).toHaveBeenCalled();
      expect(mockPostHog.reset).toHaveBeenCalled();
    });
  });

  describe('Debounce reset', () => {
    it('should allow second cleanup after debounce timer expires', () => {
      vi.useFakeTimers();

      userSignal.set({
        id: 'user-debounce',
        aud: 'authenticated',
        role: 'authenticated',
      } as User);

      service.performCleanup();
      expect(mockDemoMode.deactivateDemoMode).toHaveBeenCalledTimes(1);
      expect(mockPreload.reset).toHaveBeenCalledTimes(1);
      expect(mockBudgetInvalidation.reset).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);

      service.performCleanup();
      expect(mockDemoMode.deactivateDemoMode).toHaveBeenCalledTimes(2);
      expect(mockPreload.reset).toHaveBeenCalledTimes(2);
      expect(mockBudgetInvalidation.reset).toHaveBeenCalledTimes(2);
      expect(mockUserSettings.reset).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });
});
