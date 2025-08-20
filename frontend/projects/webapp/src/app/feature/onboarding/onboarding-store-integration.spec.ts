import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
import { type NavigationEnd, Router } from '@angular/router'; // Import NavigationEnd
import { of, Subject, throwError } from 'rxjs'; // Import Subject

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

describe('OnboardingStore - Integration Tests', () => {
  let store: OnboardingStore;
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    // Configuration de TestBed avec les mocks et zoneless change detection
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        OnboardingStore,
        { provide: AuthApi, useValue: mockAuthApi },
        { provide: TemplateApi, useValue: mockTemplateApi },
        { provide: OnboardingApi, useValue: mockOnboardingApi },
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: Router, useValue: mockRouter },
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
  });

  describe('submitRegistration', () => {
    it('should complete full registration flow successfully', async () => {
      // Mock successful responses
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

      expect(result).toBe(true);
      expect(mockAuthApi.signUpWithEmail).toHaveBeenCalledWith(
        'john@example.com',
        'password123',
      );
      expect(
        mockOnboardingApi.createTemplateFromOnboarding$,
      ).toHaveBeenCalled();
      expect(mockBudgetApi.createBudget$).toHaveBeenCalled();
      // Router navigation is now handled by the registration component, not the store
    });

    it('should handle authentication failure', async () => {
      mockAuthApi.signUpWithEmail.mockResolvedValue({
        success: false,
        error: 'Email already exists',
      });

      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      expect(result).toBe(false);
      expect(store.error()).toBe('Email already exists');
      expect(mockTemplateApi.createFromOnboarding$).not.toHaveBeenCalled();
      expect(mockBudgetApi.createBudget$).not.toHaveBeenCalled();
    });

    it('should handle template creation failure', async () => {
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        throwError(() => new Error('Template creation failed')),
      );

      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      expect(result).toBe(false);
      expect(store.error()).toBe("Une erreur inattendue s'est produite");
      expect(mockBudgetApi.createBudget$).not.toHaveBeenCalled();
    });

    it('should handle budget creation failure', async () => {
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        throwError(() => new Error('Budget creation failed')),
      );

      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      expect(result).toBe(false);
      expect(store.error()).toBe("Une erreur inattendue s'est produite");
    });

    it('should validate registration data before processing', async () => {
      // Clear localStorage to avoid interference
      localStorageMock = {};

      // Test with missing firstName - clear existing data first
      store.updateField('firstName', ''); // Clear firstName
      store.updateField('monthlyIncome', 5000); // Set valid income

      const result1 = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      expect(result1).toBe(false);
      expect(store.error()).toBe('Données obligatoires manquantes');

      // Clear error for next test
      store.clearError();

      // Test with missing income
      store.updateField('firstName', 'John');
      store.updateField('monthlyIncome', null);

      const result2 = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      expect(result2).toBe(false);
      expect(store.error()).toBe('Données obligatoires manquantes');

      // Clear error for next test
      store.clearError();

      // Test with zero income
      store.updateField('firstName', 'John');
      store.updateField('monthlyIncome', 0);

      const result3 = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      expect(result3).toBe(false);
      expect(store.error()).toBe('Données obligatoires manquantes');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockAuthApi.signUpWithEmail.mockRejectedValue(new Error('Network error'));

      const result = await store.submitRegistration(
        'john@example.com',
        'password123',
      );

      expect(result).toBe(false);
      expect(store.error()).toBe("Une erreur inattendue s'est produite");
    });

    it('should set isSubmitting during process', async () => {
      // Mock slow response
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

      const submitPromise = store.submitRegistration(
        'john@example.com',
        'password123',
      );

      // Should be submitting immediately
      expect(store.isSubmitting()).toBe(true);

      await submitPromise;

      // Should not be submitting after completion
      expect(store.isSubmitting()).toBe(false);
    });
  });

  describe('Template and Budget Creation Requests', () => {
    it('should build correct template creation request', async () => {
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

      await store.submitRegistration('john@example.com', 'password123');

      expect(
        mockOnboardingApi.createTemplateFromOnboarding$,
      ).toHaveBeenCalledWith({
        name: 'Mois Standard',
        description: 'Template personnel de John',
        isDefault: true,
        monthlyIncome: 5000,
        housingCosts: 1200,
        healthInsurance: 200,
        leasingCredit: 0,
        phonePlan: 50,
        transportCosts: 0,
        customTransactions: [],
      });
    });

    it('should build correct budget creation request', async () => {
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        of(createMockBudgetResponse()),
      );

      await store.submitRegistration('john@example.com', 'password123');

      const currentDate = new Date();
      expect(mockBudgetApi.createBudget$).toHaveBeenCalledWith({
        templateId: 'template-123',
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        description: `Budget initial de John pour ${currentDate.getFullYear()}`,
      });
    });

    it('should handle null values in template creation', async () => {
      // Don't set optional fields, they should default to 0
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        of(createMockBudgetResponse()),
      );

      await store.submitRegistration('john@example.com', 'password123');

      expect(
        mockOnboardingApi.createTemplateFromOnboarding$,
      ).toHaveBeenCalledWith({
        name: 'Mois Standard',
        description: 'Template personnel de John',
        isDefault: true,
        monthlyIncome: 5000,
        housingCosts: 0,
        healthInsurance: 0,
        leasingCredit: 0,
        phonePlan: 0,
        transportCosts: 0,
        customTransactions: [],
      });
    });
  });

  describe('LocalStorage persistence', () => {
    it('should save state updates to localStorage', () => {
      store.updateField('monthlyIncome', 3000);
      store.updateField('firstName', 'Jane');
      store.updateEmail('jane@example.com');

      const saved = localStorageMock['pulpe-onboarding-data'];
      expect(saved).toBeDefined();

      const parsed = JSON.parse(saved);
      expect(parsed.monthlyIncome).toBe(3000);
      expect(parsed.firstName).toBe('Jane');
      expect(parsed.email).toBe('jane@example.com');
    });

    it('should handle localStorage errors gracefully during save', () => {
      // Mock localStorage.setItem to throw
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() => {
        store.updateField('monthlyIncome', 3000);
      }).not.toThrow();
    });

    it('should handle localStorage errors gracefully during load', () => {
      // Mock localStorage.getItem to throw
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      // Should not throw and should use default values
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          OnboardingStore,
          { provide: AuthApi, useValue: mockAuthApi },
          { provide: TemplateApi, useValue: mockTemplateApi },
          { provide: OnboardingApi, useValue: mockOnboardingApi },
          { provide: BudgetApi, useValue: mockBudgetApi },
          { provide: Router, useValue: mockRouter },
        ],
      });

      expect(() => {
        const newStore = TestBed.inject(OnboardingStore);
        expect(newStore.data().firstName).toBe('');
      }).not.toThrow();
    });

    it('should clear localStorage after successful registration', async () => {
      // Set some data first
      store.updateField('monthlyIncome', 5000);
      expect(localStorageMock['pulpe-onboarding-data']).toBeDefined();

      // Mock successful registration
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        of(createMockBudgetResponse()),
      );

      await store.submitRegistration('john@example.com', 'password123');

      // localStorage should be cleared
      expect(localStorageMock['pulpe-onboarding-data']).toBeUndefined();
    });

    it('should handle localStorage errors during clear', async () => {
      // Mock removeItem to throw
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockOnboardingApi.createTemplateFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        of(createMockBudgetResponse()),
      );

      // Should not throw
      await expect(
        store.submitRegistration('john@example.com', 'password123'),
      ).resolves.toBe(true);
    });
  });
});
