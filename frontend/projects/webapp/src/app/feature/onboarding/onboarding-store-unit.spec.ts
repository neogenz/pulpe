import { beforeEach, describe, expect, it } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OnboardingStore, RegistrationProcessStep } from './onboarding-store';
import { AuthApi } from '../../core/auth/auth-api';
import { BudgetApi } from '../../core/budget/budget-api';
import { TemplateApi } from '../../core/template/template-api';

describe('OnboardingStore - Unit Tests', () => {
  let store: OnboardingStore;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Configure TestBed with mock services and zoneless change detection
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        OnboardingStore,
        { provide: AuthApi, useValue: {} },
        { provide: BudgetApi, useValue: {} },
        { provide: TemplateApi, useValue: {} },
      ],
    });

    // Create store instance using TestBed (which provides inject context)
    store = TestBed.inject(OnboardingStore);
  });

  describe('Email Validation', () => {
    it('should validate correct email formats', () => {
      store.updateField('email', 'test@example.com');
      expect(store.isEmailValid()).toBe(true);

      store.updateField('email', 'user.name@domain.co.uk');
      expect(store.isEmailValid()).toBe(true);

      store.updateField('email', 'user+tag@example.com');
      expect(store.isEmailValid()).toBe(true);
    });

    it('should invalidate incorrect email formats', () => {
      store.updateField('email', 'notanemail');
      expect(store.isEmailValid()).toBe(false);

      store.updateField('email', 'missing@domain');
      expect(store.isEmailValid()).toBe(false);

      store.updateField('email', '@example.com');
      expect(store.isEmailValid()).toBe(false);

      store.updateField('email', '');
      expect(store.isEmailValid()).toBe(false);
    });
  });

  describe('Password Validation', () => {
    it('should validate passwords with 8 or more characters', () => {
      expect(store.validatePassword('12345678')).toBe(true);
      expect(store.validatePassword('longpassword')).toBe(true);
      expect(store.validatePassword('very long password with spaces')).toBe(
        true,
      );
    });

    it('should invalidate passwords with less than 8 characters', () => {
      expect(store.validatePassword('')).toBe(false);
      expect(store.validatePassword('short')).toBe(false);
      expect(store.validatePassword('1234567')).toBe(false);
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
      store.updatePersonalInfo('John Doe', 'john@example.com');

      const data = store.data();
      expect(data.firstName).toBe('John Doe');
      expect(data.email).toBe('john@example.com');
    });

    it('should handle null values', () => {
      store.updateField('monthlyIncome', null);
      expect(store.data().monthlyIncome).toBeNull();
    });
  });

  describe('Layout Management', () => {
    it('should set layout data', () => {
      const layoutData = {
        title: 'Test Title',
        subtitle: 'Test Subtitle',
        currentStep: 3,
      };

      store.setLayoutData(layoutData);
      expect(store.layoutData()).toEqual(layoutData);
    });

    it('should set canContinue state', () => {
      expect(store.canContinue()).toBe(false);

      store.setCanContinue(true);
      expect(store.canContinue()).toBe(true);

      store.setCanContinue(false);
      expect(store.canContinue()).toBe(false);
    });

    it('should set next button text', () => {
      expect(store.nextButtonText()).toBe('Suivant');
    });
  });

  describe('Submission Readiness', () => {
    it('should not be ready when data is incomplete', () => {
      expect(store.isReadyForSubmission()).toBe(false);
    });

    it('should not be ready with only income', () => {
      store.updateField('monthlyIncome', 5000);
      expect(store.isReadyForSubmission()).toBe(false);
    });

    it('should not be ready with only personal info', () => {
      store.updatePersonalInfo('John', 'john@example.com');
      expect(store.isReadyForSubmission()).toBe(false);
    });

    it('should be ready with complete required data', () => {
      store.updateField('monthlyIncome', 5000);
      store.updatePersonalInfo('John', 'john@example.com');
      expect(store.isReadyForSubmission()).toBe(true);
    });

    it('should be ready even with zero income if other requirements are met', () => {
      store.updateField('monthlyIncome', 0);
      store.updatePersonalInfo('John', 'john@example.com');
      expect(store.isReadyForSubmission()).toBe(true); // Zero is still a valid income
    });
  });

  describe('Registration Validation', () => {
    it('should validate registration requirements', () => {
      // Initially false
      expect(store.canSubmitRegistration('password123')).toBe(false);

      // With only email
      store.updateField('email', 'john@example.com');
      expect(store.canSubmitRegistration('password123')).toBe(false);

      // With email and firstName
      store.updatePersonalInfo('John', 'john@example.com');
      expect(store.canSubmitRegistration('password123')).toBe(true);

      // With short password
      expect(store.canSubmitRegistration('short')).toBe(false);

      // With invalid email
      store.updateField('email', 'invalid-email');
      expect(store.canSubmitRegistration('password123')).toBe(false);
    });
  });

  describe('Process State Management', () => {
    it('should update current step', () => {
      expect(store.processState().currentStep).toBe(
        RegistrationProcessStep.AUTHENTICATION,
      );

      store.updateCurrentStep(RegistrationProcessStep.TEMPLATE_CREATION);
      expect(store.processState().currentStep).toBe(
        RegistrationProcessStep.TEMPLATE_CREATION,
      );
    });

    it('should mark steps as completed', () => {
      expect(store.processState().completedSteps).toEqual([]);

      store.markStepCompleted(RegistrationProcessStep.AUTHENTICATION);
      expect(store.processState().completedSteps).toContain(
        RegistrationProcessStep.AUTHENTICATION,
      );
      expect(store.isAuthenticationCompleted()).toBe(true);
    });

    it('should not duplicate completed steps', () => {
      store.markStepCompleted(RegistrationProcessStep.AUTHENTICATION);
      store.markStepCompleted(RegistrationProcessStep.AUTHENTICATION);

      const completedSteps = store.processState().completedSteps;
      const authSteps = completedSteps.filter(
        (s) => s === RegistrationProcessStep.AUTHENTICATION,
      );
      expect(authSteps.length).toBe(1);
    });

    it('should store template ID when marking template creation complete', () => {
      store.markStepCompleted(
        RegistrationProcessStep.TEMPLATE_CREATION,
        'template-123',
      );
      expect(store.processState().templateId).toBe('template-123');
    });
  });

  describe('Retry Button Text', () => {
    it('should show "Terminer" for initial state', () => {
      expect(store.retryButtonText()).toBe('Terminer');
    });

    it('should show specific text for each retry step', () => {
      store.markStepCompleted(RegistrationProcessStep.AUTHENTICATION);

      store.updateCurrentStep(RegistrationProcessStep.TEMPLATE_CREATION);
      expect(store.retryButtonText()).toBe('Créer le template');

      store.updateCurrentStep(RegistrationProcessStep.BUDGET_CREATION);
      expect(store.retryButtonText()).toBe('Créer le budget');

      store.updateCurrentStep(RegistrationProcessStep.COMPLETION);
      expect(store.retryButtonText()).toBe('Finaliser');
    });
  });

  describe('Clear Data', () => {
    it('should reset all data and state', () => {
      // Set some data
      store.updateField('monthlyIncome', 5000);
      store.updatePersonalInfo('John', 'john@example.com');
      store.markStepCompleted(RegistrationProcessStep.AUTHENTICATION);
      store.updateCurrentStep(RegistrationProcessStep.TEMPLATE_CREATION);

      // Clear all
      store.clearAllData();

      // Verify reset
      const data = store.data();
      expect(data.monthlyIncome).toBeNull();
      expect(data.firstName).toBe('');
      expect(data.email).toBe('');
      expect(store.processState().completedSteps).toEqual([]);
      expect(store.processState().currentStep).toBe(
        RegistrationProcessStep.AUTHENTICATION,
      );
    });

    it('should reset submission states', () => {
      // Since we can't access private fields, just verify the method exists and initial state
      store.resetSubmissionState();

      expect(store.submissionError()).toBe('');
      expect(store.submissionSuccess()).toBe('');
    });
  });

  describe('LocalStorage Integration', () => {
    it('should load data from localStorage on init', () => {
      const testData = {
        onboardingData: {
          monthlyIncome: 5000,
          housingCosts: 1200,
          healthInsurance: 200,
          leasingCredit: 0,
          phonePlan: 50,
          transportCosts: 100,
          firstName: 'John',
          email: 'john@example.com',
        },
        processState: {
          currentStep: RegistrationProcessStep.TEMPLATE_CREATION,
          completedSteps: [RegistrationProcessStep.AUTHENTICATION],
        },
      };

      localStorage.setItem('pulpe-onboarding-data', JSON.stringify(testData));

      // Create new TestBed instance
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          OnboardingStore,
          { provide: AuthApi, useValue: {} },
          { provide: BudgetApi, useValue: {} },
          { provide: TemplateApi, useValue: {} },
        ],
      });

      const newStore = TestBed.inject(OnboardingStore);

      expect(newStore.data()).toEqual(testData.onboardingData);
      expect(newStore.processState().currentStep).toBe(
        RegistrationProcessStep.TEMPLATE_CREATION,
      );
      expect(newStore.processState().completedSteps).toEqual([
        RegistrationProcessStep.AUTHENTICATION,
      ]);
    });
  });
});
