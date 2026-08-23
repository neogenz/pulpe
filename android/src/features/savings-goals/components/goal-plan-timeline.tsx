import type { SavingsGoalPlanMonth, SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";

import { Card } from "@/core/ui/card";
import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthLabel } from "@/core/ui/date-format";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { SPACING } from "@/core/ui/theme";

import { monthAvailability, monthState, planTimeline } from "../plan-timeline";

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
  const { t } = useTranslation();
  const [isExpanded, setExpanded] = useState(false);
  const timeline = planTimeline(months, isExpanded);

  if (months.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.headerTitle}>
          {t("goals.plan.title")}
        </Text>
        {onAdjust !== undefined && (
          <Button
            mode="text"
            icon="tune-variant"
            onPress={onAdjust}
            accessibilityLabel={t("goals.plan.adjustAccessibility")}
          >
            {t("goals.plan.adjust")}
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
            ? t("goals.plan.showLess")
            : t("goals.plan.showAll", { count: months.length })}
        </Button>
      )}

      {timeline.remainingUnlinkedMonthCount > 0 && (
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("goals.plan.unlinked", {
            count: timeline.remainingUnlinkedMonthCount,
          })}
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
  const { locale, t } = useTranslation();
  const financial = useFinancialColors();
  const savings = financial.savings;

  const isCurrent = month.state === "current";
  const isPast = month.state === "past";
  const availability = monthAvailability(month);
  const state = monthState(month);
  const plannedWithdrawal = month.plannedWithdrawalAmount ?? 0;

  // A month steps back through its ink, never through the row's opacity: 0.55
  // laid over the whole row took its metadata to 2.70:1, which is the failure
  // `budget-line-row.tsx` already names — a month someone scrolls back to is
  // not decoration. `onSurfaceVariant` recedes at 8.35:1.
  const labelColor = isCurrent
    ? savings
    : isPast
      ? theme.colors.onSurfaceVariant
      : undefined;

  return (
    <View style={styles.row}>
      <View style={styles.rowLabels}>
        <Text variant="bodyLarge" style={{ color: labelColor }}>
          {formatMonthLabel(month.month, month.year, locale)}
        </Text>

        <View style={styles.meta}>
          {isCurrent && (
            <Text variant="labelSmall" style={{ color: savings }}>
              {t("goals.plan.thisMonth")}
            </Text>
          )}
          {state !== null && (
            <Text
              variant="labelSmall"
              style={{
                color:
                  state === "checked" ? savings : theme.colors.onSurfaceVariant,
              }}
            >
              {t(`goals.plan.state.${state}`)}
            </Text>
          )}
          {availability !== "linked" && (
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t(`goals.plan.availability.${availability}`)}
            </Text>
          )}
        </View>

        {plannedWithdrawal > 0 && (
          <Amount size="meta" tone="muted">
            {t("goals.plan.withdrawal", {
              amount: formatCurrency(plannedWithdrawal, currency),
            })}
          </Amount>
        )}
      </View>

      <Amount size="row">
        {formatCurrency(month.plannedAmount, currency)}
      </Amount>
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
  meta: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" },
});
