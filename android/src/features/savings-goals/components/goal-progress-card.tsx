import {
  CURRENCY_METADATA,
  type SavingsGoalProgress,
  type SupportedCurrency,
} from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import {
  formatCompactAmount,
  formatCompactCurrency,
} from "@/core/ui/amount-format";
import { formatIsoDate } from "@/core/ui/date-format";
import { HeroFigure, HeroTile, HeroTileRow, HeroVerdict } from "@/core/ui/hero";
import { useHeroColors } from "@/core/ui/scheme-colors";
import { RADIUS, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

import {
  confirmedFraction,
  currentMonthPlannedAmount,
  hasClosedPlanMonth,
  plannedFraction,
  requiredMatchesPlannedPace,
} from "../goals-vm";

const PROGRESS_HEIGHT = 8;
const PERCENT = 100;

interface GoalProgressCardProps {
  progress: SavingsGoalProgress;
  currency: SupportedCurrency;
  /** The span or the deadline, already worded. */
  period: string | null;
}

/**
 * Where a goal stands, on the forest — `GoalProgressHero.swift`: what is
 * confirmed against what it aims at, the plan behind it, and whether the pace
 * holds.
 *
 * The pace verdict stays silent until a plan month has closed — judging a goal
 * created this morning on a month nobody has lived yet would be noise. Until
 * then the hero says what to put aside now, which is the only actionable thing
 * on day one.
 */
export function GoalProgressCard({
  progress,
  currency,
  period,
}: GoalProgressCardProps) {
  const hero = useHeroColors();
  const { locale, t } = useTranslation();

  const isJudgeable = hasClosedPlanMonth(progress.months);
  const currentPlanned = currentMonthPlannedAmount(progress.months);
  const confirmed = confirmedFraction(progress) ?? 0;
  const planned = plannedFraction(progress) ?? 0;
  const paceTint = progress.paceStatus === "ahead" ? hero.positive : hero.ink;
  const verdict =
    progress.paceStatus !== null && isJudgeable
      ? t(`goals.progress.pace.${progress.paceStatus}`)
      : currentPlanned !== null
        ? t("goals.progress.planReady", {
            amount: formatCompactCurrency(currentPlanned, currency),
          })
        : null;
  const advice =
    progress.required !== null &&
    isJudgeable &&
    !requiredMatchesPlannedPace(progress.pace, progress.required)
      ? t(
          progress.targetDate === null
            ? "goals.progress.paceAdvice"
            : "goals.progress.paceAdviceDate",
          {
            pace: formatCompactCurrency(progress.pace, currency),
            required: formatCompactCurrency(progress.required, currency),
            date:
              progress.targetDate === null
                ? ""
                : formatIsoDate(progress.targetDate, locale),
          },
        )
      : null;

  return (
    <View style={styles.hero}>
      <View style={styles.identity}>
        <HeroFigure
          eyebrow={t("goals.progress.saved")}
          amount={formatCompactAmount(progress.confirmed, currency)}
          currency={CURRENCY_METADATA[currency].symbol}
          suffix={
            progress.targetAmount === null
              ? undefined
              : t("goals.progress.ofTarget", {
                  amount: formatCompactCurrency(
                    progress.targetAmount,
                    currency,
                  ),
                })
          }
        />
        {period !== null && (
          <Text variant="bodyMedium" style={{ color: hero.support }}>
            {period}
          </Text>
        )}
        {progress.initialAmount > 0 && (
          <Text variant="bodyMedium" style={{ color: hero.support }}>
            {`${t("goals.progress.initial")} · ${formatCompactCurrency(progress.initialAmount, currency)}`}
          </Text>
        )}
      </View>

      {progress.targetAmount !== null && (
        <View
          style={styles.progressRow}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t("goals.progress.achievementAccessibility", {
            percent: progress.achievementPercent ?? 0,
          })}
        >
          {/* Two layers: the plan behind, what is actually confirmed in
              front — so the gap between them is the plan still to come. */}
          <View style={[styles.track, { backgroundColor: hero.tile }]}>
            <View
              style={[
                styles.fill,
                { backgroundColor: hero.muted, width: `${planned * PERCENT}%` },
              ]}
            />
            <View
              style={[
                styles.fill,
                styles.front,
                {
                  backgroundColor: hero.support,
                  width: `${confirmed * PERCENT}%`,
                },
              ]}
            />
          </View>
          <Text
            variant="titleSmall"
            style={[TABULAR_DIGITS, { color: hero.support }]}
          >
            {`${progress.achievementPercent ?? 0} %`}
          </Text>
        </View>
      )}

      <HeroTileRow>
        <HeroTile
          value={formatCompactCurrency(progress.plannedCumulative, currency)}
          label={t("goals.progress.planned")}
        />
        <HeroTile
          value={formatCompactCurrency(progress.plannedProjection, currency)}
          label={t("goals.progress.projection")}
        />
      </HeroTileRow>

      {verdict !== null && <HeroVerdict sentence={verdict} tint={paceTint} />}

      {progress.required !== null &&
        isJudgeable &&
        requiredMatchesPlannedPace(progress.pace, progress.required) && (
          <Text variant="bodyMedium" style={{ color: hero.support }}>
            {`${t("goals.progress.required")} · ${t("goals.progress.perMonth", {
              amount: formatCompactCurrency(progress.required, currency),
            })}`}
          </Text>
        )}
      {advice !== null && (
        <Text variant="bodyMedium" style={{ color: hero.support }}>
          {advice}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: SPACING.md },
  identity: { gap: SPACING.xs },
  progressRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  track: {
    flex: 1,
    height: PROGRESS_HEIGHT,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: RADIUS.full,
  },
  front: { zIndex: 1 },
});
