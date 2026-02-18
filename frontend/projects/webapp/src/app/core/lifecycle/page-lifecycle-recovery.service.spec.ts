import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PAGE_RELOAD,
  PAGE_RESUME_THRESHOLD_MS,
  PageLifecycleRecoveryService,
} from './page-lifecycle-recovery.service';
import { Logger } from '@core/logging/logger';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { AuthStateService } from '@core/auth/auth-state.service';
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { UserSettingsApi } from '@core/user-settings';

function setVisibilityState(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
}

function dispatchPageShow(persisted: boolean): void {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', {
    configurable: true,
    value: persisted,
  });
  window.dispatchEvent(event);
}

describe('PageLifecycleRecoveryService', () => {
  const reloadSpy = vi.fn();
  const mockRouter = { url: '/dashboard' };
  const mockAuthState = {
    isLoading: vi.fn<() => boolean>().mockReturnValue(false),
    isAuthenticated: vi.fn<() => boolean>().mockReturnValue(true),
  };
  const mockAuthSession = {
    refreshSession: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  };
  const mockBudgetInvalidation = {
    invalidate: vi.fn(),
  };
  const mockUserSettingsApi = {
    reload: vi.fn(),
  };
  const mockLogger = {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  };

  let service: PageLifecycleRecoveryService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    reloadSpy.mockReset();
    mockAuthState.isLoading.mockReset();
    mockAuthState.isAuthenticated.mockReset();
    mockAuthState.isLoading.mockReturnValue(false);
    mockAuthState.isAuthenticated.mockReturnValue(true);
    mockAuthSession.refreshSession.mockReset();
    mockAuthSession.refreshSession.mockResolvedValue(true);
    mockBudgetInvalidation.invalidate.mockReset();
    mockUserSettingsApi.reload.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.info.mockReset();
    mockLogger.debug.mockReset();
    mockRouter.url = '/dashboard';
    sessionStorage.clear();
    setVisibilityState('visible');
    Object.defineProperty(document, 'wasDiscarded', {
      configurable: true,
      value: false,
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        PageLifecycleRecoveryService,
        { provide: PAGE_RELOAD, useValue: reloadSpy },
        { provide: Router, useValue: mockRouter },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: AuthSessionService, useValue: mockAuthSession },
        {
          provide: BudgetInvalidationService,
          useValue: mockBudgetInvalidation,
        },
        { provide: UserSettingsApi, useValue: mockUserSettingsApi },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(PageLifecycleRecoveryService);
    service.initialize();
  });

  it('should perform soft recovery on pageshow persisted for protected routes', async () => {
    dispatchPageShow(true);
    await vi.waitFor(() => {
      expect(mockAuthSession.refreshSession).toHaveBeenCalledOnce();
    });
    expect(mockBudgetInvalidation.invalidate).toHaveBeenCalledOnce();
    expect(mockUserSettingsApi.reload).toHaveBeenCalledOnce();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should perform soft recovery when document was discarded on pageshow', async () => {
    Object.defineProperty(document, 'wasDiscarded', {
      configurable: true,
      value: true,
    });

    dispatchPageShow(false);
    await vi.waitFor(() => {
      expect(mockAuthSession.refreshSession).toHaveBeenCalledOnce();
    });
    expect(mockBudgetInvalidation.invalidate).toHaveBeenCalledOnce();
    expect(mockUserSettingsApi.reload).toHaveBeenCalledOnce();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should not trigger recovery for short background/foreground switch', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000);

    setVisibilityState('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    nowSpy.mockReturnValue(1_000 + PAGE_RESUME_THRESHOLD_MS - 1);
    setVisibilityState('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockAuthSession.refreshSession).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should perform soft recovery when tab resumes after long background period', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000);

    setVisibilityState('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    nowSpy.mockReturnValue(1_000 + PAGE_RESUME_THRESHOLD_MS + 1);
    setVisibilityState('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    await vi.waitFor(() => {
      expect(mockAuthSession.refreshSession).toHaveBeenCalledOnce();
    });
    expect(mockBudgetInvalidation.invalidate).toHaveBeenCalledOnce();
    expect(mockUserSettingsApi.reload).toHaveBeenCalledOnce();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should fallback to hard reload when soft recovery fails', async () => {
    mockAuthSession.refreshSession.mockResolvedValue(false);

    dispatchPageShow(true);

    await vi.waitFor(() => {
      expect(reloadSpy).toHaveBeenCalledOnce();
    });
    expect(mockBudgetInvalidation.invalidate).not.toHaveBeenCalled();
    expect(mockUserSettingsApi.reload).not.toHaveBeenCalled();
  });

  it('should not trigger duplicate reloads within cooldown window', async () => {
    mockAuthSession.refreshSession.mockResolvedValue(false);
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(5_000);

    dispatchPageShow(true);
    await vi.waitFor(() => {
      expect(reloadSpy).toHaveBeenCalledOnce();
    });

    nowSpy.mockReturnValue(5_500);
    dispatchPageShow(true);

    await vi.waitFor(() => {
      expect(mockAuthSession.refreshSession).toHaveBeenCalledTimes(2);
    });
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it('should skip recovery while auth is loading', async () => {
    mockAuthState.isLoading.mockReturnValue(true);

    dispatchPageShow(true);
    await Promise.resolve();

    expect(mockAuthSession.refreshSession).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should not recover on non-protected routes', async () => {
    mockRouter.url = '/welcome';
    dispatchPageShow(true);
    await Promise.resolve();

    expect(mockAuthSession.refreshSession).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should fall back to location.pathname when router.url is "/" before navigation settles', async () => {
    mockRouter.url = '/';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, pathname: '/dashboard' },
    });

    dispatchPageShow(true);
    await vi.waitFor(() => {
      expect(mockAuthSession.refreshSession).toHaveBeenCalledOnce();
    });
    expect(mockBudgetInvalidation.invalidate).toHaveBeenCalledOnce();
    expect(mockUserSettingsApi.reload).toHaveBeenCalledOnce();
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
