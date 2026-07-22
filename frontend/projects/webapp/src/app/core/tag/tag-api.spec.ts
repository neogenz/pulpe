import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TagApi } from './tag-api';

const TAG_ID = '68c73361-c59b-4ce4-9e6a-0843505a08d5';
const baseUrl = 'http://localhost:3000/api/v1';

describe('TagApi', () => {
  let api: TagApi;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        TagApi,
        {
          provide: ApplicationConfiguration,
          useValue: { backendApiUrl: () => baseUrl },
        },
      ],
    });
    api = TestBed.inject(TagApi);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads history with the requested anchor and validates the response', async () => {
    const responsePromise = firstValueFrom(
      api.getHistory$(TAG_ID, { months: 6, endMonth: 7, endYear: 2026 }),
    );

    const req = httpTesting.expectOne(
      `${baseUrl}/tags/${TAG_ID}/history?months=6&endMonth=7&endYear=2026`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        tagId: TAG_ID,
        periods: [
          {
            month: 7,
            year: 2026,
            plannedAmount: 120,
            actualAmount: 90,
          },
        ],
        totalPlanned: 120,
        totalActual: 90,
        monthlyAverageActual: 15,
        actualToPlannedPercent: 75,
      },
    });

    const response = await responsePromise;
    expect(response.data.periods).toHaveLength(1);
    expect(response.data.actualToPlannedPercent).toBe(75);
  });

  it('rejects an invalid history response', async () => {
    const responsePromise = firstValueFrom(
      api.getHistory$(TAG_ID, { months: 3, endMonth: 7, endYear: 2026 }),
    );

    httpTesting
      .expectOne(
        `${baseUrl}/tags/${TAG_ID}/history?months=3&endMonth=7&endYear=2026`,
      )
      .flush({
        success: true,
        data: {
          tagId: TAG_ID,
          periods: [],
          totalPlanned: -1,
          totalActual: 0,
          monthlyAverageActual: 0,
          actualToPlannedPercent: null,
        },
      });

    await expect(responsePromise).rejects.toBeDefined();
  });
});
