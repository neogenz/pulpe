import { Injectable, signal, computed, inject } from '@angular/core';
import { firstValueFrom, Subject } from 'rxjs';
import { Router } from '@angular/router';
import { AuthApi } from '../../core/auth/auth-api';
import { BudgetApi } from '../../core/budget';
import { TemplateApi } from '../../core/template';
import {
  type BudgetCreate,
  type BudgetTemplateCreateFromOnboarding,
} from '@pulpe/shared';
import {
  type OnboardingStepData,
  type OnboardingSubmissionResult,
} from './onboarding.types';

export enum RegistrationProcessStep {
  AUTHENTICATION = 'authentication',
  TEMPLATE_CREATION = 'template_creation',
  BUDGET_CREATION = 'budget_creation',
  COMPLETION = 'completion',
}

export interface ProcessState {
  currentStep: RegistrationProcessStep;
  templateId?: string;
  completedSteps: RegistrationProcessStep[];
}

export interface OnboardingLayoutData {
  title: string;
  subtitle: string;
  currentStep: number;
}

const ONBOARDING_STORAGE_KEY = 'pulpe-onboarding-data';

@Injectable()
export class OnboardingStore {
  readonly #authApi = inject(AuthApi);
  readonly #budgetApi = inject(BudgetApi);
  readonly #templateApi = inject(TemplateApi);
  readonly #router = inject(Router);

  // Navigation events
  readonly previousClicked$ = new Subject<void>();
  readonly nextClicked$ = new Subject<void>();

