import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { TransactionApi } from './transaction-api';

const mockApplicationConfig = {
  backendApiUrl: () => 'http://localhost:3000/api/v1',
};

describe('TransactionApi', () => {
  let service: TransactionApi;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        TransactionApi,
        {
          provide: ApplicationConfiguration,
          useValue: mockApplicationConfig,
        },
      ],
    });

    service = TestBed.inject(TransactionApi);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should serialize active search filters as repeated query parameters', async () => {
    const tagIds = [
      '4df3df43-2b73-467a-a7ac-322f3ab8ed49',
      '73ce725e-0173-4bb5-b35d-30ec2b01af75',
    ];
    const responsePromise = firstValueFrom(
      service.search$({ q: 'loyer', years: [2026, 2025], tagIds }),
    );

    const req = httpTesting.expectOne(
      'http://localhost:3000/api/v1/transactions/search' +
        `?q=loyer&years=2026&years=2025&tagIds=${tagIds[0]}&tagIds=${tagIds[1]}`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [] });

    await expect(responsePromise).resolves.toEqual({
      success: true,
      data: [],
    });
  });

  it('should POST toggle-check and accept amount=0 when encryption is active', async () => {
    const transactionId = '68c73361-c59b-4ce4-9e6a-0843505a08d5';
    const responsePromise = firstValueFrom(service.toggleCheck$(transactionId));

    const req = httpTesting.expectOne(
      `http://localhost:3000/api/v1/transactions/${transactionId}/toggle-check`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({
      success: true,
      data: {
        id: transactionId,
        budgetId: 'd9bc5bb2-ef0e-49b6-bfd5-7bfc2d66f62f',
        budgetLineId: null,
        name: 'Dépense',
        amount: 0,
        kind: 'expense',
        transactionDate: '2026-02-04T00:00:00.000Z',
        tagIds: [],
        createdAt: '2026-02-04T00:00:00.000Z',
        updatedAt: '2026-02-04T00:00:00.000Z',
        checkedAt: '2026-02-04T00:00:00.000Z',
      },
    });

    const response = await responsePromise;
    expect(response.success).toBe(true);
    expect(response.data.amount).toBe(0);
  });
});
