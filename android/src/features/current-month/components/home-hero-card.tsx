import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  CURRENCY_METADATA,
  type BalanceTrajectory,
  type BudgetPeriodDates,
  type SupportedCurrency,
} from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { formatCompactAmount } from "@/core/ui/amount-format";
import {
  toggleAmountVisibility,
  useAmountVisibility,
} from "@/core/ui/amount-visibility";
import { hapticCommit } from "@/core/ui/haptics";
import { HeroVerdict } from "@/core/ui/hero";
import { useRipple } from "@/core/ui/ripple";
import { useHeroColors } from "@/core/ui/scheme-colors";
import {
  BRAND_TYPE,
  ICON_SIZE,
  SPACING,
  TABULAR_DIGITS,
  TOUCH_TARGET,
} from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";

import {
  verdictSentence,
  type HeroPresentation,
} from "../home-hero-presentation";
import { BalanceTrajectoryChart } from "./balance-trajectory-chart";

interface HomeHeroCardProps {
  /**
   * Passed in rather than derived here: the drift row reads the same verdict to
   * decide whether an envelope overrun was covered elsewhere, and two cards
   * computing it apart is how they end up contradicting each other.
   */
  presentation: HeroPresentation;
  trajectory: BalanceTrajectory | null;
  /** What the chart's captions date: the period the trajectory spans. */
  period: BudgetPeriodDates;
  currency: SupportedCurrency;
  /**
   * The first month of an account with nothing recorded: no plot to read yet,
   * and the sentence invites instead of judging.
   */
  startsFresh?: boolean;
  onPressCalculation: () => void;
}

/**
 * What the month is heading for, on a white card. The eyebrow names the figure
 * and holds the eye that hides every amount, the figure is the estimate, the
 * chart is how the month got there, and one sentence names the state — the
 * same grammar as `HomeHeroCard.swift`.
 *
 * The surface is the same in every state: the verdict is carried by the accent,
 * so a hero that also changed colour would say it twice.
 */
export function HomeHeroCard({
  presentation,
  trajectory,
  period,
  currency,
  startsFresh = false,
  onPressCalculation,
}: HomeHeroCardProps) {
  const hero = useHeroColors();
  const theme = useTheme();
  const accent = useAccentColor(presentation);
  const { locale, t } = useTranslation();
  const ripple = useRipple({ radius: TOUCH_TARGET / 2 });
  const areHidden = useAmountVisibility((state) => state.areAmountsHidden);

  return (
    <View style={styles.hero}>
      <View style={styles.figure}>
        <View style={styles.header}>
          <Text variant="labelLarge" style={{ color: hero.support }}>
            {t("home.hero.eyebrow")}
          </Text>
          <Pressable
            testID="home-amounts-toggle"
            onPress={toggleAmountVisibility}
            android_ripple={ripple}
            accessibilityRole="button"
            accessibilityLabel={t(
              areHidden ? "home.hero.showAmounts" : "home.hero.hideAmounts",
            )}
            style={styles.eye}
          >
            <MaterialCommunityIcons
              name={areHidden ? "eye-outline" : "eye-off-outline"}
              size={ICON_SIZE.md}
              color={areHidden ? theme.colors.primary : hero.support}
            />
          </Pressable>
          <Button
            mode="text"
            compact
            textColor={theme.colors.primary}
            onPress={() => {
              hapticCommit();
              onPressCalculation();
            }}
            accessibilityHint={t("home.hero.calculationHint")}
            style={styles.calculation}
          >
            {t("home.hero.calculation")}
          </Button>
        </View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          accessibilityLabel={`${formatCompactAmount(presentation.estimatedBalance, currency)} ${CURRENCY_METADATA[currency].symbol}`}
          style={[BRAND_TYPE.heroFigure, TABULAR_DIGITS, { color: hero.ink }]}
        >
          {formatCompactAmount(presentation.estimatedBalance, currency)}
          <Text style={[BRAND_TYPE.heroCurrency, { color: hero.support }]}>
            {` ${CURRENCY_METADATA[currency].symbol}`}
          </Text>
        </Text>
      </View>

      {trajectory !== null && !startsFresh && (
        <BalanceTrajectoryChart
          trajectory={trajectory}
          period={period}
          accent={accent}
          ruleColor={hero.support}
        />
      )}

      <HeroVerdict
        sentence={
          startsFresh
            ? `${t("home.hero.fresh.verdict")} ${t("home.hero.fresh.tail")}`
            : verdictSentence(t, locale, presentation)
        }
        tint={startsFresh ? theme.colors.primary : accent}
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
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  eye: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
    // The eye sits beside its label, not a full target away from it.
    marginVertical: -SPACING.sm,
    marginLeft: -SPACING.sm,
  },
  calculation: { marginLeft: "auto", marginRight: -SPACING.sm },
});
