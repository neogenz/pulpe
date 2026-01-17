import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BudgetApi } from './budget-api';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { StorageService, STORAGE_KEYS } from '../storage';
import { HasBudgetCache } from '../auth/has-budget-cache';

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

  function createTestBed(mockStorageValue: unknown = null) {
    const mockHasBudgetCache = {
      hasBudget: vi.fn().mockReturnValue(null),
      setHasBudget: vi.fn(),
      clear: vi.fn(),
    };

    const mockStorageService = {
      get: vi.fn().mockReturnValue(mockStorageValue),
      set: vi.fn(),
      remove: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        BudgetApi,
        { provide: ApplicationConfiguration, useValue: mockApplicationConfig },
        { provide: Logger, useValue: mockLogger },
        { provide: StorageService, useValue: mockStorageService },
        { provide: HasBudgetCache, useValue: mockHasBudgetCache },
      ],
    });

    return {
      service: TestBed.inject(BudgetApi),
      httpTesting: TestBed.inject(HttpTestingController),
      mockHasBudgetCache,
      mockStorageService,
    };
  }

  describe('createBudget$', () => {
    it('should make HTTP POST request and sync cache', () => {
      const { service, httpTesting, mockHasBudgetCache, mockStorageService } =
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

      service.createBudget$(templateData).subscribe();

      const req = httpTesting.expectOne('http://localhost:3000/api/v1/budgets');
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, data: responseBudget });

      expect(mockHasBudgetCache.setHasBudget).toHaveBeenCalledWith(true);
      expect(mockStorageService.set).toHaveBeenCalledWith(
        STORAGE_KEYS.CURRENT_BUDGET,
        responseBudget,
      );
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
        { message: 'Budget already exists', code: 'ERR_BUDGET_ALREADY_EXISTS' },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(error).toEqual({
        message:
          'Un budget existe déjà pour cette période. Veuillez sélectionner un autre mois.',
        details: undefined,
        code: 'ERR_BUDGET_ALREADY_EXISTS',
      });
      expect(mockHasBudgetCache.setHasBudget).not.toHaveBeenCalled();
    });
  });

  describe('deleteBudget$', () => {
    const budgetId = '550e8400-e29b-41d4-a716-446655440000';

    it('should make HTTP DELETE request and sync cache', () => {
      const { service, httpTesting, mockHasBudgetCache } = createTestBed();

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
    });

    it('should remove budget from storage when deleted budget is the current budget', () => {
      // Use a valid budget that passes Zod schema validation
      const currentBudget = {
        id: budgetId,
        month: 1,
        year: 2024,
        description: 'Test Budget',
        templateId: '550e8400-e29b-41d4-a716-446655440001',
        createdAt: '2024-01-01T00:00:00+00:00',
        updatedAt: '2024-01-01T00:00:00+00:00',
      };
      const { service, httpTesting, mockStorageService } =
        createTestBed(currentBudget);

      service.deleteBudget$(budgetId).subscribe();

      const deleteReq = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budgets/${budgetId}`,
      );
      deleteReq.flush(null);

      const existsReq = httpTesting.expectOne(
        'http://localhost:3000/api/v1/budgets/exists',
      );
      existsReq.flush({ hasBudget: false });

      expect(mockStorageService.remove).toHaveBeenCalledWith(
        STORAGE_KEYS.CURRENT_BUDGET,
      );
    });

    it('should NOT remove budget from storage when deleted budget is NOT the current budget', () => {
      // Use a valid budget that passes Zod schema validation
      const differentBudget = {
        id: '550e8400-e29b-41d4-a716-446655440099',
        month: 1,
        year: 2024,
        description: 'Other Budget',
        templateId: '550e8400-e29b-41d4-a716-446655440001',
        createdAt: '2024-01-01T00:00:00+00:00',
        updatedAt: '2024-01-01T00:00:00+00:00',
      };
      const { service, httpTesting, mockStorageService } =
        createTestBed(differentBudget);

      service.deleteBudget$(budgetId).subscribe();

      const deleteReq = httpTesting.expectOne(
        `http://localhost:3000/api/v1/budgets/${budgetId}`,
      );
      deleteReq.flush(null);

      expect(mockStorageService.remove).not.toHaveBeenCalled();

      const existsReq = httpTesting.expectOne(
        'http://localhost:3000/api/v1/budgets/exists',
      );
      existsReq.flush({ hasBudget: true });
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
        { message: 'Budget not found' },
        { status: 404, statusText: 'Not Found' },
      );

      expect(error).toEqual({
        message: 'Budget not found',
        details: undefined,
        code: undefined,
      });
      expect(mockHasBudgetCache.setHasBudget).not.toHaveBeenCalled();
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
