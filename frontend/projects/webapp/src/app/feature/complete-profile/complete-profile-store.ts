import { Service, inject, signal, computed } from '@angular/core';
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
import {
  STORAGE_KEYS,
  StorageService,
  type CompleteProfileDraft,
} from '@core/storage';
import { firstValueFrom } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { ANALYTICS_EVENTS, type SupportedCurrency } from 'pulpe-shared';

/**
 * An onboarding suggestion chip. Carries a stable `id` independent of the
 * (currency-localized) display `name`, so a chip stays correctly matched even
 * when its label changes after a currency switch. The id never crosses the API
 * boundary — it's stripped alongside `__suggestionId` before submit.
 */
export interface OnboardingSuggestion extends OnboardingTransaction {
  readonly id: string;
}

/**
 * Onboarding suggestion chips. All amounts/types/order are identical regardless
 * of currency — only the retirement-savings label is localized per market:
 * CHF users (Swiss) see "3ème pilier", EUR users (French) see "Épargne retraite".
 * The `id` is currency-invariant (notably identical across CHF/EUR for the
 * retirement chip) so chip selection survives a currency relabel.
 */
export function getOnboardingSuggestions(
  currency: SupportedCurrency,
): readonly OnboardingSuggestion[] {
  const retirementSavingsName =
    currency === 'CHF' ? '3ème pilier' : 'Épargne retraite';
  return [
    {
      id: 'groceries',
      name: 'Courses / alimentation',
      amount: 600,
      type: 'expense',
      expenseType: 'fixed',
      isRecurring: true,
    },
    {
      id: 'dining-out',
      name: 'Restaurants & sorties',
      amount: 150,
      type: 'expense',
      expenseType: 'fixed',
      isRecurring: true,
    },
    {
      id: 'leisure-sport',
      name: 'Loisirs & sport',
      amount: 100,
      type: 'expense',
      expenseType: 'fixed',
      isRecurring: true,
    },
    {
      id: 'saving',
      name: 'Épargne',
      amount: 500,
      type: 'saving',
      expenseType: 'fixed',
      isRecurring: true,
    },
    {
      id: 'retirement',
      name: retirementSavingsName,
      amount: 587,
      type: 'saving',
      expenseType: 'fixed',
      isRecurring: true,
    },
  ];
}

export const MAX_CUSTOM_TRANSACTIONS = 50;

/**
 * Client-only fields identifying a customTransactions entry sourced from a
 * suggestion chip (as opposed to a user-typed entry). Both `__suggestionId`
 * (the matching key) and `id` (copied from the spread suggestion) are stripped
 * from the payload sent to the API so the wire contract stays clean.
 *
 * Keeping a single list + provenance tag (rather than two parallel states)
 * means "which chip is selected" and "which custom rows exist" can never
 * drift out of sync, which is what caused the original name-collision bug.
 */
interface InternalCustomTransaction extends OnboardingTransaction {
  readonly __suggestionId?: string;
  readonly id?: string;
}

function stripSuggestionTag(
  tx: InternalCustomTransaction,
): OnboardingTransaction {
  const clean: Record<string, unknown> = { ...tx };
  delete clean['__suggestionId'];
  delete clean['id'];
  return clean as OnboardingTransaction;
}

interface CompleteProfileState {
  currentStep: 1 | 2;
  currency: SupportedCurrency;
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

function createInitialState(currency: SupportedCurrency): CompleteProfileState {
  return {
    currentStep: 1,
    currency,
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

@Service({ autoProvided: false })
export class CompleteProfileStore {
  readonly #profileSetupService = inject(ProfileSetupService);
  readonly #budgetApi = inject(BudgetApi);
  readonly #userSettingsStore = inject(UserSettingsStore);
  readonly #authOAuth = inject(AuthOAuthService);
  readonly #storage = inject(StorageService);
  readonly #logger = inject(Logger);
  readonly #postHogService = inject(PostHogService);
  readonly #transloco = inject(TranslocoService);

  readonly #state = signal<CompleteProfileState>(this.#restoreDraft());

  readonly currentStep = computed(() => this.#state().currentStep);
  readonly currency = computed(() => this.#state().currency);
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
  readonly selectedSuggestionIds = computed(() => {
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
      state.firstName.length <= 50 &&
      state.monthlyIncome !== null &&
      state.monthlyIncome > 0
    );
  });

  updateCurrentStep(value: 1 | 2): void {
    this.#patchDraftState({ currentStep: value });
  }

  updateCurrency(value: SupportedCurrency): void {
    this.#patchDraftState({ currency: value });
  }

  updateFirstName(value: string): void {
    this.#patchDraftState({ firstName: value.slice(0, 50) });
  }

  updateMonthlyIncome(value: number | null): void {
    this.#patchDraftState({ monthlyIncome: this.#validAmount(value) });
  }

  updateHousingCosts(value: number | null): void {
    this.#patchDraftState({ housingCosts: this.#validAmount(value) });
  }

  updateHealthInsurance(value: number | null): void {
    this.#patchDraftState({ healthInsurance: this.#validAmount(value) });
  }

  updatePhonePlan(value: number | null): void {
    this.#patchDraftState({ phonePlan: this.#validAmount(value) });
  }

  updateInternetPlan(value: number | null): void {
    this.#patchDraftState({ internetPlan: this.#validAmount(value) });
  }

  updateTransportCosts(value: number | null): void {
    this.#patchDraftState({ transportCosts: this.#validAmount(value) });
  }

  updateLeasingCredit(value: number | null): void {
    this.#patchDraftState({ leasingCredit: this.#validAmount(value) });
  }

  updatePayDayOfMonth(value: number | null): void {
    this.#patchDraftState({ payDayOfMonth: value });
  }

  addCustomTransaction(tx: OnboardingTransaction): void {
    if (this.#state().customTransactions.length >= MAX_CUSTOM_TRANSACTIONS)
      return;
    this.#patchDraftState({
      customTransactions: [...this.#state().customTransactions, { ...tx }],
    });
    this.#trackCustomTransactionEvent(
      ANALYTICS_EVENTS.CUSTOM_TRANSACTION_ADDED,
      tx,
      'manual',
    );
  }

  removeCustomTransaction(index: number): void {
    const current = this.#state().customTransactions;
    const removed = current[index];
    if (!removed) return;
    this.#patchDraftState({
      customTransactions: current.filter((_, i) => i !== index),
    });
    this.#trackCustomTransactionEvent(
      ANALYTICS_EVENTS.CUSTOM_TRANSACTION_REMOVED,
      removed,
      removed.__suggestionId ? 'suggestion' : 'manual',
    );
  }

