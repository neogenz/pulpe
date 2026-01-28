import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  ApplicationInitStatus,
  provideZonelessChangeDetection,
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

describe('provideSplashRemoval', () => {
  let routerEvents$: Subject<unknown>;
  let splashElement: HTMLDivElement;

  beforeEach(() => {
    routerEvents$ = new Subject();

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

    await setup();

    vi.advanceTimersByTime(15_000);
    vi.advanceTimersByTime(16);

    vi.useRealTimers();

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
});

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
