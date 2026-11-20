import type { BalanceTrajectory, SupportedCurrency } from "pulpe-shared";
import type { TranslateOptions } from "i18n-js";

import {
  formatAdaptiveCurrency,
  formatCompactCurrency,
} from "@/core/ui/amount-format";
import { formatDayMonth } from "@/core/ui/date-format";

import { chartProjection, showsTrendLabel } from "./balance-chart-scale";
import { toCents } from "./balance-scrub";
import type { TrendedTrajectory } from "./current-month-view-model";

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
  trajectory: TrendedTrajectory;
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
  if (chartProjection(trajectory).length === 0) return null;
  // Compared in whole cents: two floats a rounding apart are the same landing.
  const landing = toCents(trajectory.trend);
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

export interface ChartAccessibilityInput {
  trajectory: TrendedTrajectory;
  currency: SupportedCurrency;
  amountsHidden: boolean;
}

/**
 * What a screen reader says about the plot, in the drawing's own order: what
 * the period opened with, what the plan keeps, what is really left today, and
 * where the month lands if it carries on. Self-contained sentences joined by a
 * space, each translated whole. Port of `chartAccessibilityLabel` in Swift.
 */
export function chartAccessibilityLabel(
  t: Translate,
  { trajectory, currency, amountsHidden }: ChartAccessibilityInput,
): string {
  if (amountsHidden) return t("home.hero.chart.accessibility.hidden");
  const real = trajectory.real[trajectory.real.length - 1]?.balance ?? 0;
  const spoken = [
    t("home.hero.chart.accessibility.plannedAvailable", {
      amount: formatAdaptiveCurrency(trajectory.plannedAvailable, currency),
    }),
    t("home.hero.chart.accessibility.plannedEnd", {
      amount: formatAdaptiveCurrency(trajectory.plannedBalance, currency),
    }),
    t("home.hero.chart.accessibility.realToday", {
      amount: formatAdaptiveCurrency(real, currency),
    }),
  ];
  if (showsTrendLabel(trajectory)) {
    spoken.push(
      t("home.hero.chart.accessibility.trend", {
        amount: formatCompactCurrency(trajectory.trend, currency),
      }),
    );
  }
  return spoken.join(" ");
}
