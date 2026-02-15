import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom, of } from 'rxjs';
import { BudgetApi } from './budget-api';
import { BudgetInvalidationService } from './budget-invalidation.service';
import { TransactionApi } from '../transaction/transaction-api';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { HasBudgetCache } from '../auth/has-budget-cache';
import { ApiError } from '../api/api-error';

describe('BudgetApi', () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const mockApplicationConfig = {
    backendApiUrl: () => 'http://localhost:3000/api/v1',
  };

  function createTestBed() {
    const mockHasBudgetCache = {
      hasBudget: vi.fn().mockReturnValue(null),
      setHasBudget: vi.fn(),
      clear: vi.fn(),
    };

    const mockInvalidation = {
      version: vi.fn().mockReturnValue(0),
      invalidate: vi.fn(),
    };

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
        { provide: HasBudgetCache, useValue: mockHasBudgetCache },
        { provide: BudgetInvalidationService, useValue: mockInvalidation },
        { provide: TransactionApi, useValue: mockTransactionApi },
      ],
    });

    return {
      service: TestBed.inject(BudgetApi),
      httpTesting: TestBed.inject(HttpTestingController),
      mockHasBudgetCache,
      mockInvalidation,
      mockTransactionApi,
    };
  }

  describe('createBudget$', () => {
    it('should make HTTP POST request and store budget ID', () => {
      const { service, httpTesting, mockHasBudgetCache, mockInvalidation } =
        createTestBed();
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
        message: 'Budget créé avec succès à partir du template',
      });
      expect(mockHasBudgetCache.setHasBudget).toHaveBeenCalledWith(true);
      expect(mockInvalidation.invalidate).toHaveBeenCalled();
    });

    it('should NOT sync cache on HTTP error', () => {
      const { service, httpTesting, mockHasBudgetCache } = createTestBed();
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
      expect(mockHasBudgetCache.setHasBudget).not.toHaveBeenCalled();
    });
  });

  describe('deleteBudget$', () => {
    const budgetId = '550e8400-e29b-41d4-a716-446655440000';

    it('should make HTTP DELETE request, sync cache, and invalidate', () => {
      const { service, httpTesting, mockHasBudgetCache, mockInvalidation } =
        createTestBed();

      service.deleteBudget$(budgetId).subscribe();

      const deleteReq = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budgets/${budgetId}`,
      );
      expect(deleteReq.request.method).toBe('DELETE');
      deleteReq.flush(null);

      const existsReq = httpTesting.expectOne(
        'http://localhost:3000/api/v1/budgets/exists',
      );
      existsReq.flush({ hasBudget: true });

      expect(mockHasBudgetCache.setHasBudget).toHaveBeenCalledWith(true);
      expect(mockInvalidation.invalidate).toHaveBeenCalled();
    });

    it('should sync HasBudgetCache to false after deleting last budget', () => {
      const { service, httpTesting, mockHasBudgetCache } = createTestBed();

      service.deleteBudget$(budgetId).subscribe();

      const deleteReq = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budgets/${budgetId}`,
      );
      deleteReq.flush(null);

      const existsReq = httpTesting.expectOne(
        'http://localhost:3000/api/v1/budgets/exists',
      );
      existsReq.flush({ hasBudget: false });

      expect(mockHasBudgetCache.setHasBudget).toHaveBeenCalledWith(false);
    });

    it('should handle HTTP error and NOT sync cache', () => {
      const { service, httpTesting, mockHasBudgetCache } = createTestBed();
      let error: unknown;

      service.deleteBudget$(budgetId).subscribe({
        error: (e) => {
          error = e;
        },
      });

      const deleteReq = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budgets/${budgetId}`,
      );
      deleteReq.flush(
        { success: false, error: 'Budget not found' },
        { status: 404, statusText: 'Not Found' },
      );

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
      expect((error as ApiError).message).toBe('Budget not found');
      expect(mockHasBudgetCache.setHasBudget).not.toHaveBeenCalled();
    });
  });

  describe('updateBudget$', () => {
    it('should call invalidate after successful update', () => {
      const { service, httpTesting, mockInvalidation } = createTestBed();
      const budgetId = '550e8400-e29b-41d4-a716-446655440000';

      service.updateBudget$(budgetId, { description: 'Updated' }).subscribe();

      const req = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budgets/${budgetId}`,
      );
      expect(req.request.method).toBe('PATCH');
      req.flush({
        success: true,
        data: {
          id: budgetId,
          month: 1,
          year: 2024,
          description: 'Updated',
          templateId: '550e8400-e29b-41d4-a716-446655440001',
          createdAt: '2024-01-01T00:00:00+00:00',
          updatedAt: '2024-01-01T00:00:00+00:00',
        },
      });

      expect(mockInvalidation.invalidate).toHaveBeenCalled();
    });
  });

  describe('checkBudgetExists$', () => {
    it('should call /budgets/exists and sync HasBudgetCache', async () => {
      const { service, httpTesting, mockHasBudgetCache } = createTestBed();

      const resultPromise = firstValueFrom(service.checkBudgetExists$());

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/budgets/exists',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ hasBudget: false });

      await resultPromise;
      expect(mockHasBudgetCache.setHasBudget).toHaveBeenCalledWith(false);
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

    it('should return cached result on second call (fresh cache)', async () => {
      const { service, httpTesting } = createTestBed();

      const firstPromise = firstValueFrom(service.checkBudgetExists$());

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/budgets/exists',
      );
      req.flush({ hasBudget: true });

      expect(await firstPromise).toBe(true);

      const secondResult = await firstValueFrom(service.checkBudgetExists$());
      httpTesting.expectNone('http://localhost:3000/api/v1/budgets/exists');

      expect(secondResult).toBe(true);
    });

    it('should deduplicate concurrent calls', async () => {
      const { service, httpTesting } = createTestBed();

      const promise1 = firstValueFrom(service.checkBudgetExists$());
      const promise2 = firstValueFrom(service.checkBudgetExists$());

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/budgets/exists',
      );
      req.flush({ hasBudget: true });

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('getAllBudgets$', () => {
    it('should sync HasBudgetCache to true when budgets exist', async () => {
      const { service, httpTesting, mockHasBudgetCache } = createTestBed();

      service.getAllBudgets$().subscribe();

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

      await Promise.resolve();
      expect(mockHasBudgetCache.setHasBudget).toHaveBeenCalledWith(true);
    });

    it('should sync HasBudgetCache to false when no budgets exist', async () => {
      const { service, httpTesting, mockHasBudgetCache } = createTestBed();

      service.getAllBudgets$().subscribe();

      const req = httpTesting.expectOne('http://localhost:3000/api/v1/budgets');
      req.flush({ success: true, data: [] });

      await Promise.resolve();
      expect(mockHasBudgetCache.setHasBudget).toHaveBeenCalledWith(false);
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
    it('should POST to /budget-lines and invalidate', () => {
      const { service, httpTesting, mockInvalidation } = createTestBed();
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
      expect(mockInvalidation.invalidate).toHaveBeenCalled();
    });
  });

  describe('updateBudgetLine$', () => {
    it('should PATCH to /budget-lines/:id and invalidate', () => {
      const { service, httpTesting, mockInvalidation } = createTestBed();
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
      expect(mockInvalidation.invalidate).toHaveBeenCalled();
    });
  });

  describe('deleteBudgetLine$', () => {
    it('should DELETE to /budget-lines/:id and invalidate', () => {
      const { service, httpTesting, mockInvalidation } = createTestBed();
      const id = '550e8400-e29b-41d4-a716-446655440010';

      let result: unknown;
      service.deleteBudgetLine$(id).subscribe((r) => (result = r));

      const req = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budget-lines/${id}`,
      );
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, message: 'Deleted' });

      expect(result).toEqual({ success: true, message: 'Deleted' });
      expect(mockInvalidation.invalidate).toHaveBeenCalled();
    });
  });

  describe('resetBudgetLineFromTemplate$', () => {
    it('should POST to /budget-lines/:id/reset-from-template and invalidate', () => {
      const { service, httpTesting, mockInvalidation } = createTestBed();
      const id = '550e8400-e29b-41d4-a716-446655440010';

      let result: unknown;
      service.resetBudgetLineFromTemplate$(id).subscribe((r) => (result = r));

      const req = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budget-lines/${id}/reset-from-template`,
      );
      expect(req.request.method).toBe('POST');
      req.flush(BUDGET_LINE_RESPONSE);

      expect(result).toEqual(BUDGET_LINE_RESPONSE);
      expect(mockInvalidation.invalidate).toHaveBeenCalled();
    });
  });

  describe('toggleBudgetLineCheck$', () => {
    it('should POST to /budget-lines/:id/toggle-check without global invalidation but with cache invalidation', () => {
      const { service, httpTesting, mockInvalidation } = createTestBed();
      const cacheInvalidateSpy = vi.spyOn(service.cache, 'invalidate');
      const id = '550e8400-e29b-41d4-a716-446655440010';

      let result: unknown;
      service.toggleBudgetLineCheck$(id).subscribe((r) => (result = r));

      const req = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budget-lines/${id}/toggle-check`,
      );
      expect(req.request.method).toBe('POST');
      req.flush(BUDGET_LINE_RESPONSE);

      expect(result).toEqual(BUDGET_LINE_RESPONSE);
      expect(mockInvalidation.invalidate).not.toHaveBeenCalled();
      expect(cacheInvalidateSpy).toHaveBeenCalledWith(['budget']);
    });
  });

  describe('checkBudgetLineTransactions$', () => {
    it('should POST to /budget-lines/:id/check-transactions without global invalidation but with cache invalidation', () => {
      const { service, httpTesting, mockInvalidation } = createTestBed();
      const cacheInvalidateSpy = vi.spyOn(service.cache, 'invalidate');
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
      expect(mockInvalidation.invalidate).not.toHaveBeenCalled();
      expect(cacheInvalidateSpy).toHaveBeenCalledWith(['budget']);
    });
  });

  describe('createTransaction$', () => {
    it('should delegate to TransactionApi.create$ and invalidate', () => {
      const { service, mockTransactionApi, mockInvalidation } = createTestBed();
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
      expect(mockInvalidation.invalidate).toHaveBeenCalled();
    });
  });

  describe('updateTransaction$', () => {
    it('should delegate to TransactionApi.update$ and invalidate', () => {
      const { service, mockTransactionApi, mockInvalidation } = createTestBed();
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
      expect(mockInvalidation.invalidate).toHaveBeenCalled();
    });
  });

  describe('deleteTransaction$', () => {
    it('should delegate to TransactionApi.remove$ and invalidate', () => {
      const { service, mockTransactionApi, mockInvalidation } = createTestBed();
      mockTransactionApi.remove$.mockReturnValue(of(void 0));
      const id = '550e8400-e29b-41d4-a716-446655440020';

      let result: unknown = 'not-called';
      service.deleteTransaction$(id).subscribe((r) => (result = r));

      expect(mockTransactionApi.remove$).toHaveBeenCalledWith(id);
      expect(result).toBeUndefined();
      expect(mockInvalidation.invalidate).toHaveBeenCalled();
    });
  });

  describe('toggleTransactionCheck$', () => {
    it('should delegate to TransactionApi.toggleCheck$ without global invalidation but with cache invalidation', () => {
      const { service, mockTransactionApi, mockInvalidation } = createTestBed();
      const cacheInvalidateSpy = vi.spyOn(service.cache, 'invalidate');
      mockTransactionApi.toggleCheck$.mockReturnValue(of(TRANSACTION_RESPONSE));
      const id = '550e8400-e29b-41d4-a716-446655440020';

      let result: unknown;
      service.toggleTransactionCheck$(id).subscribe((r) => (result = r));

      expect(mockTransactionApi.toggleCheck$).toHaveBeenCalledWith(id);
      expect(result).toEqual(TRANSACTION_RESPONSE);
      expect(mockInvalidation.invalidate).not.toHaveBeenCalled();
      expect(cacheInvalidateSpy).toHaveBeenCalledWith(['budget']);
    });
  });
});
