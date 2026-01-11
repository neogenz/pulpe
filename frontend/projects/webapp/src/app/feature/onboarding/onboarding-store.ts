import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { PostHogService } from '@core/analytics/posthog';
import { AuthApi } from '@core/auth/auth-api';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { StorageService, STORAGE_KEYS } from '@core/storage';
import { UserSettingsApi } from '@core/user-settings';
import {
  type BudgetCreate,
  type BudgetTemplateCreateFromOnboarding,
} from 'pulpe-shared';
import { firstValueFrom } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import {
  type OnboardingData,
  type OnboardingState,
  type OnboardingStep,
  createInitialOnboardingState,
} from './onboarding-state';
import { OnboardingApi } from './services/onboarding-api';

// Re-export for external use
export type { OnboardingStep } from './onboarding-state';

export const STEP_ORDER: readonly OnboardingStep[] = [
  'welcome',
  'personal-info',
  'income',
  'pay-day',
  'housing',
  'health-insurance',
  'phone-plan',
  'transport',
  'leasing-credit',
  'registration',
] as const;

/**
 * OnboardingStore - Signal-based state management for onboarding flow
 *
 * This store manages the complete onboarding process including:
 * - User data collection through multiple steps
 * - Progress tracking and navigation state
 * - Form validation and error handling
 * - Final registration and account creation
 *
 * Architecture:
 * - Single private state signal following the established pattern
 * - Public computed selectors for reactive data access
 * - Actions for state mutations with strict immutability
 * - Local storage persistence for user data
 */
@Injectable()
export class OnboardingStore {
  readonly #authApi = inject(AuthApi);
  readonly #budgetApi = inject(BudgetApi);
  readonly #onboardingApi = inject(OnboardingApi);
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #router = inject(Router);
  readonly #logger = inject(Logger);
  readonly #postHogService = inject(PostHogService);
  readonly #storageService = inject(StorageService);

  // Single source of truth - private state signal
  readonly #state = signal<OnboardingState>(createInitialOnboardingState());

