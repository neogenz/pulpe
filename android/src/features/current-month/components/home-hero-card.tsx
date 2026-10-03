import {
  CURRENCY_METADATA,
  type BalanceTrajectory,
  type BudgetPeriodDates,
  type SupportedCurrency,
} from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { formatCompactAmount } from "@/core/ui/amount-format";
import { hapticCommit } from "@/core/ui/haptics";
import { HeroFigure, HeroTile, HeroTileRow, HeroVerdict } from "@/core/ui/hero";
import { useHeroColors } from "@/core/ui/scheme-colors";
import { SPACING } from "@/core/ui/theme";
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
  daysRemaining: number;
  currency: SupportedCurrency;
  /** Brings the operations to point into view. */
  onPressUnchecked: () => void;
  onPressMetrics: () => void;
  /** Absent until there is a budget detail to open — the verdict then reads as
   * the sentence it is, with no link promising a screen that is not there. */
  onPressDetail?: () => void;
}

/**
 * What the month is heading for, on the forest. The figure is the estimate,
 * the chart is how the month got there, the two tiles say what still moves it,
 * and the sentence names the state — the same grammar as `HomeHeroCard.swift`.
 *
 * The surface is the same in every state: the verdict is carried by the accent,
 * so a hero that also changed colour would say it twice.
 */
export function HomeHeroCard({
  presentation,
  trajectory,
  period,
  monthName,
  uncheckedCount,
  daysRemaining,
  currency,
  onPressUnchecked,
  onPressMetrics,
  onPressDetail,
}: HomeHeroCardProps) {
  const hero = useHeroColors();
  const accent = useAccentColor(presentation);
  const { locale, t } = useTranslation();
  const variance = varianceLabel(presentation, currency);

  return (
    <View style={styles.hero}>
      <View style={styles.figure}>
        <HeroFigure
          eyebrow={t("home.hero.estimate", { month: monthName })}
          amount={formatCompactAmount(presentation.estimatedBalance, currency)}
          currency={CURRENCY_METADATA[currency].symbol}
        />
        <Text variant="bodyMedium" style={{ color: hero.support }}>
          {t("home.periodRemaining", { count: daysRemaining })}
        </Text>
      </View>

      {trajectory !== null && (
        <BalanceTrajectoryChart
          trajectory={trajectory}
          period={period}
          accent={accent}
          ruleColor={hero.support}
        />
      )}

      <HeroTileRow>
        <HeroTile
          value={String(uncheckedCount)}
          label={t("home.hero.toCheck")}
          onPress={uncheckedCount > 0 ? onPressUnchecked : undefined}
          accessibilityLabel={`${uncheckedCount} ${t("home.hero.toCheck")}`}
        />
        <HeroTile
          value={variance}
          label={t("home.hero.vsPlanned")}
          tint={accent}
          onPress={() => {
            hapticCommit();
            onPressMetrics();
          }}
          accessibilityLabel={t("home.hero.metricsAccessibility", {
            count: uncheckedCount,
            variance,
          })}
          accessibilityHint={t("home.hero.metricsHint")}
        />
      </HeroTileRow>

      <HeroVerdict
        sentence={verdictSentence(t, locale, presentation)}
        tint={accent}
        link={
          onPressDetail === undefined
            ? undefined
            : {
                label: t("home.hero.detail"),
                onPress: onPressDetail,
                accessibilityLabel: t("home.hero.detailAccessibility"),
              }
        }
      />
    </View>
  );
}

/**
 * One ink for the gap, the sentence and the plotted line. A month sitting
 * exactly on its plan takes the neutral ink: green is how this hero says
 * "better than planned", so spending it on "as planned" would leave nothing to
 * tell the two apart.
 */
function useAccentColor(presentation: HeroPresentation): string {
  const hero = useHeroColors();

  if (presentation.verdict === "onPlan") return hero.ink;
  switch (presentation.tone) {
    case "favorable":
      return hero.positive;
    case "caution":
      return hero.caution;
    case "deficit":
      return hero.deficit;
  }
}

const styles = StyleSheet.create({
  hero: { gap: SPACING.md },
  figure: { gap: SPACING.xs },
});
