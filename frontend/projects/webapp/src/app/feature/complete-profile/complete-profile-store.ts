import { Injectable, inject, signal, computed } from '@angular/core';
import { ProfileSetupService, type ProfileData } from '@core/profile';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsApi } from '@core/user-settings';
import { AuthApi } from '@core/auth/auth-api';
import { HasBudgetCache } from '@core/auth/has-budget-cache';
import { firstValueFrom } from 'rxjs';

interface CompleteProfileState {
  firstName: string;
  monthlyIncome: number | null;
  housingCosts: number | null;
  healthInsurance: number | null;
  phonePlan: number | null;
  transportCosts: number | null;
  leasingCredit: number | null;
  payDayOfMonth: number | null;
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
    payDayOfMonth: null,
    isLoading: false,
    isCheckingExistingBudget: false,
    error: '',
  };
}

@Injectable()
export class CompleteProfileStore {
  readonly #profileSetupService = inject(ProfileSetupService);
  readonly #budgetApi = inject(BudgetApi);
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #authApi = inject(AuthApi);
  readonly #hasBudgetCache = inject(HasBudgetCache);
  readonly #logger = inject(Logger);
  readonly #postHogService = inject(PostHogService);

  readonly #state = signal<CompleteProfileState>(createInitialState());

  readonly firstName = computed(() => this.#state().firstName);
  readonly monthlyIncome = computed(() => this.#state().monthlyIncome);
  readonly housingCosts = computed(() => this.#state().housingCosts);
  readonly healthInsurance = computed(() => this.#state().healthInsurance);
  readonly phonePlan = computed(() => this.#state().phonePlan);
  readonly transportCosts = computed(() => this.#state().transportCosts);
  readonly leasingCredit = computed(() => this.#state().leasingCredit);
  readonly payDayOfMonth = computed(() => this.#state().payDayOfMonth);
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

  updatePayDayOfMonth(value: number | null): void {
    this.#state.update((s) => ({ ...s, payDayOfMonth: value }));
  }

  clearError(): void {
    this.#state.update((s) => ({ ...s, error: '' }));
  }

  prefillFromOAuthMetadata(): void {
    const metadata = this.#authApi.getOAuthUserMetadata();
    if (!metadata) {
      return;
    }

    const firstName = metadata.givenName ?? metadata.fullName?.split(' ')[0];
    if (firstName) {
      this.updateFirstName(firstName);
      this.#logger.info('Prefilled firstName from OAuth metadata', {
        source: metadata.givenName ? 'givenName' : 'fullName',
      });
    }
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

      // Save pay day setting if user configured it
      if (state.payDayOfMonth !== null) {
        try {
          await this.#userSettingsApi.updateSettings({
            payDayOfMonth: state.payDayOfMonth,
          });
          this.#logger.info('Pay day setting saved', {
            payDayOfMonth: state.payDayOfMonth,
          });
        } catch (settingsError) {
          // Log but don't fail - budget was created successfully
          this.#logger.warn('Failed to save pay day setting', settingsError);
          this.#postHogService.captureException(settingsError, {
            context: 'complete-profile',
            action: 'savePayDaySetting',
          });
        }
      }

      // Update cache so guard allows navigation immediately
      this.#hasBudgetCache.setHasBudget(true);

      this.#postHogService.captureEvent('first_budget_created', {
        signup_method: this.#determineSignupMethod(),
        has_pay_day: state.payDayOfMonth !== null,
        charges_count: this.#countOptionalCharges(state),
      });

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

  #determineSignupMethod(): 'google' | 'email' {
    const metadata = this.#authApi.getOAuthUserMetadata();
    return metadata ? 'google' : 'email';
  }

  #countOptionalCharges(state: CompleteProfileState): number {
    const charges = [
      state.housingCosts,
      state.healthInsurance,
      state.phonePlan,
      state.transportCosts,
      state.leasingCredit,
    ];
    return charges.filter((c) => c !== null && c > 0).length;
  }
}