  // Router-based current URL tracking
  readonly #currentUrl = toSignal(
    this.#router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => (event as NavigationEnd).url),
    ),
    { initialValue: this.#router.url },
  );

  // Public readonly computed selectors
  readonly data = computed(() => this.#state().data);
  readonly isLoading = computed(() => this.#state().isLoading);
  readonly hasValue = computed(() => !!this.#state().data.firstName);
  readonly error = computed(() => this.#state().error);

  // Navigation and progress computed selectors
  readonly currentStep = computed(() => {
    const url = this.#currentUrl();
    const stepName = url.split('/').pop();
    const stepIndex = STEP_ORDER.indexOf(stepName as OnboardingStep);
    return stepIndex !== -1 ? stepIndex : -1;
  });

  readonly totalSteps = STEP_ORDER.length;
  readonly isFirstStep = computed(() => this.currentStep() === 0);
  readonly currentStepName = computed(
    () => STEP_ORDER[this.currentStep()] || 'welcome',
  );

  // Progress tracking
  readonly progressPercentage = computed(() =>
    Math.round((this.currentStep() / (this.totalSteps - 1)) * 100),
  );

  readonly isLastStep = computed(
    () => this.currentStep() === this.totalSteps - 1,
  );

  constructor() {
    this.#loadFromStorage();
  }

  // Public Actions

  /**
   * Update a specific field in the onboarding data
   */
  updateField(
    field: keyof OnboardingData,
    value: string | number | null,
  ): void {
    this.#setState((currentState) => ({
      ...currentState,
      data: {
        ...currentState.data,
        [field]: value,
      },
    }));
    this.#saveDataToStorage(this.data());
  }

  /**
   * Update user email specifically
   */
  updateEmail(email: string): void {
    this.#setState((currentState) => ({
      ...currentState,
      data: {
        ...currentState.data,
        email,
      },
    }));
    this.#saveDataToStorage(this.data());
  }

  /**
   * Clear any error message
   */
  clearError(): void {
    this.#setState((currentState) => ({
      ...currentState,
      error: '',
    }));
  }

  /**
   * Reset the user creation state (for retry scenarios)
   */
  resetUserCreationState(): void {
    this.#setState((currentState) => ({
      ...currentState,
      data: {
        ...currentState.data,
        isUserCreated: false,
      },
    }));
  }

  /**
   * Submit the complete registration with onboarding data
   */
  async submitRegistration(email: string, password: string): Promise<boolean> {
    const currentData = this.data();

    if (
      !currentData.firstName ||
      !currentData.monthlyIncome ||
      currentData.monthlyIncome <= 0
    ) {
      this.#setError('Données obligatoires manquantes');
      return false;
    }

    this.#setLoading(true);
    this.#clearError();

    try {
      // 1. Créer le compte seulement s'il n'a pas déjà été créé
      if (!currentData.isUserCreated) {
        const authResult = await this.#authApi.signUpWithEmail(email, password);
        if (!authResult.success) {
          this.#setError(
            authResult.error || 'Erreur lors de la création du compte',
          );
          return false;
        }
        // Marquer que l'utilisateur a été créé avec succès
        this.#setState((state) => ({
          ...state,
          data: {
            ...state.data,
            isUserCreated: true,
          },
        }));
      }

      // 2. Sauvegarder les paramètres utilisateur (payDayOfMonth)
      if (currentData.payDayOfMonth !== null) {
        try {
          await this.#userSettingsApi.updateSettings({
            payDayOfMonth: currentData.payDayOfMonth,
          });
        } catch {
          this.#logger.warn('Failed to save payDayOfMonth, continuing...');
          // Continue even if settings save fails - not critical
        }
      }

      // 3. Créer le template de budget
      const templateRequest: BudgetTemplateCreateFromOnboarding = {
        name: 'Mois Standard',
        description: `Template personnel de ${currentData.firstName}`,
        isDefault: true,
        monthlyIncome: currentData.monthlyIncome,
        housingCosts: currentData.housingCosts ?? 0,
        healthInsurance: currentData.healthInsurance ?? 0,
        leasingCredit: currentData.leasingCredit ?? 0,
        phonePlan: currentData.phonePlan ?? 0,
        transportCosts: currentData.transportCosts ?? 0,
        customTransactions: [],
      };

      const templateResponse = await firstValueFrom(
        this.#onboardingApi.createTemplateFromOnboarding$(templateRequest),
      );

      // 3. Créer le budget
      const currentDate = new Date();
      const budgetRequest: BudgetCreate = {
        templateId: templateResponse.data.template.id,
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        description: `Budget initial de ${currentData.firstName} pour ${currentDate.getFullYear()}`,
      };

      await firstValueFrom(this.#budgetApi.createBudget$(budgetRequest));

      // 4. Activer PostHog maintenant que l'utilisateur a accepté les CGU
      this.#postHogService.enableTracking();
      this.#logger.info('PostHog tracking enabled after CGU acceptance');

      // 5. Nettoyer et rediriger
      this.#clearStorage();
      return true;
    } catch (error) {
      this.#logger.error("Erreur lors de l'inscription:", error);

      // Déterminer le type d'erreur selon le stack trace ou le message
      const errorMessage = error?.toString() || '';
      const errorObj = error as { message?: string };
      if (
        errorMessage.includes('template') ||
        errorObj?.message?.includes('template')
      ) {
        this.#setError(
          'Erreur lors de la création de votre template budgétaire.',
        );
      } else if (
        errorMessage.includes('budget') ||
        errorObj?.message?.includes('budget')
      ) {
        this.#setError('Erreur lors de la création de votre budget initial.');
      } else {
        this.#setError("Une erreur inattendue s'est produite");
      }

      return false;
    } finally {
      this.#setLoading(false);
    }
  }

  // Private state mutation methods

  /**
   * Immutably update the state signal
   */
  #setState(updater: (currentState: OnboardingState) => OnboardingState): void {
    this.#state.update(updater);
  }

  /**
   * Set loading state
   */
  #setLoading(isLoading: boolean): void {
    this.#setState((state) => ({ ...state, isLoading }));
  }

  /**
   * Set error message
   */
  #setError(error: string): void {
    this.#setState((state) => ({ ...state, error }));
  }

  /**
   * Clear error state
   */
  #clearError(): void {
    this.#setState((state) => ({ ...state, error: '' }));
  }

  // Private storage methods

  /**
   * Save onboarding data to localStorage (called by effect)
   */
  #saveDataToStorage(data: OnboardingData): void {
    this.#storageService.set(STORAGE_KEYS.ONBOARDING_DATA, data);
  }

  /**
   * Load onboarding data from localStorage
   */
  #loadFromStorage(): void {
    const savedData = this.#storageService.get<OnboardingData>(
      STORAGE_KEYS.ONBOARDING_DATA,
    );
    if (savedData) {
      this.#setState((state) => ({
        ...state,
        data: savedData,
      }));
    }
  }

  /**
   * Clear onboarding data from localStorage
   */
  #clearStorage(): void {
    this.#storageService.remove(STORAGE_KEYS.ONBOARDING_DATA);
  }
}
