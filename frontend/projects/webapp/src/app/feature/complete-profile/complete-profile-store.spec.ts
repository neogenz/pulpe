import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  CompleteProfileStore,
  ONBOARDING_SUGGESTIONS,
} from './complete-profile-store';
import { ProfileSetupService } from '@core/complete-profile';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsStore } from '@core/user-settings';
import { AuthOAuthService } from '@core/auth';
import { provideTranslocoForTest } from '../../testing/transloco-testing';

describe('CompleteProfileStore', () => {
  let store: CompleteProfileStore;
  let mockProfileSetupService: {
    createInitialBudget: ReturnType<typeof vi.fn>;
  };
  let mockBudgetApi: {
    checkBudgetExists$: ReturnType<typeof vi.fn>;
  };
  let mockUserSettingsStore: {
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
      checkBudgetExists$: vi.fn().mockReturnValue(of(false)),
    };

    mockUserSettingsStore = {
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
        { provide: UserSettingsStore, useValue: mockUserSettingsStore },
        { provide: AuthOAuthService, useValue: mockAuthOAuth },
        { provide: Logger, useValue: mockLogger },
        { provide: PostHogService, useValue: mockPostHogService },
        ...provideTranslocoForTest(),
      ],
    });

    store = TestBed.inject(CompleteProfileStore);
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
      expect(store.error()).toBeNull();
    });

    it('should have null internetPlan', () => {
      expect(store.internetPlan()).toBeNull();
    });

    it('should have null payDayOfMonth', () => {
      expect(store.payDayOfMonth()).toBeNull();
    });

    it('should have empty customTransactions', () => {
      expect(store.customTransactions()).toEqual([]);
    });

    it('should be invalid for step 1', () => {
      expect(store.isStep1Valid()).toBe(false);
    });
  });

  describe('checkExistingBudgets', () => {
    it('should return false when no budgets exist', async () => {
      mockBudgetApi.checkBudgetExists$.mockReturnValue(of(false));

      const result = await store.checkExistingBudgets();

      expect(result).toBe(false);
      expect(store.isCheckingExistingBudget()).toBe(false);
    });

    it('should return true when budgets exist', async () => {
      mockBudgetApi.checkBudgetExists$.mockReturnValue(of(true));

      const result = await store.checkExistingBudgets();

      expect(result).toBe(true);
      expect(store.isCheckingExistingBudget()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User already has budgets, should redirect to dashboard',
      );
    });

    it('should return false and track error on API failure', async () => {
      const apiError = new Error('API Error');
      mockBudgetApi.checkBudgetExists$.mockReturnValue(
        throwError(() => apiError),
      );

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

  describe('updateInternetPlan', () => {
    it('should update internetPlan', () => {
      store.updateInternetPlan(60);

      expect(store.internetPlan()).toBe(60);
    });

    it('should allow setting to null', () => {
      store.updateInternetPlan(60);
      store.updateInternetPlan(null);

      expect(store.internetPlan()).toBeNull();
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

    it('should set isLoading during submission', async () => {
      let resolvePromise: (value: { success: true }) => void;
      mockProfileSetupService.createInitialBudget.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);

      const submitPromise = store.submitProfile();

      expect(store.isLoading()).toBe(true);

      resolvePromise!({ success: true });
      await submitPromise;

      expect(store.isLoading()).toBe(false);
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
        internetPlan: undefined,
        transportCosts: undefined,
        leasingCredit: undefined,
        payDayOfMonth: undefined,
        customTransactions: [],
      });
    });

    it('should pass payDayOfMonth to createInitialBudget when set', async () => {
      mockProfileSetupService.createInitialBudget.mockResolvedValue({
        success: true,
      });

      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);
      store.updatePayDayOfMonth(4);

      await store.submitProfile();

      expect(mockProfileSetupService.createInitialBudget).toHaveBeenCalledWith(
        expect.objectContaining({ payDayOfMonth: 4 }),
      );
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
      expect(mockUserSettingsStore.updateSettings).toHaveBeenCalledWith({
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
      expect(mockUserSettingsStore.updateSettings).not.toHaveBeenCalled();
    });

    it('should succeed even if saving payDayOfMonth fails', async () => {
      mockProfileSetupService.createInitialBudget.mockResolvedValue({
        success: true,
      });
      mockUserSettingsStore.updateSettings.mockRejectedValue(
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
          custom_transactions_count: 0,
        },
      );
    });

    it('should track first_budget_created with oauth method when OAuth metadata exists', async () => {
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
          signup_method: 'oauth',
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
      store.updateInternetPlan(45);
      store.updatePayDayOfMonth(27);

      await store.submitProfile();

      expect(mockPostHogService.captureEvent).toHaveBeenCalledWith(
        'first_budget_created',
        {
          signup_method: 'email',
          has_pay_day: true,
          charges_count: 3,
          custom_transactions_count: 0,
        },
      );
    });
  });

  describe('customTransactions', () => {
    const mockTransaction = {
      name: 'Salle de sport',
      amount: 50,
      type: 'expense' as const,
      expenseType: 'fixed' as const,
      isRecurring: true,
    };

    describe('addCustomTransaction', () => {
      it('should add a transaction to the list', () => {
        store.addCustomTransaction(mockTransaction);

        expect(store.customTransactions()).toEqual([mockTransaction]);
      });

      it('should append to existing transactions', () => {
        const secondTransaction = {
          ...mockTransaction,
          name: 'Streaming',
          amount: 15,
        };

        store.addCustomTransaction(mockTransaction);
        store.addCustomTransaction(secondTransaction);

        expect(store.customTransactions()).toHaveLength(2);
        expect(store.customTransactions()[0].name).toBe('Salle de sport');
        expect(store.customTransactions()[1].name).toBe('Streaming');
      });
    });

    describe('removeCustomTransaction', () => {
      it('should remove a transaction by index', () => {
        store.addCustomTransaction(mockTransaction);
        store.addCustomTransaction({
          ...mockTransaction,
          name: 'Streaming',
        });

        store.removeCustomTransaction(0);

        expect(store.customTransactions()).toHaveLength(1);
        expect(store.customTransactions()[0].name).toBe('Streaming');
      });

      it('should handle removing the last transaction', () => {
        store.addCustomTransaction(mockTransaction);

        store.removeCustomTransaction(0);

        expect(store.customTransactions()).toEqual([]);
      });
    });

    it('should include customTransactions in submitProfile', async () => {
      mockProfileSetupService.createInitialBudget.mockResolvedValue({
        success: true,
      });

      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);
      store.addCustomTransaction(mockTransaction);

      await store.submitProfile();

      expect(mockProfileSetupService.createInitialBudget).toHaveBeenCalledWith(
        expect.objectContaining({
          customTransactions: [mockTransaction],
        }),
      );
    });

    it('should handle unexpected exception from createInitialBudget', async () => {
      mockProfileSetupService.createInitialBudget.mockRejectedValue(
        new Error('Network failure'),
      );

      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);

      const result = await store.submitProfile();

      expect(result).toBe(false);
      expect(store.error()).toBeDefined();
      expect(store.isLoading()).toBe(false);
    });

    it('should track custom_transactions_count in PostHog event', async () => {
      mockProfileSetupService.createInitialBudget.mockResolvedValue({
        success: true,
      });

      store.updateFirstName('John');
      store.updateMonthlyIncome(5000);
      store.addCustomTransaction(mockTransaction);

      await store.submitProfile();

      expect(mockPostHogService.captureEvent).toHaveBeenCalledWith(
        'first_budget_created',
        expect.objectContaining({
          custom_transactions_count: 1,
        }),
      );
    });
  });

  describe('suggestions', () => {
    const suggestion = ONBOARDING_SUGGESTIONS[0];

    describe('toggleSuggestion', () => {
      it('should add a suggestion when not present', () => {
        store.toggleSuggestion(suggestion);

        expect(store.customTransactions()).toContainEqual(suggestion);
      });

      it('should remove a suggestion when already present', () => {
        store.toggleSuggestion(suggestion);
        store.toggleSuggestion(suggestion);

        expect(store.customTransactions()).toEqual([]);
      });

      it('should not affect other transactions when toggling off', () => {
        const manualTx = {
          name: 'Salle de sport',
          amount: 50,
          type: 'expense' as const,
          expenseType: 'fixed' as const,
          isRecurring: true,
        };

        store.addCustomTransaction(manualTx);
        store.toggleSuggestion(suggestion);
        store.toggleSuggestion(suggestion);

        expect(store.customTransactions()).toEqual([manualTx]);
      });
    });

    describe('selectedSuggestionNames', () => {
      it('should return empty set initially', () => {
        expect(store.selectedSuggestionNames().size).toBe(0);
      });

      it('should contain name after toggling on', () => {
        store.toggleSuggestion(suggestion);

        expect(store.selectedSuggestionNames().has(suggestion.name)).toBe(true);
      });

      it('should not contain name after toggling off', () => {
        store.toggleSuggestion(suggestion);
        store.toggleSuggestion(suggestion);

        expect(store.selectedSuggestionNames().has(suggestion.name)).toBe(
          false,
        );
      });

      it('should include manually added transactions matching a suggestion exactly', () => {
        store.addCustomTransaction({
          name: 'Courses / alimentation',
          amount: 600,
          type: 'expense',
          expenseType: 'fixed',
          isRecurring: true,
        });

        expect(
          store.selectedSuggestionNames().has('Courses / alimentation'),
        ).toBe(true);
      });

      it('should include transactions with matching name+type even if amount differs', () => {
        // Identity is now (name, type) — matches the suggestion regardless of edited amount.
        // This is the post-fix contract: a manually-added transaction colliding on name+type
        // is treated as toggling the chip on. Suggestion names are distinctive enough
        // ("Courses / alimentation", etc.) that this collision is benign in practice.
        store.addCustomTransaction({
          name: 'Courses / alimentation',
          amount: 200,
          type: 'expense',
          expenseType: 'fixed',
          isRecurring: true,
        });

        expect(
          store.selectedSuggestionNames().has('Courses / alimentation'),
        ).toBe(true);
      });
    });

    describe('toggle → edit amount → re-toggle (T1.1 regression)', () => {
      it('should not duplicate the suggestion when amount is edited then re-toggled', () => {
        // Reproduction sequence for the original bug:
        //   1. Toggle chip ON (suggestion appended at its static amount)
        //   2. User inline-edits the amount (mutates the stored entry)
        //   3. Triple-match identity USED to fail → chip rendered as unselected
        //   4. Re-tap appended a duplicate → "Disponible à dépenser" inflated
        // After the fix, identity is (name, type) only, so the chip stays
        // selected after edit and re-tap removes (not duplicates) the entry.
        const suggestion = ONBOARDING_SUGGESTIONS[0]; // Courses / alimentation, 600

        store.toggleSuggestion(suggestion);
        expect(store.customTransactions()).toHaveLength(1);

        store.updateCustomTransactionAmount(0, 800);
        expect(store.customTransactions()[0].amount).toBe(800);

        // Chip stays selected after the edit (name+type identity).
        expect(store.selectedSuggestionNames().has(suggestion.name)).toBe(true);

        // Re-toggle removes the entry — does NOT append a duplicate.
        store.toggleSuggestion(suggestion);
        expect(store.customTransactions()).toHaveLength(0);
      });

      it('should remove the edited entry on re-toggle, regardless of amount drift', () => {
        const suggestion = ONBOARDING_SUGGESTIONS[3]; // Épargne, 500
        store.toggleSuggestion(suggestion);
        store.updateCustomTransactionAmount(0, 1234);

        store.toggleSuggestion(suggestion);

        expect(store.customTransactions()).toEqual([]);
      });
    });
  });
});
