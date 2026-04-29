import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  ApplicationInitStatus,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import {
  Router,
  NavigationEnd,
  NavigationError,
  NavigationCancel,
  NavigationStart,
  provideRouter,
} from '@angular/router';
import { Subject } from 'rxjs';
import { provideSplashRemoval } from './splash-removal';
import { AuthStateService } from './auth/auth-state.service';
import { SessionResumeRecoveryService } from './lifecycle/session-resume-recovery.service';
import { Logger } from './logging/logger';

describe('provideSplashRemoval', () => {
  let routerEvents$: Subject<unknown>;
  let splashElement: HTMLDivElement;
  const isLoadingSignal = signal(false);
  const forceReloadSpy = vi.fn();
  const warnSpy = vi.fn();

  beforeEach(() => {
    routerEvents$ = new Subject();
    isLoadingSignal.set(false);
    forceReloadSpy.mockReset();
    warnSpy.mockReset();

    splashElement = document.createElement('div');
    splashElement.id = 'pulpe-splash';
    document.body.appendChild(splashElement);
  });

  afterEach(() => {
    document.getElementById('pulpe-splash')?.remove();
  });

  function setup(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: Router,
          useValue: { events: routerEvents$.asObservable() },
        },
        {
          provide: AuthStateService,
          useValue: { isLoading: isLoadingSignal.asReadonly() },
        },
        {
          provide: SessionResumeRecoveryService,
          useValue: { forceReloadOnSplashTimeout: forceReloadSpy },
        },
        {
          provide: Logger,
          useValue: {
            warn: warnSpy,
            info: vi.fn(),
            debug: vi.fn(),
            error: vi.fn(),
          },
        },
        provideSplashRemoval(),
      ],
    });

    return TestBed.inject(ApplicationInitStatus).donePromise;
  }

  it('should remove splash on NavigationEnd', async () => {
    await setup();

    routerEvents$.next(new NavigationEnd(1, '/', '/'));
    await waitForAnimationFrame();

    expect(document.getElementById('pulpe-splash')).toBeNull();
  });

  it('should remove splash on NavigationError', async () => {
    await setup();

    routerEvents$.next(new NavigationError(1, '/', new Error('fail')));
    await waitForAnimationFrame();

    expect(document.getElementById('pulpe-splash')).toBeNull();
  });

  it('should remove splash on NavigationCancel', async () => {
    await setup();

    routerEvents$.next(new NavigationCancel(1, '/', ''));
    await waitForAnimationFrame();

    expect(document.getElementById('pulpe-splash')).toBeNull();
  });

  it('should NOT remove splash on NavigationStart', async () => {
    await setup();

    routerEvents$.next(new NavigationStart(1, '/'));
    await waitForAnimationFrame();

    expect(document.getElementById('pulpe-splash')).not.toBeNull();
  });

  it('should remove splash on timeout if no navigation event fires', async () => {
    vi.useFakeTimers();
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb(0);
        return 0;
      });

    await setup();

    vi.advanceTimersByTime(15_000);

    vi.useRealTimers();
    rafSpy.mockRestore();

    expect(document.getElementById('pulpe-splash')).toBeNull();
  });

  it('should only remove splash once even if multiple events fire', async () => {
    const removeSpy = vi.spyOn(splashElement, 'remove');

    await setup();

    routerEvents$.next(new NavigationEnd(1, '/', '/'));
    await waitForAnimationFrame();

    routerEvents$.next(new NavigationEnd(2, '/other', '/other'));
    await waitForAnimationFrame();

    expect(removeSpy).toHaveBeenCalledOnce();
  });

  it('should force reload when timeout fires while auth still loading', async () => {
    vi.useFakeTimers();
    isLoadingSignal.set(true);

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    await setup();

    await vi.advanceTimersByTimeAsync(15_001);

    vi.useRealTimers();

    expect(forceReloadSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      '[SplashRemoval] Timeout fired while auth still loading, forcing reload',
    );
    expect(document.getElementById('pulpe-splash')).not.toBeNull();
  });

  it('should remove splash when timeout fires but auth resolved', async () => {
    vi.useFakeTimers();
    isLoadingSignal.set(false);

    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb(0);
        return 0;
      });

    await setup();

    await vi.advanceTimersByTimeAsync(15_001);

    vi.useRealTimers();
    rafSpy.mockRestore();

    expect(forceReloadSpy).not.toHaveBeenCalled();
    expect(document.getElementById('pulpe-splash')).toBeNull();
  });
});

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
