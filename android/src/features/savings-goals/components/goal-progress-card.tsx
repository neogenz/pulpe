import type { SavingsGoalProgress, SupportedCurrency } from "pulpe-shared";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Card, Icon, ProgressBar, Text, useTheme } from "react-native-paper";

import { formatCompactCurrency, formatCurrency } from "@/core/ui/amount-format";
import { formatIsoDate } from "@/core/ui/date-format";
import {
  FINANCIAL_COLORS,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";

import {
  confirmedFraction,
  currentMonthPlannedAmount,
  hasClosedPlanMonth,
  PACE_ICONS,
  PACE_LABELS,
  plannedFraction,
  requiredMatchesPlannedPace,
} from "../goals-vm";

const ICON_SIZE = 18;

interface GoalProgressCardProps {
  progress: SavingsGoalProgress;
  currency: SupportedCurrency;
}

/**
 * Where a goal stands: what is confirmed, what the plan still promises, and
 * whether the deadline is holding.
 *
 * The pace verdict stays silent until a plan month has closed — judging a goal
 * created this morning on a month nobody has lived yet would be noise. Until
 * then the card says what to put aside now, which is the only actionable thing
 * on day one.
 */
export function GoalProgressCard({
  progress,
  currency,
}: GoalProgressCardProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const savings = FINANCIAL_COLORS[scheme].savings;

  const isJudgeable = hasClosedPlanMonth(progress.months);
  const currentPlanned = currentMonthPlannedAmount(progress.months);
  const confirmed = confirmedFraction(progress) ?? 0;
  const planned = plannedFraction(progress) ?? 0;

  return (
    <Card mode="contained">
      <Card.Content style={styles.content}>
        <View style={styles.headline}>
          <View style={styles.headlineLabels}>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Épargné
            </Text>
            <Text
              variant="headlineSmall"
              style={[TABULAR_DIGITS, { color: savings }]}
            >
              {formatCompactCurrency(progress.confirmed, currency)}
            </Text>
          </View>

          {progress.targetAmount !== null && (
            <Text
              variant="labelMedium"
              style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
            >
              sur {formatCurrency(progress.targetAmount, currency)}
            </Text>
          )}
        </View>

        {progress.targetAmount !== null && (
          <View
            accessible
            accessibilityLabel={`${progress.achievementPercent ?? 0}% de la cible épargné`}
          >
            {/* Two bars stacked: the plan behind, what is actually confirmed in
                front. Paper's ProgressBar has no layers of its own. */}
            <View style={styles.barStack}>
              <ProgressBar
                progress={planned}
                color={`${savings}66`}
                style={styles.bar}
              />
              <ProgressBar
                progress={confirmed}
                color={savings}
                style={[styles.bar, styles.barOverlay]}
              />
            </View>
          </View>
        )}

        {progress.paceStatus !== null && isJudgeable && (
          <View style={styles.pace}>
            <Icon
              source={PACE_ICONS[progress.paceStatus]}
              size={ICON_SIZE}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              variant="labelLarge"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {PACE_LABELS[progress.paceStatus]}
            </Text>
          </View>
        )}

        {progress.paceStatus !== null &&
          !isJudgeable &&
          currentPlanned !== null && (
            <View style={styles.pace}>
              <Icon
                source="check-circle-outline"
                size={ICON_SIZE}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="labelLarge"
                style={[
                  styles.paceText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Ton plan est prêt — {formatCurrency(currentPlanned, currency)} à
                mettre de côté ce mois.
              </Text>
            </View>
          )}

        <View style={styles.stats}>
          {progress.initialAmount > 0 && (
            <StatRow
              label="Montant de départ"
              value={formatCompactCurrency(progress.initialAmount, currency)}
            />
          )}
          <StatRow
            label="Déjà prévu"
            value={formatCompactCurrency(progress.plannedCumulative, currency)}
            swatch={`${savings}66`}
          />
          <StatRow
            label="Projection du plan"
            value={formatCompactCurrency(progress.plannedProjection, currency)}
          />
          {progress.required !== null &&
            isJudgeable &&
            (requiredMatchesPlannedPace(progress.pace, progress.required) ? (
              <StatRow
                label="Pour tenir ton échéance"
                value={`${formatCompactCurrency(progress.required, currency)} / mois`}
              />
            ) : (
              <Text
                variant="labelMedium"
                style={[
                  TABULAR_DIGITS,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Ton rythme prévu :{" "}
                {formatCompactCurrency(progress.pace, currency)}/mois ·{" "}
                {progress.targetDate === null
                  ? "pour tenir ton échéance"
                  : `pour finir le ${formatIsoDate(progress.targetDate)}`}
                , vise {formatCompactCurrency(progress.required, currency)}/mois
              </Text>
            ))}
        </View>
      </Card.Content>
    </Card>
  );
}

function StatRow({
  label,
  value,
  swatch,
}: {
  label: string;
  value: string;
  swatch?: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.statRow}>
      {swatch !== undefined && (
        <View style={[styles.swatch, { backgroundColor: swatch }]} />
      )}
      <Text
        variant="labelMedium"
        style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}
      >
        {label}
      </Text>
      <Text variant="labelLarge" style={TABULAR_DIGITS}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACING.md },
  headline: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  headlineLabels: { gap: SPACING.xxs },
  barStack: { position: "relative", justifyContent: "center" },
  bar: { height: SPACING.sm, borderRadius: RADIUS.sm },
  barOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "transparent",
  },
  pace: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  paceText: { flex: 1 },
  stats: { gap: SPACING.sm },
  statRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  statLabel: { flex: 1 },
  swatch: { width: SPACING.sm, height: SPACING.sm, borderRadius: RADIUS.xs },
});
