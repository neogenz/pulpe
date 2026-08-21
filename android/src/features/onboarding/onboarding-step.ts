/**
 * The steps, in the order they are visited. The first seven mirror
 * `ios/Pulpe/Features/Onboarding/OnboardingStep.swift` one for one — same order,
 * same analytics names.
 *
 * `pinSetup` is the eighth, and Android's alone: it closes the flow rather than
 * asking a question. The client key is derived from the code chosen here, and
 * every amount the previous steps collected is encrypted under it before it
 * reaches the server. iOS runs the same ceremony outside its step enum, which is
 * why comparing the two funnels means comparing the seven, not the eight.
 *
 * The mapping below is the value each step reports as the `step` property of
 * `onboarding_step_completed` — a property value, not an event name, which is
 * why it lives here rather than in the shared catalogue. `onboarding-analytics.ts`
 * is what sends it.
 */
export const ONBOARDING_STEPS = [
  "welcome",
  "firstName",
  "registration",
  "income",
  "charges",
  "savings",
  "budgetPreview",
  "pinSetup",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** PostHog names, snake_case and stable across reorderings. */
export const STEP_ANALYTICS_NAMES: Record<OnboardingStep, string> = {
  welcome: "welcome",
  firstName: "first_name",
  registration: "registration",
  income: "income",
  charges: "charges",
  savings: "savings",
  budgetPreview: "budget_preview",
  pinSetup: "pin_setup",
};
