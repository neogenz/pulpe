import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom, of } from 'rxjs';
import { BudgetApi, BUDGET_EXISTS_KEY } from './budget-api';
import { TransactionApi } from '../transaction/transaction-api';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { ApiError } from '../api/api-error';

describe('BudgetApi', () => {
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const mockApplicationConfig = {
    backendApiUrl: () => 'http://localhost:3000/api/v1',
  };

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  function createTestBed() {
    const mockTransactionApi = {
      create$: vi.fn(),
      update$: vi.fn(),
      remove$: vi.fn(),
      toggleCheck$: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        BudgetApi,
        { provide: ApplicationConfiguration, useValue: mockApplicationConfig },
        { provide: Logger, useValue: mockLogger },
        { provide: TransactionApi, useValue: mockTransactionApi },
      ],
    });

    const service = TestBed.inject(BudgetApi);
    const cacheSetSpy = vi.spyOn(service.cache, 'set');

    return {
      service,
      httpTesting: TestBed.inject(HttpTestingController),
      cacheSetSpy,
      mockTransactionApi,
    };
  }

  describe('createBudget$', () => {
    it('should create a budget and return it', () => {
      const { service, httpTesting } = createTestBed();
      const templateData = {
        month: 2,
        year: 2024,
        description: 'Budget Février',
        templateId: '550e8400-e29b-41d4-a716-446655440001',
      };
      const responseBudget = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        month: 2,
        year: 2024,
        description: 'Budget Février',
        templateId: '550e8400-e29b-41d4-a716-446655440001',
        createdAt: '2024-02-01T00:00:00+00:00',
        updatedAt: '2024-02-01T00:00:00+00:00',
      };

      let result: unknown;
      service.createBudget$(templateData).subscribe((r) => (result = r));

      const req = httpTesting.expectOne('http://localhost:3000/api/v1/budgets');
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, data: responseBudget });

      expect(result).toEqual({
        budget: responseBudget,
      });
    });

    it('should propagate HTTP error', () => {
      const { service, httpTesting } = createTestBed();
      const templateData = {
        month: 2,
        year: 2024,
        description: 'Budget Février',
        templateId: '550e8400-e29b-41d4-a716-446655440001',
      };
      let error: unknown;

      service.createBudget$(templateData).subscribe({
        error: (e) => {
          error = e;
        },
      });

      const req = httpTesting.expectOne('http://localhost:3000/api/v1/budgets');
      req.flush(
        {
          success: false,
          error: 'Budget already exists',
          code: 'ERR_BUDGET_ALREADY_EXISTS',
        },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).code).toBe('ERR_BUDGET_ALREADY_EXISTS');
      expect((error as ApiError).message).toBe('Budget already exists');
    });
  });

  describe('checkBudgetExists$', () => {
    it('should call /budgets/exists and sync DataCache', async () => {
      const { service, httpTesting, cacheSetSpy } = createTestBed();

      const resultPromise = firstValueFrom(service.checkBudgetExists$());

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/budgets/exists',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ hasBudget: false });

      await resultPromise;
      expect(cacheSetSpy).toHaveBeenCalledWith(BUDGET_EXISTS_KEY, false);
    });

    it('should return the hasBudget boolean', async () => {
      const { service, httpTesting } = createTestBed();

      const resultPromise = firstValueFrom(service.checkBudgetExists$());

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/budgets/exists',
      );
      req.flush({ hasBudget: true });

      expect(await resultPromise).toBe(true);
    });
  });

  describe('getAllBudgets$', () => {
    it('should sync DataCache to true when budgets exist', async () => {
      const { service, httpTesting, cacheSetSpy } = createTestBed();

      const resultPromise = firstValueFrom(service.getAllBudgets$());

      const req = httpTesting.expectOne('http://localhost:3000/api/v1/budgets');
      req.flush({
        success: true,
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            month: 1,
            year: 2024,
            description: 'Budget Janvier',
            templateId: '550e8400-e29b-41d4-a716-446655440001',
            createdAt: '2024-01-01T00:00:00+00:00',
            updatedAt: '2024-01-01T00:00:00+00:00',
          },
        ],
      });

      await resultPromise;
      expect(cacheSetSpy).toHaveBeenCalledWith(BUDGET_EXISTS_KEY, true);
    });

    it('should sync DataCache to false when no budgets exist', async () => {
      const { service, httpTesting, cacheSetSpy } = createTestBed();

      const resultPromise = firstValueFrom(service.getAllBudgets$());

      const req = httpTesting.expectOne('http://localhost:3000/api/v1/budgets');
      req.flush({ success: true, data: [] });

      await resultPromise;
      expect(cacheSetSpy).toHaveBeenCalledWith(BUDGET_EXISTS_KEY, false);
    });
  });

  const BUDGET_LINE_DATA = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    budgetId: '550e8400-e29b-41d4-a716-446655440000',
    templateLineId: null,
    savingsGoalId: null,
    name: 'Loyer',
    amount: 800,
    kind: 'expense',
    recurrence: 'fixed',
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: '2024-01-01T00:00:00+00:00',
    updatedAt: '2024-01-01T00:00:00+00:00',
  };

  const BUDGET_LINE_RESPONSE = {
    success: true as const,
    data: BUDGET_LINE_DATA,
  };

  const TRANSACTION_DATA = {
    id: '550e8400-e29b-41d4-a716-446655440020',
    budgetId: '550e8400-e29b-41d4-a716-446655440000',
    budgetLineId: '550e8400-e29b-41d4-a716-446655440010',
    name: 'Courses',
    amount: 50,
    kind: 'expense',
    transactionDate: '2024-01-15T00:00:00+00:00',
    category: null,
    checkedAt: null,
    createdAt: '2024-01-15T00:00:00+00:00',
    updatedAt: '2024-01-15T00:00:00+00:00',
  };

  const TRANSACTION_RESPONSE = {
    success: true as const,
    data: TRANSACTION_DATA,
  };

  describe('createBudgetLine$', () => {
    it('should create a budget line and invalidate cache', () => {
      const { service, httpTesting } = createTestBed();
      const data = {
        budgetId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Loyer',
        amount: 800,
        kind: 'expense' as const,
        recurrence: 'fixed' as const,
        isManuallyAdjusted: false,
      };

      let result: unknown;
      service.createBudgetLine$(data).subscribe((r) => (result = r));

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/budget-lines',
      );
      expect(req.request.method).toBe('POST');
      req.flush(BUDGET_LINE_RESPONSE);

      expect(result).toEqual(BUDGET_LINE_RESPONSE);
    });
  });

  describe('updateBudgetLine$', () => {
    it('should PATCH to /budget-lines/:id and invalidate', () => {
      const { service, httpTesting } = createTestBed();
      const id = '550e8400-e29b-41d4-a716-446655440010';

      let result: unknown;
      service
        .updateBudgetLine$(id, { id, name: 'Loyer mis à jour' })
        .subscribe((r) => (result = r));

      const req = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budget-lines/${id}`,
      );
      expect(req.request.method).toBe('PATCH');
      req.flush(BUDGET_LINE_RESPONSE);

      expect(result).toEqual(BUDGET_LINE_RESPONSE);
    });
  });

  describe('deleteBudgetLine$', () => {
    it('should DELETE to /budget-lines/:id and invalidate', () => {
      const { service, httpTesting } = createTestBed();
      const id = '550e8400-e29b-41d4-a716-446655440010';

      let result: unknown;
      service.deleteBudgetLine$(id).subscribe((r) => (result = r));

      const req = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budget-lines/${id}`,
      );
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, message: 'Deleted' });

      expect(result).toEqual({ success: true, message: 'Deleted' });
    });
  });

  describe('resetBudgetLineFromTemplate$', () => {
    it('should POST to /budget-lines/:id/reset-from-template and invalidate', () => {
      const { service, httpTesting } = createTestBed();
      const id = '550e8400-e29b-41d4-a716-446655440010';

      let result: unknown;
      service.resetBudgetLineFromTemplate$(id).subscribe((r) => (result = r));

      const req = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budget-lines/${id}/reset-from-template`,
      );
      expect(req.request.method).toBe('POST');
      req.flush(BUDGET_LINE_RESPONSE);

      expect(result).toEqual(BUDGET_LINE_RESPONSE);
    });
  });

  describe('toggleBudgetLineCheck$', () => {
    it('should POST to /budget-lines/:id/toggle-check', () => {
      const { service, httpTesting } = createTestBed();
      const id = '550e8400-e29b-41d4-a716-446655440010';

      let result: unknown;
      service.toggleBudgetLineCheck$(id).subscribe((r) => (result = r));

      const req = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budget-lines/${id}/toggle-check`,
      );
      expect(req.request.method).toBe('POST');
      req.flush(BUDGET_LINE_RESPONSE);

      expect(result).toEqual(BUDGET_LINE_RESPONSE);
    });
  });

  describe('checkBudgetLineTransactions$', () => {
    it('should POST to /budget-lines/:id/check-transactions', () => {
      const { service, httpTesting } = createTestBed();
      const id = '550e8400-e29b-41d4-a716-446655440010';
      const listResponse = { success: true, data: [TRANSACTION_DATA] };

      let result: unknown;
      service.checkBudgetLineTransactions$(id).subscribe((r) => (result = r));

      const req = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budget-lines/${id}/check-transactions`,
      );
      expect(req.request.method).toBe('POST');
      req.flush(listResponse);

      expect(result).toEqual(listResponse);
    });
  });

  describe('createTransaction$', () => {
    it('should delegate to TransactionApi.create$ and invalidate', () => {
      const { service, mockTransactionApi } = createTestBed();
      mockTransactionApi.create$.mockReturnValue(of(TRANSACTION_RESPONSE));

      let result: unknown;
      service
        .createTransaction$({
          budgetId: '550e8400-e29b-41d4-a716-446655440000',
          budgetLineId: '550e8400-e29b-41d4-a716-446655440010',
          name: 'Courses',
          amount: 50,
          kind: 'expense',
          transactionDate: '2024-01-15T00:00:00+00:00',
        })
        .subscribe((r) => (result = r));

      expect(mockTransactionApi.create$).toHaveBeenCalled();
      expect(result).toEqual(TRANSACTION_RESPONSE);
    });
  });

  describe('updateTransaction$', () => {
    it('should delegate to TransactionApi.update$ and invalidate', () => {
      const { service, mockTransactionApi } = createTestBed();
      mockTransactionApi.update$.mockReturnValue(of(TRANSACTION_RESPONSE));
      const id = '550e8400-e29b-41d4-a716-446655440020';

      let result: unknown;
      service
        .updateTransaction$(id, { name: 'Updated' })
        .subscribe((r) => (result = r));

      expect(mockTransactionApi.update$).toHaveBeenCalledWith(id, {
        name: 'Updated',
      });
      expect(result).toEqual(TRANSACTION_RESPONSE);
    });
  });

  describe('deleteTransaction$', () => {
    it('should delegate to TransactionApi.remove$ and invalidate', () => {
      const { service, mockTransactionApi } = createTestBed();
      mockTransactionApi.remove$.mockReturnValue(of(void 0));
      const id = '550e8400-e29b-41d4-a716-446655440020';

      let result: unknown = 'not-called';
      service.deleteTransaction$(id).subscribe((r) => (result = r));

      expect(mockTransactionApi.remove$).toHaveBeenCalledWith(id);
      expect(result).toBeUndefined();
    });
  });

  describe('toggleTransactionCheck$', () => {
    it('should delegate to TransactionApi.toggleCheck$', () => {
      const { service, mockTransactionApi } = createTestBed();
      mockTransactionApi.toggleCheck$.mockReturnValue(of(TRANSACTION_RESPONSE));
      const id = '550e8400-e29b-41d4-a716-446655440020';

      let result: unknown;
      service.toggleTransactionCheck$(id).subscribe((r) => (result = r));

      expect(mockTransactionApi.toggleCheck$).toHaveBeenCalledWith(id);
      expect(result).toEqual(TRANSACTION_RESPONSE);
    });
  });
});
