import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import type { User } from '@supabase/supabase-js';
import { AuthCleanupService } from './auth-cleanup.service';
import { AuthStore } from './auth-store';
import { BudgetApi } from '@core/budget';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { ClientKeyService } from '@core/encryption';
import { DemoModeService } from '../demo/demo-mode.service';
import { PreloadService } from '../preload/preload.service';
import { PostHogService } from '../analytics/posthog';
import { StorageService } from '../storage';
import { UserSettingsStore } from '../user-settings/user-settings-store';
import { Logger } from '../logging/logger';
import { type E2EWindow } from './e2e-window';

describe('AuthCleanupService', () => {
  let service: AuthCleanupService;
  let mockState: Partial<AuthStore>;
  let mockBudgetApi: { clearCache: ReturnType<typeof vi.fn> };
  let mockBudgetTemplatesApi: { clearCache: ReturnType<typeof vi.fn> };
  let mockClientKey: Partial<ClientKeyService>;
  let mockDemoMode: Partial<DemoModeService>;
  let mockPreload: Partial<PreloadService>;
  let mockPostHog: Partial<PostHogService>;
  let mockStorage: Partial<StorageService>;
  let mockUserSettings: Partial<UserSettingsStore>;
  let mockLogger: Partial<Logger>;
  let userSignal: ReturnType<typeof signal<User | null>>;

  beforeEach(() => {
    userSignal = signal<User | null>(null);
    mockState = {
      user: userSignal.asReadonly(),
      set: vi.fn(),
    };

    mockBudgetApi = { clearCache: vi.fn() };
    mockBudgetTemplatesApi = { clearCache: vi.fn() };
    mockClientKey = {
      clear: vi.fn(),
      clearPreservingDeviceTrust: vi.fn(),
    };
    mockDemoMode = { deactivateDemoMode: vi.fn() };
    mockPreload = { reset: vi.fn() };
    mockPostHog = { reset: vi.fn() };
    mockStorage = { clearAllUserData: vi.fn() };
    mockUserSettings = { reset: vi.fn() };
    mockLogger = { info: vi.fn(), error: vi.fn(), debug: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AuthCleanupService,
        { provide: AuthStore, useValue: mockState },
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: BudgetTemplatesApi, useValue: mockBudgetTemplatesApi },
        { provide: ClientKeyService, useValue: mockClientKey },
        { provide: DemoModeService, useValue: mockDemoMode },
        { provide: PreloadService, useValue: mockPreload },
        { provide: PostHogService, useValue: mockPostHog },
        { provide: StorageService, useValue: mockStorage },
        { provide: UserSettingsStore, useValue: mockUserSettings },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(AuthCleanupService);
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
    expect(mockBudgetApi.clearCache).toHaveBeenCalled();
    expect(mockBudgetTemplatesApi.clearCache).toHaveBeenCalled();
    expect(mockPreload.reset).toHaveBeenCalled();
    expect(mockUserSettings.reset).toHaveBeenCalled();
    expect(mockPostHog.reset).toHaveBeenCalled();
    expect(mockStorage.clearAllUserData).toHaveBeenCalled();
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
      expect(mockPreload.reset).toHaveBeenCalled();
      expect(mockUserSettings.reset).toHaveBeenCalled();
      expect(mockPostHog.reset).toHaveBeenCalled();
      expect(mockStorage.clearAllUserData).toHaveBeenCalled();
    });

    it('should continue cleanup when budgetApi.clearCache() throws', () => {
      mockBudgetApi.clearCache.mockImplementation(() => {
        throw new Error('Cache clear failed');
      });

      service.performCleanup();

      expect(mockClientKey.clearPreservingDeviceTrust).toHaveBeenCalled();
      expect(mockDemoMode.deactivateDemoMode).toHaveBeenCalled();
      expect(mockPreload.reset).toHaveBeenCalled();
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
      expect(mockPreload.reset).toHaveBeenCalled();
      expect(mockUserSettings.reset).toHaveBeenCalled();
      expect(mockPostHog.reset).toHaveBeenCalled();
    });
  });
});
