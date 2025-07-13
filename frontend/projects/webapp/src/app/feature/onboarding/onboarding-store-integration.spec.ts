import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OnboardingStore, RegistrationProcessStep } from './onboarding-store';
import { AuthApi } from '../../core/auth/auth-api';
import { BudgetApi } from '../../core/budget/budget-api';
import { TemplateApi } from '../../core/template/template-api';
import { of, throwError } from 'rxjs';
import {
  type BudgetCreate,
  type BudgetTemplateCreateFromOnboarding,
} from '@pulpe/shared';

// Mocker les dépendances API
const mockAuthApi = {
  signUpWithEmail: vi.fn(),
};

const mockTemplateApi = {
  createFromOnboarding$: vi.fn(),
};

const mockBudgetApi = {
  createBudget$: vi.fn(),
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
        { provide: BudgetApi, useValue: mockBudgetApi },
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
    store.updatePersonalInfo('John', 'john@example.com');
    store.updateField('monthlyIncome', 5000);
  });

  afterEach(() => {
    // Réinitialiser les mocks et le localStorage après chaque test
    vi.clearAllMocks();
    localStorageMock = {};
    store.clearAllData();
  });

  describe('processCompleteRegistration', () => {
    it('should complete full registration flow successfully', async () => {
      // Mock successful responses
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockTemplateApi.createFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(of({ success: true }));

      const result = await store.processCompleteRegistration(
        'john@example.com',
        'password123',
      );

      expect(result.success).toBe(true);
      expect(mockAuthApi.signUpWithEmail).toHaveBeenCalledWith(
        'john@example.com',
        'password123',
      );
      expect(mockTemplateApi.createFromOnboarding$).toHaveBeenCalled();
      expect(mockBudgetApi.createBudget$).toHaveBeenCalled();

      // Verify state was cleared after completion
      expect(store.data().firstName).toBe('');
      expect(store.data().email).toBe('');
    });

    it('should handle authentication failure', async () => {
      mockAuthApi.signUpWithEmail.mockResolvedValue({
        success: false,
        error: 'Email already exists',
      });

      const result = await store.processCompleteRegistration(
        'john@example.com',
        'password123',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already exists');
      expect(mockTemplateApi.createFromOnboarding$).not.toHaveBeenCalled();
      expect(mockBudgetApi.createBudget$).not.toHaveBeenCalled();
    });

    it('should handle template creation failure', async () => {
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockTemplateApi.createFromOnboarding$.mockReturnValue(
        throwError(() => new Error('Template creation failed')),
      );

      const result = await store.processCompleteRegistration(
        'john@example.com',
        'password123',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Erreur lors de la création de votre template budgétaire.',
      );
      expect(mockBudgetApi.createBudget$).not.toHaveBeenCalled();
    });

    it('should handle budget creation failure', async () => {
      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockTemplateApi.createFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(
        throwError(() => new Error('Budget creation failed')),
      );

      const result = await store.processCompleteRegistration(
        'john@example.com',
        'password123',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Erreur lors de la création de votre budget initial.',
      );
    });

    it('should skip completed steps on retry', async () => {
      // Mark authentication as already completed
      store.markStepCompleted(RegistrationProcessStep.AUTHENTICATION);
      store.updateCurrentStep(RegistrationProcessStep.TEMPLATE_CREATION);

      mockTemplateApi.createFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(of({ success: true }));

      const result = await store.processCompleteRegistration(
        'john@example.com',
        'password123',
      );

      expect(result.success).toBe(true);
      expect(mockAuthApi.signUpWithEmail).not.toHaveBeenCalled();
      expect(mockTemplateApi.createFromOnboarding$).toHaveBeenCalled();
    });

    it('should handle missing template ID during budget creation', async () => {
      // Manually set state to budget creation step without template ID
      store.updateCurrentStep(RegistrationProcessStep.BUDGET_CREATION);
      store.markStepCompleted(RegistrationProcessStep.AUTHENTICATION);
      store.markStepCompleted(RegistrationProcessStep.TEMPLATE_CREATION);
      // Note: not setting templateId

      const result = await store.processCompleteRegistration(
        'john@example.com',
        'password123',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'ID du template manquant pour créer le budget.',
      );
    });

    it('should validate registration data before processing', async () => {
      store.updatePersonalInfo('', 'invalid-email');

      const result = await store.processCompleteRegistration(
        'invalid-email',
        'short',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Données invalides pour la registration');
      expect(mockAuthApi.signUpWithEmail).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors gracefully', async () => {
      mockAuthApi.signUpWithEmail.mockRejectedValue(new Error('Network error'));

      const result = await store.processCompleteRegistration(
        'john@example.com',
        'password123',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Une erreur inattendue s'est produite. Veuillez réessayer.",
      );
      expect(store.submissionError()).toBe(
        "Une erreur inattendue s'est produite. Veuillez réessayer.",
      );
    });

    it('should set isSubmitting during process', async () => {
      mockAuthApi.signUpWithEmail.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Check that isSubmitting is true during the process
            expect(store.isSubmitting()).toBe(true);
            resolve({ success: true });
          }),
      );

      mockTemplateApi.createFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-123' } } }),
      );
      mockBudgetApi.createBudget$.mockReturnValue(of({ success: true }));

      await store.processCompleteRegistration(
        'john@example.com',
        'password123',
      );

      // Should be false after completion
      expect(store.isSubmitting()).toBe(false);
    });
  });

  describe('Template and Budget Creation Requests', () => {
    it('should build correct template creation request', async () => {
      store.updateField('housingCosts', 1200);
      store.updateField('healthInsurance', 200);
      store.updateField('leasingCredit', 300);
      store.updateField('phonePlan', 50);
      store.updateField('transportCosts', 100);

      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });

      let capturedTemplateRequest:
        | BudgetTemplateCreateFromOnboarding
        | undefined;
      mockTemplateApi.createFromOnboarding$.mockImplementation(
        (request: BudgetTemplateCreateFromOnboarding) => {
          capturedTemplateRequest = request;
          return of({ data: { template: { id: 'template-123' } } });
        },
      );

      mockBudgetApi.createBudget$.mockReturnValue(of({ success: true }));

      await store.processCompleteRegistration(
        'john@example.com',
        'password123',
      );

      expect(capturedTemplateRequest).toEqual({
        name: 'Mois Standard',
        description: 'Template personnel de John',
        isDefault: true,
        monthlyIncome: 5000,
        housingCosts: 1200,
        healthInsurance: 200,
        leasingCredit: 300,
        phonePlan: 50,
        transportCosts: 100,
        customTransactions: [],
      });
    });

    it('should build correct budget creation request', async () => {
      const mockDate = new Date('2024-03-15');
      vi.setSystemTime(mockDate);

      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });
      mockTemplateApi.createFromOnboarding$.mockReturnValue(
        of({ data: { template: { id: 'template-456' } } }),
      );

      let capturedBudgetRequest: BudgetCreate | undefined;
      mockBudgetApi.createBudget$.mockImplementation(
        (request: BudgetCreate) => {
          capturedBudgetRequest = request;
          return of({ success: true });
        },
      );

      await store.processCompleteRegistration(
        'john@example.com',
        'password123',
      );

      expect(capturedBudgetRequest).toEqual({
        templateId: 'template-456',
        month: 3,
        year: 2024,
        description: 'Budget initial de John pour 2024',
      });

      vi.useRealTimers();
    });

    it('should handle null values in template creation', async () => {
      // Set some fields to null
      store.updateField('housingCosts', null);
      store.updateField('healthInsurance', null);

      mockAuthApi.signUpWithEmail.mockResolvedValue({ success: true });

      let capturedTemplateRequest:
        | BudgetTemplateCreateFromOnboarding
        | undefined;
      mockTemplateApi.createFromOnboarding$.mockImplementation(
        (request: BudgetTemplateCreateFromOnboarding) => {
          capturedTemplateRequest = request;
          return of({ data: { template: { id: 'template-123' } } });
        },
      );

      mockBudgetApi.createBudget$.mockReturnValue(of({ success: true }));

      await store.processCompleteRegistration(
        'john@example.com',
        'password123',
      );

      expect(capturedTemplateRequest.housingCosts).toBe(0);
      expect(capturedTemplateRequest.healthInsurance).toBe(0);
    });
  });

  describe('LocalStorage persistence', () => {
    it('should save state updates to localStorage', () => {
      store.updateField('monthlyIncome', 6000);

      const savedData = JSON.parse(
        localStorage.getItem('pulpe-onboarding-data') || '{}',
      );
      expect(savedData.onboardingData.monthlyIncome).toBe(6000);
    });

    it('should handle localStorage errors gracefully during save', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {
          // Intentionally empty - suppressing console errors for test
        });

      // Mock localStorage.setItem to throw an error
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('Storage full');
      });

      // Should not throw
      expect(() => store.updateField('monthlyIncome', 7000)).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save onboarding state to localStorage:',
        expect.any(Error),
      );

      Storage.prototype.setItem = originalSetItem;
      consoleErrorSpy.mockRestore();
    });

    it('should handle localStorage errors gracefully during load', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {
          // Intentionally empty - suppressing console errors for test
        });

      // Set invalid JSON in localStorage mock
      localStorageMock['pulpe-onboarding-data'] = 'invalid-json';

      // Create new TestBed instance to test loading behavior
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          OnboardingStore,
          { provide: AuthApi, useValue: mockAuthApi },
          { provide: TemplateApi, useValue: mockTemplateApi },
          { provide: BudgetApi, useValue: mockBudgetApi },
        ],
      });

      const newStore = TestBed.inject(OnboardingStore);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load onboarding state from localStorage:',
        expect.any(Error),
      );

      // Should have default values
      expect(newStore.data().monthlyIncome).toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should clear localStorage when clearing all data', () => {
      localStorage.setItem(
        'pulpe-onboarding-data',
        JSON.stringify({ test: 'data' }),
      );

      store.clearAllData();

      expect(localStorage.getItem('pulpe-onboarding-data')).toBeNull();
    });

    it('should handle localStorage errors during clear', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {
          // Intentionally empty - suppressing console errors for test
        });

      // Mock localStorage.removeItem to throw an error
      const originalRemoveItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = vi.fn(() => {
        throw new Error('Clear failed');
      });

      // Should not throw
      expect(() => store.clearAllData()).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to clear onboarding state from localStorage:',
        expect.any(Error),
      );

      Storage.prototype.removeItem = originalRemoveItem;
      consoleErrorSpy.mockRestore();
    });
  });
});
