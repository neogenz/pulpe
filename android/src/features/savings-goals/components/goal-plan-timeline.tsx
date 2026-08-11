import type { SavingsGoalPlanMonth, SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Button, Card, Divider, Text, useTheme } from "react-native-paper";

import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { FINANCIAL_COLORS, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

import {
  AVAILABILITY_LABELS,
  MONTH_STATE_LABELS,
  monthAvailability,
  monthState,
  planTimeline,
} from "../plan-timeline";

const DIMMED_OPACITY = 0.55;

interface GoalPlanTimelineProps {
  months: SavingsGoalPlanMonth[];
  currency: SupportedCurrency;
  /** Absent when the goal cannot be adjusted — paused, achieved, or over. */
  onAdjust?: () => void;
}

/**
 * "Ton plan, mois par mois" — what the goal asks of each month, starting from
 * this one.
 *
 * It opens on four rows and unfolds on request: a goal can run for eight years,
 * and a screen that starts with ninety-six rows has spent the reader before it
 * says anything.
 */
export function GoalPlanTimeline({
  months,
  currency,
  onAdjust,
}: GoalPlanTimelineProps) {
  const theme = useTheme();
  const [isExpanded, setExpanded] = useState(false);
  const timeline = planTimeline(months, isExpanded);

  if (months.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.headerTitle}>
          Ton plan, mois par mois
        </Text>
        {onAdjust !== undefined && (
          <Button
            mode="text"
            icon="tune-variant"
            onPress={onAdjust}
            accessibilityLabel="Ajuster le plan"
          >
            Ajuster
          </Button>
        )}
      </View>

      <Card mode="contained">
        <Card.Content style={styles.card}>
          {timeline.visibleMonths.map((month, index) => (
            <View key={`${month.year}-${month.month}`}>
              {index > 0 && <Divider />}
              <MonthRow month={month} currency={currency} />
            </View>
          ))}
        </Card.Content>
      </Card>

      {timeline.canToggle && (
        <Button
          mode="text"
          icon={isExpanded ? "chevron-up" : "chevron-down"}
          onPress={() => setExpanded((current) => !current)}
        >
          {isExpanded
            ? "Voir moins"
            : `Voir tout le plan (${months.length} mois)`}
        </Button>
      )}

      {timeline.remainingUnlinkedMonthCount > 0 && (
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {timeline.remainingUnlinkedMonthCount} mois restants sans prévision
          liée à cet objectif.
        </Text>
      )}
    </View>
  );
}

function MonthRow({
  month,
  currency,
}: {
  month: SavingsGoalPlanMonth;
  currency: SupportedCurrency;
}) {
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const savings = FINANCIAL_COLORS[scheme].savings;

  const isCurrent = month.state === "current";
  const isPast = month.state === "past";
  const availability = monthAvailability(month);
  const availabilityLabel = AVAILABILITY_LABELS[availability];
  const state = monthState(month);
  const plannedWithdrawal = month.plannedWithdrawalAmount ?? 0;

  return (
    <View style={[styles.row, isPast && { opacity: DIMMED_OPACITY }]}>
      <View style={styles.rowLabels}>
        <Text
          variant="bodyLarge"
          style={[styles.month, isCurrent && { color: savings }]}
        >
          {formatMonthName(month.month, month.year)} {month.year}
        </Text>

        <View style={styles.meta}>
          {isCurrent && (
            <Text variant="labelSmall" style={{ color: savings }}>
              Ce mois
            </Text>
          )}
          {state !== null && (
            <Text
              variant="labelSmall"
              style={{
                color: state === "checked" ? savings : theme.colors.outline,
              }}
            >
              {MONTH_STATE_LABELS[state]}
            </Text>
          )}
          {availabilityLabel !== null && (
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {availabilityLabel}
            </Text>
          )}
        </View>

        {plannedWithdrawal > 0 && (
          <Text
            variant="labelSmall"
            style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
          >
            dont {formatCurrency(plannedWithdrawal, currency)} à sortir
          </Text>
        )}
      </View>

      <Text variant="bodyLarge" style={TABULAR_DIGITS}>
        {formatCurrency(month.plannedAmount, currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  headerTitle: { flex: 1 },
  card: { paddingVertical: SPACING.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  rowLabels: { flex: 1, gap: SPACING.xxs },
  month: { textTransform: "capitalize" },
  meta: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" },
});
