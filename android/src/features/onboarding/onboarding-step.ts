/**
 * The steps, in the order they are visited. The first seven mirror
 * `ios/Pulpe/Features/Onboarding/OnboardingStep.swift` one for one — same order,
 * same copy, same analytics names.
 *
 * `pinSetup` is the eighth, and Android's alone: it closes the flow rather than
 * asking a question. The client key is derived from the code chosen here, and
 * every amount the previous steps collected is encrypted under it before it
 * reaches the server. iOS runs the same ceremony outside its step enum, which is
 * why comparing the two funnels means comparing the seven, not the eight.
 *
 * `analyticsName` is the name each step *would* report under. Nothing emits it
 * yet: `core/observability/analytics.ts` captures screens only, and this flow is
 * one route, so today the whole of onboarding is a single screen event.
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

interface StepCopy {
  title: string;
  subtitle: string;
  /** PostHog name, snake_case and stable across reorderings. */
  analyticsName: string;
}

export const STEP_COPY: Record<OnboardingStep, StepCopy> = {
  welcome: {
    title: "Bienvenue",
    subtitle: "Reprends le contrôle de tes finances",
    analyticsName: "welcome",
  },
  firstName: {
    title: "Comment tu t'appelles ?",
    subtitle: "Juste ton prénom",
    analyticsName: "first_name",
  },
  registration: {
    title: "Crée ton compte",
    subtitle: "Pour retrouver tout ça sur tous tes appareils",
    analyticsName: "registration",
  },
  income: {
    title: "Tes revenus",
    subtitle: "Ce qui tombe sur ton compte chaque mois",
    analyticsName: "income",
  },
  charges: {
    title: "Tes dépenses",
    subtitle: "Renseigne ce que tu connais — le reste peut attendre",
    analyticsName: "charges",
  },
  savings: {
    title: "Ton épargne",
    subtitle: "Ce que tu mets de côté chaque mois",
    analyticsName: "savings",
  },
  budgetPreview: {
    title: "Ton budget",
    subtitle: "Voici ce que ça donne",
    analyticsName: "budget_preview",
  },
  pinSetup: {
    title: "Choisis ton code",
    subtitle: "Tes montants sont chiffrés avec ce code",
    analyticsName: "pin_setup",
  },
};

/** Steps the user may skip outright. */
export function isOptionalStep(step: OnboardingStep): boolean {
  return step === "charges" || step === "savings";
}

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}
