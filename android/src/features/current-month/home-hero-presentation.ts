import type { BalanceTrajectory, SupportedCurrency } from "pulpe-shared";
import type { TranslateOptions } from "i18n-js";

import { formatSignedCompactCurrency } from "@/core/ui/amount-format";
import { formatDayMonth } from "@/core/ui/date-format";

/**
 * What the hero says about the month, kept apart from how it is drawn. Port of
 * `HomeHeroCard.PresentationState` in Swift: the two apps have to reach the
 * same verdict from the same two numbers, and a sentence assembled inside a
 * view is a sentence no test can read.
 */
export type HeroVerdict = "gain" | "overrun" | "onPlan";
export type HeroTone = "favorable" | "caution" | "deficit";
type Translate = (key: string, options?: TranslateOptions) => string;

export interface HeroPresentation {
  plannedBalance: number;
  estimatedBalance: number;
  variance: number;
  verdict: HeroVerdict;
  tone: HeroTone;
  /** The day the month left its plan, or null when it never did. */
  driftDate: Date | null;
  /** Whether an envelope overrun was paid for elsewhere in the month. */
  absorbsEnvelopeOverrun: boolean;
}

export interface HeroPresentationInput {
  estimatedBalance: number;
  /**
   * Read only when there is no trajectory to take the plan's own origin from —
   * a period the chart cannot draw because today falls outside it.
   */
  fallbackPlannedBalance: number;
  trajectory: BalanceTrajectory | null;
}

export function heroPresentation({
  estimatedBalance,
  fallbackPlannedBalance,
  trajectory,
}: HeroPresentationInput): HeroPresentation {
  const plannedBalance = trajectory?.plannedBalance ?? fallbackPlannedBalance;
  const variance = estimatedBalance - plannedBalance;
  const verdict: HeroVerdict =
    variance > 0 ? "gain" : variance < 0 ? "overrun" : "onPlan";

  return {
    plannedBalance,
    estimatedBalance,
    variance,
    verdict,
    tone:
      estimatedBalance < 0 ? "deficit" : variance < 0 ? "caution" : "favorable",
    driftDate: trajectory?.driftDate ?? null,
    // A month landing exactly on plan absorbed the overrun just as surely as
    // one landing above it; only a month behind its own plan left it uncovered.
    absorbsEnvelopeOverrun: verdict !== "overrun",
  };
}

/**
 * The one thing the chart cannot draw and the metrics cannot show: *when* the
 * month left its plan. The size of the gap is in `vs prévu` and its shape is in
 * the line, so repeating either here would waste the sentence.
 */
export function verdictSentence(
  t: Translate,
  locale: string,
  presentation: HeroPresentation,
): string {
  switch (presentation.verdict) {
    case "onPlan":
      return t("home.hero.verdict.onPlan");
    case "overrun":
      return datedVerdict(t, locale, "overrun", presentation.driftDate);
    case "gain":
      return datedVerdict(t, locale, "gain", presentation.driftDate);
  }
}

/**
 * Carries its unit even though the hero above already shows one: its neighbour
 * on the row is a count of operations, and two figures in the same type have
 * nothing else to say which of them is money.
 */
export function varianceLabel(
  presentation: HeroPresentation,
  currency: SupportedCurrency,
): string {
  return formatSignedCompactCurrency(presentation.variance, currency);
}

function datedVerdict(
  t: Translate,
  locale: string,
  verdict: "gain" | "overrun",
  driftDate: Date | null,
): string {
  return driftDate === null
    ? t(`home.hero.verdict.${verdict}`)
    : t(`home.hero.verdict.${verdict}Dated`, {
        date: formatDayMonth(driftDate, locale),
      });
}
