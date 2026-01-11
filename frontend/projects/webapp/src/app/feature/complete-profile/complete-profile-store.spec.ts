import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { CompleteProfileStore } from './complete-profile-store';
import { ProfileSetupService } from '@core/profile';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { PostHogService } from '@core/analytics/posthog';

describe('CompleteProfileStore', () => {
  let store: CompleteProfileStore;
  let mockProfileSetupService: {
    createInitialBudget: ReturnType<typeof vi.fn>;
  };
  let mockBudgetApi: {
    getAllBudgets$: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let mockPostHogService: {
    captureException: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockProfileSetupService = {
      createInitialBudget: vi.fn(),
    };

    mockBudgetApi = {
      getAllBudgets$: vi.fn().mockReturnValue(of([])),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    mockPostHogService = {
      captureException: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        CompleteProfileStore,
        { provide: ProfileSetupService, useValue: mockProfileSetupService },
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: Logger, useValue: mockLogger },
        { provide: PostHogService, useValue: mockPostHogService },
      ],
    });

    store = TestBed.inject(CompleteProfileStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have empty firstName', () => {
      expect(store.firstName()).toBe('');
    });

    it('should have null monthlyIncome', () => {
      expect(store.monthlyIncome()).toBeNull();
    });

    it('should not be loading', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should be checking existing budget initially', () => {
      expect(store.isCheckingExistingBudget()).toBe(true);
    });

    it('should have no error', () => {
      expect(store.error()).toBe('');
    });

    it('should be invalid for step 1', () => {
      expect(store.isStep1Valid()).toBe(false);
    });
  });

  describe('checkExistingBudgets', () => {
    it('should return false when no budgets exist', async () => {
      mockBudgetApi.getAllBudgets$.mockReturnValue(of([]));

      const result = await store.checkExistingBudgets();

      expect(result).toBe(false);
      expect(store.isCheckingExistingBudget()).toBe(false);
    });

    it('should return true when budgets exist', async () => {
      mockBudgetApi.getAllBudgets$.mockReturnValue(
        of([{ id: 'budget-1', name: 'Test Budget' }]),
      );

      const result = await store.checkExistingBudgets();

      expect(result).toBe(true);
      expect(store.isCheckingExistingBudget()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User already has budgets, should redirect to dashboard',
      );
    });

    it('should return false and track error on API failure', async () => {
      const apiError = new Error('API Error');
      mockBudgetApi.getAllBudgets$.mockReturnValue(throwError(() => apiError));

      const result = await store.checkExistingBudgets();

      expect(result).toBe(false);
      expect(store.isCheckingExistingBudget()).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error checking existing budgets:',
        apiError,
      );
      expect(mockPostHogService.captureException).toHaveBeenCalledWith(
        apiError,
        {
          context: 'complete-profile',
          action: 'checkExistingBudgets',
        },
      );
    });
  });

  describe('updateFirstName', () => {
    it('should update firstName', () => {
      store.updateFirstName('John');

      expect(store.firstName()).toBe('John');
    });
  });

  describe('updateMonthlyIncome', () => {
    it('should update monthlyIncome', () => {
      store.updateMonthlyIncome(5000);

      expect(store.monthlyIncome()).toBe(5000);
    });
  });

  describe('isStep1Valid', () => {
    it('should be false when firstName is empty', () => {
      store.updateMonthlyIncome(5000);

      expect(store.isStep1Valid()).toBe(false);
    });

    it('should be false when monthlyIncome is null', () => {
      store.updateFirstName('John');

      expect(store.isStep1Valid()).toBe(false);
    });

    it('should be false when monthlyIncome is zero', () => {
      store.updateFirstName('John');
      store.updateMonthlyIncome(0);

      expect(store.isStep1Valid()).toBe(false);
    });

    it('should be true when both firstName and monthlyIncome are valid', () => {
      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);

      expect(store.isStep1Valid()).toBe(true);
    });
  });

  describe('submitProfile', () => {
    it('should return false and set error when step 1 is invalid', async () => {
      const result = await store.submitProfile();

      expect(result).toBe(false);
      expect(store.error()).toContain('prénom');
    });

    it('should call profileSetupService when valid', async () => {
      mockProfileSetupService.createInitialBudget.mockResolvedValue({
        success: true,
      });

      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);

      const result = await store.submitProfile();

      expect(result).toBe(true);
      expect(mockProfileSetupService.createInitialBudget).toHaveBeenCalledWith({
        firstName: 'John',
        monthlyIncome: 5000,
        housingCosts: undefined,
        healthInsurance: undefined,
        phonePlan: undefined,
        transportCosts: undefined,
        leasingCredit: undefined,
      });
    });

    it('should return false when profileSetupService fails', async () => {
      mockProfileSetupService.createInitialBudget.mockResolvedValue({
        success: false,
        error: 'API Error',
      });

      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);

      const result = await store.submitProfile();

      expect(result).toBe(false);
      expect(store.error()).toBe('API Error');
    });
  });
});
