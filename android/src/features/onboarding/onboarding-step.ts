/**
 * The seven steps, in the order they are visited. Mirrors
 * `ios/Pulpe/Features/Onboarding/OnboardingStep.swift` — same order, same copy,
 * same analytics names, so the two funnels are comparable.
 */
export const ONBOARDING_STEPS = [
  "welcome",
  "firstName",
  "registration",
  "income",
  "charges",
  "savings",
  "budgetPreview",
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
};

/** Steps the user may skip outright. */
export function isOptionalStep(step: OnboardingStep): boolean {
  return step === "charges" || step === "savings";
}

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}
