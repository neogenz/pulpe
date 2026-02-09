import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { CompleteProfileStore } from './complete-profile-store';
import { ProfileSetupService } from '@core/complete-profile';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsApi } from '@core/user-settings';
import { AuthOAuthService } from '@core/auth';

describe('CompleteProfileStore', () => {
  let store: CompleteProfileStore;
  let mockProfileSetupService: {
    createInitialBudget: ReturnType<typeof vi.fn>;
  };
  let mockBudgetApi: {
    getAllBudgets$: ReturnType<typeof vi.fn>;
  };
  let mockUserSettingsApi: {
    updateSettings: ReturnType<typeof vi.fn>;
  };
  let mockAuthOAuth: {
    getOAuthUserMetadata: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let mockPostHogService: {
    captureException: ReturnType<typeof vi.fn>;
    captureEvent: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockProfileSetupService = {
      createInitialBudget: vi.fn(),
    };

    mockBudgetApi = {
      getAllBudgets$: vi.fn().mockReturnValue(of([])),
    };

    mockUserSettingsApi = {
      updateSettings: vi.fn().mockResolvedValue({ payDayOfMonth: null }),
    };

    mockAuthOAuth = {
      getOAuthUserMetadata: vi.fn().mockReturnValue(null),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockPostHogService = {
      captureException: vi.fn(),
      captureEvent: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        CompleteProfileStore,
        { provide: ProfileSetupService, useValue: mockProfileSetupService },
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: UserSettingsApi, useValue: mockUserSettingsApi },
        { provide: AuthOAuthService, useValue: mockAuthOAuth },
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

    it('should not be checking existing budget initially', () => {
      expect(store.isCheckingExistingBudget()).toBe(false);
    });

    it('should have no error', () => {
      expect(store.error()).toBe('');
    });

    it('should have null payDayOfMonth', () => {
      expect(store.payDayOfMonth()).toBeNull();
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

  describe('prefillFromOAuthMetadata', () => {
    it('should not change firstName when no OAuth metadata', () => {
      mockAuthOAuth.getOAuthUserMetadata.mockReturnValue(null);

      store.prefillFromOAuthMetadata();

      expect(store.firstName()).toBe('');
    });

    it('should prefill firstName from givenName', () => {
      mockAuthOAuth.getOAuthUserMetadata.mockReturnValue({
        givenName: 'John',
        fullName: 'John Doe',
      });

      store.prefillFromOAuthMetadata();

      expect(store.firstName()).toBe('John');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Prefilled firstName from OAuth metadata',
        { source: 'givenName' },
      );
    });

    it('should prefill firstName from fullName first word when givenName missing', () => {
      mockAuthOAuth.getOAuthUserMetadata.mockReturnValue({
        fullName: 'Jane Smith',
      });

      store.prefillFromOAuthMetadata();

      expect(store.firstName()).toBe('Jane');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Prefilled firstName from OAuth metadata',
        { source: 'fullName' },
      );
    });

    it('should not change firstName when metadata has no name fields', () => {
      mockAuthOAuth.getOAuthUserMetadata.mockReturnValue({});

      store.prefillFromOAuthMetadata();

      expect(store.firstName()).toBe('');
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should prefer givenName over fullName', () => {
      mockAuthOAuth.getOAuthUserMetadata.mockReturnValue({
        givenName: 'Johnny',
        fullName: 'John Doe',
      });

      store.prefillFromOAuthMetadata();

      expect(store.firstName()).toBe('Johnny');
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

  describe('updatePayDayOfMonth', () => {
    it('should update payDayOfMonth', () => {
      store.updatePayDayOfMonth(27);

      expect(store.payDayOfMonth()).toBe(27);
    });

    it('should allow setting to null', () => {
      store.updatePayDayOfMonth(15);
      store.updatePayDayOfMonth(null);

      expect(store.payDayOfMonth()).toBeNull();
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

    it('should save payDayOfMonth when set', async () => {
      mockProfileSetupService.createInitialBudget.mockResolvedValue({
        success: true,
      });

      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);
      store.updatePayDayOfMonth(27);

      const result = await store.submitProfile();

      expect(result).toBe(true);
      expect(mockUserSettingsApi.updateSettings).toHaveBeenCalledWith({
        payDayOfMonth: 27,
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Pay day setting saved', {
        payDayOfMonth: 27,
      });
    });

    it('should not save payDayOfMonth when null', async () => {
      mockProfileSetupService.createInitialBudget.mockResolvedValue({
        success: true,
      });

      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);
      // payDayOfMonth is null by default

      const result = await store.submitProfile();

      expect(result).toBe(true);
      expect(mockUserSettingsApi.updateSettings).not.toHaveBeenCalled();
    });

    it('should succeed even if saving payDayOfMonth fails', async () => {
      mockProfileSetupService.createInitialBudget.mockResolvedValue({
        success: true,
      });
      mockUserSettingsApi.updateSettings.mockRejectedValue(
        new Error('Settings API Error'),
      );

      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);
      store.updatePayDayOfMonth(15);

      const result = await store.submitProfile();

      expect(result).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to save pay day setting',
        expect.any(Error),
      );
      expect(mockPostHogService.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        {
          context: 'complete-profile',
          action: 'savePayDaySetting',
        },
      );
    });

    it('should track first_budget_created event on success', async () => {
      mockProfileSetupService.createInitialBudget.mockResolvedValue({
        success: true,
      });

      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);

      await store.submitProfile();

      expect(mockPostHogService.captureEvent).toHaveBeenCalledWith(
        'first_budget_created',
        {
          signup_method: 'email',
          has_pay_day: false,
          charges_count: 0,
        },
      );
    });

    it('should track first_budget_created with google method when OAuth metadata exists', async () => {
      mockProfileSetupService.createInitialBudget.mockResolvedValue({
        success: true,
      });
      mockAuthOAuth.getOAuthUserMetadata.mockReturnValue({
        givenName: 'John',
      });

      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);

      await store.submitProfile();

      expect(mockPostHogService.captureEvent).toHaveBeenCalledWith(
        'first_budget_created',
        expect.objectContaining({
          signup_method: 'google',
        }),
      );
    });

    it('should count optional charges correctly', async () => {
      mockProfileSetupService.createInitialBudget.mockResolvedValue({
        success: true,
      });

      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);
      store.updateHousingCosts(1000);
      store.updatePhonePlan(50);
      store.updatePayDayOfMonth(27);

      await store.submitProfile();

      expect(mockPostHogService.captureEvent).toHaveBeenCalledWith(
        'first_budget_created',
        {
          signup_method: 'email',
          has_pay_day: true,
          charges_count: 2,
        },
      );
    });
  });
});
