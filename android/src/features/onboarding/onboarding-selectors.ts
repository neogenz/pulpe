import { BudgetFormulas, type EmotionState } from "pulpe-shared";

import { type OnboardingStep, ONBOARDING_STEPS } from "./onboarding-step";
import type { OnboardingState } from "./onboarding-store";

/**
 * Derived reads over the onboarding state. They take the state rather than
 * calling the store so a component can subscribe to the slices it needs and so
 * every one of them is testable without a store instance — mirrors the computed
 * properties on `OnboardingState.swift`.
 */

/** The fixed charges, in the order the preview lists them. */
export interface FixedChargeLine {
  label: string;
  amount: number;
}

/**
 * Whether the step is counted by the progress bar. Stable for the whole flow:
 * an e-mail user keeps seeing registration in the count after signing up rather
 * than watching the total shrink under them.
 */
export function isStepInProgressBar(
  state: OnboardingState,
  step: OnboardingStep,
): boolean {
  switch (step) {
    case "welcome":
      return false;
    case "firstName":
      return !(state.isSocialAuth && state.socialProvidedName);
    case "registration":
      return !state.isSocialAuth;
    // The ceremony that closes the flow, not one of the questions it counts.
    case "pinSetup":
      return false;
    default:
      return true;
  }
}

/**
 * Whether navigation should stop on the step. Stricter than the progress bar:
 * an authenticated user never lands on registration even though it is still
 * counted.
 */
export function isStepNavigable(
  state: OnboardingState,
  step: OnboardingStep,
): boolean {
  switch (step) {
    case "welcome":
      return true;
    case "firstName":
      return !(state.isSocialAuth && state.socialProvidedName);
    case "registration":
      return !state.isAuthenticated;
    // Asking for the code a second time would be asking the user to invent a
    // second one — the vault already holds the key derived from the first.
    case "pinSetup":
      return !state.hasCompletedPinSetup;
    default:
      return true;
  }
}

export function progressBarSteps(state: OnboardingState): OnboardingStep[] {
  return ONBOARDING_STEPS.filter((step) => isStepInProgressBar(state, step));
}

export function nextVisibleStep(
  state: OnboardingState,
  after: OnboardingStep,
): OnboardingStep | null {
  const following = ONBOARDING_STEPS.slice(ONBOARDING_STEPS.indexOf(after) + 1);
  return following.find((step) => isStepNavigable(state, step)) ?? null;
}

export function previousVisibleStep(
  state: OnboardingState,
  before: OnboardingStep,
): OnboardingStep | null {
  const preceding = ONBOARDING_STEPS.slice(
    0,
    ONBOARDING_STEPS.indexOf(before),
  ).reverse();
  return preceding.find((step) => isStepNavigable(state, step)) ?? null;
}

/** Back from here lands on welcome, which the flow treats as leaving it. */
export function wouldExitOnBack(state: OnboardingState): boolean {
  return previousVisibleStep(state, state.currentStep) === "welcome";
}

export function isFirstNameValid(state: OnboardingState): boolean {
  return state.firstName.trim().length > 0;
}

export function isIncomeValid(state: OnboardingState): boolean {
  return state.monthlyIncome !== null && state.monthlyIncome > 0;
}

/** Whether the CTA of the current step may advance the flow. */
export function canProceed(state: OnboardingState): boolean {
  switch (state.currentStep) {
    case "firstName":
      return isFirstNameValid(state);
    case "income":
      return isIncomeValid(state);
    default:
      return true;
  }
}

/**
 * The single source of truth for which fixed charges exist — `totalCharges`
 * reads it too, so adding a field here is enough to make it count.
 */
export function fixedChargeLines(state: OnboardingState): FixedChargeLine[] {
  return [
    { label: "Loyer", amount: state.housingCosts },
    { label: "Assurance maladie", amount: state.healthInsurance },
    { label: "Forfait téléphone", amount: state.phonePlan },
    { label: "Transport", amount: state.transportCosts },
    { label: "Leasing / crédit", amount: state.leasingCredit },
  ].filter(
    (line): line is FixedChargeLine => line.amount !== null && line.amount > 0,
  );
}

function sumOfKind(
  state: OnboardingState,
  kind: "income" | "expense" | "saving",
): number {
  return state.customTransactions
    .filter((transaction) => transaction.type === kind)
    .reduce((total, transaction) => total + transaction.amount, 0);
}

export function totalCustomIncome(state: OnboardingState): number {
  return sumOfKind(state, "income");
}

export function totalCharges(state: OnboardingState): number {
  const fixedTotal = fixedChargeLines(state).reduce(
    (total, line) => total + line.amount,
    0,
  );
  return fixedTotal + sumOfKind(state, "expense");
}

export function totalSavings(state: OnboardingState): number {
  return sumOfKind(state, "saving");
}

export function totalExpenses(state: OnboardingState): number {
  return totalCharges(state) + totalSavings(state);
}

export function totalIncome(state: OnboardingState): number {
  return (state.monthlyIncome ?? 0) + totalCustomIncome(state);
}

export function availableToSpend(state: OnboardingState): number {
  return totalIncome(state) - totalExpenses(state);
}

/**
 * The same three-state health the dashboard hero uses, so the preview and the
 * app that follows it are tinted by one formula. Onboarding has no previous
 * month, hence `rollover: 0`.
 */
export function emotionState(state: OnboardingState): EmotionState {
  return BudgetFormulas.emotionState({
    remaining: availableToSpend(state),
    totalIncome: totalIncome(state),
    totalExpenses: totalExpenses(state),
    rollover: 0,
  });
}
