import { type SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { FINANCIAL_COLORS, RADIUS, SPACING } from "@/core/ui/theme";

type Accent = keyof (typeof FINANCIAL_COLORS)["light"];

/**
 * What the answers on this step add up to, updated as they are given. The whole
 * point of asking three questions instead of one is that the user watches the
 * number move.
 */
export function RunningTotal({
  label,
  amount,
  accent,
  currency,
}: {
  label: string;
  amount: number;
  accent: Accent;
  currency: SupportedCurrency;
}) {
  const theme = useTheme();
  const color = useFinancialColors()[accent];

  if (amount <= 0) return null;

  return (
    <View
      style={[styles.row, { backgroundColor: theme.colors.surfaceVariant }]}
      accessibilityRole="summary"
    >
      <Text variant="labelLarge">{label}</Text>
      <Amount size="row" style={{ color }}>
        {/* Decimals, not the compact form the summary screens use: this
            restates amounts the user is entering on this very step, and a
            total that rounds what they typed reads as a mistyped entry. */}
        {formatCurrency(amount, currency)}
      </Amount>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.md,
    borderRadius: RADIUS.card,
  },
});
