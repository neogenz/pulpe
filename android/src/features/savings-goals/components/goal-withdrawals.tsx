import { router } from "expo-router";
import type {
  SavingsGoalPlannedWithdrawal,
  SavingsGoalPlanOnlyWithdrawal,
  SavingsGoalWithdrawal,
  SupportedCurrency,
} from "pulpe-shared";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Card, Divider, Text, useTheme } from "react-native-paper";

import { formatCurrency } from "@/core/ui/amount-format";
import { formatIsoDate, formatMonthLabel } from "@/core/ui/date-format";
import { FINANCIAL_COLORS, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

const PLANNED_STATUS_LABELS: Record<
  SavingsGoalPlannedWithdrawal["status"],
  string
> = {
  planned: "À réaliser",
  partially_realized: "Partiellement réalisé",
  realized: "Réalisé",
};

interface GoalWithdrawalsProps {
  realized: SavingsGoalWithdrawal[];
  planned: SavingsGoalPlannedWithdrawal[];
  planOnly: SavingsGoalPlanOnlyWithdrawal[];
  currency: SupportedCurrency;
}

/**
 * "Retraits" — money taken back out of the goal, announced and actual.
 *
 * Amounts travel positive on the wire; the minus sign is this screen's
 * decision. Announcing a withdrawal never rewrites the plan: it lowers the
 * stock, which is why the two lists sit side by side rather than merging.
 */
export function GoalWithdrawals({
  realized,
  planned,
  planOnly,
  currency,
}: GoalWithdrawalsProps) {
  const theme = useTheme();

  if (realized.length === 0 && planned.length === 0 && planOnly.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text variant="titleMedium">Retraits</Text>

      {(planned.length > 0 || planOnly.length > 0) && (
        <>
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Retraits planifiés
          </Text>
          <Card mode="contained">
            <Card.Content style={styles.card}>
              {planned.map((withdrawal, index) => (
                <View key={withdrawal.budgetLineId}>
                  {index > 0 && <Divider />}
                  <PlannedRow withdrawal={withdrawal} currency={currency} />
                </View>
              ))}
              {planOnly.map((withdrawal, index) => (
                <View key={withdrawal.planWithdrawalId}>
                  {(index > 0 || planned.length > 0) && <Divider />}
                  <WithdrawalRow
                    title={withdrawal.name}
                    subtitle={`${formatMonthLabel(withdrawal.month, withdrawal.year)} · Prévu dans le plan`}
                    amount={withdrawal.plannedAmount}
                    currency={currency}
                  />
                </View>
              ))}
            </Card.Content>
          </Card>
        </>
      )}

      {realized.length > 0 && (
        <>
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Retraits réalisés
          </Text>
          <Card mode="contained">
            <Card.Content style={styles.card}>
              {realized.map((withdrawal, index) => (
                <View key={withdrawal.transactionId}>
                  {index > 0 && <Divider />}
                  <RealizedRow withdrawal={withdrawal} currency={currency} />
                </View>
              ))}
            </Card.Content>
          </Card>
        </>
      )}
    </View>
  );
}

function PlannedRow({
  withdrawal,
  currency,
}: {
  withdrawal: SavingsGoalPlannedWithdrawal;
  currency: SupportedCurrency;
}) {
  const period = formatMonthLabel(withdrawal.month, withdrawal.year);
  const status = PLANNED_STATUS_LABELS[withdrawal.status];
  const detail =
    withdrawal.status === "planned"
      ? status
      : `${status} · Prévu ${formatCurrency(withdrawal.plannedAmount, currency)} · Réalisé ${formatCurrency(withdrawal.realizedAmount, currency)}`;

  return (
    <WithdrawalRow
      title={withdrawal.name}
      subtitle={`${period} · ${detail}`}
      amount={withdrawal.remainingAmount}
      currency={currency}
      onPress={() => router.push(`/budget/${withdrawal.budgetId}`)}
    />
  );
}

function RealizedRow({
  withdrawal,
  currency,
}: {
  withdrawal: SavingsGoalWithdrawal;
  currency: SupportedCurrency;
}) {
  const isChecked = (withdrawal.checkedAt ?? null) !== null;
  const day = formatIsoDate(withdrawal.transactionDate.slice(0, 10));

  return (
    <WithdrawalRow
      title={withdrawal.name}
      subtitle={`${day} · ${isChecked ? "Pointé" : "À pointer"}`}
      amount={withdrawal.amount}
      currency={currency}
      onPress={() => router.push(`/budget/${withdrawal.budgetId}`)}
    />
  );
}

function WithdrawalRow({
  title,
  subtitle,
  amount,
  currency,
  onPress,
}: {
  title: string;
  subtitle: string;
  amount: number;
  currency: SupportedCurrency;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  const row = (
    <View style={styles.row}>
      <View style={styles.rowLabels}>
        <Text variant="bodyLarge">{title}</Text>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {subtitle}
        </Text>
      </View>

      <Text
        variant="bodyLarge"
        style={[TABULAR_DIGITS, { color: FINANCIAL_COLORS[scheme].expense }]}
      >
        −{formatCurrency(amount, currency)}
      </Text>
    </View>
  );

  if (onPress === undefined) return row;

  return (
    <Card
      mode="contained"
      onPress={onPress}
      accessibilityLabel={`Ouvrir le budget de ${title}`}
      style={styles.pressable}
    >
      {row}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm },
  card: { paddingVertical: SPACING.xs },
  pressable: { backgroundColor: "transparent" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  rowLabels: { flex: 1, gap: SPACING.xxs },
});
