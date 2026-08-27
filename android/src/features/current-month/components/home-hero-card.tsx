import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  CURRENCY_METADATA,
  type BalanceTrajectory,
  type BudgetPeriodDates,
  type SupportedCurrency,
} from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

import { hapticCommit } from "@/core/ui/haptics";
import { Amount } from "@/core/ui/amount";
import { Eyebrow } from "@/core/ui/eyebrow";
import { useFinancialColors, useHeroColors } from "@/core/ui/scheme-colors";
import { formatCompactAmount } from "@/core/ui/amount-format";
import { useRipple } from "@/core/ui/ripple";
import { ICON_SIZE, RADIUS, SPACING, TOUCH_TARGET } from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";

import {
  varianceLabel,
  verdictSentence,
  type HeroPresentation,
} from "../home-hero-presentation";
import { BalanceTrajectoryChart } from "./balance-trajectory-chart";

interface HomeHeroCardProps {
  /**
   * Passed in rather than derived here: the drift card reads the same verdict to
   * decide whether an envelope overrun was covered elsewhere, and two cards
   * computing it apart is how they end up contradicting each other.
   */
  presentation: HeroPresentation;
  trajectory: BalanceTrajectory | null;
  /** What the chart's captions date: the period the trajectory spans. */
  period: BudgetPeriodDates;
  monthName: string;
  uncheckedCount: number;
  currency: SupportedCurrency;
  onPressMetrics: () => void;
  /** Absent until there is a budget detail to open — the verdict then reads as
   * the sentence it is, with no chevron promising a screen that is not there. */
  onPressDetail?: () => void;
  /**
   * Present only while a next month can be prepared. The forward-looking
   * action sits in the hero's footer, where the eye already is, rather than at
   * the bottom of a page it had to be scrolled to.
   */
  onPrepareNextMonth?: () => void;
}

/**
 * What the month is heading for. The figure is the estimate, the pair under it
 * says what still moves it, and the sentence at the bottom dates the day the
 * month left its plan — the one thing neither the chart nor the numbers show.
 *
 * The mint surface is the same in every state: the verdict is carried by the
 * ink, so a card that also changed colour would say it twice.
 */
export function HomeHeroCard({
  presentation,
  trajectory,
  period,
  monthName,
  uncheckedCount,
  currency,
  onPressMetrics,
  onPressDetail,
  onPrepareNextMonth,
}: HomeHeroCardProps) {
  const hero = useHeroColors();
  const accent = useAccentColor(presentation);
  const ripple = useRipple();
  const { locale, t } = useTranslation();

  function handlePressMetrics() {
    hapticCommit();
    onPressMetrics();
  }

  return (
    <View style={[styles.card, { backgroundColor: hero.surface }]}>
      {/* Eyebrow, then the bare figure — the same grammar as the budget detail
          hero, so the two do not read as two apps. The currency is named once,
          up here, rather than trailing the number at a size of its own. */}
      <View style={styles.amountBlock}>
        <Eyebrow style={{ color: hero.support }}>
          {t("home.hero.estimate", {
            month: monthName,
            currency: CURRENCY_METADATA[currency].symbol,
          })}
        </Eyebrow>
        <Amount size="hero" style={[styles.amount, { color: hero.ink }]}>
          {formatCompactAmount(presentation.estimatedBalance, currency)}
        </Amount>
      </View>

      <Pressable
        onPress={handlePressMetrics}
        android_ripple={ripple}
        accessibilityRole="button"
        accessibilityLabel={t("home.hero.metricsAccessibility", {
          count: uncheckedCount,
          variance: varianceLabel(presentation, currency),
        })}
        accessibilityHint={t("home.hero.metricsHint")}
        style={styles.metrics}
      >
        <Metric
          value={String(uncheckedCount)}
          label={t("home.hero.toCheck")}
          tint={hero.ink}
          supportColor={hero.support}
        />
        <Metric
          value={varianceLabel(presentation, currency)}
          label={t("home.hero.vsPlanned")}
          tint={accent}
          supportColor={hero.support}
          alignEnd
          hasChevron
        />
      </Pressable>

      {trajectory !== null && (
        <BalanceTrajectoryChart
          trajectory={trajectory}
          period={period}
          accent={accent}
          ruleColor={hero.support}
        />
      )}

      {onPressDetail === undefined ? (
        <Text variant="labelLarge" style={{ color: accent }}>
          {verdictSentence(t, locale, presentation)}
        </Text>
      ) : (
        <Pressable
          onPress={onPressDetail}
          android_ripple={ripple}
          accessibilityRole="button"
          accessibilityLabel={t("home.hero.detailAccessibility")}
          style={styles.verdict}
        >
          <Text variant="labelLarge" style={{ color: accent }}>
            {verdictSentence(t, locale, presentation)}
            <Text style={{ color: hero.ink }}>
              {` ${t("home.hero.detail")} `}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={ICON_SIZE.sm}
              color={hero.ink}
            />
          </Text>
        </Pressable>
      )}

      {onPrepareNextMonth !== undefined && (
        <Button
          mode="text"
          icon="chevron-right"
          textColor={hero.ink}
          onPress={onPrepareNextMonth}
          style={styles.footer}
          contentStyle={styles.footerContent}
        >
          {t("home.prepareNextMonth")}
        </Button>
      )}
    </View>
  );
}

function Metric({
  value,
  label,
  tint,
  supportColor,
  alignEnd = false,
  hasChevron = false,
}: {
  value: string;
  label: string;
  tint: string;
  supportColor: string;
  alignEnd?: boolean;
  /** Marks the half of the pair that opens something. */
  hasChevron?: boolean;
}) {
  const align = alignEnd ? "flex-end" : "flex-start";
  return (
    <View style={{ alignItems: align, gap: SPACING.xxs }}>
      <Amount size="row" style={{ color: tint }} numberOfLines={1}>
        {value}
      </Amount>
      <View style={styles.metricLabel}>
        <Text variant="labelMedium" style={{ color: supportColor }}>
          {label}
        </Text>
        {hasChevron && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={ICON_SIZE.sm}
            color={supportColor}
          />
        )}
      </View>
    </View>
  );
}

/**
 * One ink for the gap, the sentence and the plotted line. A month sitting
 * exactly on its plan takes the neutral ink: green is how this card says
 * "better than planned", so spending it on "as planned" would leave nothing to
 * tell the two apart.
 */
function useAccentColor(presentation: HeroPresentation): string {
  const hero = useHeroColors();
  const financial = useFinancialColors();

  if (presentation.verdict === "onPlan") return hero.ink;
  switch (presentation.tone) {
    case "favorable":
      return financial.savings;
    case "caution":
      return financial.overBudget;
    case "deficit":
      return hero.drift;
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  amountBlock: { alignItems: "center", gap: SPACING.xs },
  amount: { textAlign: "center" },
  metrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  metricLabel: { flexDirection: "row", alignItems: "center" },
  verdict: { minHeight: TOUCH_TARGET, justifyContent: "center" },
  footer: { alignSelf: "flex-start", marginLeft: -SPACING.sm },
  // The chevron follows the label: it points at the screen the tap opens.
  footerContent: { flexDirection: "row-reverse" },
});
