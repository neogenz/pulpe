import { ANALYTICS_EVENTS } from "pulpe-shared";

import { captureEvent } from "@/core/observability/analytics";

import {
  fixedChargeLines,
  hasAccount,
  progressBarSteps,
} from "./onboarding-selectors";
import type { OnboardingState } from "./onboarding-state";
import { STEP_ANALYTICS_NAMES, type OnboardingStep } from "./onboarding-step";

/**
 * The onboarding funnel, under the names `shared/src/feature-flags.ts` already
 * publishes — the same seven events iOS emits, so the two apps can be read side
 * by side rather than each in its own dashboard.
 *
 * Nothing here carries an amount. The dimensions are which step, how far along,
 * and which of the two signup paths; `captureEvent` drops anything financial
 * that slips through, and a test proves it.
 *
 * `pin_setup_completed` is Android's alone in this flow. iOS runs the same
 * ceremony outside its step enum, which is why comparing the two funnels means
 * comparing the seven steps and not the eight.
 */

/** A run emits each of these once. Cleared when a run ends, in either direction. */
let hasEmittedStarted = false;
let hasEmittedResumed = false;
let hasEmittedAbandoned = false;

/** Matches `login_completed.method` on every platform: `email | google | apple`. */
function authMethod(state: OnboardingState): string {
  return state.isSocialAuth ? "google" : "email";
}

export function resetOnboardingAnalytics(): void {
  hasEmittedStarted = false;
  hasEmittedResumed = false;
  hasEmittedAbandoned = false;
}

/** Leaving the welcome screen into the flow, by either signup path. */
export function captureOnboardingStarted(state: OnboardingState): void {
  if (hasEmittedStarted) return;
  hasEmittedStarted = true;
  captureEvent(ANALYTICS_EVENTS.ONBOARDING_STARTED, {
    method: authMethod(state),
  });
}

/**
 * A run picked back up from the draft on disk. `source` says which recovery
 * path found it — Android has one, iOS has two, and the property is what keeps
 * them comparable.
 */
export function captureOnboardingResumed(state: OnboardingState): void {
  if (hasEmittedResumed) return;
  hasEmittedResumed = true;
  // A resumed run has already started; emitting both would double the top of
  // the funnel for the one user who relaunched.
  hasEmittedStarted = true;
  captureEvent(ANALYTICS_EVENTS.ONBOARDING_RESUMED, {
    method: authMethod(state),
    source: "draft",
    resumed_at_step: STEP_ANALYTICS_NAMES[state.currentStep],
  });
}

/**
 * `state` is the state *before* the move, so `step` is the one being left.
 *
 * `step_index` is 1-based over the steps this path actually shows, and
 * `step_count` is how many that is — both carried on the event so a funnel
 * survives a future reordering of the flow, exactly as on iOS.
 */
export function captureStepCompleted(
  state: OnboardingState,
  step: OnboardingStep,
): void {
  const bar = progressBarSteps(state);
  captureEvent(ANALYTICS_EVENTS.ONBOARDING_STEP_COMPLETED, {
    step: STEP_ANALYTICS_NAMES[step],
    step_index: bar.indexOf(step) + 1,
    step_count: bar.length,
    auth_method: authMethod(state),
  });
}

/** The account now exists, by the path named. */
export function captureSignupCompleted(method: "email" | "google"): void {
  captureEvent(ANALYTICS_EVENTS.SIGNUP_COMPLETED, { method });
}

export function capturePinSetupCompleted(): void {
  captureEvent(ANALYTICS_EVENTS.PIN_SETUP_COMPLETED);
}

/**
 * The end of the funnel: the answers became a template and a budget.
 *
 * The two counts say how many lines the user started with, never what they were
 * worth — which is the same line iOS draws, and the reason they survive the
 * property filter.
 */
export function captureFirstBudgetCreated(state: OnboardingState): void {
  captureEvent(ANALYTICS_EVENTS.FIRST_BUDGET_CREATED, {
    signup_method: authMethod(state),
    // Onboarding never asks for one; the pay cycle is a settings question.
    has_pay_day: false,
    charges_count: fixedChargeLines(state).length,
    custom_transactions_count: state.customTransactions.length,
  });
}

/**
 * The user confirmed the exit dialog. Only that: an app killed from the task
 * switcher leaves no event, since nothing runs to send one — iOS catches that
 * case on `background`, which has no Android equivalent that is worth a
 * lifecycle listener here.
 */
export function captureOnboardingAbandoned(state: OnboardingState): void {
  if (hasEmittedAbandoned) return;
  hasEmittedAbandoned = true;
  captureEvent(ANALYTICS_EVENTS.ONBOARDING_ABANDONED, {
    last_step: STEP_ANALYTICS_NAMES[state.currentStep],
    exit_method: "quit_button",
    was_authenticated: hasAccount(state),
    auth_method: authMethod(state),
  });
}
