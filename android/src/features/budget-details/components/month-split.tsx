import type { SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatAmount } from "@/core/ui/amount-format";
import { useFinancialColors, useV2Colors } from "@/core/ui/scheme-colors";
import { RADIUS, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

const BAR_HEIGHT = 10;
const DOT_SIZE = 8;

interface MonthSplitProps {
  expenses: number;
  savings: number;
  available: number;
  currency: SupportedCurrency;
}

/**
 * Where a month's money goes: one bar (Dépenses / Épargne / Disponible) and its
 * three-column legend — `AvailableSplit.swift`. A negative share draws nothing
 * but keeps its figure in the legend.
 */
export function MonthSplit({
  expenses,
  savings,
  available,
  currency,
}: MonthSplitProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const financial = useFinancialColors();
  const v2 = useV2Colors();
  const parts = [
    { key: "expenses", amount: expenses, color: financial.expense },
    { key: "savings", amount: savings, color: financial.savings },
    { key: "available", amount: available, color: theme.colors.onSurface },
  ];

  return (
    <View style={styles.split}>
      <View style={[styles.track, { backgroundColor: v2.sunk }]}>
        {parts.map((part) => (
          <View
            key={part.key}
            style={{
              flex: Math.max(part.amount, 0),
              backgroundColor: part.color,
            }}
          />
        ))}
      </View>

      <View style={styles.legend}>
        {parts.map((part) => (
          <View
            key={part.key}
            style={styles.column}
            accessible
            accessibilityLabel={`${t(`budgets.detail.hero.split.${part.key}`)} ${formatAmount(part.amount, currency)}`}
          >
            <View style={styles.label}>
              <View style={[styles.dot, { backgroundColor: part.color }]} />
              <Text
                variant="bodySmall"
                numberOfLines={1}
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t(`budgets.detail.hero.split.${part.key}`)}
              </Text>
            </View>
            <Text
              variant="titleSmall"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={TABULAR_DIGITS}
            >
              {formatAmount(part.amount, currency)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  split: { gap: SPACING.md },
  track: {
    flexDirection: "row",
    height: BAR_HEIGHT,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  legend: { flexDirection: "row", gap: SPACING.md },
  column: { flex: 1, gap: SPACING.xxs },
  label: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: RADIUS.full },
});
