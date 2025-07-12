import { Injectable, signal, computed, inject } from '@angular/core';
import { AuthApi } from '@core/auth/auth-api';
import { BudgetApi } from '@core/budget';
import { TemplateApi } from '@core/template';
import {
  type BudgetCreate,
  type BudgetTemplateCreateFromOnboarding,
} from '@pulpe/shared';
import { firstValueFrom } from 'rxjs';
import {
  OnboardingApi,
  type OnboardingSubmissionResult,
  type OnboardingStepData,
} from '../onboarding-api';
import {
  RegistrationProcessStep,
  type ProcessState,
} from '../onboarding-orchestrator';

@Injectable()
export class RegistrationState {
  readonly #authApi = inject(AuthApi);
  readonly #budgetApi = inject(BudgetApi);
  readonly #templateApi = inject(TemplateApi);
  readonly #onboardingApi = inject(OnboardingApi);

  readonly #processState = signal<ProcessState>({
    currentStep: RegistrationProcessStep.AUTHENTICATION,
    completedSteps: [],
  });

  // Read-only access
  readonly processState = this.#processState.asReadonly();

  // Computed values
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

  constructor() {
    this.loadProcessStateFromLocalStorage();
  }

  /**
   * Handles the complete registration process with retry logic
   */
  async processCompleteRegistration(
    email: string,
    password: string,
  ): Promise<OnboardingSubmissionResult> {
    if (!this.#onboardingApi.canSubmitRegistration(password)) {
      return {
        success: false,
        error: 'Données invalides pour la registration',
      };
    }

    try {
      // Process steps sequentially from current step to completion
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
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Resets the process state
   */
  resetProcessState(): void {
    this.#processState.set({
      currentStep: RegistrationProcessStep.AUTHENTICATION,
      completedSteps: [],
    });
    this.clearProcessStateFromLocalStorage();
  }

  /**
   * Marks a process step as completed
   */
  markStepCompleted(step: RegistrationProcessStep, templateId?: string): void {
    const currentState = this.#processState();
    if (!currentState.completedSteps.includes(step)) {
      this.#processState.update((state) => ({
        ...state,
        completedSteps: [...state.completedSteps, step],
        templateId: templateId || state.templateId,
      }));
      this.saveProcessStateToLocalStorage();
    }
  }

  /**
   * Updates the current step being processed
   */
  updateCurrentStep(step: RegistrationProcessStep): void {
    this.#processState.update((state) => ({
      ...state,
      currentStep: step,
    }));
    this.saveProcessStateToLocalStorage();
  }

  async #processAuthentication(
    email: string,
    password: string,
  ): Promise<OnboardingSubmissionResult> {
    // Skip if already completed
    if (this.isAuthenticationCompleted()) {
      return { success: true };
    }

    this.updateCurrentStep(RegistrationProcessStep.AUTHENTICATION);

    const authResult = await this.#authApi.signUpWithEmail(email, password);

    if (!authResult.success) {
      const errorMessage =
        authResult.error || 'Erreur lors de la création du compte';
      return {
        success: false,
        error: errorMessage,
      };
    }

    this.markStepCompleted(RegistrationProcessStep.AUTHENTICATION);
    this.updateCurrentStep(RegistrationProcessStep.TEMPLATE_CREATION);
    return { success: true };
  }

  async #processTemplateCreation(): Promise<OnboardingSubmissionResult> {
    // Skip if already completed
    if (this.isTemplateCreationCompleted()) {
      return { success: true };
    }

    this.updateCurrentStep(RegistrationProcessStep.TEMPLATE_CREATION);

    try {
      const onboardingData = this.#onboardingApi.getStateData();
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
      const onboardingData = this.#onboardingApi.getStateData();
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
    this.#onboardingApi.submitCompletedOnboarding();
    this.#onboardingApi.clearOnboardingData();
    this.resetProcessState();
    this.markStepCompleted(RegistrationProcessStep.COMPLETION);
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

  private saveProcessStateToLocalStorage(): void {
    try {
      const processState = this.#processState();
      localStorage.setItem(
        'pulpe-registration-process-state',
        JSON.stringify(processState),
      );
    } catch (error) {
      console.error('Failed to save process state to localStorage:', error);
    }
  }

  private loadProcessStateFromLocalStorage(): void {
    try {
      const savedState = localStorage.getItem(
        'pulpe-registration-process-state',
      );
      if (savedState) {
        const parsedState = JSON.parse(savedState) as ProcessState;
        this.#processState.set(parsedState);
      }
    } catch (error) {
      console.error('Failed to load process state from localStorage:', error);
    }
  }

  private clearProcessStateFromLocalStorage(): void {
    try {
      localStorage.removeItem('pulpe-registration-process-state');
    } catch (error) {
      console.error('Failed to clear process state from localStorage:', error);
    }
  }
}
