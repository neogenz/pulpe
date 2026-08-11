import * as Haptics from "expo-haptics";
import {
  CURRENCY_METADATA,
  type BalanceTrajectory,
  type SupportedCurrency,
} from "pulpe-shared";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { Text } from "react-native-paper";

import { formatCompactAmount } from "@/core/ui/amount-format";
import {
  FINANCIAL_COLORS,
  HOME_HERO_COLORS,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";

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
  monthName: string;
  uncheckedCount: number;
  currency: SupportedCurrency;
  onPressMetrics: () => void;
  /** Absent until there is a budget detail to open — the verdict then reads as
   * the sentence it is, with no chevron promising a screen that is not there. */
  onPressDetail?: () => void;
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
  monthName,
  uncheckedCount,
  currency,
  onPressMetrics,
  onPressDetail,
}: HomeHeroCardProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const hero = HOME_HERO_COLORS[scheme];
  const accent = accentColor(presentation, scheme);

  function handlePressMetrics() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    onPressMetrics();
  }

  return (
    <View style={[styles.card, { backgroundColor: hero.surface }]}>
      <View style={styles.amountBlock}>
        <Text
          variant="displayMedium"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.amount, TABULAR_DIGITS, { color: hero.ink }]}
        >
          {formatCompactAmount(presentation.estimatedBalance, currency)}
          <Text variant="headlineSmall" style={{ color: hero.ink }}>
            {` ${CURRENCY_METADATA[currency].symbol}`}
          </Text>
        </Text>
        <Text variant="labelMedium" style={{ color: hero.support }}>
          {`estimé fin ${monthName}`}
        </Text>
      </View>

      <Pressable
        onPress={handlePressMetrics}
        accessibilityRole="button"
        accessibilityLabel={`${uncheckedCount} à pointer, ${varianceLabel(presentation, currency)} par rapport au prévu`}
        accessibilityHint="Ouvrir le suivi du réalisé"
        style={styles.metrics}
      >
        <Metric
          value={String(uncheckedCount)}
          label="à pointer"
          tint={hero.ink}
          supportColor={hero.support}
        />
        <Metric
          value={varianceLabel(presentation, currency)}
          label="vs prévu ›"
          tint={accent}
          supportColor={hero.support}
          alignEnd
        />
      </Pressable>

      {trajectory !== null && (
        <BalanceTrajectoryChart
          trajectory={trajectory}
          accent={accent}
          ruleColor={hero.support}
        />
      )}

      {onPressDetail === undefined ? (
        <Text variant="labelLarge" style={{ color: accent }}>
          {verdictSentence(presentation)}
        </Text>
      ) : (
        <Pressable
          onPress={onPressDetail}
          accessibilityRole="button"
          accessibilityLabel="Voir le détail du budget"
          style={styles.verdict}
        >
          <Text variant="labelLarge" style={{ color: accent }}>
            {verdictSentence(presentation)}
            <Text style={{ color: hero.ink }}> Voir le détail ›</Text>
          </Text>
        </Pressable>
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
}: {
  value: string;
  label: string;
  tint: string;
  supportColor: string;
  alignEnd?: boolean;
}) {
  const align = alignEnd ? "flex-end" : "flex-start";
  return (
    <View style={{ alignItems: align, gap: SPACING.xxs }}>
      <Text
        variant="titleMedium"
        numberOfLines={1}
        style={[TABULAR_DIGITS, { color: tint }]}
      >
        {value}
      </Text>
      <Text variant="labelMedium" style={{ color: supportColor }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * One ink for the gap, the sentence and the plotted line. A month sitting
 * exactly on its plan takes the neutral ink: green is how this card says
 * "better than planned", so spending it on "as planned" would leave nothing to
 * tell the two apart.
 */
function accentColor(
  presentation: HeroPresentation,
  scheme: "light" | "dark",
): string {
  if (presentation.verdict === "onPlan") return HOME_HERO_COLORS[scheme].ink;
  switch (presentation.tone) {
    case "favorable":
      return FINANCIAL_COLORS[scheme].savings;
    case "caution":
      return FINANCIAL_COLORS[scheme].overBudget;
    case "deficit":
      return HOME_HERO_COLORS[scheme].drift;
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
  verdict: { minHeight: 44, justifyContent: "center" },
});
