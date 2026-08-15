import type { SupportedCurrency } from "pulpe-shared";
import { create } from "zustand";

import {
  clearDraft,
  readDraft,
  readHandoffSeen,
  readOnboardingCompleted,
  writeDraft,
  writeHandoffSeen,
  writeOnboardingCompleted,
} from "./draft-storage";
import { nextVisibleStep, previousVisibleStep } from "./onboarding-selectors";
import type { OnboardingStep } from "./onboarding-step";
import type { OnboardingTransaction } from "./onboarding-transaction";

/**
 * The onboarding flow's state machine, mirroring `OnboardingState.swift`:
 * which step the user is on, what they have answered so far, and which of the
 * two signup paths they came in through. Derived values live in
 * `onboarding-selectors.ts`; the HTTP calls that consume the answers live in
 * `api.ts`.
 */
export interface OnboardingState {
  /**
   * A run is under way and owns the router. It is what keeps the flow on
   * screen after registration, when the session turns authenticated and the
   * vault gate would otherwise claim the user mid-flow.
   */
  isFlowActive: boolean;
  /** A run finished on this device — a returning user goes to sign-in, not to welcome. */
  hasCompletedOnboarding: boolean;
  /** The one-time handoff has been read; the app opens on the home screen from now on. */
  hasSeenHandoff: boolean;

  currentStep: OnboardingStep;
  /**
   * Set while editing an answer from the budget preview: the next move in
   * either direction returns here instead of walking the steps in order.
   */
  editReturnStep: OnboardingStep | null;

  /**
   * True for Google signup only — it is what makes firstName and registration
   * skippable. Together with `wasEmailRegistered` it is also how the flow knows
   * it has an account; see `hasAccount`.
   */
  isSocialAuth: boolean;
  /**
   * Whether the provider supplied a usable first name. Captured once at auth
   * time so the visible step count cannot shift while the user is mid-form.
   */
  socialProvidedName: boolean;
  /** Persisted, so a cold start after signup resumes past registration. */
  wasEmailRegistered: boolean;
  /** Persisted, so a cold start between the PIN ceremony and the reveal skips it. */
  hasCompletedPinSetup: boolean;

  firstName: string;
  /** Not persisted: it means something only inside the registration form. */
  email: string;
  currency: SupportedCurrency;
  monthlyIncome: number | null;
  housingCosts: number | null;
  healthInsurance: number | null;
  phonePlan: number | null;
  transportCosts: number | null;
  leasingCredit: number | null;
  customTransactions: OnboardingTransaction[];
}

/** The answers, minus everything the flow derives or re-establishes on its own. */
export type OnboardingAnswers = Pick<
  OnboardingState,
  | "firstName"
  | "currency"
  | "monthlyIncome"
  | "housingCosts"
  | "healthInsurance"
  | "phonePlan"
  | "transportCosts"
  | "leasingCredit"
>;

/**
 * The `.max(50)` on `budgetTemplateCreateFromOnboardingSchema.customTransactions`
 * — reached here rather than at submit time, so the cap is a disabled chip
 * instead of a rejected payload after seven steps of work.
 */
export const MAX_CUSTOM_TRANSACTIONS = 50;

const INITIAL_STATE: OnboardingState = {
  isFlowActive: false,
  hasCompletedOnboarding: false,
  hasSeenHandoff: false,

  currentStep: "welcome",
  editReturnStep: null,

  isSocialAuth: false,
  socialProvidedName: false,
  wasEmailRegistered: false,
  hasCompletedPinSetup: false,

  firstName: "",
  email: "",
  currency: "CHF",
  monthlyIncome: null,
  housingCosts: null,
  healthInsurance: null,
  phonePlan: null,
  transportCosts: null,
  leasingCredit: null,
  customTransactions: [],
};

export const useOnboardingStore = create<OnboardingState>(() => ({
  ...INITIAL_STATE,
}));

/**
 * Every mutation goes through here, so the draft on disk is never behind what
 * is on screen. Saving on navigation alone would lose whatever was typed in the
 * step the app died on — which is exactly the step the user would be sent back
 * to.
 */
function patch(update: Partial<OnboardingState>): void {
  useOnboardingStore.setState(update);
  writeDraft(toDraft(useOnboardingStore.getState()));
}

/**
 * What belongs to the device rather than to the run. Resetting the flow spreads
 * `INITIAL_STATE` over everything, and these two have to survive it — they are
 * what tell a reinstall apart from a second visit.
 */
