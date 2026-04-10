import { Injectable, inject, signal, computed } from '@angular/core';
import {
  ProfileSetupService,
  type ProfileData,
  type OnboardingTransaction,
} from '@core/complete-profile';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsStore } from '@core/user-settings';
import { AuthOAuthService } from '@core/auth/auth-oauth.service';
import { firstValueFrom } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

export const ONBOARDING_SUGGESTIONS: readonly OnboardingTransaction[] = [
  {
    name: 'Courses / alimentation',
    amount: 600,
    type: 'expense',
    expenseType: 'fixed',
    isRecurring: true,
  },
  {
    name: 'Restaurants & sorties',
    amount: 150,
    type: 'expense',
    expenseType: 'fixed',
    isRecurring: true,
  },
  {
    name: 'Loisirs & sport',
    amount: 100,
    type: 'expense',
    expenseType: 'fixed',
    isRecurring: true,
  },
  {
    name: 'Épargne',
    amount: 500,
    type: 'saving',
    expenseType: 'fixed',
    isRecurring: true,
  },
  {
    name: '3ème pilier',
    amount: 587,
    type: 'saving',
    expenseType: 'fixed',
    isRecurring: true,
  },
];

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
  customTransactions: OnboardingTransaction[];
  isLoading: boolean;
  isCheckingExistingBudget: boolean;
  error: string | null;
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
    customTransactions: [],
    isLoading: false,
    isCheckingExistingBudget: false,
    error: null,
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
  readonly customTransactions = computed(
    () => this.#state().customTransactions,
  );
  readonly selectedSuggestionNames = computed(() => {
    const txs = this.customTransactions();
    return new Set(
      ONBOARDING_SUGGESTIONS.filter((s) =>
        txs.some(
          (t) =>
            t.name === s.name && t.type === s.type && t.amount === s.amount,
        ),
      ).map((s) => s.name),
    );
  });
  readonly isLoading = computed(() => this.#state().isLoading);
  readonly isCheckingExistingBudget = computed(
    () => this.#state().isCheckingExistingBudget,
  );
  readonly error = computed(() => this.#state().error);

  readonly totalFixedCharges = computed(() => {
    const s = this.#state();
    return [
      s.housingCosts,
      s.healthInsurance,
      s.phonePlan,
      s.internetPlan,
      s.transportCosts,
      s.leasingCredit,
    ]
      .filter((v): v is number => v !== null && v > 0)
      .reduce((sum, v) => sum + v, 0);
  });

  readonly budgetSummary = computed(() => {
    const txs = this.customTransactions();
    const expenseTotal = txs
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const savingTotal = txs
      .filter((t) => t.type === 'saving')
      .reduce((s, t) => s + t.amount, 0);
    const incomeTotal = txs
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);

    const income = (this.monthlyIncome() ?? 0) + incomeTotal;
    const committed = this.totalFixedCharges() + expenseTotal + savingTotal;
    const available = income - committed;
    return { income, committed, available };
  });

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

  addCustomTransaction(tx: OnboardingTransaction): void {
    if (this.#state().customTransactions.length >= 50) return;
    this.#patchState({
      customTransactions: [...this.#state().customTransactions, tx],
    });
  }

  removeCustomTransaction(index: number): void {
    this.#patchState({
      customTransactions: this.#state().customTransactions.filter(
        (_, i) => i !== index,
      ),
    });
  }

  updateCustomTransactionAmount(index: number, amount: number): void {
    this.#patchState({
      customTransactions: this.#state().customTransactions.map((tx, i) =>
        i === index ? { ...tx, amount } : tx,
      ),
    });
  }

  toggleSuggestion(suggestion: OnboardingTransaction): void {
    const current = this.#state().customTransactions;
    const exactMatch = (t: OnboardingTransaction) =>
      t.name === suggestion.name &&
      t.type === suggestion.type &&
      t.amount === suggestion.amount;
    const exists = current.some(exactMatch);
    this.#patchState({
      customTransactions: exists
        ? current.filter((t) => !exactMatch(t))
        : [...current, suggestion],
    });
  }

  clearError(): void {
    this.#patchState({ error: null });
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
      const hasExisting = await firstValueFrom(
        this.#budgetApi.checkBudgetExists$(),
      );

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
    this.#patchState({ isLoading: true, error: null });

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
      customTransactions: state.customTransactions,
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

      this.#postHogService.captureEvent('first_budget_created', {
        signup_method: this.#determineSignupMethod(),
        has_pay_day: state.payDayOfMonth !== null,
        charges_count: this.#countOptionalCharges(state),
        custom_transactions_count: state.customTransactions.length,
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
