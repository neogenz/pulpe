import { Injectable, inject, signal, computed } from '@angular/core';
import { ProfileSetupService, type ProfileData } from '@core/complete-profile';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsStore } from '@core/user-settings';
import { AuthOAuthService } from '@core/auth/auth-oauth.service';
import { firstValueFrom } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

interface CompleteProfileState {
  firstName: string;
  monthlyIncome: number | null;
  housingCosts: number | null;
  healthInsurance: number | null;
  phonePlan: number | null;
  internetPlan: number | null;
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
    internetPlan: null,
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
  readonly #userSettingsStore = inject(UserSettingsStore);
  readonly #authOAuth = inject(AuthOAuthService);
  readonly #logger = inject(Logger);
  readonly #postHogService = inject(PostHogService);
  readonly #transloco = inject(TranslocoService);

  readonly #state = signal<CompleteProfileState>(createInitialState());

  readonly firstName = computed(() => this.#state().firstName);
  readonly monthlyIncome = computed(() => this.#state().monthlyIncome);
  readonly housingCosts = computed(() => this.#state().housingCosts);
  readonly healthInsurance = computed(() => this.#state().healthInsurance);
  readonly phonePlan = computed(() => this.#state().phonePlan);
  readonly internetPlan = computed(() => this.#state().internetPlan);
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
    this.#patchState({ firstName: value });
  }

  updateMonthlyIncome(value: number | null): void {
    this.#patchState({ monthlyIncome: value });
  }

  updateHousingCosts(value: number | null): void {
    this.#patchState({ housingCosts: value });
  }

  updateHealthInsurance(value: number | null): void {
    this.#patchState({ healthInsurance: value });
  }

  updatePhonePlan(value: number | null): void {
    this.#patchState({ phonePlan: value });
  }

  updateInternetPlan(value: number | null): void {
    this.#patchState({ internetPlan: value });
  }

  updateTransportCosts(value: number | null): void {
    this.#patchState({ transportCosts: value });
  }

  updateLeasingCredit(value: number | null): void {
    this.#patchState({ leasingCredit: value });
  }

  updatePayDayOfMonth(value: number | null): void {
    this.#patchState({ payDayOfMonth: value });
  }

  clearError(): void {
    this.#patchState({ error: '' });
  }

  prefillFromOAuthMetadata(): void {
    const metadata = this.#authOAuth.getOAuthUserMetadata();
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
    this.#patchState({ isCheckingExistingBudget: true });

    try {
      const budgets = await firstValueFrom(this.#budgetApi.getAllBudgets$());
      const hasExisting = budgets.length > 0;

      this.#patchState({ isCheckingExistingBudget: false });

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
      this.#patchState({ isCheckingExistingBudget: false });
      return false;
    }
  }

  async submitProfile(): Promise<boolean> {
    if (this.isLoading()) {
      return false;
    }

    if (!this.isStep1Valid()) {
      this.#patchState({
        error: this.#transloco.translate('completeProfile.validationError'),
      });
      return false;
    }

    const state = this.#state();
    this.#patchState({ isLoading: true, error: '' });

    const profileData: ProfileData = {
      firstName: state.firstName.trim(),
      monthlyIncome: state.monthlyIncome as number,
      housingCosts: state.housingCosts ?? undefined,
      healthInsurance: state.healthInsurance ?? undefined,
      phonePlan: state.phonePlan ?? undefined,
      internetPlan: state.internetPlan ?? undefined,
      transportCosts: state.transportCosts ?? undefined,
      leasingCredit: state.leasingCredit ?? undefined,
      payDayOfMonth: state.payDayOfMonth ?? undefined,
    };

    try {
      const result =
        await this.#profileSetupService.createInitialBudget(profileData);

      if (!result.success) {
        this.#patchState({
          isLoading: false,
          error:
            result.error ||
            this.#transloco.translate('completeProfile.createBudgetError'),
        });
        return false;
      }

      // Save pay day setting if user configured it
      if (state.payDayOfMonth !== null) {
        try {
          await this.#userSettingsStore.updateSettings({
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
      this.#budgetApi.markBudgetExists(true);

      this.#postHogService.captureEvent('first_budget_created', {
        signup_method: this.#determineSignupMethod(),
        has_pay_day: state.payDayOfMonth !== null,
        charges_count: this.#countOptionalCharges(state),
      });

      this.#logger.info('Profile setup completed successfully');
      this.#patchState({ isLoading: false });
      return true;
    } catch (error) {
      this.#logger.error('Error submitting profile:', error);
      this.#patchState({
        isLoading: false,
        error: this.#transloco.translate('completeProfile.unexpectedError'),
      });
      return false;
    }
  }

  #patchState(partial: Partial<CompleteProfileState>): void {
    this.#state.update((s) => ({ ...s, ...partial }));
  }

  #determineSignupMethod(): 'oauth' | 'email' {
    const metadata = this.#authOAuth.getOAuthUserMetadata();
    return metadata ? 'oauth' : 'email';
  }

  #countOptionalCharges(state: CompleteProfileState): number {
    const charges = [
      state.housingCosts,
      state.healthInsurance,
      state.phonePlan,
      state.internetPlan,
      state.transportCosts,
      state.leasingCredit,
    ];
    return charges.filter((c) => c !== null && c > 0).length;
  }
}