  // Consolidated state
  readonly #onboardingData = signal<OnboardingStepData>({
    monthlyIncome: null,
    housingCosts: null,
    healthInsurance: null,
    leasingCredit: null,
    phonePlan: null,
    transportCosts: null,
    firstName: '',
    email: '',
  });

  readonly #processState = signal<ProcessState>({
    currentStep: RegistrationProcessStep.AUTHENTICATION,
    completedSteps: [],
  });

  readonly #layoutData = signal<OnboardingLayoutData | null>(null);
  readonly #canContinue = signal<boolean>(false);
  readonly #isSubmitting = signal<boolean>(false);
  readonly #submissionError = signal<string>('');
  readonly #submissionSuccess = signal<string>('');

  // Read-only access
  readonly data = this.#onboardingData.asReadonly();
  readonly processState = this.#processState.asReadonly();
  readonly layoutData = this.#layoutData.asReadonly();
  readonly canContinue = this.#canContinue.asReadonly();
  readonly isSubmitting = this.#isSubmitting.asReadonly();
  readonly submissionError = this.#submissionError.asReadonly();
  readonly submissionSuccess = this.#submissionSuccess.asReadonly();

  // Computed values
  readonly isEmailValid = computed(() => {
    const email = this.#onboardingData().email;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  });

  readonly isAuthenticationCompleted = computed(() =>
    this.#processState().completedSteps.includes(
      RegistrationProcessStep.AUTHENTICATION,
    ),
  );

  readonly isTemplateCreationCompleted = computed(() =>
    this.#processState().completedSteps.includes(
      RegistrationProcessStep.TEMPLATE_CREATION,
    ),
  );

  readonly currentStepToRetry = computed(
    () => this.#processState().currentStep,
  );

  readonly retryButtonText = computed(() => {
    const processState = this.#processState();
    const isRetry = processState.completedSteps.length > 0;

    if (!isRetry) {
      return 'Terminer';
    }

    switch (processState.currentStep) {
      case RegistrationProcessStep.TEMPLATE_CREATION:
        return 'Créer le template';
      case RegistrationProcessStep.BUDGET_CREATION:
        return 'Créer le budget';
      case RegistrationProcessStep.COMPLETION:
        return 'Finaliser';
      default:
        return 'Réessayer';
    }
  });

  // Step order for navigation
  readonly stepOrder = [
    'welcome',
    'personal-info',
    'income',
    'housing',
    'health-insurance',
    'leasing-credit',
    'phone-plan',
    'transport',
    'registration',
  ];

  readonly nextButtonText = computed(() => {
    const layoutData = this.#layoutData();
    if (!layoutData) return 'Suivant';

    const currentStep = layoutData.currentStep;
    if (currentStep === 0) return 'Commencer';
    if (currentStep === this.stepOrder.length - 1)
      return this.retryButtonText();
    return 'Suivant';
  });

  readonly isFirstStep = computed(() => {
    return this.#layoutData()?.currentStep === 0;
  });

  readonly isLastStep = computed(() => {
    const layoutData = this.#layoutData();
    return layoutData?.currentStep === this.stepOrder.length - 1;
  });

  constructor() {
    this.#loadFromLocalStorage();
  }

  // Data management methods
  updateField(field: keyof OnboardingStepData, value: unknown): void {
    this.#onboardingData.update((data) => ({
      ...data,
      [field]: value,
    }));
    this.#saveToLocalStorage();
  }

  updatePersonalInfo(firstName: string, email: string): void {
    this.#onboardingData.update((data) => ({
      ...data,
      firstName,
      email,
    }));
    this.#saveToLocalStorage();
  }

  // Layout management
  setLayoutData(layoutData: OnboardingLayoutData): void {
    this.#layoutData.set(layoutData);
  }

  setCanContinue(canContinue: boolean): void {
    this.#canContinue.set(canContinue);
  }

  // Validation methods
  validatePassword(password: string): boolean {
    return password.length >= 8;
  }

  canSubmitRegistration(password: string): boolean {
    const data = this.#onboardingData();
    return (
      data.firstName.trim().length > 0 &&
      this.isEmailValid() &&
      this.validatePassword(password)
    );
  }

  isReadyForSubmission(): boolean {
    const data = this.#onboardingData();
    return !!(
      data.monthlyIncome !== null &&
      data.firstName.trim() &&
      data.email.trim()
    );
  }

  // Registration process methods
  async processCompleteRegistration(
    email: string,
    password: string,
  ): Promise<OnboardingSubmissionResult> {
    if (!this.canSubmitRegistration(password)) {
      return {
        success: false,
        error: 'Données invalides pour la registration',
      };
    }

    try {
      this.#isSubmitting.set(true);
      this.#submissionError.set('');

      let currentStep = this.currentStepToRetry();

      // Step 1: Authentication
      if (currentStep === RegistrationProcessStep.AUTHENTICATION) {
        const authResult = await this.#processAuthentication(email, password);
        if (!authResult.success) return authResult;
        currentStep = RegistrationProcessStep.TEMPLATE_CREATION;
      }

      // Step 2: Template Creation
      if (currentStep === RegistrationProcessStep.TEMPLATE_CREATION) {
        const templateResult = await this.#processTemplateCreation();
        if (!templateResult.success) return templateResult;
        currentStep = RegistrationProcessStep.BUDGET_CREATION;
      }

      // Step 3: Budget Creation
      if (currentStep === RegistrationProcessStep.BUDGET_CREATION) {
        const budgetResult = await this.#processBudgetCreation();
        if (!budgetResult.success) return budgetResult;
        currentStep = RegistrationProcessStep.COMPLETION;
      }

      // Step 4: Completion
      if (currentStep === RegistrationProcessStep.COMPLETION) {
        await this.#processCompletion();
      }

      return { success: true };
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
      const errorMessage =
        "Une erreur inattendue s'est produite. Veuillez réessayer.";
      this.#submissionError.set(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      this.#isSubmitting.set(false);
    }
  }

  // Process state management
  markStepCompleted(step: RegistrationProcessStep, templateId?: string): void {
    const currentState = this.#processState();
    if (!currentState.completedSteps.includes(step)) {
      this.#processState.update((state) => ({
        ...state,
        completedSteps: [...state.completedSteps, step],
        templateId: templateId || state.templateId,
      }));
      this.#saveToLocalStorage();
    }
  }

  updateCurrentStep(step: RegistrationProcessStep): void {
    this.#processState.update((state) => ({
      ...state,
      currentStep: step,
    }));
    this.#saveToLocalStorage();
  }

  resetSubmissionState(): void {
    this.#submissionError.set('');
    this.#submissionSuccess.set('');
  }

  clearAllData(): void {
    this.#onboardingData.set({
      monthlyIncome: null,
      housingCosts: null,
      healthInsurance: null,
      leasingCredit: null,
      phonePlan: null,
      transportCosts: null,
      firstName: '',
      email: '',
    });

    this.#processState.set({
      currentStep: RegistrationProcessStep.AUTHENTICATION,
      completedSteps: [],
    });

    this.#clearLocalStorage();
  }

  // Navigation methods
  navigateToPrevious(): void {
    const layoutData = this.#layoutData();
    if (!layoutData || layoutData.currentStep <= 0) return;

    const currentStepIndex = layoutData.currentStep;
    const previousStepRoute = this.stepOrder[currentStepIndex - 1];
    this.#router.navigate([`/onboarding/${previousStepRoute}`]);
  }

  navigateToNext(): void {
    const layoutData = this.#layoutData();
    if (!layoutData) return;

    const currentStepIndex = layoutData.currentStep;

    // Special handling for registration step
    if (currentStepIndex === this.stepOrder.length - 1) {
      // This will be handled by the registration component
      return;
    }

    if (currentStepIndex < this.stepOrder.length - 1) {
      const nextStepRoute = this.stepOrder[currentStepIndex + 1];
      this.#router.navigate([`/onboarding/${nextStepRoute}`]);
    }
  }

  onEnterPressed(): void {
    if (this.canContinue()) {
      this.navigateToNext();
    }
  }

  // Private methods
  async #processAuthentication(
    email: string,
    password: string,
  ): Promise<OnboardingSubmissionResult> {
    if (this.isAuthenticationCompleted()) {
      return { success: true };
    }

    this.updateCurrentStep(RegistrationProcessStep.AUTHENTICATION);

    const authResult = await this.#authApi.signUpWithEmail(email, password);

    if (!authResult.success) {
      const errorMessage =
        authResult.error || 'Erreur lors de la création du compte';
      return { success: false, error: errorMessage };
    }

    this.markStepCompleted(RegistrationProcessStep.AUTHENTICATION);
    this.updateCurrentStep(RegistrationProcessStep.TEMPLATE_CREATION);
    return { success: true };
  }

  async #processTemplateCreation(): Promise<OnboardingSubmissionResult> {
    if (this.isTemplateCreationCompleted()) {
      return { success: true };
    }

    this.updateCurrentStep(RegistrationProcessStep.TEMPLATE_CREATION);

    try {
      const onboardingData = this.#onboardingData();
      const templateRequest =
        this.#buildTemplateCreationRequest(onboardingData);
      const templateResponse = await firstValueFrom(
        this.#templateApi.createFromOnboarding$(templateRequest),
      );

      this.markStepCompleted(
        RegistrationProcessStep.TEMPLATE_CREATION,
        templateResponse.data.template.id,
      );
      this.updateCurrentStep(RegistrationProcessStep.BUDGET_CREATION);
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la création du template:', error);
      const errorMessage =
        'Erreur lors de la création de votre template budgétaire.';
      return { success: false, error: errorMessage };
    }
  }

  async #processBudgetCreation(): Promise<OnboardingSubmissionResult> {
    this.updateCurrentStep(RegistrationProcessStep.BUDGET_CREATION);

    try {
      const onboardingData = this.#onboardingData();
      const processState = this.#processState();

      if (!processState.templateId) {
        const errorMessage = 'ID du template manquant pour créer le budget.';
        return { success: false, error: errorMessage };
      }

      const budgetRequest = this.#buildBudgetFromTemplateRequest(
        onboardingData,
        processState.templateId,
      );
      await firstValueFrom(this.#budgetApi.createBudget$(budgetRequest));

      this.markStepCompleted(RegistrationProcessStep.BUDGET_CREATION);
      this.updateCurrentStep(RegistrationProcessStep.COMPLETION);
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la création du budget:', error);
      const errorMessage =
        'Erreur lors de la création de votre budget initial.';
      return { success: false, error: errorMessage };
    }
  }

  async #processCompletion(): Promise<void> {
    this.updateCurrentStep(RegistrationProcessStep.COMPLETION);
    this.markStepCompleted(RegistrationProcessStep.COMPLETION);
    this.clearAllData();
  }

  #buildTemplateCreationRequest(
    payload: OnboardingStepData,
  ): BudgetTemplateCreateFromOnboarding {
    return {
      name: 'Mois Standard',
      description: `Template personnel de ${payload.firstName}`,
      isDefault: true,
      monthlyIncome: payload.monthlyIncome ?? 0,
      housingCosts: payload.housingCosts ?? 0,
      healthInsurance: payload.healthInsurance ?? 0,
      leasingCredit: payload.leasingCredit ?? 0,
      phonePlan: payload.phonePlan ?? 0,
      transportCosts: payload.transportCosts ?? 0,
      customTransactions: [],
    };
  }

  #buildBudgetFromTemplateRequest(
    payload: OnboardingStepData,
    templateId: string,
  ): BudgetCreate {
    const currentDate = new Date();
    return {
      templateId,
      month: currentDate.getMonth() + 1,
      year: currentDate.getFullYear(),
      description: `Budget initial de ${
        payload.firstName
      } pour ${currentDate.getFullYear()}`,
    };
  }

  #saveToLocalStorage(): void {
    try {
      const state = {
        onboardingData: this.#onboardingData(),
        processState: this.#processState(),
      };
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save onboarding state to localStorage:', error);
    }
  }

  #loadFromLocalStorage(): void {
    try {
      const savedState = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        if (parsedState.onboardingData) {
          this.#onboardingData.set(parsedState.onboardingData);
        }
        if (parsedState.processState) {
          this.#processState.set(parsedState.processState);
        }
      }
    } catch (error) {
      console.error(
        'Failed to load onboarding state from localStorage:',
        error,
      );
    }
  }

  #clearLocalStorage(): void {
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    } catch (error) {
      console.error(
        'Failed to clear onboarding state from localStorage:',
        error,
      );
    }
  }
}