function deviceFlags(): Pick<
  OnboardingState,
  "hasCompletedOnboarding" | "hasSeenHandoff"
> {
  const { hasCompletedOnboarding, hasSeenHandoff } =
    useOnboardingStore.getState();
  return { hasCompletedOnboarding, hasSeenHandoff };
}

function toDraft(state: OnboardingState) {
  return {
    currentStep: state.currentStep,
    firstName: state.firstName,
    currency: state.currency,
    monthlyIncome: state.monthlyIncome,
    housingCosts: state.housingCosts,
    healthInsurance: state.healthInsurance,
    phonePlan: state.phonePlan,
    transportCosts: state.transportCosts,
    leasingCredit: state.leasingCredit,
    customTransactions: state.customTransactions,
    // How the run signed in, not only what it answered. Which steps exist is
    // decided from these, so a draft that carried the answers alone came back
    // as an anonymous run and put questions back that were already settled.
    isSocialAuth: state.isSocialAuth,
    socialProvidedName: state.socialProvidedName,
    wasEmailRegistered: state.wasEmailRegistered,
    hasCompletedPinSetup: state.hasCompletedPinSetup,
  };
}

// MARK: - Draft

/**
 * Reads what the device already knows about onboarding, before the first frame
 * routes anywhere: whether a run was left unfinished, and whether one ever
 * finished here. Both answers change which screen the user lands on.
 */
export function restoreOnboardingDraft(): void {
  useOnboardingStore.setState({
    hasCompletedOnboarding: readOnboardingCompleted(),
    hasSeenHandoff: readHandoffSeen(),
  });

  const draft = readDraft();
  if (draft === null) return;

  useOnboardingStore.setState({
    isFlowActive: true,
    currentStep: draft.currentStep ?? INITIAL_STATE.currentStep,
    firstName: draft.firstName ?? INITIAL_STATE.firstName,
    currency: draft.currency ?? INITIAL_STATE.currency,
    monthlyIncome: draft.monthlyIncome ?? null,
    housingCosts: draft.housingCosts ?? null,
    healthInsurance: draft.healthInsurance ?? null,
    phonePlan: draft.phonePlan ?? null,
    transportCosts: draft.transportCosts ?? null,
    leasingCredit: draft.leasingCredit ?? null,
    customTransactions: draft.customTransactions ?? [],
    // The account outlives the process. Left to default, a resumed run came
    // back anonymous and `registration` became navigable again — so back from
    // the step the app died on landed on "Créer mon compte", for an address
    // that already had an account and could only answer that it did.
    isSocialAuth: draft.isSocialAuth ?? false,
    socialProvidedName: draft.socialProvidedName ?? false,
    wasEmailRegistered: draft.wasEmailRegistered ?? false,
    hasCompletedPinSetup: draft.hasCompletedPinSetup ?? false,
  });
}

/** The welcome CTA: from here on the flow owns the router. */
export function beginOnboarding(): void {
  patch({ isFlowActive: true });
  goToNextStep();
}

/**
 * The run is over and the account is set up. The draft goes, the completion
 * flag stays — it is the only thing left to tell a returning user apart from a
 * fresh install.
 */
export function completeOnboarding(): void {
  writeOnboardingCompleted();
  clearDraft();
  useOnboardingStore.setState({
    ...INITIAL_STATE,
    ...deviceFlags(),
    hasCompletedOnboarding: true,
  });
}

/** The handoff has been read. Nothing routes through it again on this device. */
export function acknowledgeHandoff(): void {
  writeHandoffSeen();
  useOnboardingStore.setState({ hasSeenHandoff: true });
}

/**
 * Nothing of this run survives: the flow starts from welcome next time. Leaves
 * the completion flag alone — abandoning a run says nothing about a run that
 * finished earlier.
 */
export function resetOnboarding(): void {
  clearDraft();
  useOnboardingStore.setState({ ...INITIAL_STATE, ...deviceFlags() });
}

// MARK: - Auth paths

/**
 * A Google signup starts from a blank slate. Wiping the draft first is what
 * keeps a half-finished e-mail attempt from bleeding its amounts into the
 * social one — restoring it happens at flow entry, before this runs.
 */
