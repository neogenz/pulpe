import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResumeRefreshService } from './resume-refresh.service';
import { PAGE_RELOAD } from '@core/page-reload';
import { Logger } from '@core/logging/logger';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { AuthStore } from '@core/auth/auth-store';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { UserSettingsStore } from '@core/user-settings';

function dispatchPageShow(persisted: boolean): void {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', {
    configurable: true,
    value: persisted,
  });
  window.dispatchEvent(event);
}

describe('ResumeRefreshService', () => {
  const reloadSpy = vi.fn();
  const mockRouter = { url: '/dashboard' };

  const isLoadingSignal = signal(false);
  const isAuthenticatedFn = vi.fn<() => boolean>().mockReturnValue(true);
  const mockAuthStore = {
    isLoading: isLoadingSignal.asReadonly(),
    isAuthenticated: isAuthenticatedFn,
  };

  const mockAuthSession = {
    refreshSession: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  };
  const mockBudgetApi = {
    cache: { invalidate: vi.fn() },
  };
  const mockBudgetTemplatesApi = {
    cache: { invalidate: vi.fn() },
  };
  const mockUserSettingsStore = {
    reload: vi.fn(),
  };
  const mockLogger = {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  };

  let service: ResumeRefreshService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.useRealTimers();
    reloadSpy.mockReset();
    isLoadingSignal.set(false);
    isAuthenticatedFn.mockReset();
    isAuthenticatedFn.mockReturnValue(true);
    mockAuthSession.refreshSession.mockReset();
    mockAuthSession.refreshSession.mockResolvedValue(true);
    mockBudgetApi.cache.invalidate.mockReset();
    mockBudgetTemplatesApi.cache.invalidate.mockReset();
    mockUserSettingsStore.reload.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.info.mockReset();
    mockLogger.debug.mockReset();
    mockRouter.url = '/dashboard';
    sessionStorage.clear();
    Object.defineProperty(document, 'wasDiscarded', {
      configurable: true,
      value: false,
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ResumeRefreshService,
        { provide: PAGE_RELOAD, useValue: reloadSpy },
        { provide: Router, useValue: mockRouter },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: AuthSessionService, useValue: mockAuthSession },
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: BudgetTemplatesApi, useValue: mockBudgetTemplatesApi },
        { provide: UserSettingsStore, useValue: mockUserSettingsStore },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(ResumeRefreshService);
    TestBed.runInInjectionContext(() => service.initialize());
  });

  it('should perform soft refresh on pageshow persisted for protected routes', async () => {
    dispatchPageShow(true);
    await vi.waitFor(() => {
      expect(mockAuthSession.refreshSession).toHaveBeenCalledOnce();
    });
    expect(mockBudgetApi.cache.invalidate).toHaveBeenCalledOnce();
    expect(mockUserSettingsStore.reload).toHaveBeenCalledOnce();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should perform soft refresh when document was discarded on pageshow', async () => {
    Object.defineProperty(document, 'wasDiscarded', {
      configurable: true,
      value: true,
    });

    dispatchPageShow(false);
    await vi.waitFor(() => {
      expect(mockAuthSession.refreshSession).toHaveBeenCalledOnce();
    });
    expect(mockBudgetApi.cache.invalidate).toHaveBeenCalledOnce();
    expect(mockUserSettingsStore.reload).toHaveBeenCalledOnce();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should fallback to hard reload when soft refresh fails', async () => {
    mockAuthSession.refreshSession.mockResolvedValue(false);

    dispatchPageShow(true);

    await vi.waitFor(() => {
      expect(reloadSpy).toHaveBeenCalledOnce();
    });
    expect(mockBudgetApi.cache.invalidate).not.toHaveBeenCalled();
    expect(mockUserSettingsStore.reload).not.toHaveBeenCalled();
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

  it('should queue resume and process once auth finishes loading', async () => {
    isLoadingSignal.set(true);

    dispatchPageShow(true);
    await Promise.resolve();

    expect(mockAuthSession.refreshSession).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();

    isLoadingSignal.set(false);

    await vi.waitFor(() => {
      expect(mockAuthSession.refreshSession).toHaveBeenCalledOnce();
    });
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should not refresh on non-protected routes', async () => {
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
    expect(mockBudgetApi.cache.invalidate).toHaveBeenCalledOnce();
    expect(mockUserSettingsStore.reload).toHaveBeenCalledOnce();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should force reload when auth never finishes loading after resume (timeout)', async () => {
    vi.useFakeTimers();
    isLoadingSignal.set(true);

    dispatchPageShow(true);
    await Promise.resolve();

    expect(reloadSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(13_000);

    expect(reloadSpy).toHaveBeenCalledOnce();
    expect(mockAuthSession.refreshSession).not.toHaveBeenCalled();
  });

  it('should not queue duplicate reasons across rapid pageshow events', async () => {
    isLoadingSignal.set(true);

    dispatchPageShow(true);
    dispatchPageShow(true);
    await Promise.resolve();

    expect(mockAuthSession.refreshSession).not.toHaveBeenCalled();

    isLoadingSignal.set(false);

    await vi.waitFor(() => {
      expect(mockAuthSession.refreshSession).toHaveBeenCalledOnce();
    });
  });

  it('forceReloadOnSplashTimeout honors cooldown and reports outcome', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(5_000);

    expect(service.forceReloadOnSplashTimeout()).toBe(true);
    expect(reloadSpy).toHaveBeenCalledOnce();

    nowSpy.mockReturnValue(5_500);
    expect(service.forceReloadOnSplashTimeout()).toBe(false);
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it('should not refresh when not authenticated', async () => {
    isAuthenticatedFn.mockReturnValue(false);

    dispatchPageShow(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockAuthSession.refreshSession).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should remove event listeners on destroy', async () => {
    TestBed.resetTestingModule();

    dispatchPageShow(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockAuthSession.refreshSession).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should ignore concurrent triggers while refresh in flight', async () => {
    let resolveRefresh!: (value: boolean) => void;
    mockAuthSession.refreshSession.mockReset();
    mockAuthSession.refreshSession.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    dispatchPageShow(true);
    dispatchPageShow(true);

    await Promise.resolve();
    expect(mockAuthSession.refreshSession).toHaveBeenCalledOnce();

    resolveRefresh(true);
    await vi.waitFor(() => {
      expect(mockBudgetApi.cache.invalidate).toHaveBeenCalledOnce();
    });
  });
});
