import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { SupportedCurrency } from "pulpe-shared";
import { BudgetFormulas, CURRENCY_METADATA } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import {
  formatAmount,
  formatCurrency,
  formatSignedCurrency,
} from "@/core/ui/amount-format";
import { useTranslation } from "@/core/i18n/locale-store";
import { HeroFigure, HeroProgress, HeroVerdict } from "@/core/ui/hero";
import { useHeroColors } from "@/core/ui/scheme-colors";
import {
  ICON_SIZE,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
  TOUCH_TARGET,
} from "@/core/ui/theme";

import { budgetUsagePercentage } from "../budget-details-selectors";

/** Amounts are shown to the centime, so that is the precision that counts. */
const CENTIMES_PER_UNIT = 100;

type Metrics = ReturnType<typeof BudgetFormulas.calculateAllMetrics>;

interface BudgetDetailHeroProps {
  metrics: Metrics;
  currency: SupportedCurrency;
  /** Non-zero when the month opened on last month's carry-over. */
  rollover: number;
  /** Names the month the carry-over came from, when that budget is known. */
  previousMonthName: string | null;
  onPressMetrics: () => void;
  /** Opens the month the carry-over came from, when there is one to open. */
  onPressRollover?: () => void;
}

/**
 * The month's state on the forest — `BudgetDetailHero.swift`: what is left to
 * spend, what it already includes from last month, how much of the month is
 * consumed, and one sentence that says what that means. The surface never
 * carries the state; the sentence and its accent do.
 */
export function BudgetDetailHero({
  metrics,
  currency,
  rollover,
  previousMonthName,
  onPressMetrics,
  onPressRollover,
}: BudgetDetailHeroProps) {
  const hero = useHeroColors();
  const { t } = useTranslation();
  const isDeficit = metrics.remaining < 0;
  const usagePercentage = budgetUsagePercentage(metrics);
  // Rounded to what the eye will read: a residual centime would print a
  // disclosure announcing an amount it then shows as zero.
  const hasRollover = Math.round(rollover * CENTIMES_PER_UNIT) !== 0;
  const state = BudgetFormulas.emotionState(metrics);
  const verdictTint =
    state === "comfortable"
      ? hero.positive
      : state === "tight"
        ? hero.caution
        : hero.deficit;
  const eyebrow = t(
    `budgets.detail.hero.${isDeficit ? "deficit" : "available"}`,
  );

  return (
    <View style={styles.hero}>
      <Pressable
        onPress={onPressMetrics}
        android_ripple={{ color: hero.tile }}
        style={styles.summary}
        accessibilityRole="button"
        accessibilityLabel={t("budgets.detail.hero.accessibility", {
          state: eyebrow,
          amount: formatCurrency(Math.abs(metrics.remaining), currency),
          percent: Math.round(usagePercentage),
        })}
      >
        <HeroFigure
          eyebrow={eyebrow}
          amount={signedAmount(metrics.remaining, currency)}
          currency={CURRENCY_METADATA[currency].symbol}
        />
      </Pressable>

      {hasRollover && (
        // The carry-over is the figure's second line: it says what the amount
        // above already includes, and it is the way to go and read that month.
        <Pressable
          style={styles.rollover}
          onPress={onPressRollover}
          android_ripple={{ color: hero.tile }}
          disabled={onPressRollover === undefined}
          accessibilityRole={onPressRollover === undefined ? undefined : "link"}
          accessibilityLabel={
            onPressRollover === undefined
              ? undefined
              : t("budgets.detail.hero.viewMonth", {
                  month:
                    previousMonthName ?? t("budgets.detail.hero.previousMonth"),
                })
          }
        >
          <MaterialCommunityIcons
            name="autorenew"
            size={ICON_SIZE.sm}
            color={hero.support}
          />
          <Text variant="labelLarge" style={{ color: hero.support }}>
            {previousMonthName === null
              ? t("budgets.detail.hero.rollover")
              : t("budgets.detail.hero.rolloverNamed", {
                  month: previousMonthName,
                })}
          </Text>
          <Text
            variant="labelLarge"
            style={[TABULAR_DIGITS, styles.rolloverAmount, { color: hero.ink }]}
          >
            {formatSignedCurrency(rollover, currency)}
          </Text>
          {onPressRollover !== undefined && (
            <MaterialCommunityIcons
              name="chevron-right"
              size={ICON_SIZE.sm}
              color={hero.support}
            />
          )}
        </Pressable>
      )}

      <HeroProgress
        progress={usagePercentage / 100}
        label={`${Math.round(usagePercentage)} %`}
      />

      <HeroVerdict
        sentence={t(`budgets.detail.hero.verdict.${state}`)}
        tint={verdictTint}
      />
    </View>
  );
}

/** The hero's shape before its numbers, on the forest it will land on. */
export function BudgetDetailSkeleton() {
  const hero = useHeroColors();
  const { t } = useTranslation();
  const tone = { backgroundColor: hero.tile };

  return (
    <View
      style={styles.hero}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("common.loading")}
    >
      <View style={[styles.bone, styles.boneEyebrow, tone]} />
      <View style={[styles.bone, styles.boneFigure, tone]} />
      <View style={[styles.bone, styles.boneBar, tone]} />
      <View style={[styles.bone, styles.boneSentence, tone]} />
    </View>
  );
}

/**
 * A `+` only where it adds meaning: a negative amount already reads as one.
 * Decimals, always — this is the screen where a line is being edited, and a
 * hero that rounds forty centimes to `+0` announces a sign with nothing after
 * it. The rule iOS keeps on the same screen.
 */
function signedAmount(value: number, currency: SupportedCurrency): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatAmount(Math.abs(value), currency)}`;
}

const styles = StyleSheet.create({
  hero: { gap: SPACING.sm },
  summary: { alignSelf: "stretch" },
  // A link that navigates to another month owes the finger the same floor
  // every other control keeps.
  rollover: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACING.xs,
    minHeight: TOUCH_TARGET,
  },
  rolloverAmount: { fontWeight: "700" },
  bone: { borderRadius: RADIUS.sm },
  boneEyebrow: { width: 140, height: 14 },
  boneFigure: { width: 200, height: 48 },
  boneBar: { alignSelf: "stretch", height: 10, marginTop: SPACING.sm },
  boneSentence: { width: 220, height: 18, marginTop: SPACING.sm },
});
