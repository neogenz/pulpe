import type { SavingsGoalProgress, SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Icon, ProgressBar, Text, useTheme } from "react-native-paper";

import { Card } from "@/core/ui/card";
import { Amount } from "@/core/ui/amount";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { formatIsoDate } from "@/core/ui/date-format";
import { ICON_SIZE, RADIUS, SPACING } from "@/core/ui/theme";

import {
  confirmedFraction,
  currentMonthPlannedAmount,
  hasClosedPlanMonth,
  PACE_ICONS,
  PACE_LABELS,
  plannedFraction,
  requiredMatchesPlannedPace,
} from "../goals-vm";

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
  const financial = useFinancialColors();
  const savings = financial.savings;

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
            <Amount size="hero" style={{ color: savings }}>
              {formatCompactCurrency(progress.confirmed, currency)}
            </Amount>
          </View>

          {progress.targetAmount !== null && (
            <Amount size="meta" tone="muted">
              sur {formatCompactCurrency(progress.targetAmount, currency)}
            </Amount>
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
              size={ICON_SIZE.md}
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
                size={ICON_SIZE.md}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="labelLarge"
                style={[
                  styles.paceText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Ton plan est prêt —{" "}
                {formatCompactCurrency(currentPlanned, currency)} à mettre de
                côté ce mois.
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
              <Amount size="meta" tone="muted">
                Ton rythme prévu :{" "}
                {formatCompactCurrency(progress.pace, currency)}/mois ·{" "}
                {progress.targetDate === null
                  ? "pour tenir ton échéance"
                  : `pour finir le ${formatIsoDate(progress.targetDate)}`}
                , vise {formatCompactCurrency(progress.required, currency)}/mois
              </Amount>
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
      <Amount size="meta">{value}</Amount>
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
  // The column that yields. Nothing in a row shrinks unless it is told to, so
  // the hero used to measure at its natural width and push the target clean out
  // of the card — a six-figure goal printed "sur 200'000 CHF" past the rounded
  // edge, on the screen that exists to compare the two. The target keeps its
  // width; the hero is the one that can afford to lose a few points of type.
  headlineLabels: { flexShrink: 1, gap: SPACING.xxs },
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
