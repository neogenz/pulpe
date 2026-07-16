import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  API_ERROR_CODES,
  type BudgetLineSavingsWithdrawalCreate,
} from 'pulpe-shared';

import { BudgetDetailsStore } from './budget-details-store';
import { BudgetApi } from '@core/budget/budget-api';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { ApiError } from '@core/api/api-error';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { Logger } from '@core/logging/logger';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsStore } from '@core/user-settings';
import {
  createMockBudgetDetailsResponse,
  createMockBudgetLine,
} from '../../../../testing/mock-factories';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

const mockBudgetId = 'budget-savings-withdrawal-test';

// A far-future month in deficit (one expense, no income) so both the "current or
// future" gate and the "available < 0" gate hold regardless of the run date.
const mockBudgetDetailsResponse = createMockBudgetDetailsResponse({
  budget: { id: mockBudgetId, month: 6, year: 2099 },
  budgetLines: [
    createMockBudgetLine({
      id: 'expense-1',
      budgetId: mockBudgetId,
      name: 'Loyer',
      amount: 1000,
      kind: 'expense',
    }),
  ],
  transactions: [],
});

const WITHDRAWAL_INPUT: BudgetLineSavingsWithdrawalCreate = {
  budgetId: mockBudgetId,
  amount: 320,
  incomeName: 'Mon épargne',
  savingName: 'Remettre sur ton épargne',
  groupId: '00000000-0000-4000-8000-0000000000aa',
};

const withdrawalResponse = {
  success: true as const,
  data: {
    groupId: WITHDRAWAL_INPUT.groupId,
    incomeLine: createMockBudgetLine({ id: 'income-1', kind: 'income' }),
    savingLine: createMockBudgetLine({ id: 'saving-1', kind: 'saving' }),
    createdBudget: null,
  },
};

const conflictError = new ApiError(
  'conflict',
  API_ERROR_CODES.SAVINGS_WITHDRAWAL_CONFLICT,
  409,
  undefined,
);

describe('BudgetDetailsStore — savings withdrawal (PUL-292)', () => {
  let store: BudgetDetailsStore;
  let createSavingsWithdrawal$: ReturnType<typeof vi.fn>;
  let deleteSavingsWithdrawal$: ReturnType<typeof vi.fn>;

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

  const makeCache = () => ({
    version: signal(0),
    _dataVersion: signal(0),
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    has: vi.fn().mockReturnValue(false),
    invalidate: vi.fn(),
    deduplicate: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
    prefetch: vi.fn(),
    clear: vi.fn(),
    clearDirty: vi.fn(),
  });

  beforeEach(async () => {
    localStorage.clear();
    createSavingsWithdrawal$ = vi.fn().mockReturnValue(of(withdrawalResponse));
    deleteSavingsWithdrawal$ = vi.fn().mockReturnValue(of({ success: true }));

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
            createSavingsWithdrawal$,
            deleteSavingsWithdrawal$,
            cache: makeCache(),
          },
        },
        {
          provide: SavingsGoalApi,
          useValue: {
            getAll$: vi.fn().mockReturnValue(of({ success: true, data: [] })),
            cache: makeCache(),
          },
        },
        { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn() } },
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
    store.setBudgetId(mockBudgetId);
    TestBed.tick();
    await waitFor(() => store.budgetDetails() !== null);
  });

  describe('createSavingsWithdrawal', () => {
    it('creates the couple and returns the paired lines on success', async () => {
      const result = await store.createSavingsWithdrawal(WITHDRAWAL_INPUT);

      expect(createSavingsWithdrawal$).toHaveBeenCalledWith(WITHDRAWAL_INPUT);
      expect(result?.groupId).toBe(WITHDRAWAL_INPUT.groupId);
    });

    it('routes a typed ApiError through the localizer instead of a blanket message', async () => {
      createSavingsWithdrawal$.mockReturnValue(throwError(() => conflictError));
      const localizer = TestBed.inject(ApiErrorLocalizer);
      const localizeSpy = vi.spyOn(localizer, 'localizeApiError');

      const result = await store.createSavingsWithdrawal(WITHDRAWAL_INPUT);

      expect(result).toBeUndefined();
      expect(localizeSpy).toHaveBeenCalledWith(conflictError);
      expect(store.error()).toBe(localizer.localizeApiError(conflictError));
    });
  });

  describe('deleteSavingsWithdrawal', () => {
    it('deletes with the chosen scope and reports success', async () => {
      const succeeded = await store.deleteSavingsWithdrawal(
        WITHDRAWAL_INPUT.groupId!,
        'repayment',
      );

      expect(deleteSavingsWithdrawal$).toHaveBeenCalledWith(
        WITHDRAWAL_INPUT.groupId,
        'repayment',
      );
      expect(succeeded).toBe(true);
    });
  });

  describe('shouldShowSavingsWithdrawalCard', () => {
    it('shows the card on a current/future month in deficit with no pioche yet', () => {
      expect(store.savingsWithdrawalDeficit()).toBe(1000);
      expect(store.shouldShowSavingsWithdrawalCard()).toBe(true);
    });

    it('hides the card once dismissed for that budget', () => {
      store.dismissSavingsWithdrawalCard(mockBudgetId);

      expect(store.shouldShowSavingsWithdrawalCard()).toBe(false);
    });
  });
});
