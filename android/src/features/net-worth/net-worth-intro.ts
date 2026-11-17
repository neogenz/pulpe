/**
 * Content of the « Mon patrimoine » explainer, kept apart from the sheet so
 * every figure and every button choice is tested without rendering. iOS and
 * the web tell the same story with the same numbers.
 */
export const INTRO_STEPS = ["overview", "netWorth", "update"] as const;
export type IntroStep = (typeof INTRO_STEPS)[number];

export type IntroSource = "auto" | "help";
export type IntroAction = "next" | "done" | "add";

export const INTRO_SAMPLE = {
  assets: [
    {
      labelKey: "netWorth.intro.sample.checking",
      icon: "bank-outline",
      value: 3200,
    },
    {
      labelKey: "netWorth.intro.sample.savings",
      icon: "piggy-bank-outline",
      value: 12000,
    },
    {
      labelKey: "netWorth.intro.sample.investments",
      icon: "trending-up",
      value: 8000,
    },
    { labelKey: "netWorth.intro.sample.car", icon: "car-outline", value: 9000 },
  ],
  debt: 6000,
  savingsBefore: 12000,
  savingsAfter: 12500,
  budgetSuggestion: 500,
} as const;

export interface IntroTotals {
  gross: number;
  netBefore: number;
  netAfter: number;
}

/** Derived from the sample lines, so the scene can never contradict itself. */
export function introTotals(sample: typeof INTRO_SAMPLE): IntroTotals {
  const gross = sample.assets.reduce((sum, line) => sum + line.value, 0);
  const netBefore = gross - sample.debt;
  return {
    gross,
    netBefore,
    netAfter: netBefore - sample.savingsBefore + sample.savingsAfter,
  };
}

/** « Suivant » until the last step; there, an empty net worth gets « Ajouter mon premier compte ». */
export function primaryAction(
  stepIndex: number,
  isEmpty: boolean,
): IntroAction {
  if (stepIndex < INTRO_STEPS.length - 1) return "next";
  return isEmpty ? "add" : "done";
}

/** Where a rolling counter stands at `progress` (0 → 1), eased out so it lands softly. */
export function countAt(from: number, to: number, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  const eased = 1 - (1 - clamped) ** 3;
  return Math.round(from + (to - from) * eased);
}
