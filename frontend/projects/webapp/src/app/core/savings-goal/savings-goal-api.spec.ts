import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import type {
  SavingsGoalDeletionImpact,
  SavingsGoalProgress,
} from 'pulpe-shared';
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
    startDate: null,
    targetAmount: 3000,
    targetDate: '2027-08-01',
    plannedCumulative: 1200,
    plannedProjection: 1200,
    confirmed: 900,
    initialAmount: 0,
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

function makeDeletionImpact(): SavingsGoalDeletionImpact {
  return {
    goalId: GOAL_ID,
    summary: {
      templateLineCount: 0,
      templateLineTotal: 0,
      budgetCount: 0,
      budgetLineCount: 0,
      budgetLineTotal: 0,
      transactionCount: 0,
      transactionTotal: 0,
    },
    templateLines: [],
    budgets: [],
    revision: {
      templateLines: [],
      budgetLines: [],
      transactions: [],
    },
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

  it('PATCHes explicit nulls without coercing them to zero', async () => {
    const responsePromise = firstValueFrom(
      service.update$(GOAL_ID, {
        startDate: null,
        targetAmount: null,
        targetDate: null,
      }),
    );

    const req = httpTesting.expectOne(
      `http://localhost:3000/api/v1/savings-goals/${GOAL_ID}`,
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      startDate: null,
      targetAmount: null,
      targetDate: null,
    });
    req.flush({
      success: true,
      data: {
        id: GOAL_ID,
        userId: '00000000-0000-4000-8000-000000000001',
        name: 'Pot libre',
        startDate: null,
        targetAmount: null,
        targetDate: null,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    expect((await responsePromise).data.targetAmount).toBeNull();
  });

  it('passes the proposed deadline to the future-lines preview', async () => {
    const responsePromise = firstValueFrom(
      service.getFutureLines$(GOAL_ID, '2027-07-24'),
    );

    const req = httpTesting.expectOne(
      `http://localhost:3000/api/v1/savings-goals/${GOAL_ID}/future-lines?targetDate=2027-07-24`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [] });

    expect((await responsePromise).data).toEqual([]);
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

  it('getDeletionImpact$ GETs and parses the full deletion impact', async () => {
    const responsePromise = firstValueFrom(service.getDeletionImpact$(GOAL_ID));

    const req = httpTesting.expectOne(
      `http://localhost:3000/api/v1/savings-goals/${GOAL_ID}/deletion-impact`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: makeDeletionImpact() });

    await expect(responsePromise).resolves.toEqual({
      success: true,
      data: makeDeletionImpact(),
    });
  });

  it('applyDeletion$ POSTs the selected mode with the displayed revision', async () => {
    const impact = makeDeletionImpact();
    const command = {
      mode: 'goal_and_forecasts' as const,
      revision: impact.revision,
    };
    const responsePromise = firstValueFrom(
      service.applyDeletion$(GOAL_ID, command),
    );

    const req = httpTesting.expectOne(
      `http://localhost:3000/api/v1/savings-goals/${GOAL_ID}/deletion`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(command);
    req.flush({ success: true, message: 'deleted' });

    await expect(responsePromise).resolves.toEqual({
      success: true,
      message: 'deleted',
    });
  });

  // Bug repro: a transaction pointée on a goal-linked line invalidates the
  // budget cache, but the goal progress cache stayed FRESH — the detail page
  // kept serving the pre-mutation confirmed amount for up to staleTime.
  it('invalidates derived goal data without refetching the goal list after a budget mutation', () => {
    const budgetApi = TestBed.inject(BudgetApi);
    const listKey = ['savings-goals', 'list'];
    const progressKey = ['savings-goals', 'progress', GOAL_ID];
    const contributionsKey = ['savings-goals', 'contributions', GOAL_ID];
    service.cache.set(listKey, []);
    service.cache.set(progressKey, makeProgress());
    service.cache.set(contributionsKey, []);

    budgetApi.cache.invalidate(['budget', 'details']);
    TestBed.flushEffects();

    expect(service.cache.get(listKey)?.fresh).toBe(true);
    expect(service.cache.get<SavingsGoalProgress>(progressKey)?.fresh).toBe(
      false,
    );
    expect(service.cache.get(contributionsKey)?.fresh).toBe(false);
  });
});
