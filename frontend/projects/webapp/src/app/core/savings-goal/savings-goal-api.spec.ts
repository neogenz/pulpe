import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import type { SavingsGoalProgress } from 'pulpe-shared';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { BudgetApi } from '@core/budget/budget-api';
import { SavingsGoalApi } from './savings-goal-api';

const mockApplicationConfig = {
  backendApiUrl: () => 'http://localhost:3000/api/v1',
};

const GOAL_ID = '68c73361-c59b-4ce4-9e6a-0843505a08d5';

function makeProgress(
  overrides: Partial<SavingsGoalProgress> = {},
): SavingsGoalProgress {
  return {
    goalId: GOAL_ID,
    status: 'ACTIVE',
    targetAmount: 3000,
    targetDate: '2027-08-01',
    plannedCumulative: 1200,
    confirmed: 900,
    achievementPercent: 30,
    monthsElapsed: 3,
    monthsRemaining: 12,
    isOverdue: false,
    pace: 400,
    confirmedPace: 300,
    required: 175,
    projected: 4500,
    paceStatus: 'on_track',
    suggestCompletion: false,
    linkedLineCount: 2,
    cumulativeGap: 300,
    estimatedCompletion: { month: 6, year: 2027 },
    months: [],
    originalTargetAmount: null,
    originalCurrency: null,
    targetCurrency: null,
    exchangeRate: null,
    ...overrides,
  };
}

describe('SavingsGoalApi', () => {
  let service: SavingsGoalApi;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        SavingsGoalApi,
        { provide: ApplicationConfiguration, useValue: mockApplicationConfig },
      ],
    });

    service = TestBed.inject(SavingsGoalApi);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('getProgress$ GETs the progress endpoint and parses the schema', async () => {
    const responsePromise = firstValueFrom(service.getProgress$(GOAL_ID));

    const req = httpTesting.expectOne(
      `http://localhost:3000/api/v1/savings-goals/${GOAL_ID}/progress`,
    );
    expect(req.request.method).toBe('GET');

    req.flush({ success: true, data: makeProgress() });

    const response = await responsePromise;
    expect(response.success).toBe(true);
    expect(response.data.goalId).toBe(GOAL_ID);
    expect(response.data.achievementPercent).toBe(30);
    expect(response.data.paceStatus).toBe('on_track');
  });

  it('getProgress$ accepts the overdue shape (required + paceStatus null)', async () => {
    const responsePromise = firstValueFrom(service.getProgress$(GOAL_ID));

    httpTesting
      .expectOne(
        `http://localhost:3000/api/v1/savings-goals/${GOAL_ID}/progress`,
      )
      .flush({
        success: true,
        data: makeProgress({
          isOverdue: true,
          monthsRemaining: -2,
          required: null,
          paceStatus: null,
          projected: 900,
        }),
      });

    const response = await responsePromise;
    expect(response.data.isOverdue).toBe(true);
    expect(response.data.required).toBeNull();
    expect(response.data.paceStatus).toBeNull();
  });

  it('getContributions$ GETs the goal contributions endpoint and parses the schema', async () => {
    const responsePromise = firstValueFrom(service.getContributions$(GOAL_ID));

    const req = httpTesting.expectOne(
      `http://localhost:3000/api/v1/savings-goals/${GOAL_ID}/contributions`,
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      success: true,
      data: [
        {
          lineId: '3a15195c-2be2-4b64-a4a3-e064f34cb44b',
          name: 'Épargne mensuelle',
          amount: 500,
          checkedAt: '2026-07-02T18:00:00.000Z',
          budgetMonth: 7,
          budgetYear: 2026,
          transactions: [
            {
              id: '4f8f011f-3312-4676-9b18-3b237db2d40c',
              budgetId: 'c2c15b83-9975-4534-a6be-30a19f2f1389',
              budgetLineId: '3a15195c-2be2-4b64-a4a3-e064f34cb44b',
              name: 'macbook1',
              amount: 150,
              kind: 'saving',
              transactionDate: '2026-07-02T10:00:00.000Z',
              checkedAt: '2026-07-02T10:00:00.000Z',
              category: null,
              createdAt: '2026-07-02T10:00:00.000Z',
              updatedAt: '2026-07-02T10:00:00.000Z',
            },
          ],
        },
      ],
    });

    const response = await responsePromise;
    expect(response.data).toHaveLength(1);
    expect(response.data[0].amount).toBe(500);
    expect(response.data[0].checkedAt).not.toBeNull();
    expect(response.data[0].transactions[0].amount).toBe(150);
  });

  // Bug repro: a transaction pointée on a goal-linked line invalidates the
  // budget cache, but the goal progress cache stayed FRESH — the detail page
  // kept serving the pre-mutation confirmed amount for up to staleTime.
  it('marks savings-goal cache entries stale when the budget cache is invalidated', () => {
    const budgetApi = TestBed.inject(BudgetApi);
    const key = ['savings-goals', 'progress', GOAL_ID];
    service.cache.set(key, makeProgress());
    expect(service.cache.get(key)?.fresh).toBe(true);

    budgetApi.cache.invalidate(['budget', 'details']);
    TestBed.flushEffects();

    const entry = service.cache.get<SavingsGoalProgress>(key);
    expect(entry).not.toBeNull();
    expect(entry?.fresh).toBe(false);
  });
});
