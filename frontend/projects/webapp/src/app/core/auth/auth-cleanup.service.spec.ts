import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { User } from '@supabase/supabase-js';
import { AuthCleanupService } from './auth-cleanup.service';
import { AuthStateService } from './auth-state.service';
import { DemoModeService } from '../demo/demo-mode.service';
import { HasBudgetCache } from './has-budget-cache';
import { PostHogService } from '../analytics/posthog';
import { StorageService } from '../storage';
import { Logger } from '../logging/logger';
import { type E2EWindow } from './e2e-window';

describe('AuthCleanupService', () => {
  let service: AuthCleanupService;
  let mockState: Partial<AuthStateService>;
  let mockDemoMode: Partial<DemoModeService>;
  let mockHasBudgetCache: Partial<HasBudgetCache>;
  let mockPostHog: Partial<PostHogService>;
  let mockStorage: Partial<StorageService>;
  let mockLogger: Partial<Logger>;

  const userSignal = signal<User | null>(null);

  beforeEach(() => {
    mockState = {
      user: userSignal.asReadonly(),
      setSession: vi.fn(),
      setLoading: vi.fn(),
    };

    mockDemoMode = {
      deactivateDemoMode: vi.fn(),
    };

    mockHasBudgetCache = {
      clear: vi.fn(),
    };

    mockPostHog = {
      reset: vi.fn(),
    };

    mockStorage = {
      clearAllUserData: vi.fn(),
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
        { provide: DemoModeService, useValue: mockDemoMode },
        { provide: HasBudgetCache, useValue: mockHasBudgetCache },
        { provide: PostHogService, useValue: mockPostHog },
        { provide: StorageService, useValue: mockStorage },
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

    expect(mockDemoMode.deactivateDemoMode).toHaveBeenCalled();
    expect(mockHasBudgetCache.clear).toHaveBeenCalled();
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
});