export function configureSocialUser(providedFirstName: string | null): void {
  clearDraft();
  useOnboardingStore.setState({
    ...INITIAL_STATE,
    ...deviceFlags(),
    isFlowActive: true,
    isSocialAuth: true,
    socialProvidedName:
      providedFirstName !== null && providedFirstName.length > 0,
    firstName: providedFirstName ?? "",
  });
  // Written straight away rather than at the first answer: the account already
  // exists at this point, and a run that died before the next step had no draft
  // to resume — which sent a signed-in user to the vault setup with no budget.
  writeDraft(toDraft(useOnboardingStore.getState()));
}

/** The account exists; the draft is what the rest of the flow builds on. */
export function configureEmailUser(): void {
  patch({
    isSocialAuth: false,
    socialProvidedName: false,
    wasEmailRegistered: true,
  });
}

export function markPinSetupCompleted(): void {
  patch({ hasCompletedPinSetup: true });
}

// MARK: - Answers

export function updateAnswers(answers: Partial<OnboardingAnswers>): void {
  patch(answers);
}

/** Not persisted, so it does not go through `patch`. */
export function setEmail(email: string): void {
  useOnboardingStore.setState({ email });
}

/**
 * Health insurance is a Swiss-only line in this flow, so an amount entered in
 * CHF is dropped when the user leaves it — it would otherwise persist invisibly
 * into a French budget where the field is not shown.
 */
export function selectCurrency(currency: SupportedCurrency): void {
  patch(
    currency === "CHF" ? { currency } : { currency, healthInsurance: null },
  );
}

// MARK: - Custom transactions

export function isSuggestionSelected(
  state: OnboardingState,
  suggestion: OnboardingTransaction,
): boolean {
  return state.customTransactions.some(
    (transaction) => transaction.id === suggestion.id,
  );
}

export function toggleSuggestion(suggestion: OnboardingTransaction): void {
  const { customTransactions } = useOnboardingStore.getState();
  const isSelected = customTransactions.some(
    (transaction) => transaction.id === suggestion.id,
  );

  if (isSelected) {
    patch({
      customTransactions: customTransactions.filter(
        (transaction) => transaction.id !== suggestion.id,
      ),
    });
    return;
  }
  addCustomTransaction(suggestion);
}

export function addCustomTransaction(transaction: OnboardingTransaction): void {
  const { customTransactions } = useOnboardingStore.getState();
  if (customTransactions.length >= MAX_CUSTOM_TRANSACTIONS) return;
  patch({ customTransactions: [...customTransactions, transaction] });
}

export function removeCustomTransaction(id: string): void {
  const { customTransactions } = useOnboardingStore.getState();
  patch({
    customTransactions: customTransactions.filter(
      (transaction) => transaction.id !== id,
    ),
  });
}

export function replaceCustomTransaction(
  transaction: OnboardingTransaction,
): void {
  const { customTransactions } = useOnboardingStore.getState();
  patch({
    customTransactions: customTransactions.map((existing) =>
      existing.id === transaction.id ? transaction : existing,
    ),
  });
}

// MARK: - Navigation

/**
 * Advances one visible step, or returns to the preview when the user came from
 * it to edit an answer. Returns false at the end of the flow — budget preview
 * has no next step, and its CTA submits instead.
 */
export function goToNextStep(): boolean {
  const state = useOnboardingStore.getState();

  if (state.editReturnStep !== null) {
    patch({ currentStep: state.editReturnStep, editReturnStep: null });
    return true;
  }

  const next = nextVisibleStep(state, state.currentStep);
  if (next === null) return false;

  patch({ currentStep: next });
  return true;
}

/**
 * Steps back one visible step, or cancels an edit round-trip. Landing back on
 * welcome counts as leaving the flow, so callers check `wouldExitOnBack` and
 * confirm before calling this.
 */
export function goToPreviousStep(): boolean {
  const state = useOnboardingStore.getState();

  if (state.editReturnStep !== null) {
    patch({ currentStep: state.editReturnStep, editReturnStep: null });
    return true;
  }

  const previous = previousVisibleStep(state, state.currentStep);
  if (previous === null) return false;

  patch({ currentStep: previous });
  return true;
}

/** Entry point for a user who authenticated on the welcome screen itself. */
export function startAfterWelcome(): void {
  const state = useOnboardingStore.getState();
  const next = nextVisibleStep(state, "welcome");
  if (next === null) return;
  patch({ currentStep: next });
}

/** Jumps to a step with a bookmark back to the preview that sent the user there. */
export function jumpToStepForEdit(step: OnboardingStep): void {
  patch({ currentStep: step, editReturnStep: "budgetPreview" });
}
