import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { AppPreloader } from './app-preloader';
import { AuthStateService } from '../auth/auth-state.service';
import { UserSettingsApi } from '../user-settings/user-settings-api';
import { BudgetCache } from '../budget/budget-cache';
import { TemplateCache } from '../template/template-cache';
import { Logger } from '../logging/logger';

describe('AppPreloader', () => {
  let preloader: AppPreloader;
  let mockAuthState: { isAuthenticated: ReturnType<typeof vi.fn> };
  let mockUserSettings: { payDayOfMonth: ReturnType<typeof vi.fn> };
  let mockBudgetCache: {
    preloadBudgetList: ReturnType<typeof vi.fn>;
    preloadBudgetDetails: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    budgets: ReturnType<typeof vi.fn>;
  };
  let mockTemplateCache: {
    preloadAll: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAuthState = {
      isAuthenticated: vi.fn().mockReturnValue(false),
    };

    mockUserSettings = {
      payDayOfMonth: vi.fn().mockReturnValue(1),
    };

    mockBudgetCache = {
      preloadBudgetList: vi.fn().mockResolvedValue([]),
      preloadBudgetDetails: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn(),
      budgets: vi.fn().mockReturnValue(null),
    };

    mockTemplateCache = {
      preloadAll: vi.fn().mockResolvedValue([]),
      clear: vi.fn(),
    };

    mockLogger = {
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AppPreloader,
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: UserSettingsApi, useValue: mockUserSettings },
        { provide: BudgetCache, useValue: mockBudgetCache },
        { provide: TemplateCache, useValue: mockTemplateCache },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    preloader = TestBed.inject(AppPreloader);
  });

  describe('reset', () => {
    it('should call clear on BudgetCache', () => {
      preloader.reset();

      expect(mockBudgetCache.clear).toHaveBeenCalled();
    });

    it('should call clear on TemplateCache', () => {
      preloader.reset();

      expect(mockTemplateCache.clear).toHaveBeenCalled();
    });

    it('should reset preloading flag to allow re-preloading', () => {
      preloader.reset();

      expect(mockBudgetCache.clear).toHaveBeenCalledTimes(1);
      expect(mockTemplateCache.clear).toHaveBeenCalledTimes(1);
    });

    it('should call both clear methods in a single reset call', () => {
      preloader.reset();

      expect(mockBudgetCache.clear).toHaveBeenCalledOnce();
      expect(mockTemplateCache.clear).toHaveBeenCalledOnce();
    });
  });
});
