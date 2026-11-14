import {
  trendBalance,
  type BalanceTrajectory,
  type SupportedCurrency,
} from "pulpe-shared";
import type { TranslateOptions } from "i18n-js";

import { formatCompactCurrency } from "@/core/ui/amount-format";
import { formatDayMonth } from "@/core/ui/date-format";

/** Mirror of `DesignTokens.Chart.trendPriorDays` on iOS. */
const TREND_PRIOR_DAYS = 7;

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

export interface RhythmSentenceInput {
  trajectory: BalanceTrajectory;
  periodEnd: Date;
  currency: SupportedCurrency;
  amountsHidden: boolean;
}

/**
 * Where the month lands if it keeps its pace, against what the plan kept: the
 * sentence that follows the verdict. `null` on the period's last day (nothing
 * left to project) or when the pace lands exactly on the plan. Under the
 * privacy mode it keeps the direction and drops both figures. Port of
 * `HomeHeroCard.rhythmSentence` in Swift.
 */
export function rhythmSentence(
  t: Translate,
  locale: string,
  { trajectory, periodEnd, currency, amountsHidden }: RhythmSentenceInput,
): string | null {
  if (trajectory.today >= trajectory.totalDays || trajectory.real.length === 0)
    return null;
  const landing = toCents(trendBalance(trajectory, TREND_PRIOR_DAYS));
  const planned = toCents(trajectory.plannedBalance);
  if (landing === planned) return null;

  const date = formatDayMonth(periodEnd, locale);
  if (amountsHidden) {
    return t(
      landing < planned
        ? "home.hero.rhythm.lessHidden"
        : "home.hero.rhythm.moreHidden",
      { date },
    );
  }
  return t("home.hero.rhythm.pace", {
    amount: formatCompactCurrency(landing / 100, currency),
    date,
    planned: formatCompactCurrency(planned / 100, currency),
  });
}

/** Compared in whole cents: two floats a rounding apart are the same landing. */
function toCents(value: number): number {
  return Math.round(value * 100);
}
