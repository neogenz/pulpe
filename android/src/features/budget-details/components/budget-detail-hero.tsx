import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { SupportedCurrency } from "pulpe-shared";
import { BudgetFormulas, CURRENCY_METADATA } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { formatAmount } from "@/core/ui/amount-format";
import { useTranslation } from "@/core/i18n/locale-store";
import { useFinancialColors, useHeroColors } from "@/core/ui/scheme-colors";
import {
  BRAND_TYPE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
  TOUCH_TARGET,
} from "@/core/ui/theme";

import { MonthSplit } from "./month-split";

/** Amounts are shown to the centime, so that is the precision that counts. */
const CENTIMES_PER_UNIT = 100;

type Metrics = ReturnType<typeof BudgetFormulas.calculateAllMetrics>;

interface BudgetDetailHeroProps {
  metrics: Metrics;
  currency: SupportedCurrency;
  /** Non-zero when the month opened on last month's carry-over. */
  rollover: number;
  /**
   * The month before, named, when this one has not started: the figure is a
   * projection and its carry-over an estimate.
   */
  projectedReportMonth: string | null;
  /** Opens « Le calcul ». */
  onPressCalculation: () => void;
  /** Opens the month the carry-over came from, when there is one to open. */
  onPressRollover?: () => void;
}

/**
 * The month's state on a white card — `BudgetDetailHero.swift`: what is left to
 * spend, to the cent, the carry-over it already includes, then where the money
 * goes in one split bar. The figure turns ocre only when the month is over its
 * plan.
 */
export function BudgetDetailHero({
  metrics,
  currency,
  rollover,
  projectedReportMonth,
  onPressCalculation,
  onPressRollover,
}: BudgetDetailHeroProps) {
  const hero = useHeroColors();
  const theme = useTheme();
  const financial = useFinancialColors();
  const { t } = useTranslation();
  // Rounded to what the eye will read: a residual centime would print a
  // disclosure announcing an amount it then shows as zero.
  const hasRollover = Math.round(rollover * CENTIMES_PER_UNIT) !== 0;
  const eyebrow = t(
    projectedReportMonth === null
      ? "budgets.detail.hero.available"
      : "budgets.detail.hero.availableProjected",
  );
  const rolloverAmount = formatAmount(rollover, currency);

  return (
    <View style={styles.hero}>
      <View style={styles.header}>
        <Text
          variant="labelLarge"
          style={[styles.eyebrow, { color: hero.support }]}
        >
          {eyebrow}
        </Text>
        <Pressable
          onPress={onPressCalculation}
          android_ripple={{ color: hero.tile }}
          style={styles.link}
          accessibilityRole="link"
          accessibilityHint={t("budgets.detail.hero.calculationHint")}
          testID="budget-calculation-link"
        >
          <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
            {t("budgets.detail.hero.calculation")}
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={ICON_SIZE.md}
            color={theme.colors.primary}
          />
        </Pressable>
      </View>

      <Text
        accessibilityLabel={`${eyebrow} ${formatAmount(metrics.remaining, currency)} ${CURRENCY_METADATA[currency].symbol}`}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={[
          BRAND_TYPE.heroFigure,
          TABULAR_DIGITS,
          {
            color: metrics.remaining < 0 ? financial.overBudget : hero.ink,
          },
        ]}
      >
        {formatAmount(metrics.remaining, currency)}
        <Text style={[BRAND_TYPE.heroCurrency, { color: hero.support }]}>
          {` ${CURRENCY_METADATA[currency].symbol}`}
        </Text>
      </Text>

      {hasRollover && (
        // The carry-over is the figure's second line: it says what the amount
        // above already includes, and it is the way to go and read that month.
        <Pressable
          style={styles.rollover}
          onPress={onPressRollover}
          android_ripple={{ color: hero.tile }}
          disabled={onPressRollover === undefined}
          accessibilityRole={onPressRollover === undefined ? undefined : "link"}
          accessibilityHint={
            onPressRollover === undefined
              ? undefined
              : t("budgets.detail.hero.viewPrevious")
          }
        >
          <Text
            variant="labelLarge"
            style={[
              TABULAR_DIGITS,
              {
                color:
                  onPressRollover === undefined
                    ? hero.support
                    : theme.colors.primary,
              },
            ]}
          >
            {projectedReportMonth === null
              ? t("budgets.detail.hero.rolloverIncluded", {
                  amount: rolloverAmount,
                })
              : t("budgets.detail.hero.rolloverEstimated", {
                  month: projectedReportMonth,
                  amount: rolloverAmount,
                })}
          </Text>
        </Pressable>
      )}

      {/* Savings are counted inside `totalExpenses`: the expense part is what
          is left of it. */}
      <MonthSplit
        expenses={metrics.totalExpenses - metrics.totalSavings}
        savings={metrics.totalSavings}
        available={metrics.remaining}
        currency={currency}
      />
    </View>
  );
}

/** The hero's shape before its numbers. */
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
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: SPACING.sm },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  eyebrow: { flex: 1 },
  // A link owes the finger the same floor every other control keeps, and
  // sits flush right without growing the header past it.
  link: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: TOUCH_TARGET,
    marginVertical: -SPACING.sm,
    paddingLeft: SPACING.sm,
  },
  rollover: { minHeight: TOUCH_TARGET, justifyContent: "center" },
  bone: { borderRadius: RADIUS.sm },
  boneEyebrow: { width: 140, height: 14 },
  boneFigure: { width: 200, height: 48 },
  boneBar: { alignSelf: "stretch", height: 10, marginTop: SPACING.sm },
});
