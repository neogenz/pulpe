import type { SupportedCurrency, Transaction } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { Amount } from "@/core/ui/amount";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatDayMonth } from "@/core/ui/date-format";
import { useRipple } from "@/core/ui/ripple";
import { RADIUS, SPACING } from "@/core/ui/theme";

import { PointCircle } from "./point-circle";

const KIND_ACCENTS = {
  income: "income",
  expense: "expense",
  saving: "savings",
} as const;

interface TransactionRowProps {
  transaction: Transaction;
  currency: SupportedCurrency;
  isSyncing: boolean;
  tagSummary: string | null;
  onToggle: () => void;
  /** Opens the operation for correction; absent where it cannot be edited. */
  onPress?: () => void;
}

/** A spend that answers to no envelope: date, name, amount, and its ring. */
export function TransactionRow({
  transaction,
  currency,
  isSyncing,
  tagSummary,
  onToggle,
  onPress,
}: TransactionRowProps) {
  const theme = useTheme();
  const ripple = useRipple();
  const financial = useFinancialColors();
  const isChecked = transaction.checkedAt !== null;
  const accent = financial[KIND_ACCENTS[transaction.kind]];

  return (
    <View style={[styles.row, { backgroundColor: theme.colors.surface }]}>
      <PointCircle
        isChecked={isChecked}
        color={accent}
        isSyncing={isSyncing}
        label={transaction.name}
        onToggle={onToggle}
      />

      <Pressable
        style={styles.labels}
        onPress={onPress}
        android_ripple={ripple}
        disabled={onPress === undefined}
        accessibilityRole={onPress === undefined ? undefined : "button"}
        accessibilityLabel={
          onPress === undefined ? undefined : `Modifier ${transaction.name}`
        }
      >
        <Text
          variant="bodyLarge"
          numberOfLines={1}
          style={isChecked && styles.struck}
        >
          {transaction.name}
        </Text>
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {tagSummary === null
            ? formatDayMonth(new Date(transaction.transactionDate))
            : `${formatDayMonth(new Date(transaction.transactionDate))} · ${tagSummary}`}
        </Text>
      </Pressable>

      <Amount size="row" style={{ color: accent }} numberOfLines={1}>
        {formatCurrency(transaction.amount, currency)}
      </Amount>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingRight: SPACING.md,
    borderRadius: RADIUS.card,
  },
  /** Struck through, never dimmed — see the note in `budget-line-row.tsx`. */
  struck: { textDecorationLine: "line-through" },
  labels: { flex: 1, gap: SPACING.xxs, paddingVertical: SPACING.sm },
});
