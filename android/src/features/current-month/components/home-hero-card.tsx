import {
  CURRENCY_METADATA,
  type BalanceTrajectory,
  type SupportedCurrency,
} from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { hapticCommit } from "@/core/ui/haptics";
import { Amount } from "@/core/ui/amount";
import { Eyebrow } from "@/core/ui/eyebrow";
import { useFinancialColors, useHeroColors } from "@/core/ui/scheme-colors";
import { formatCompactAmount } from "@/core/ui/amount-format";
import { useRipple } from "@/core/ui/ripple";
import { RADIUS, SPACING, TOUCH_TARGET } from "@/core/ui/theme";

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
  const hero = useHeroColors();
  const accent = useAccentColor(presentation);
  const ripple = useRipple();

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
          {`Estimé fin ${monthName} · ${CURRENCY_METADATA[currency].symbol}`}
        </Eyebrow>
        <Amount size="hero" style={[styles.amount, { color: hero.ink }]}>
          {formatCompactAmount(presentation.estimatedBalance, currency)}
        </Amount>
      </View>

      <Pressable
        onPress={handlePressMetrics}
        android_ripple={ripple}
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
          android_ripple={ripple}
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
      <Amount size="row" style={{ color: tint }} numberOfLines={1}>
        {value}
      </Amount>
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
  verdict: { minHeight: TOUCH_TARGET, justifyContent: "center" },
});
