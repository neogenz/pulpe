import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  API_ERROR_CODES,
  type SpreadOccurrence,
  type BudgetLineSpreadCreate,
} from 'pulpe-shared';

import { BudgetDetailsStore } from './budget-details-store';
import { BudgetApi } from '@core/budget/budget-api';
import { ApiError } from '@core/api/api-error';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { Logger } from '@core/logging/logger';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsStore } from '@core/user-settings';
import { createMockBudgetDetailsResponse } from '../../../../testing/mock-factories';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

/**
 * Integration: the réalisé tracker exposed by the store, the single source every
 * spread detail surface consumes. Verifies the wiring around the (separately
 * unit-tested) pure builders — viewed-period reference + payDay-aware live period
 * — produces the right cumulé. Uses far-past (always closed) and far-future
 * (never closed) months so the assertion is deterministic regardless of run date.
 */
const mockBudgetId = 'budget-spread-test';

const mockBudgetDetailsResponse = createMockBudgetDetailsResponse({
  budget: { id: mockBudgetId, month: 6, year: 2026 },
  budgetLines: [],
  transactions: [],
});

const occurrence = (
  overrides: Partial<SpreadOccurrence> & { budgetLineId: string },
): SpreadOccurrence => ({
  budgetId: 'b',
  month: 1,
  year: 2020,
  name: 'Prime assurance',
  amount: 100,
  consumed: 0,
  transactionCount: 0,
  kind: 'expense',
  checkedAt: null,
  ...overrides,
});

// closedConsumed: closed month with 2 sub-transactions → counts 80, not 100.
// closedPlanned:  closed month, no sub-transactions → counts its prévu (100).
// futureUnchecked: not elapsed, not pointed → EXCLUDED from réalisé.
// futureChecked:  not elapsed but pointed → counts its prévu (100).
const SPREAD_OCCURRENCES: SpreadOccurrence[] = [
  occurrence({
    budgetLineId: 'closed-consumed',
    month: 1,
    year: 2020,
    amount: 100,
    consumed: 80,
    transactionCount: 2,
  }),
  occurrence({
    budgetLineId: 'closed-planned',
    month: 2,
    year: 2020,
    amount: 100,
  }),
  occurrence({
    budgetLineId: 'future-unchecked',
    month: 1,
    year: 2099,
    amount: 100,
  }),
  occurrence({
    budgetLineId: 'future-checked',
    month: 2,
    year: 2099,
    amount: 100,
    checkedAt: '2099-02-01T00:00:00+01:00',
  }),
];

// A spread create that the (always-throwing) API mock will reject — used to
// prove the onError handler maps the typed code, not a blanket message.
const SPREAD_INPUT: BudgetLineSpreadCreate = {
  name: 'Assurance',
  kind: 'expense',
  mode: 'total',
  totalAmount: 1200,
  months: [
    { year: 2026, month: 6 },
    { year: 2026, month: 7 },
  ],
};

// The server persists the spread then fails the downstream recalculation —
// telling the user to "retry" here would duplicate the additive plan.
const recalcError = new ApiError(
  'recalc failed',
  API_ERROR_CODES.BUDGET_LINE_SPREAD_RECALCULATION_FAILED,
  500,
  undefined,
);

describe('BudgetDetailsStore — spread réalisé tracker', () => {
  let store: BudgetDetailsStore;

  const waitFor = async (
    ready: () => boolean,
    timeout = 1000,
  ): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (ready()) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('store did not stabilize in time');
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTranslocoForTest(),
        BudgetDetailsStore,
        {
          provide: BudgetApi,
          useValue: {
            getBudgetWithDetails$: vi
              .fn()
              .mockReturnValue(of(mockBudgetDetailsResponse)),
            getAllBudgets$: vi.fn().mockReturnValue(of([])),
            getSpreadOccurrences$: vi
              .fn()
              .mockReturnValue(of(SPREAD_OCCURRENCES)),
            createBudgetLineSpread$: vi
              .fn()
              .mockReturnValue(throwError(() => recalcError)),
            cache: {
              version: signal(0),
              _dataVersion: signal(0),
              get: vi.fn().mockReturnValue(null),
              set: vi.fn(),
              has: vi.fn().mockReturnValue(false),
              invalidate: vi.fn(),
              deduplicate: vi.fn((_key: string[], fn: () => Promise<unknown>) =>
                fn(),
              ),
              prefetch: vi.fn(),
              clear: vi.fn(),
              clearDirty: vi.fn(),
            },
          },
        },
        { provide: Logger, useValue: { error: vi.fn() } },
        {
          provide: UserSettingsStore,
          useValue: { currency: signal('CHF'), payDayOfMonth: signal(1) },
        },
        {
          provide: ApplicationConfiguration,
          useValue: {
            backendApiUrl: vi
              .fn()
              .mockReturnValue('http://localhost:3000/api/v1'),
          },
        },
        {
          provide: PostHogService,
          useValue: {
            captureException: vi.fn(),
            isInitialized: vi.fn(() => ({ value: true })),
            isEnabled: vi.fn(() => ({ value: true })),
          },
        },
      ],
    });

    store = TestBed.inject(BudgetDetailsStore);

    // The viewed budget must load first — its period is the tracker reference.
    store.setBudgetId(mockBudgetId);
    TestBed.tick();
    await waitFor(() => store.budgetDetails() !== null);

    store.setSpreadGroupId('grp-1');
    TestBed.tick();
    await waitFor(() => store.spreadOccurrences().length === 4);
  });

  it('counts closed + checked occurrences, using consumed when sub-transactions exist else the prévu', () => {
    const tracker = store.spreadTracker()!;

    // 80 (closed, consumed) + 100 (closed, prévu) + 100 (future but checked) = 280.
    expect(tracker.cumulatedAmount).toBe(280);
    expect(tracker.totalAmount).toBe(400);
  });

  it('excludes a future, unchecked occurrence from the réalisé', () => {
    const tracker = store.spreadTracker()!;

    // The 4th occurrence (future, unchecked) would push cumulé to 380 if counted.
    expect(tracker.cumulatedAmount).not.toBe(380);
    expect(tracker.cumulatedAmount).toBe(280);
  });

  describe('spread mutation error mapping', () => {
    it('routes a typed ApiError through the localizer instead of a blanket message', async () => {
      // Arrange
      const localizer = TestBed.inject(ApiErrorLocalizer);
      const localizeSpy = vi.spyOn(localizer, 'localizeApiError');

      // Act
      await store.createBudgetLineSpread(SPREAD_INPUT);

      // Assert
      expect(localizeSpy).toHaveBeenCalledWith(recalcError);
      expect(store.error()).toBe(localizer.localizeApiError(recalcError));
    });
  });
});
