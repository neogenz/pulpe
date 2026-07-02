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
});