  updateCustomTransactionAmount(index: number, amount: number): void {
    this.#patchDraftState({
      customTransactions: this.#state().customTransactions.map((tx, i) =>
        i === index ? { ...tx, amount } : tx,
      ),
    });
  }

  toggleSuggestion(suggestion: OnboardingSuggestion): void {
    // Keyed by the currency-invariant `id`, not the localized `name`. A currency
    // switch relabels the chip but keeps the id, so the entry stays matched and
    // re-tapping removes it instead of appending a duplicate.
    const suggestionId = suggestion.id;
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
      this.#patchDraftState({ customTransactions: [...current, tagged] });
      this.#trackSuggestionToggled(suggestion, true);
      return;
    }

    // Only remove the suggestion-tagged entry — manually-added rows sharing
    // the same name+type are left alone. Fixes the data-loss edge case where
    // tapping a chip previously deleted a colliding user-typed row.
    const next = current.slice();
    next.splice(matchIndex, 1);
    this.#patchDraftState({ customTransactions: next });
    this.#trackSuggestionToggled(suggestion, false);
  }

  #trackSuggestionToggled(
    suggestion: OnboardingTransaction,
    selected: boolean,
  ): void {
    this.#postHogService.captureEvent(
      ANALYTICS_EVENTS.ONBOARDING_SUGGESTION_TOGGLED,
      {
        step: this.#analyticsStepFor(suggestion.type),
        suggestion_name: suggestion.name,
        selected,
      },
    );
  }

  #trackCustomTransactionEvent(
    event:
      | typeof ANALYTICS_EVENTS.CUSTOM_TRANSACTION_ADDED
      | typeof ANALYTICS_EVENTS.CUSTOM_TRANSACTION_REMOVED,
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
    // A resumed draft belongs to the user and must win over provider metadata.
    if (this.#state().firstName.trim()) {
      return;
    }

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
        this.#clearDraft();
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
      await this.#userSettingsStore.updateSettings({
        currency: state.currency,
      });
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

      if (state.payDayOfMonth !== null) {
        try {
          await this.#userSettingsStore.updateSettings({
            payDayOfMonth: state.payDayOfMonth,
          });
        } catch (error) {
          this.#logger.warn(
            'Budget created, but saving the pay day failed:',
            error,
          );
          this.#postHogService.captureException(error, {
            context: 'complete-profile',
            action: 'savePayDay',
          });
        }
      }

      this.#postHogService.captureEvent(ANALYTICS_EVENTS.FIRST_BUDGET_CREATED, {
        signup_method: this.#determineSignupMethod(),
        has_pay_day: state.payDayOfMonth !== null,
        charges_count: this.#countOptionalCharges(state),
        custom_transactions_count: state.customTransactions.length,
      });

      this.#logger.info('Profile setup completed successfully');
      this.#patchState({ isLoading: false });
      this.#clearDraft();
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

  #validAmount(value: number | null): number | null {
    return value !== null && Number.isFinite(value) && value >= 0
      ? value
      : null;
  }

  #patchState(partial: Partial<CompleteProfileState>): void {
    this.#state.update((s) => ({ ...s, ...partial }));
  }

  #patchDraftState(partial: Partial<CompleteProfileState>): void {
    this.#patchState(partial);
    this.#persistDraft();
  }

  #restoreDraft(): CompleteProfileState {
    const fallback = createInitialState(this.#userSettingsStore.currency());
    const stored = this.#storage.get<CompleteProfileDraft>(
      STORAGE_KEYS.COMPLETE_PROFILE_DRAFT,
      'session',
    );

    if (!stored) {
      // Also clears malformed JSON: StorageService returns null for it.
      this.#clearDraft();
      return fallback;
    }

    const { version, ...draft } = stored;
    void version;
    return { ...fallback, ...draft };
  }

  #persistDraft(): void {
    const state = this.#state();
    const draft: CompleteProfileDraft = {
      version: 1,
      currentStep: state.currentStep,
      currency: state.currency,
      firstName: state.firstName,
      monthlyIncome: state.monthlyIncome,
      housingCosts: state.housingCosts,
      healthInsurance: state.healthInsurance,
      phonePlan: state.phonePlan,
      internetPlan: state.internetPlan,
      transportCosts: state.transportCosts,
      leasingCredit: state.leasingCredit,
      payDayOfMonth: state.payDayOfMonth,
      customTransactions: state.customTransactions,
    };
    this.#storage.set(STORAGE_KEYS.COMPLETE_PROFILE_DRAFT, draft, 'session');
  }

  #clearDraft(): void {
    this.#storage.remove(STORAGE_KEYS.COMPLETE_PROFILE_DRAFT, 'session');
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
