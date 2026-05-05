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

export const MAX_CUSTOM_TRANSACTIONS = 50;

/**
 * Client-only tag identifying a customTransactions entry sourced from a
 * suggestion chip (as opposed to a user-typed entry). Stripped from the
 * payload sent to the API so the wire contract stays clean.
 *
 * Keeping a single list + provenance tag (rather than two parallel states)
 * means "which chip is selected" and "which custom rows exist" can never
 * drift out of sync, which is what caused the original name-collision bug.
 */
interface InternalCustomTransaction extends OnboardingTransaction {
  readonly __suggestionId?: string;
}

function stripSuggestionTag(
  tx: InternalCustomTransaction,
): OnboardingTransaction {
  const clean: Record<string, unknown> = { ...tx };
  delete clean['__suggestionId'];
  return clean as OnboardingTransaction;
}

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
  customTransactions: InternalCustomTransaction[];
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
  readonly customTransactions = computed<readonly OnboardingTransaction[]>(
    () => this.#state().customTransactions,
  );
  readonly selectedSuggestionNames = computed(() => {
    // Only entries tagged with `__suggestionId` count as "chip selected".
    // A manually-added row with the same `name + type` as a suggestion is
    // intentionally NOT matched here — that's the whole point of the tag.
    return new Set(
      this.#state()
        .customTransactions.map((t) => t.__suggestionId)
        .filter((id): id is string => id !== undefined),
    );
  });
  readonly customTransactionsLimitReached = computed(
    () => this.#state().customTransactions.length >= MAX_CUSTOM_TRANSACTIONS,
  );
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
    if (this.#state().customTransactions.length >= MAX_CUSTOM_TRANSACTIONS)
      return;
    this.#patchState({
      customTransactions: [...this.#state().customTransactions, { ...tx }],
    });
    this.#trackCustomTransactionEvent('custom_transaction_added', tx, 'manual');
  }

  removeCustomTransaction(index: number): void {
    const current = this.#state().customTransactions;
    const removed = current[index];
    if (!removed) return;
    this.#patchState({
      customTransactions: current.filter((_, i) => i !== index),
    });
    this.#trackCustomTransactionEvent(
      'custom_transaction_removed',
      removed,
      removed.__suggestionId ? 'suggestion' : 'manual',
    );
  }

  updateCustomTransactionAmount(index: number, amount: number): void {
    this.#patchState({
      customTransactions: this.#state().customTransactions.map((tx, i) =>
        i === index ? { ...tx, amount } : tx,
      ),
    });
  }

  toggleSuggestion(suggestion: OnboardingTransaction): void {
    // Each suggestion is keyed by its canonical `name` — ONBOARDING_SUGGESTIONS
    // is a hardcoded constant with unique names, so the name is a stable id.
    const suggestionId = suggestion.name;
    const current = this.#state().customTransactions;
    const matchIndex = current.findIndex(
      (t) => t.__suggestionId === suggestionId,
    );

    if (matchIndex === -1) {
      if (current.length >= MAX_CUSTOM_TRANSACTIONS) return;
      const tagged: InternalCustomTransaction = {
        ...suggestion,
        __suggestionId: suggestionId,
      };
      this.#patchState({ customTransactions: [...current, tagged] });
      this.#trackSuggestionToggled(suggestion, true);
      return;
    }

    // Only remove the suggestion-tagged entry — manually-added rows sharing
    // the same name+type are left alone. Fixes the data-loss edge case where
    // tapping a chip previously deleted a colliding user-typed row.
    const next = current.slice();
    next.splice(matchIndex, 1);
    this.#patchState({ customTransactions: next });
    this.#trackSuggestionToggled(suggestion, false);
  }

  #trackSuggestionToggled(
    suggestion: OnboardingTransaction,
    selected: boolean,
  ): void {
    this.#postHogService.captureEvent('onboarding_suggestion_toggled', {
      step: this.#analyticsStepFor(suggestion.type),
      suggestion_name: suggestion.name,
      selected,
    });
  }

  #trackCustomTransactionEvent(
    event: 'custom_transaction_added' | 'custom_transaction_removed',
    tx: OnboardingTransaction,
    source: 'manual' | 'suggestion',
  ): void {
    this.#postHogService.captureEvent(event, {
      step: this.#analyticsStepFor(tx.type),
      kind: tx.type,
      source,
    });
  }

  #analyticsStepFor(kind: 'income' | 'expense' | 'saving'): string {
    if (kind === 'expense') return 'charges';
    if (kind === 'saving') return 'savings';
    return 'income';
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
      // Strip the client-only `__suggestionId` tag before crossing the API
      // boundary — the Zod schema doesn't know about it and the backend
      // shouldn't either.
      customTransactions: state.customTransactions.map(stripSuggestionTag),
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
