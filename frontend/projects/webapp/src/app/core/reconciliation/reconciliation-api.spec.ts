import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { ReconciliationContext } from 'pulpe-shared';

import { ApplicationConfiguration } from '@core/config/application-configuration';
import { ReconciliationApi } from './reconciliation-api';

const BASE_URL = 'http://localhost:3000/api/v1';
const BUDGET_ID = '68c73361-c59b-4ce4-9e6a-0843505a08d5';

const context: ReconciliationContext = {
  startingAmount: 0,
  hasCompletedComparison: false,
  priorCorrection: 40,
  priorItems: [
    {
      id: '0b1c8a66-6f4e-4f55-9f2d-2f3c6a0c1d11',
      source: 'transaction',
      budgetId: '11111111-1111-4111-8111-111111111111',
      name: 'Pharmacie',
      amount: 40,
      kind: 'expense',
      monthsAgo: 1,
      effect: -40,
    },
  ],
};

describe('ReconciliationApi', () => {
  let api: ReconciliationApi;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ApplicationConfiguration,
          useValue: { backendApiUrl: () => BASE_URL },
        },
      ],
    });
    api = TestBed.inject(ReconciliationApi);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('getContext$ GETs the budget context and parses it', async () => {
    const response = firstValueFrom(api.getContext$(BUDGET_ID));

    const req = httpTesting.expectOne(
      `${BASE_URL}/reconciliation/${BUDGET_ID}`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: context });

    expect((await response).data).toEqual(context);
  });

  it('getContext$ rejects a context without its prior items', async () => {
    const response = firstValueFrom(api.getContext$(BUDGET_ID));

    httpTesting
      .expectOne(`${BASE_URL}/reconciliation/${BUDGET_ID}`)
      .flush({ success: true, data: { ...context, priorItems: undefined } });

    await expect(response).rejects.toMatchObject({ code: 'ZOD_PARSE_ERROR' });
  });

  it('updateState$ PUTs the completion alone', async () => {
    const response = firstValueFrom(api.updateState$({ completed: true }));

    const req = httpTesting.expectOne(`${BASE_URL}/reconciliation/state`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ completed: true });
    req.flush({
      success: true,
      data: { startingAmount: 0, hasCompletedComparison: true },
    });

    expect((await response).data.hasCompletedComparison).toBe(true);
  });
});
