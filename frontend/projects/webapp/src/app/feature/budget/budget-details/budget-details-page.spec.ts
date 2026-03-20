import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DestroyRef,
  effect,
  signal,
  provideZonelessChangeDetection,
} from '@angular/core';
import { LoadingIndicator } from '@core/loading/loading-indicator';

/**
 * Tests the loading indicator ↔ isStale contract used by BudgetDetailsPage.
 *
 * The production component (budget-details-page.ts:180-187) wires:
 *   effect(() => this.#loadingIndicator.setLoading(this.store.isStale()));
 *   destroyRef.onDestroy(() => this.#loadingIndicator.setLoading(false));
 *
 * We test this contract in isolation because the component uses templateUrl
 * which is not resolved by the vitest setup (no Angular vite plugin).
 */
describe('BudgetDetailsPage — loading indicator contract', () => {
  let loadingIndicator: LoadingIndicator;
  let isStale: ReturnType<typeof signal<boolean>>;
  let destroyRef: DestroyRef;

  beforeEach(() => {
    isStale = signal(false);

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });

    loadingIndicator = TestBed.inject(LoadingIndicator);
    destroyRef = TestBed.inject(DestroyRef);

    TestBed.runInInjectionContext(() => {
      effect(() => {
        loadingIndicator.setLoading(isStale());
      });

      destroyRef.onDestroy(() => {
        loadingIndicator.setLoading(false);
      });
    });

    TestBed.flushEffects();
  });

  it('should not show loading bar when budget data is fresh', () => {
    expect(loadingIndicator.isLoading()).toBe(false);
  });

  it('should show loading bar when budget data becomes stale', () => {
    isStale.set(true);
    TestBed.flushEffects();

    expect(loadingIndicator.isLoading()).toBe(true);
  });

  it('should hide loading bar when stale data is refreshed', () => {
    isStale.set(true);
    TestBed.flushEffects();

    isStale.set(false);
    TestBed.flushEffects();

    expect(loadingIndicator.isLoading()).toBe(false);
  });
});
