import {
  CURRENCY_METADATA,
  type SavingsGoalProgress,
  type SavingsGoalStatus,
  type SupportedCurrency,
} from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatCompactAmount } from "@/core/ui/amount-format";
import { HeroFigure, HeroProgress } from "@/core/ui/hero";
import { useHeroColors } from "@/core/ui/scheme-colors";
import { SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

import { goalHero } from "../goal-presentation";

interface GoalProgressCardProps {
  progress: SavingsGoalProgress;
  status: SavingsGoalStatus;
  currency: SupportedCurrency;
}

/**
 * Where a goal stands — `GoalProgressHero.swift`: what is saved against the
 * target, the span it runs over and the bar. The pace sentence lives in
 * « Ce mois-ci », not here.
 */
export function GoalProgressCard({
  progress,
  status,
  currency,
}: GoalProgressCardProps) {
  const hero = useHeroColors();
  const { locale, t } = useTranslation();
  const presentation = goalHero(progress, status, { t, locale, currency });

  return (
    <View style={styles.hero}>
      <View style={styles.identity}>
        <HeroFigure
          eyebrow={t("goals.progress.saved")}
          amount={formatCompactAmount(progress.confirmed, currency)}
          currency={CURRENCY_METADATA[currency].symbol}
        />
        {presentation.caption !== null && (
          <Text variant="bodyMedium" style={{ color: hero.support }}>
            {presentation.caption}
          </Text>
        )}
        {presentation.dateLine !== null && (
          <Text variant="bodyMedium" style={{ color: hero.support }}>
            {presentation.dateLine}
          </Text>
        )}
      </View>

      {presentation.bar !== null && (
        <View style={styles.bar}>
          <HeroProgress
            progress={presentation.bar.fraction}
            label={`${presentation.bar.percent} %`}
            accessibilityLabel={[
              t("goals.hero.barAccessibility", {
                percent: `${presentation.bar.percent} %`,
              }),
              presentation.bar.trailing,
            ]
              .filter(Boolean)
              .join(", ")}
          />
          {presentation.bar.trailing !== null && (
            <Text
              variant="bodyMedium"
              style={[TABULAR_DIGITS, { color: hero.support }]}
            >
              {presentation.bar.trailing}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: SPACING.md },
  identity: { gap: SPACING.xs },
  bar: { gap: SPACING.xs },
});
