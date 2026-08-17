import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DestroyRef,
  effect,
  signal,
  provideZonelessChangeDetection,
} from '@angular/core';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { formatBudgetPeriod, type SupportedLocale } from 'pulpe-shared';
import { BreadcrumbState } from '@core/shell/breadcrumb-state';
import { UserSettingsStore } from '@core/user-settings';
import BudgetDetailsPage from './budget-details-page';
import { BudgetDetailsStore } from './store/budget-details-store';
import { BudgetDetailsDialogService } from './budget-details-dialog.service';

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

describe('BudgetDetailsPage — localized budget period', () => {
  it.each<SupportedLocale>(['en', 'de', 'it'])(
    'formats the period with the %s interface locale',
    (locale) => {
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          {
            provide: BudgetDetailsStore,
            useValue: {
              budgetDetails: signal({ month: 3, year: 2026 }),
              financialTotals: signal(null),
              isStale: signal(false),
              setBudgetId: () => undefined,
            },
          },
          {
            provide: UserSettingsStore,
            useValue: {
              currency: signal('CHF'),
              locale: signal(locale),
              payDayOfMonth: signal(5),
            },
          },
          { provide: Router, useValue: { navigate: () => undefined } },
          {
            provide: BreadcrumbState,
            useValue: {
              setDynamicBreadcrumb: () => undefined,
              clearDynamicBreadcrumb: () => undefined,
            },
          },
          {
            provide: LoadingIndicator,
            useValue: { setLoading: () => undefined },
          },
          { provide: BudgetDetailsDialogService, useValue: {} },
          { provide: MatSnackBar, useValue: {} },
          { provide: TranslocoService, useValue: {} },
        ],
      });

      const component = TestBed.runInInjectionContext(
        () => new BudgetDetailsPage(),
      );

      expect(component['periodDisplay']()).toBe(
        formatBudgetPeriod(3, 2026, 5, locale),
      );
      expect(component['periodDisplay']()).not.toBe(
        formatBudgetPeriod(3, 2026, 5, 'fr'),
      );
    },
  );
});

/**
 * PUL-329 — arriving from a savings goal's "Retraits" section carries the
 * targeted transaction in a query param. The template stays empty here: the
 * behaviour under test lives entirely in the page's constructor effect.
 */
