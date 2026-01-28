import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  Router,
  NavigationEnd,
  NavigationError,
  NavigationCancel,
  NavigationStart,
  provideRouter,
} from '@angular/router';
import { Subject } from 'rxjs';
import { App } from './app';

describe('App', () => {
  let routerEvents$: Subject<unknown>;
  let splashElement: HTMLDivElement;

  beforeEach(() => {
    routerEvents$ = new Subject();

    // Create a fake splash element in the DOM
    splashElement = document.createElement('div');
    splashElement.id = 'pulpe-splash';
    document.body.appendChild(splashElement);

    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: Router,
          useValue: {
            events: routerEvents$.asObservable(),
          },
        },
      ],
    });
  });

  afterEach(() => {
    // Clean up splash element if still present
    document.getElementById('pulpe-splash')?.remove();
  });

  it('should remove splash on NavigationEnd', async () => {
    TestBed.createComponent(App);

    routerEvents$.next(new NavigationEnd(1, '/', '/'));
    await waitForAnimationFrame();

    expect(document.getElementById('pulpe-splash')).toBeNull();
  });

  it('should remove splash on NavigationError', async () => {
    TestBed.createComponent(App);

    routerEvents$.next(new NavigationError(1, '/', new Error('fail')));
    await waitForAnimationFrame();

    expect(document.getElementById('pulpe-splash')).toBeNull();
  });

  it('should remove splash on NavigationCancel', async () => {
    TestBed.createComponent(App);

    routerEvents$.next(new NavigationCancel(1, '/', ''));
    await waitForAnimationFrame();

    expect(document.getElementById('pulpe-splash')).toBeNull();
  });

  it('should NOT remove splash on NavigationStart', async () => {
    TestBed.createComponent(App);

    routerEvents$.next(new NavigationStart(1, '/'));
    await waitForAnimationFrame();

    expect(document.getElementById('pulpe-splash')).not.toBeNull();
  });

  it('should remove splash on timeout if no navigation event fires', async () => {
    vi.useFakeTimers();

    TestBed.createComponent(App);

    // Advance past the 15s timeout
    vi.advanceTimersByTime(15_000);
    // Flush the requestAnimationFrame queued by removeSplash
    vi.advanceTimersByTime(16);

    vi.useRealTimers();

    expect(document.getElementById('pulpe-splash')).toBeNull();
  });

  it('should only remove splash once even if multiple events fire', async () => {
    const removeSpy = vi.spyOn(splashElement, 'remove');

    TestBed.createComponent(App);

    routerEvents$.next(new NavigationEnd(1, '/', '/'));
    await waitForAnimationFrame();

    // Second event should not cause issues (element already removed)
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
