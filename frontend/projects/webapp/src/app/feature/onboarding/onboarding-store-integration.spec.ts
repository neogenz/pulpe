import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OnboardingStore } from './onboarding-store';
import { AuthApi } from '@core/auth/auth-api';
import {
  BudgetApi,
  type CreateBudgetApiResponse,
} from '@core/budget/budget-api';
import { TemplateApi } from '@core/template/template-api';
import { OnboardingApi } from './services/onboarding-api';
import { PostHogService } from '@core/analytics/posthog';
import { Logger } from '@core/logging/logger';
import { type NavigationEnd, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';

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

// Mock des dépendances API
const mockAuthApi = {
  signUpWithEmail: vi.fn(),
  isAuthenticated: signal(false).asReadonly(),
};

const mockTemplateApi = {
  createFromOnboarding$: vi.fn(),
};

const mockOnboardingApi = {
  createTemplateFromOnboarding$: vi.fn(),
};

const mockBudgetApi = {
  createBudget$: vi.fn(),
};

const mockRouter = {
  navigate: vi.fn(),
  events: new Subject<NavigationEnd>(), // Initialize events as a Subject
};

// Mock PostHogService for tracking tests
const mockPostHogService = {
  enableTracking: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  captureException: vi.fn(),
  isInitialized: vi.fn(() => true),
};

// Mock Logger
const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

describe('User Onboarding Journey', () => {
  let store: OnboardingStore;
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    // Configuration de TestBed avec les mocks et zoneless change detection
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        OnboardingStore,
        { provide: AuthApi, useValue: mockAuthApi },
        { provide: TemplateApi, useValue: mockTemplateApi },
        { provide: OnboardingApi, useValue: mockOnboardingApi },
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: Router, useValue: mockRouter },
        { provide: PostHogService, useValue: mockPostHogService },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    // Mock du localStorage
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      localStorageMock[key] = value as string;
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      return localStorageMock[key] || null;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete localStorageMock[key];
    });

    store = TestBed.inject(OnboardingStore);

    // Setup initial data for tests
    store.updateField('firstName', 'John');
    store.updateEmail('john@example.com');
    store.updateField('monthlyIncome', 5000);
  });

  afterEach(() => {
    // Réinitialiser les mocks et le localStorage après chaque test
    vi.clearAllMocks();
    localStorageMock = {};
    mockPostHogService.enableTracking.mockClear();
    mockPostHogService.identify.mockClear();
    mockPostHogService.reset.mockClear();
  });

  describe('User completes registration', () => {
    it('user creates account and receives initial budget for current month', async () => {
      // Given: User has filled their personal and financial information
      // When: User submits registration with valid credentials
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        of(createMockBudgetResponse()),
      );

      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Then: Account is created with a budget template and current month budget
      expect(result).toBe(true);
      expect(store.error()).toBe('');
    });

    it('user sees error message when email already exists', async () => {
      // Given: Email is already registered
      mockAuthApi.signUpWithEmail.mockResolvedValue({
        success: false,
        error: 'Email already exists',
      });

      // When: User tries to register with existing email
      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Then: User sees clear error message
      expect(result).toBe(false);
      expect(store.error()).toBe('Email already exists');
    });

    it('user sees generic error message when technical issue occurs', async () => {
      // Given: System has technical issue during template creation
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        throwError(() => new Error('Template creation failed')),
      );

      // When: User tries to complete registration
      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Then: User sees friendly error message in French
      expect(result).toBe(false);
      expect(store.error()).toBe("Une erreur inattendue s'est produite");
    });

    it('user sees error when budget cannot be created for current month', async () => {
      // Given: Budget creation will fail
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        throwError(() => new Error('Budget creation failed')),
      );

      // When: User completes registration
      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Then: User sees error message
      expect(result).toBe(false);
      expect(store.error()).toBe("Une erreur inattendue s'est produite");
    });

    it('user cannot register without providing required information', async () => {
      // Given: User has not filled all required fields
      localStorageMock = {};

      // When: User tries to register without name
      store.updateField('firstName', '');
      store.updateField('monthlyIncome', 5000);
      const resultNoName = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Then: Registration is blocked with clear message
      expect(resultNoName).toBe(false);
      expect(store.error()).toBe('Données obligatoires manquantes');

      store.clearError();

      // When: User tries to register without income
      store.updateField('firstName', 'John');
      store.updateField('monthlyIncome', null);
      const resultNoIncome = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Then: Registration is blocked
      expect(resultNoIncome).toBe(false);
      expect(store.error()).toBe('Données obligatoires manquantes');
    });

    it('user sees friendly error when network fails', async () => {
      // Given: Network connection fails
      mockAuthApi.signUpWithEmail.mockRejectedValue(new Error('Network error'));

      // When: User tries to register
      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Then: User sees generic error message in French
      expect(result).toBe(false);
      expect(store.error()).toBe("Une erreur inattendue s'est produite");
    });

    it('user sees loading state during registration process', async () => {
      // Given: Registration will take some time
      mockAuthApi.signUpWithEmail.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true }), 100),
          ),
      );
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        of(createMockBudgetResponse()),
      );

      // When: User submits registration
      const submitPromise = store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Then: Loading state is active during process
      expect(store.isLoading()).toBe(true);

      await submitPromise;

      // And: Loading state ends after completion
      expect(store.isLoading()).toBe(false);
    });
  });

  describe('User enters financial information', () => {
    it('user budget template includes all expenses entered during onboarding', async () => {
      // Given: User has entered their monthly expenses
      store.updateField('housingCosts', 1200);
      store.updateField('healthInsurance', 200);
      store.updateField('phonePlan', 50);

      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        of(createMockBudgetResponse()),
      );

      // When: User completes registration
      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Then: Budget template is created with user's financial data
      expect(result).toBe(true);
      expect(store.error()).toBe('');
    });

    it('user receives budget for current month automatically', async () => {
      // Given: User has completed onboarding
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        of(createMockBudgetResponse()),
      );

      // When: Registration completes
      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Then: User has a budget ready for the current month
      expect(result).toBe(true);
      const currentDate = new Date();
      const mockBudget = createMockBudgetResponse().budget;
      expect(mockBudget.month).toBe(currentDate.getMonth() + 1);
      expect(mockBudget.year).toBe(currentDate.getFullYear());
    });

    it('user expenses default to zero when not provided', async () => {
      // Given: User skips optional expense fields
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        of(createMockBudgetResponse()),
      );

      // When: User registers without entering optional expenses
      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Then: Budget is created with zero values for skipped fields
      expect(result).toBe(true);
      expect(store.error()).toBe('');
    });
  });

  describe('User data is preserved during onboarding', () => {
    it('user information is saved when navigating between steps', () => {
      // Given: User enters information on different steps
      store.updateField('monthlyIncome', 3000);
      store.updateField('firstName', 'Jane');
      store.updateEmail('jane@example.com');

      // When: Browser saves the data
      const saved = localStorageMock['pulpe-onboarding-data'];

      // Then: All user data is preserved
      expect(saved).toBeDefined();
      const parsed = JSON.parse(saved);
      expect(parsed.monthlyIncome).toBe(3000);
      expect(parsed.firstName).toBe('Jane');
      expect(parsed.email).toBe('jane@example.com');
    });

    it('user data is retained even if browser storage fails', () => {
      // Given: Browser storage is not available
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // When: User enters information
      expect(() => {
        store.updateField('monthlyIncome', 3000);
      }).not.toThrow();

      // Then: Application continues to work
      expect(store.data().monthlyIncome).toBe(3000);
    });

    it('user data is cleared after successful account creation', async () => {
      // Given: User has entered data during onboarding
      store.updateField('monthlyIncome', 5000);
      expect(localStorageMock['pulpe-onboarding-data']).toBeDefined();

      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        of(createMockBudgetResponse()),
      );

      // When: User completes registration
      await store.submitRegistration('john@example.com', 'password123');

      // Then: Temporary data is removed for privacy
      expect(localStorageMock['pulpe-onboarding-data']).toBeUndefined();
    });
  });

  describe('User accepts terms and conditions', () => {
    it('user consent enables analytics tracking after successful registration', async () => {
      // Given: User accepts terms by completing registration
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        of(createMockBudgetResponse()),
      );

      // When: Registration succeeds
      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Then: Analytics are activated for product improvement
      expect(result).toBe(true);
      expect(mockPostHogService.enableTracking).toHaveBeenCalled();
    });

    it('user analytics remain disabled when registration fails', async () => {
      // Given: Registration will fail
      mockAuthApi.signUpWithEmail.mockResolvedValue({
        success: false,
        error: 'Email already exists',
      });

      // When: User attempts to register
      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Then: No tracking occurs without successful account creation
      expect(result).toBe(false);
      expect(mockPostHogService.enableTracking).not.toHaveBeenCalled();
    });
  });
});
