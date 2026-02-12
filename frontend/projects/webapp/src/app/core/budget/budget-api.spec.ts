import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BudgetApi } from './budget-api';
import { BudgetInvalidationService } from './budget-invalidation.service';
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
      ],
    });

    return {
      service: TestBed.inject(BudgetApi),
      httpTesting: TestBed.inject(HttpTestingController),
      mockHasBudgetCache,
      mockInvalidation,
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
    it('should call /budgets/exists and sync HasBudgetCache', () => {
      const { service, httpTesting, mockHasBudgetCache } = createTestBed();

      service.checkBudgetExists$().subscribe();

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/budgets/exists',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ hasBudget: false });

      expect(mockHasBudgetCache.setHasBudget).toHaveBeenCalledWith(false);
    });

    it('should return the hasBudget boolean', () => {
      const { service, httpTesting } = createTestBed();
      let result: boolean | undefined;

      service.checkBudgetExists$().subscribe((value) => {
        result = value;
      });

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/budgets/exists',
      );
      req.flush({ hasBudget: true });

      expect(result).toBe(true);
    });
  });

  describe('getAllBudgets$', () => {
    it('should sync HasBudgetCache to true when budgets exist', () => {
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

      expect(mockHasBudgetCache.setHasBudget).toHaveBeenCalledWith(true);
    });

    it('should sync HasBudgetCache to false when no budgets exist', () => {
      const { service, httpTesting, mockHasBudgetCache } = createTestBed();

      service.getAllBudgets$().subscribe();

      const req = httpTesting.expectOne('http://localhost:3000/api/v1/budgets');
      req.flush({ success: true, data: [] });

      expect(mockHasBudgetCache.setHasBudget).toHaveBeenCalledWith(false);
    });
  });
});
