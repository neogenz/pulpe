import { Injectable, inject, signal, computed } from '@angular/core';
import { ProfileSetupService, type ProfileData } from '@core/profile';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { PostHogService } from '@core/analytics/posthog';
import { firstValueFrom } from 'rxjs';

interface CompleteProfileState {
  firstName: string;
  monthlyIncome: number | null;
  housingCosts: number | null;
  healthInsurance: number | null;
  phonePlan: number | null;
  transportCosts: number | null;
  leasingCredit: number | null;
  isLoading: boolean;
  isCheckingExistingBudget: boolean;
  error: string;
}

function createInitialState(): CompleteProfileState {
  return {
    firstName: '',
    monthlyIncome: null,
    housingCosts: null,
    healthInsurance: null,
    phonePlan: null,
    transportCosts: null,
    leasingCredit: null,
    isLoading: false,
    isCheckingExistingBudget: true,
    error: '',
  };
}

@Injectable()
export class CompleteProfileStore {
  readonly #profileSetupService = inject(ProfileSetupService);
  readonly #budgetApi = inject(BudgetApi);
  readonly #logger = inject(Logger);
  readonly #postHogService = inject(PostHogService);

  readonly #state = signal<CompleteProfileState>(createInitialState());

  // Public selectors
  readonly firstName = computed(() => this.#state().firstName);
  readonly monthlyIncome = computed(() => this.#state().monthlyIncome);
  readonly housingCosts = computed(() => this.#state().housingCosts);
  readonly healthInsurance = computed(() => this.#state().healthInsurance);
  readonly phonePlan = computed(() => this.#state().phonePlan);
  readonly transportCosts = computed(() => this.#state().transportCosts);
  readonly leasingCredit = computed(() => this.#state().leasingCredit);
  readonly isLoading = computed(() => this.#state().isLoading);
  readonly isCheckingExistingBudget = computed(
    () => this.#state().isCheckingExistingBudget,
  );
  readonly error = computed(() => this.#state().error);

  readonly isStep1Valid = computed(() => {
    const state = this.#state();
    return (
      state.firstName.trim().length > 0 &&
      state.monthlyIncome !== null &&
      state.monthlyIncome > 0
    );
  });

  // Actions
  updateFirstName(value: string): void {
    this.#state.update((s) => ({ ...s, firstName: value }));
  }

  updateMonthlyIncome(value: number | null): void {
    this.#state.update((s) => ({ ...s, monthlyIncome: value }));
  }

  updateHousingCosts(value: number | null): void {
    this.#state.update((s) => ({ ...s, housingCosts: value }));
  }

  updateHealthInsurance(value: number | null): void {
    this.#state.update((s) => ({ ...s, healthInsurance: value }));
  }

  updatePhonePlan(value: number | null): void {
    this.#state.update((s) => ({ ...s, phonePlan: value }));
  }

  updateTransportCosts(value: number | null): void {
    this.#state.update((s) => ({ ...s, transportCosts: value }));
  }

  updateLeasingCredit(value: number | null): void {
    this.#state.update((s) => ({ ...s, leasingCredit: value }));
  }

  clearError(): void {
    this.#state.update((s) => ({ ...s, error: '' }));
  }

  async checkExistingBudgets(): Promise<boolean> {
    this.#state.update((s) => ({ ...s, isCheckingExistingBudget: true }));

    try {
      const budgets = await firstValueFrom(this.#budgetApi.getAllBudgets$());
      const hasExisting = budgets.length > 0;

      this.#state.update((s) => ({ ...s, isCheckingExistingBudget: false }));

      if (hasExisting) {
        this.#logger.info(
          'User already has budgets, should redirect to dashboard',
        );
      }

      return hasExisting;
    } catch (error) {
      this.#logger.error('Error checking existing budgets:', error);
      this.#postHogService.captureException(error, {
        context: 'complete-profile',
        action: 'checkExistingBudgets',
      });
      this.#state.update((s) => ({ ...s, isCheckingExistingBudget: false }));
      return false;
    }
  }

  async submitProfile(): Promise<boolean> {
    const state = this.#state();

    if (!this.isStep1Valid()) {
      this.#state.update((s) => ({
        ...s,
        error: 'Veuillez renseigner votre prénom et vos revenus mensuels',
      }));
      return false;
    }

    this.#state.update((s) => ({ ...s, isLoading: true, error: '' }));

    const profileData: ProfileData = {
      firstName: state.firstName.trim(),
      monthlyIncome: state.monthlyIncome!,
      housingCosts: state.housingCosts ?? undefined,
      healthInsurance: state.healthInsurance ?? undefined,
      phonePlan: state.phonePlan ?? undefined,
      transportCosts: state.transportCosts ?? undefined,
      leasingCredit: state.leasingCredit ?? undefined,
    };

    try {
      const result =
        await this.#profileSetupService.createInitialBudget(profileData);

      if (!result.success) {
        this.#state.update((s) => ({
          ...s,
          isLoading: false,
          error: result.error || 'Erreur lors de la création du budget',
        }));
        return false;
      }

      this.#logger.info('Profile setup completed successfully');
      this.#state.update((s) => ({ ...s, isLoading: false }));
      return true;
    } catch (error) {
      this.#logger.error('Error submitting profile:', error);
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error: "Une erreur inattendue s'est produite",
      }));
      return false;
    }
  }
}
