import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OnboardingStore } from './onboarding-store';
import { AuthApi } from '@core/auth/auth-api';
import {
  BudgetApi,
  type CreateBudgetApiResponse,
} from '@core/budget/budget-api';
import { TemplateApi } from '@core/template/template-api';
import { OnboardingApi } from './services/onboarding-api';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs'; // Import Subject and observables
import { provideHttpClient } from '@angular/common/http';

describe('OnboardingStore - Unit Tests', () => {
  // Mock helper to create valid budget API responses
  const createMockBudgetResponse = (
    overrides?: Partial<CreateBudgetApiResponse['budget']>,
  ): CreateBudgetApiResponse => ({
    budget: {
      id: 'budget-123',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      description: 'Onboarding budget',
      userId: 'user-123',
      templateId: 'template-123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    },
    message: 'Budget created successfully',
  });

  let store: OnboardingStore;
  let mockAuthApi: {
    signUpWithEmail: ReturnType<typeof vi.fn>;
  };
  let mockBudgetApi: {
    createBudget$: ReturnType<typeof vi.fn>;
  };
  let mockTemplateApi: {
    createFromOnboarding$: ReturnType<typeof vi.fn>;
  };
  let mockOnboardingApi: {
    createTemplateFromOnboarding$: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
    events: Subject<NavigationEnd>; // Add events property
  };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Create mocks
    mockAuthApi = {
      signUpWithEmail: vi.fn(),
    };
    mockBudgetApi = {
      createBudget$: vi.fn(),
    };
    mockTemplateApi = {
      createFromOnboarding$: vi.fn(),
    };
    mockOnboardingApi = {
      createTemplateFromOnboarding$: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn(),
      events: new Subject<NavigationEnd>(), // Initialize events as a Subject
    };

    // Configure TestBed with mock services and zoneless change detection
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        OnboardingStore,
        { provide: AuthApi, useValue: mockAuthApi },
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: TemplateApi, useValue: mockTemplateApi },
        { provide: OnboardingApi, useValue: mockOnboardingApi },
        { provide: Router, useValue: mockRouter },
      ],
    });

    // Create store instance using TestBed (which provides inject context)
    store = TestBed.inject(OnboardingStore);
  });

  describe('Initial State', () => {
    it('should initialize with empty data', () => {
      const data = store.data();
      expect(data.firstName).toBe('');
      expect(data.email).toBe('');
      expect(data.monthlyIncome).toBeNull();
      expect(data.housingCosts).toBeNull();
      expect(data.healthInsurance).toBeNull();
      expect(data.leasingCredit).toBeNull();
      expect(data.phonePlan).toBeNull();
      expect(data.transportCosts).toBeNull();
    });

    it('should initialize with no loading state', () => {
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBe('');
    });
  });

  describe('Field Updates', () => {
    it('should update individual fields', () => {
      store.updateField('monthlyIncome', 5000);
      expect(store.data().monthlyIncome).toBe(5000);

      store.updateField('housingCosts', 1200);
      expect(store.data().housingCosts).toBe(1200);

      store.updateField('healthInsurance', 200);
      expect(store.data().healthInsurance).toBe(200);
    });

    it('should update personal info', () => {
      store.updateField('firstName', 'John Doe');
      store.updateEmail('john@example.com');

      const data = store.data();
      expect(data.firstName).toBe('John Doe');
      expect(data.email).toBe('john@example.com');
    });

    it('should handle null values', () => {
      store.updateField('monthlyIncome', null);
      expect(store.data().monthlyIncome).toBeNull();
    });

    it('should persist data to localStorage', () => {
      store.updateField('firstName', 'John');
      store.updateField('monthlyIncome', 5000);

      const saved = localStorage.getItem('pulpe-onboarding-data');
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved!);
      expect(parsed.firstName).toBe('John');
      expect(parsed.monthlyIncome).toBe(5000);
    });
  });

  describe('Error Management', () => {
    it('should clear error', async () => {
      // Simulate an error by calling submitRegistration with invalid data
      store.updateField('firstName', ''); // Invalid data
      await store.submitRegistration('invalid@email', 'password');

      // Check that error was set
      expect(store.error()).toBe('Données obligatoires manquantes');

      // Clear error
      store.clearError();
      expect(store.error()).toBe('');
    });
  });

  describe('Submission Registration', () => {
    it('should reject submission with invalid data', async () => {
      const result = await store.submitRegistration(
        'test@example.com',
        'password123',
      );
      expect(result).toBe(false);
      expect(store.error()).toBe('Données obligatoires manquantes');
    });

    it('should reject submission with no firstName', async () => {
      store.updateField('monthlyIncome', 5000);
      const result = await store.submitRegistration(
        'test@example.com',
        'password123',
      );
      expect(result).toBe(false);
      expect(store.error()).toBe('Données obligatoires manquantes');
    });

    it('should reject submission with no income', async () => {
      store.updateField('firstName', 'John');
      const result = await store.submitRegistration(
        'test@example.com',
        'password123',
      );
      expect(result).toBe(false);
      expect(store.error()).toBe('Données obligatoires manquantes');
    });

    it('should reject submission with zero or negative income', async () => {
      store.updateField('firstName', 'John');
      store.updateField('monthlyIncome', 0);
      const result = await store.submitRegistration(
        'test@example.com',
        'password123',
      );
      expect(result).toBe(false);
      expect(store.error()).toBe('Données obligatoires manquantes');
    });
  });

  describe('LocalStorage Integration', () => {
    it('should load data from localStorage on init', () => {
      const testData = {
        firstName: 'John',
        email: 'john@example.com',
        monthlyIncome: 5000,
        housingCosts: 1200,
        healthInsurance: 200,
        leasingCredit: 0,
        phonePlan: 50,
        transportCosts: 100,
      };

      localStorage.setItem('pulpe-onboarding-data', JSON.stringify(testData));

      // Create new TestBed instance
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          provideHttpClient(),
          OnboardingStore,
          { provide: AuthApi, useValue: mockAuthApi },
          { provide: BudgetApi, useValue: mockBudgetApi },
          { provide: TemplateApi, useValue: mockTemplateApi },
          { provide: OnboardingApi, useValue: mockOnboardingApi },
          { provide: Router, useValue: mockRouter },
        ],
      });

      const newStore = TestBed.inject(OnboardingStore);
      expect(newStore.data()).toEqual(testData);
    });

    it('should handle invalid localStorage data gracefully', () => {
      localStorage.setItem('pulpe-onboarding-data', 'invalid json');

      // Should not throw and should initialize with defaults
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          provideHttpClient(),
          OnboardingStore,
          { provide: AuthApi, useValue: mockAuthApi },
          { provide: BudgetApi, useValue: mockBudgetApi },
          { provide: TemplateApi, useValue: mockTemplateApi },
          { provide: OnboardingApi, useValue: mockOnboardingApi },
          { provide: Router, useValue: mockRouter },
        ],
      });

      const newStore = TestBed.inject(OnboardingStore);
      expect(newStore.data().firstName).toBe('');
    });
  });

  describe('Progress Tracking', () => {
    it('should return the correct total number of steps', () => {
      expect(store.totalSteps).toBe(10); // Based on STEP_ORDER length
    });

    it('should correctly determine the current step based on URL', () => {
      // Simulate initial URL as welcome
      mockRouter.events.next(
        new NavigationEnd(1, '/onboarding/welcome', '/onboarding/welcome'),
      );
      expect(store.currentStep()).toBe(0);

      // Simulate navigation to personal-info
      mockRouter.events.next(
        new NavigationEnd(
          2,
          '/onboarding/personal-info',
          '/onboarding/personal-info',
        ),
      );
      expect(store.currentStep()).toBe(1);

      // Simulate navigation to registration
      mockRouter.events.next(
        new NavigationEnd(
          3,
          '/onboarding/registration',
          '/onboarding/registration',
        ),
      );
      expect(store.currentStep()).toBe(9); // 'registration' is the 9th index (0-based)
    });

    it('should correctly identify if it is the first step', () => {
      // Initial URL (welcome)
      mockRouter.events.next(
        new NavigationEnd(1, '/onboarding/welcome', '/onboarding/welcome'),
      );
      expect(store.isFirstStep()).toBe(true);

      // Navigate to a non-first step
      mockRouter.events.next(
        new NavigationEnd(2, '/onboarding/income', '/onboarding/income'),
      );
      expect(store.isFirstStep()).toBe(false);
    });

    it('should handle unknown URLs by returning -1 for currentStep', () => {
      mockRouter.events.next(
        new NavigationEnd(1, '/unknown/path', '/unknown/path'),
      );
      expect(store.currentStep()).toBe(-1);
    });
  });

  describe('Registration Retry Logic', () => {
    beforeEach(() => {
      // Set up valid onboarding data
      store.updateField('firstName', 'John Doe');
      store.updateEmail('john@example.com');
      store.updateField('monthlyIncome', 5000);
    });

    it('should not retry signup if user was already created successfully', async () => {
      // First attempt - signup succeeds, template creation fails
      mockAuthApi.signUpWithEmail.mockResolvedValueOnce({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValueOnce(
        throwError(() => new Error('Template creation failed')),
      );

      const firstResult = await store.submitRegistration(
        'john@example.com',
        'password123',
      );
      expect(firstResult).toBe(false);
      expect(mockAuthApi.signUpWithEmail).toHaveBeenCalledTimes(1);

      // Verify that isUserCreated is now true in the data
      expect(store.data().isUserCreated).toBe(true);

      // Second attempt - should skip signup and retry template creation
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValueOnce(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValueOnce(
        of(createMockBudgetResponse()),
      );

      const secondResult = await store.submitRegistration(
        'john@example.com',
        'password123',
      );
      expect(secondResult).toBe(true);

      // Signup should not have been called again
      expect(mockAuthApi.signUpWithEmail).toHaveBeenCalledTimes(1);

      // Template and budget creation should have been retried
      expect(
        mockOnboardingApi.createTemplateFromOnboarding$,
      ).toHaveBeenCalledTimes(2);
      expect(mockBudgetApi.createBudget$).toHaveBeenCalledTimes(1);
    });

    it('should reset user creation state when clearing storage', () => {
      // First create a user
      mockAuthApi.signUpWithEmail.mockResolvedValueOnce({ success: true });
      mockTemplateApi.createFromOnboarding$.mockReturnValueOnce(
        throwError(() => new Error('Template creation failed')),
      );

      return store
        .submitRegistration('john@example.com', 'password123')
        .then(() => {
          expect(mockAuthApi.signUpWithEmail).toHaveBeenCalledTimes(1);

          // Verify that isUserCreated is true after first attempt
          expect(store.data().isUserCreated).toBe(true);

          // Reset the state manually (simulating starting a new onboarding)
          store.resetUserCreationState();

          // Verify that isUserCreated is now false after reset
          expect(store.data().isUserCreated).toBe(false);

          // Now signup should be called again
          mockAuthApi.signUpWithEmail.mockResolvedValueOnce({ success: true });
          mockTemplateApi.createFromOnboarding$.mockReturnValueOnce(
            of({ data: { template: { id: 'template-456' } } }),
          );
          mockBudgetApi.createBudget$.mockReturnValueOnce(
            of({ success: true }),
          );

          return store
            .submitRegistration('john@example.com', 'password123')
            .then(() => {
              expect(mockAuthApi.signUpWithEmail).toHaveBeenCalledTimes(2);
            });
        });
    });
  });
});
